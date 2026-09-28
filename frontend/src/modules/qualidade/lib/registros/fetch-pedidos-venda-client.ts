import { QUALIDADE_API_BASE } from "@qualidade/lib/api-base";
import type {
  ItemPedidoVendaAtendidoErp,
  PedidoVendaErp,
} from "@qualidade/types/pedido-venda-erp";

export const PEDIDOS_VENDA_INITIAL_LIMIT = 20;
export const PEDIDOS_VENDA_SEARCH_LIMIT = 50;
export const PEDIDOS_VENDA_MIN_SEARCH_CHARS = 2;

export interface FetchPedidosVendaOptions {
  q?: string;
  limit?: number;
  /** Só pedidos com item atendido parcialmente, totalmente ou com corte. */
  somenteAtendidos?: boolean;
}

export async function fetchPedidosVendaClient(
  options: FetchPedidosVendaOptions = {}
): Promise<PedidoVendaErp[]> {
  const params = new URLSearchParams();

  if (options.q?.trim()) {
    params.set("q", options.q.trim());
  }
  if (options.somenteAtendidos) {
    params.set("somenteAtendidos", "1");
  }
  params.set("limit", String(options.limit ?? PEDIDOS_VENDA_INITIAL_LIMIT));

  const response = await fetch(
    `${QUALIDADE_API_BASE}/pedidos-venda?${params.toString()}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error("Não foi possível carregar os pedidos de venda.");
  }

  const data = (await response.json()) as { pedidos: PedidoVendaErp[] };
  return data.pedidos;
}

export async function fetchItensPedidoVendaAtendidos(
  pedidoId: string
): Promise<ItemPedidoVendaAtendidoErp[]> {
  const id = pedidoId.trim();
  if (!id) return [];

  const response = await fetch(
    `${QUALIDADE_API_BASE}/pedidos-venda/${encodeURIComponent(id)}/itens`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error("Não foi possível carregar os itens do pedido.");
  }

  const data = (await response.json()) as { itens: ItemPedidoVendaAtendidoErp[] };
  return data.itens ?? [];
}

/** Números de nota fiscal de saída vinculados ao pedido. */
export async function fetchNotasFiscaisPedidoVenda(pedidoId: string): Promise<string[]> {
  const id = pedidoId.trim();
  if (!id) return [];

  const response = await fetch(
    `${QUALIDADE_API_BASE}/pedidos-venda/${encodeURIComponent(id)}/notas-fiscais`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error("Não foi possível carregar a nota fiscal do pedido.");
  }

  const data = (await response.json()) as { notasFiscais?: string[] };
  return (data.notasFiscais ?? []).map((nota) => nota.trim()).filter(Boolean);
}
