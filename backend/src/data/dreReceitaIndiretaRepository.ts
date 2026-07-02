/**
 * DRE — Faturamento indireto (Só Móveis / Nomus).
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  calcularValorFaturamentoIndireto,
  nomeGrupoProdutoDre,
  variacaoMkpPorGrupo,
} from './dreMkpVariacoes.js';
import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadSql(name: string): string {
  return readFileSync(join(__dirname, 'sql', name), 'utf-8');
}

const MAX_DETALHE_LINHAS = 8000;
const PSM_PEDIDO_EMISAO_MIN = '2024-01-01';
const ID_ITEM_PEDIDO_SM_SO_MOVEIS = 'So Moveis';

export type DreReceitaIndiretaBrutoRow = {
  mes: number;
  ano: number;
  valorTotal: number;
};

export type DreReceitaIndiretaLiquidoRow = {
  mes: number;
  ano: number;
  grupoProduto: string;
  valorLiquido: number;
};

export type DreReceitaIndiretaDetalheRow = {
  idItemDocumentoEstoque: number;
  idItemPedido: number | null;
  pedido: string | null;
  idItemPedidoSM: string;
  dataEmissao: string | null;
  tipoMovimentacao: string | null;
  statusNfe: string | null;
  idProduto: number | null;
  produto: string | null;
  qtde: number;
  valorUnitario: number;
  valorTotal: number;
  totalDesconto: number;
  valorTotalComDesconto: number;
  grupoProduto: string;
  familiaProduto: string | null;
  mes: number;
  ano: number;
  numeroDocumentoFiscal: number | null;
  percMarkup: number;
  valorIndireto: number;
};

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function toDateYmd(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : s || null;
}

function argsBase(params: { dataInicio: string; dataFim: string; idEmpresaSaida?: number }) {
  const idEmpresa = params.idEmpresaSaida ?? 1;
  return [PSM_PEDIDO_EMISAO_MIN, idEmpresa, params.dataInicio, params.dataFim, idEmpresa];
}

export async function queryDreReceitaIndiretaBruto(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresaSaida?: number;
}): Promise<{ linhas: DreReceitaIndiretaBrutoRow[]; erro?: string }> {
  if (!isNomusEnabled()) {
    return { linhas: [], erro: 'Nomus não configurado (NOMUS_DB_URL).' };
  }
  const pool = getNomusPool();
  if (!pool) return { linhas: [], erro: 'Pool Nomus indisponível.' };

  try {
    const [rows] = await pool.query(loadSql('dreReceitaIndiretaBruto.sql'), argsBase(params));
    const linhas = (rows as Record<string, unknown>[]).map((r) => ({
      mes: toInt(r.mes),
      ano: toInt(r.ano),
      valorTotal: toNum(r.valorTotal),
    }));
    return { linhas };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[queryDreReceitaIndiretaBruto]', msg);
    return { linhas: [], erro: msg };
  }
}

export async function queryDreReceitaIndiretaLiquido(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresaSaida?: number;
}): Promise<{ linhas: DreReceitaIndiretaLiquidoRow[]; erro?: string }> {
  if (!isNomusEnabled()) {
    return { linhas: [], erro: 'Nomus não configurado (NOMUS_DB_URL).' };
  }
  const pool = getNomusPool();
  if (!pool) return { linhas: [], erro: 'Pool Nomus indisponível.' };

  try {
    const [rows] = await pool.query(loadSql('dreReceitaIndiretaLiquidoItem.sql'), argsBase(params));
    const acum = new Map<string, DreReceitaIndiretaLiquidoRow>();

    for (const r of rows as Record<string, unknown>[]) {
      const mes = toInt(r.mes);
      const ano = toInt(r.ano);
      const grupoNomus = String(r.grupoProduto ?? 'Outros').trim() || 'Outros';
      const grupoProduto = nomeGrupoProdutoDre(grupoNomus);
      const valorUnitario = toNum(r.valorUnitario);
      const qtde = toNum(r.qtde);
      const percMarkup = variacaoMkpPorGrupo(grupoProduto);
      const valorLiquido = calcularValorFaturamentoIndireto(valorUnitario, qtde, percMarkup);

      const key = `${ano}-${mes}-${grupoProduto}`;
      const prev = acum.get(key);
      if (prev) {
        prev.valorLiquido += valorLiquido;
      } else {
        acum.set(key, { mes, ano, grupoProduto, valorLiquido });
      }
    }

    return { linhas: [...acum.values()] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[queryDreReceitaIndiretaLiquido]', msg);
    return { linhas: [], erro: msg };
  }
}

export async function queryDreReceitaIndiretaDetalhe(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresaSaida?: number;
  grupoProduto?: string;
}): Promise<{ detalhes: DreReceitaIndiretaDetalheRow[]; truncado?: boolean; erro?: string }> {
  if (!isNomusEnabled()) {
    return { detalhes: [], erro: 'Nomus não configurado (NOMUS_DB_URL).' };
  }
  const pool = getNomusPool();
  if (!pool) return { detalhes: [], erro: 'Pool Nomus indisponível.' };

  const grupoFiltro = (params.grupoProduto ?? '').trim();
  const args = [...argsBase(params), grupoFiltro, grupoFiltro, MAX_DETALHE_LINHAS + 1];

  try {
    const [rows] = await pool.query(loadSql('dreReceitaIndiretaDetalhe.sql'), args);
    const list = rows as Record<string, unknown>[];
    const truncado = list.length > MAX_DETALHE_LINHAS;
    const slice = truncado ? list.slice(0, MAX_DETALHE_LINHAS) : list;

    const detalhes = slice
      .map((r) => {
        const grupoProduto = String(r.grupoProduto ?? 'Outros').trim() || 'Outros';
        const valorUnitario = toNum(r.valorUnitario);
        const qtde = toNum(r.qtde);
        const percMarkup = variacaoMkpPorGrupo(nomeGrupoProdutoDre(grupoProduto));
        return {
          idItemDocumentoEstoque: toInt(r.idItemDocumentoEstoque),
          idItemPedido: r.idItemPedido != null ? toInt(r.idItemPedido) : null,
          pedido: r.pedido != null ? String(r.pedido) : null,
          idItemPedidoSM: String(r.idItemPedidoSM ?? ID_ITEM_PEDIDO_SM_SO_MOVEIS),
          dataEmissao: toDateYmd(r.dataEmissao),
          tipoMovimentacao: r.tipoMovimentacao != null ? String(r.tipoMovimentacao) : null,
          statusNfe: r.statusNfe != null ? String(r.statusNfe) : null,
          idProduto: r.idProduto != null ? toInt(r.idProduto) : null,
          produto: r.produto != null ? String(r.produto) : null,
          qtde,
          valorUnitario,
          valorTotal: toNum(r.valorTotal),
          totalDesconto: toNum(r.totalDesconto),
          valorTotalComDesconto: toNum(r.valorTotalComDesconto),
          grupoProduto,
          familiaProduto: r.familiaProduto != null ? String(r.familiaProduto) : null,
          mes: toInt(r.mes),
          ano: toInt(r.ano),
          numeroDocumentoFiscal: r.numeroDocumentoFiscal != null ? toInt(r.numeroDocumentoFiscal) : null,
          percMarkup,
          valorIndireto: calcularValorFaturamentoIndireto(valorUnitario, qtde, percMarkup),
        };
      })
      .filter((r) => r.idItemPedidoSM === ID_ITEM_PEDIDO_SM_SO_MOVEIS);

    return { detalhes, truncado: truncado || undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[queryDreReceitaIndiretaDetalhe]', msg);
    return { detalhes: [], erro: msg };
  }
}
