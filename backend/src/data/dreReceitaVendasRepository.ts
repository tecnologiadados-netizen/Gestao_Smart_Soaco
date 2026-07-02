/**
 * DRE — Receita de vendas de produtos (documento de estoque / NF-e, Nomus).
 * SQL recarregado a cada consulta (tsx watch não observa .sql).
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

export type DreReceitaVendasAgregadoRow = {
  mes: number;
  ano: number;
  grupoProduto: string;
  idItemPedidoSM: string;
  valorTotal: number;
  totalDesconto: number;
};

export type DreReceitaVendasDetalheRow = {
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

const PSM_PEDIDO_EMISAO_MIN = '2024-01-01';
const ID_ITEM_PEDIDO_SM_SO_ACO = 'So Aco';

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/**
 * Agrega valorTotal por mês/ano e grupo de produto (filtro Só Aço no SQL).
 * Parâmetros Nomus: dataInicio (psm + de), dataFim, idEmpresa (psm + saída), idItemPedidoSM.
 */
export async function queryDreReceitaVendasProdutos(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresaSaida?: number;
}): Promise<{ linhas: DreReceitaVendasAgregadoRow[]; erro?: string }> {
  if (!isNomusEnabled()) {
    return { linhas: [], erro: 'Nomus não configurado (NOMUS_DB_URL).' };
  }
  const pool = getNomusPool();
  if (!pool) return { linhas: [], erro: 'Pool Nomus indisponível.' };

  const idEmpresa = params.idEmpresaSaida ?? 1;
  /** psm: corte 2024-01-01 + empresa; de: período + empresa saída. */
  const args = [
    PSM_PEDIDO_EMISAO_MIN,
    idEmpresa,
    params.dataInicio,
    params.dataFim,
    idEmpresa,
  ];

  try {
    const [rows] = await pool.query(loadSql('dreReceitaVendasProduto.sql'), args);
    const linhas = (rows as Record<string, unknown>[]).map((r) => ({
      mes: toInt(r.mes),
      ano: toInt(r.ano),
      grupoProduto: String(r.grupoProduto ?? 'Outros').trim() || 'Outros',
      idItemPedidoSM: String(r.idItemPedidoSM ?? ID_ITEM_PEDIDO_SM_SO_ACO),
      valorTotal: toNum(r.valorTotal),
      totalDesconto: toNum(r.totalDesconto),
    }));
    return { linhas };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[queryDreReceitaVendasProdutos]', msg);
    return { linhas: [], erro: msg };
  }
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

/**
 * Itens de documento de estoque (mesma base do agregado), com filtro opcional por grupo.
 */
export async function queryDreReceitaVendasDetalhe(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresaSaida?: number;
  grupoProduto?: string;
}): Promise<{ detalhes: DreReceitaVendasDetalheRow[]; truncado?: boolean; erro?: string }> {
  if (!isNomusEnabled()) {
    return { detalhes: [], erro: 'Nomus não configurado (NOMUS_DB_URL).' };
  }
  const pool = getNomusPool();
  if (!pool) return { detalhes: [], erro: 'Pool Nomus indisponível.' };

  const idEmpresa = params.idEmpresaSaida ?? 1;
  const grupoFiltro = (params.grupoProduto ?? '').trim();
  /** psm: corte 2024-01-01 + empresa; de: período; grupo (6,7); limit (8). */
  const args = [
    PSM_PEDIDO_EMISAO_MIN,
    idEmpresa,
    params.dataInicio,
    params.dataFim,
    idEmpresa,
    grupoFiltro,
    grupoFiltro,
    MAX_DETALHE_LINHAS + 1,
  ];

  try {
    const [rows] = await pool.query(loadSql('dreReceitaVendasDetalhe.sql'), args);
    const list = rows as Record<string, unknown>[];
    const truncado = list.length > MAX_DETALHE_LINHAS;
    const slice = truncado ? list.slice(0, MAX_DETALHE_LINHAS) : list;
    const detalhes = slice
      .map((r) => ({
      idItemDocumentoEstoque: toInt(r.idItemDocumentoEstoque),
      idItemPedido: r.idItemPedido != null ? toInt(r.idItemPedido) : null,
      pedido: r.pedido != null ? String(r.pedido) : null,
      idItemPedidoSM: String(r.idItemPedidoSM ?? ID_ITEM_PEDIDO_SM_SO_ACO),
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
    }))
      .filter((r) => r.idItemPedidoSM === ID_ITEM_PEDIDO_SM_SO_ACO);
    return { detalhes, truncado: truncado || undefined };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[queryDreReceitaVendasDetalhe]', msg);
    return { detalhes: [], erro: msg };
  }
}
