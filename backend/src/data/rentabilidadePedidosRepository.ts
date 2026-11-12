import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';
import { termoParaPadraoLikeSql } from '../utils/textoLivreBusca.js';

export type FiltrosRentabilidadePedidos = {
  dataInicio: string;
  dataFim: string;
  numeroPedido?: string;
  cliente?: string;
  vendedor?: string;
  idEmpresa?: number | null;
  /** Status do item (Nomus ip.status). Vazio = todos exceto cancelado. */
  statusItens?: number[];
};

export type LinhaPedidoItemNomus = {
  idPedido: number;
  numeroPedido: string;
  dataEmissao: string;
  idEmpresa: number;
  cliente: string;
  vendedor: string;
  idItem: number;
  idProduto: number;
  codigoProduto: string;
  descricaoProduto: string;
  statusItem: number;
  statusLabel: string;
  qtde: number;
  qtdeDevolvida: number;
  valorTotal: number;
  valorDesconto: number;
  valorTotalComDesconto: number;
};

function toNum(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toStr(v: unknown): string {
  return v == null ? '' : String(v);
}

function ymd(v: unknown): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  const s = String(v ?? '').trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1]! : s.slice(0, 10);
}

const STATUS_LABEL: Record<number, string> = {
  1: 'Aguardando liberação',
  2: 'Liberado',
  3: 'Atendido parcialmente',
  4: 'Atendido totalmente',
  5: 'Atendido com corte',
  6: 'Cancelado',
  7: 'Devolvido parcialmente',
  8: 'Devolvido totalmente',
};

/**
 * Itens de pedidos de venda no período.
 * Exclui cancelados (status 6). Devoluções vinculadas abatem a qtde líquida.
 */
export async function listarItensPedidosRentabilidade(
  filtros: FiltrosRentabilidadePedidos
): Promise<LinhaPedidoItemNomus[]> {
  if (!isNomusEnabled()) return [];
  const pool = getNomusPool();
  if (!pool) return [];

  const params: Array<string | number> = [filtros.dataInicio, filtros.dataFim];
  const where: string[] = [
    'DATE(pd.dataEmissao) BETWEEN ? AND ?',
    'ip.status <> 6',
    'pd.idEmpresa IN (1, 2)',
  ];

  if (filtros.idEmpresa === 1 || filtros.idEmpresa === 2) {
    where.push('pd.idEmpresa = ?');
    params.push(filtros.idEmpresa);
  }

  if (filtros.statusItens && filtros.statusItens.length > 0) {
    const statuses = filtros.statusItens.filter((s) => s !== 6);
    if (statuses.length > 0) {
      where.push(`ip.status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }
  }

  if (filtros.numeroPedido?.trim()) {
    where.push('pd.nome LIKE ?');
    params.push(termoParaPadraoLikeSql(filtros.numeroPedido.trim()));
  }
  if (filtros.cliente?.trim()) {
    where.push('pe.nome LIKE ?');
    params.push(termoParaPadraoLikeSql(filtros.cliente.trim()));
  }
  if (filtros.vendedor?.trim()) {
    where.push('vr.nome LIKE ?');
    params.push(termoParaPadraoLikeSql(filtros.vendedor.trim()));
  }

  const sql = `
SELECT
  pd.id AS idPedido,
  pd.nome AS numeroPedido,
  pd.dataEmissao,
  pd.idEmpresa,
  UPPER(pe.nome) AS cliente,
  COALESCE(vr.nome, '') AS vendedor,
  ip.id AS idItem,
  p.id AS idProduto,
  p.nome AS codigoProduto,
  p.descricao AS descricaoProduto,
  ip.status AS statusItem,
  ip.qtde AS qtde,
  IFNULL(ip.valorTotal, 0) AS valorTotal,
  IFNULL(ip.valorDesconto, 0) AS valorDesconto,
  IFNULL(ip.valorTotalComDesconto, 0) AS valorTotalComDesconto,
  IFNULL(devol.qtdDevolvida, 0) AS qtdeDevolvida
FROM pedido pd
INNER JOIN itempedido ip ON ip.idPedido = pd.id
INNER JOIN produto p ON p.id = ip.idProduto
LEFT JOIN pessoa pe ON pe.id = pd.idCliente
LEFT JOIN pessoa vr ON vr.id = COALESCE(pd.idVendedor, pd.idRepresentante)
LEFT JOIN (
  SELECT
    ideipv.idItemPedidoVenda AS idItem,
    SUM(COALESCE(ide.qtde, 0)) AS qtdDevolvida
  FROM itemdocumentoestoque ide
  INNER JOIN itemdocumentoestoque_itempedidovenda ideipv
    ON ideipv.idItemDocumentoEstoque = ide.idItemOrigemDevolucao
  INNER JOIN tipomovimentacao tm ON tm.id = ide.idTipoMovimentacao
  WHERE tm.id IN (52, 55)
    AND ide.idItemOrigemDevolucao IS NOT NULL
  GROUP BY ideipv.idItemPedidoVenda
) devol ON devol.idItem = ip.id
WHERE ${where.join('\n  AND ')}
ORDER BY pd.dataEmissao DESC, pd.nome, ip.id
`.trim();

  const [rows] = await pool.query(sql, params);
  const list = (Array.isArray(rows) ? rows : []) as Record<string, unknown>[];
  return list.map((r) => {
    const statusItem = Math.trunc(toNum(r.statusItem ?? r.statusitem));
    return {
      idPedido: Math.trunc(toNum(r.idPedido ?? r.idpedido)),
      numeroPedido: toStr(r.numeroPedido ?? r.numeropedido),
      dataEmissao: ymd(r.dataEmissao ?? r.dataemissao),
      idEmpresa: Math.trunc(toNum(r.idEmpresa ?? r.idempresa)),
      cliente: toStr(r.cliente),
      vendedor: toStr(r.vendedor),
      idItem: Math.trunc(toNum(r.idItem ?? r.iditem)),
      idProduto: Math.trunc(toNum(r.idProduto ?? r.idproduto)),
      codigoProduto: toStr(r.codigoProduto ?? r.codigoproduto),
      descricaoProduto: toStr(r.descricaoProduto ?? r.descricaoproduto),
      statusItem,
      statusLabel: STATUS_LABEL[statusItem] ?? 'Sem status',
      qtde: toNum(r.qtde),
      qtdeDevolvida: toNum(r.qtdeDevolvida ?? r.qtdedevolvida),
      valorTotal: toNum(r.valorTotal ?? r.valortotal),
      valorDesconto: toNum(r.valorDesconto ?? r.valordesconto),
      valorTotalComDesconto: toNum(r.valorTotalComDesconto ?? r.valortotalcomdesconto),
    };
  });
}
