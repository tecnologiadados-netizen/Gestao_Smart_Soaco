/**
 * DRE — 1.4.1 Faturamento Direto (Só Móveis), Nomus.
 * Base: data emissão NF (de.dataEmissao) e valorTotal do item.
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadSql(name: string): string {
  return readFileSync(join(__dirname, 'sql', name), 'utf-8');
}

const MAX_DETALHE_LINHAS = 8000;
const PSM_PEDIDO_EMISAO_MIN = '2024-01-01';
const ID_EMPRESA_MOVEIS = 2;

export type DreReceitaMoveisDiretoAgregadoRow = {
  mes: number;
  ano: number;
  dataEmissao: string;
  valorTotal: number;
  totalDesconto: number;
};

export type DreReceitaMoveisDiretoDetalheRow = {
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

export async function queryDreReceitaMoveisDireto(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresaSaida?: number;
}): Promise<{ linhas: DreReceitaMoveisDiretoAgregadoRow[]; erro?: string }> {
  if (!isNomusEnabled()) {
    return { linhas: [], erro: 'Nomus não configurado (NOMUS_DB_URL).' };
  }
  const pool = getNomusPool();
  if (!pool) return { linhas: [], erro: 'Pool Nomus indisponível.' };

  const idEmpresa = params.idEmpresaSaida ?? ID_EMPRESA_MOVEIS;
  const args = [PSM_PEDIDO_EMISAO_MIN, idEmpresa, params.dataInicio, params.dataFim, idEmpresa];

  try {
    const [rows] = await pool.query(loadSql('dreReceitaMoveisDireto.sql'), args);
    const linhas = (rows as Record<string, unknown>[]).map((r) => ({
      mes: toInt(r.mes),
      ano: toInt(r.ano),
      dataEmissao: toDateYmd(r.dataEmissao) ?? '',
      valorTotal: toNum(r.valorTotal),
      totalDesconto: toNum(r.totalDesconto),
    }));
    return { linhas };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[queryDreReceitaMoveisDireto]', msg);
    return { linhas: [], erro: msg };
  }
}

export async function queryDreReceitaMoveisDiretoDetalhe(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresaSaida?: number;
}): Promise<{ detalhes: DreReceitaMoveisDiretoDetalheRow[]; truncado?: boolean; erro?: string }> {
  if (!isNomusEnabled()) {
    return { detalhes: [], erro: 'Nomus não configurado (NOMUS_DB_URL).' };
  }
  const pool = getNomusPool();
  if (!pool) return { detalhes: [], erro: 'Pool Nomus indisponível.' };

  const idEmpresa = params.idEmpresaSaida ?? ID_EMPRESA_MOVEIS;
  const args = [
    PSM_PEDIDO_EMISAO_MIN,
    idEmpresa,
    params.dataInicio,
    params.dataFim,
    idEmpresa,
    MAX_DETALHE_LINHAS + 1,
  ];

  try {
    const [rows] = await pool.query(loadSql('dreReceitaMoveisDiretoDetalhe.sql'), args);
    const list = rows as Record<string, unknown>[];
    const truncado = list.length > MAX_DETALHE_LINHAS;
    const slice = truncado ? list.slice(0, MAX_DETALHE_LINHAS) : list;
    const detalhes = slice.map((r) => ({
      idItemDocumentoEstoque: toInt(r.idItemDocumentoEstoque),
      idItemPedido: r.idItemPedido != null ? toInt(r.idItemPedido) : null,
      pedido: r.pedido != null ? String(r.pedido) : null,
      idItemPedidoSM: String(r.idItemPedidoSM ?? 'So Moveis'),
      dataEmissao: toDateYmd(r.dataEmissao),
      tipoMovimentacao: r.tipoMovimentacao != null ? String(r.tipoMovimentacao) : null,
      statusNfe: r.statusNfe != null ? String(r.statusNfe) : null,
      idProduto: r.idProduto != null ? toInt(r.idProduto) : null,
      produto: r.produto != null ? String(r.produto) : null,
      qtde: toNum(r.qtde),
      valorUnitario: toNum(r.valorUnitario),
      valorTotal: toNum(r.valorTotal),
      totalDesconto: toNum(r.totalDesconto),
      valorTotalComDesconto: toNum(r.valorTotalComDesconto),
      grupoProduto: String(r.grupoProduto ?? 'Outros').trim() || 'Outros',
      familiaProduto: r.familiaProduto != null ? String(r.familiaProduto) : null,
      mes: toInt(r.mes),
      ano: toInt(r.ano),
      numeroDocumentoFiscal: r.numeroDocumentoFiscal != null ? toInt(r.numeroDocumentoFiscal) : null,
    }));
    return { detalhes, truncado: truncado || undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[queryDreReceitaMoveisDiretoDetalhe]', msg);
    return { detalhes: [], erro: msg };
  }
}
