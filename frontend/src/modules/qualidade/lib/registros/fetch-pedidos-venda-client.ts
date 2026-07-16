import { QUALIDADE_API_BASE } from "@qualidade/lib/api-base";
import type { PedidoVendaErp } from "@qualidade/types/pedido-venda-erp";

export const PEDIDOS_VENDA_INITIAL_LIMIT = 20;
export const PEDIDOS_VENDA_SEARCH_LIMIT = 50;
export const PEDIDOS_VENDA_MIN_SEARCH_CHARS = 2;

export interface FetchPedidosVendaOptions {
  q?: string;
  limit?: number;
}

export async function fetchPedidosVendaClient(
  options: FetchPedidosVendaOptions = {}
): Promise<PedidoVendaErp[]> {
  const params = new URLSearchParams();

  if (options.q?.trim()) {
    params.set("q", options.q.trim());
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
