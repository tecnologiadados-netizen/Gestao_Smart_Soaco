/**
 * DFC — Projeção de Receitas (1.1.3) e sublinhas.
 * 1.1.3.1 Projeção de Receita Carteira: Saldo a Receber (mesma regra da Carteira Financeira),
 *         rateado pelos dias de condicaopagamento.regra a partir da previsão do Gerenciador.
 * 1.1.3.2 / 1.1.3.4: placeholders (sem regra ainda).
 */

import { getNomusPool } from '../config/nomusDb.js';
import { queryCarteiraFinanceira } from './carteiraFinanceiraRepository.js';
import { ajustarDataProjVencFimSemana } from './dfcDateUtils.js';

export const DFC_NOME_PROJECAO_RECEITAS = 'Projeção de Receitas';
export const DFC_NOME_PROJECAO_RECEITA_CARTEIRA = 'Projeção de Receita Carteira';
export const DFC_NOME_PROJECAO_ENTRADAS = 'Projeção de Entradas';
export const DFC_NOME_PROJECAO_VENDAS_AVISTA = 'Projeção de Vendas à Vista';

export const DFC_SUBLINHAS_PROJECAO_RECEITAS = [
  DFC_NOME_PROJECAO_RECEITA_CARTEIRA,
  DFC_NOME_PROJECAO_ENTRADAS,
  DFC_NOME_PROJECAO_VENDAS_AVISTA,
] as const;

export type DfcProjecaoReceitasSublinha = (typeof DFC_SUBLINHAS_PROJECAO_RECEITAS)[number];

/** Só Aço — mesma empresa da projeção histórica de PDs. */
const ID_EMPRESA_PROJECAO = 1;

const CACHE_MS = 90_000;
let cacheParcelas: { at: number; parcelas: DfcProjecaoReceitaParcelaLinha[] } | null = null;

export type DfcProjecaoReceitaParcelaLinha = {
  sublinha: DfcProjecaoReceitasSublinha;
  idEmpresa: number;
  idPedido: number;
  pd: string | null;
  cliente: string | null;
  condicaoPagamento: string | null;
  regra: string | null;
  diasRegra: number;
  indiceParcela: number;
  qtdeParcelas: number;
  saldoAReceberTotal: number;
  valorParcela: number;
  dataPrevisao: string | null;
  dataProjVenc: string;
  uf: string | null;
  vendedorRepresentante: string | null;
};

/**
 * Parseia `condicaopagamento.regra` (ex.: "0,30,45,60" ou "30;45;60").
 * Zeros (entrada) são ignorados quando há prazos > 0 — o Saldo a Receber já desconta adiantamento.
 * Sem prazos positivos → [0] (cai na data da previsão).
 */
