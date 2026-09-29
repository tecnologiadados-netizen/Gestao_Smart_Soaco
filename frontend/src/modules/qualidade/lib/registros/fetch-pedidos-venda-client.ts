import { apiFetch } from "@/api/client";
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

  const response = await apiFetch(
    `/api/qualidade/pedidos-venda?${params.toString()}`,
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

  const response = await apiFetch(
    `/api/qualidade/pedidos-venda/${encodeURIComponent(id)}/itens`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error("Não foi possível carregar os itens do pedido.");
  }

  const data = (await response.json()) as { itens: ItemPedidoVendaAtendidoErp[] };
  return data.itens ?? [];
}

export interface NotaFiscalPedidoVenda {
  numero: string;
  /** Data de emissão do documento, em `YYYY-MM-DD`. Várias datas ficam separadas por vírgula. */
  dataEmissao: string;
}

/** Notas fiscais de saída do pedido, com a data de emissão. */
export async function fetchNotasFiscaisPedidoVenda(
  pedidoId: string
): Promise<NotaFiscalPedidoVenda[]> {
  const id = pedidoId.trim();
  if (!id) return [];

  const response = await apiFetch(
    `/api/qualidade/pedidos-venda/${encodeURIComponent(id)}/notas-fiscais`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error("Não foi possível carregar a nota fiscal do pedido.");
  }

  const data = (await response.json()) as {
    notasFiscais?: string[];
    notas?: { numero?: string; dataEmissao?: string }[];
  };

  if (Array.isArray(data.notas) && data.notas.length > 0) {
    return data.notas
      .map((nota) => ({
        numero: String(nota.numero ?? "").trim(),
        dataEmissao: String(nota.dataEmissao ?? "").trim(),
      }))
      .filter((nota) => nota.numero);
  }

  return (data.notasFiscais ?? [])
    .map((nota) => nota.trim())
    .filter(Boolean)
    .map((numero) => ({ numero, dataEmissao: "" }));
}
