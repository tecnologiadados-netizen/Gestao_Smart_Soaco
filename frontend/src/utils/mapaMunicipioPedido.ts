import type { TooltipDetalheRow } from '../api/pedidos';

/** Mesma chave usada na agregação do popup (pedido + rota + RM). */
export function chaveLinhaPedidoMapa(row: TooltipDetalheRow): string {
  const pedido = String(row.pedido ?? '').trim() || `_${row.codigo ?? ''}_${row.produto ?? ''}`;
  const rota = (row.rota ?? '').trim();
  const rm = (row.rm ?? '').trim();
  return `${pedido}|${rota}|${rm}`;
}

export function labelPedidoMapa(pedido: string | undefined): string {
  const n = String(pedido ?? '').replace(/^PD\s*/i, '').trim();
  return n ? `PD ${n}` : '—';
}

/** Itens (produtos) da linha agregada clicada no tooltip. */
export function itensProdutoLinhaPedido(
  linha: TooltipDetalheRow,
  detalhesBruto: TooltipDetalheRow[]
): TooltipDetalheRow[] {
  const k = chaveLinhaPedidoMapa(linha);
  return detalhesBruto.filter((r) => chaveLinhaPedidoMapa(r) === k);
}