export function parseRegraCondicaoPagamento(regra: string | null | undefined): number[] {
  if (regra == null || !String(regra).trim()) return [0];
  const dias = String(regra)
    .split(/[,;/|]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => Number(String(p).replace(/[^\d.-]/g, '')))
    .filter((n) => Number.isFinite(n) && n >= 0)
    .map((n) => Math.trunc(n));
  const positivos = dias.filter((d) => d > 0);
  if (positivos.length > 0) return positivos;
  return [0];
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return ymd.slice(0, 10);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function hojeYmdLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function bucketPeriodo(ymd: string, granularidade: 'dia' | 'mes'): string {
  return granularidade === 'mes' ? ymd.slice(0, 7) : ymd.slice(0, 10);
}

type PedidoAgg = {
  idPedido: number;
  idEmpresa: number;
  pd: string | null;
  cliente: string | null;
  condicaoPagamento: string | null;
  previsao: string | null;
  saldoAReceber: number;
  uf: string | null;
  vendedorRepresentante: string | null;
};

async function carregarRegrasPorPedido(
  idsPedido: number[],
): Promise<Map<number, { regra: string | null; condicao: string | null }>> {
  const out = new Map<number, { regra: string | null; condicao: string | null }>();
  if (idsPedido.length === 0) return out;
  const pool = getNomusPool();
  if (!pool) return out;

  const placeholders = idsPedido.map(() => '?').join(', ');
  const sql = `
SELECT
  pd.id AS idPedido,
  cp.regra AS regra,
  cp.nome AS condicao
FROM pedido pd
LEFT JOIN condicaopagamento cp ON cp.id = pd.idCondicaoPagamento
WHERE pd.id IN (${placeholders})
`.trim();

  try {
    const [rows] = await pool.query(sql, idsPedido);
    const list = Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
    for (const r of list) {
      const id = Number(r.idPedido ?? r['idPedido']);
      if (!Number.isFinite(id) || id <= 0) continue;
      const regra = r.regra != null ? String(r.regra).trim() || null : null;
      const condicao = r.condicao != null ? String(r.condicao).trim() || null : null;
      out.set(Math.trunc(id), { regra, condicao });
    }
  } catch (err) {
    console.error('[carregarRegrasPorPedido]', err instanceof Error ? err.message : err);
  }
  return out;
}

function montarParcelasCarteira(
  pedidos: PedidoAgg[],
  regras: Map<number, { regra: string | null; condicao: string | null }>,
): DfcProjecaoReceitaParcelaLinha[] {
  const parcelas: DfcProjecaoReceitaParcelaLinha[] = [];
  for (const p of pedidos) {
    if (p.saldoAReceber <= 0 || !p.previsao) continue;
    const meta = regras.get(p.idPedido);
    const regraStr = meta?.regra ?? null;
    const condicao = meta?.condicao ?? p.condicaoPagamento;
    const diasList = parseRegraCondicaoPagamento(regraStr);
    const n = diasList.length;
    if (n <= 0) continue;
    const valorParcela = p.saldoAReceber / n;
    diasList.forEach((dias, idx) => {
      const raw = addDaysYmd(p.previsao!, dias);
      const dataProjVenc = ajustarDataProjVencFimSemana(raw);
      parcelas.push({
        sublinha: DFC_NOME_PROJECAO_RECEITA_CARTEIRA,
        idEmpresa: p.idEmpresa,
        idPedido: p.idPedido,
        pd: p.pd,
        cliente: p.cliente,
        condicaoPagamento: condicao,
        regra: regraStr,
        diasRegra: dias,
        indiceParcela: idx + 1,
        qtdeParcelas: n,
        saldoAReceberTotal: p.saldoAReceber,
        valorParcela,
        dataPrevisao: p.previsao,
        dataProjVenc,
        uf: p.uf,
        vendedorRepresentante: p.vendedorRepresentante,
      });
    });
  }
  return parcelas;
}

async function carregarTodasParcelasProjecao(force = false): Promise<{
  parcelas: DfcProjecaoReceitaParcelaLinha[];
  erro?: string;
}> {
  if (!force && cacheParcelas && Date.now() - cacheParcelas.at < CACHE_MS) {
    return { parcelas: cacheParcelas.parcelas };
  }

  const cart = await queryCarteiraFinanceira({});
  if (cart.erro) {
    return { parcelas: [], erro: cart.erro };
  }

  const byPedido = new Map<number, PedidoAgg>();
  for (const l of cart.linhas) {
    if (l.idEmpresa !== ID_EMPRESA_PROJECAO) continue;
    const saldo = l['Saldo a Receber'] || 0;
    if (!(saldo > 0)) continue;
    const id = l.id;
    if (!(id > 0)) continue;
    const prev = l.previsaoAtual?.slice(0, 10) || null;
    const cur = byPedido.get(id);
    if (cur) {
      cur.saldoAReceber += saldo;
      if (!cur.previsao && prev) cur.previsao = prev;
    } else {
      byPedido.set(id, {
        idPedido: id,
        idEmpresa: l.idEmpresa,
        pd: l.PD,
        cliente: l.Cliente,
        condicaoPagamento: l['Condicao de pagamento do pedido de venda'],
        previsao: prev,
        saldoAReceber: saldo,
        uf: l.UF,
        vendedorRepresentante: l['Vendedor/Representante'],
      });
    }
  }

  const pedidos = [...byPedido.values()];
  const regras = await carregarRegrasPorPedido(pedidos.map((p) => p.idPedido));
  const parcelas = montarParcelasCarteira(pedidos, regras);
  cacheParcelas = { at: Date.now(), parcelas };
  return { parcelas };
}

function parcelaEntraPeriodo(
  p: DfcProjecaoReceitaParcelaLinha,
  opts: {
    hoje: string;
    dataInicio: string;
    dataFim: string;
    periodo?: string;
    granularidade: 'dia' | 'mes';
  },
): boolean {
  const proj = p.dataProjVenc.slice(0, 10);
  if (proj < opts.hoje) return false;
  if (proj < opts.dataInicio || proj > opts.dataFim) return false;
  if (opts.periodo != null && bucketPeriodo(proj, opts.granularidade) !== opts.periodo) return false;
  return true;
}

function somarPorPeriodo(
  parcelas: DfcProjecaoReceitaParcelaLinha[],
  granularidade: 'dia' | 'mes',
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of parcelas) {
    const b = bucketPeriodo(p.dataProjVenc, granularidade);
    out[b] = (out[b] ?? 0) + p.valorParcela;
  }
  return out;
}

function mapaVazioSublinha(): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const nome of DFC_SUBLINHAS_PROJECAO_RECEITAS) {
    out[nome] = {};
  }
  return out;
}

/**
 * Agregado por sublinha e período (e total em porPeriodo para cruzamento/legado).
 */
export async function queryDfcProjecaoReceitasPorPeriodo(params: {
  dataInicio: string;
  dataFim: string;
  granularidade: 'dia' | 'mes';
  idEmpresas?: number[];
}): Promise<{
  porPeriodo: Record<string, number>;
  porSublinha: Record<string, Record<string, number>>;
  erro?: string;
}> {
  void params.idEmpresas;
  const hoje = hojeYmdLocal();
  const porSublinha = mapaVazioSublinha();
  const { parcelas, erro } = await carregarTodasParcelasProjecao();
  if (erro) {
    return { porPeriodo: {}, porSublinha, erro };
  }

  const carteira = parcelas.filter((p) =>
    parcelaEntraPeriodo(p, {
      hoje,
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
      granularidade: params.granularidade,
    }),
  );
  porSublinha[DFC_NOME_PROJECAO_RECEITA_CARTEIRA] = somarPorPeriodo(carteira, params.granularidade);

  const porPeriodo: Record<string, number> = {};
  for (const nome of DFC_SUBLINHAS_PROJECAO_RECEITAS) {
    for (const [per, val] of Object.entries(porSublinha[nome] ?? {})) {
      porPeriodo[per] = (porPeriodo[per] ?? 0) + val;
    }
  }

  return { porPeriodo, porSublinha, erro };
}

/**
 * Detalhe analítico (grade = modal). `sublinha` opcional filtra; omitir = todas as sublinhas com dados.
 */
export async function queryDfcProjecaoReceitasDetalhe(params: {
  dataInicio: string;
  dataFim: string;
  granularidade: 'dia' | 'mes';
  idEmpresas?: number[];
  periodo?: string;
  sublinha?: string;
}): Promise<{ linhas: DfcProjecaoReceitaParcelaLinha[]; erro?: string }> {
  void params.idEmpresas;
  const hoje = hojeYmdLocal();
  const { parcelas, erro } = await carregarTodasParcelasProjecao();
  if (erro) return { linhas: [], erro };

  const sub = params.sublinha?.trim();
  const linhas = parcelas
    .filter((p) => {
      if (sub && p.sublinha !== sub) return false;
      return parcelaEntraPeriodo(p, {
        hoje,
        dataInicio: params.dataInicio,
        dataFim: params.dataFim,
        periodo: params.periodo,
        granularidade: params.granularidade,
      });
    })
    .sort((a, b) => a.dataProjVenc.localeCompare(b.dataProjVenc) || a.idPedido - b.idPedido);

  return { linhas, erro };
}
