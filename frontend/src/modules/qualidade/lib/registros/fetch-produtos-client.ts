import { apiFetch } from "@/api/client";
import {
  PRODUTOS_INITIAL_LIMIT,
  PRODUTOS_MIN_SEARCH_CHARS,
  PRODUTOS_SEARCH_LIMIT,
} from "@qualidade/lib/registros/produtos-constants";
import { QUALIDADE_API_BASE } from "@qualidade/lib/api-base";
import type { ProdutoErp } from "@qualidade/types/produto-erp";

export interface FetchProdutosOptions {
  q?: string;
  codigo?: string;
  /** Filtra apenas produtos do pedido de venda Nomus (itempedido). */
  pedidoId?: string;
  limit?: number;
}

export async function fetchProdutosClient(
  options: FetchProdutosOptions = {}
): Promise<ProdutoErp[]> {
  const params = new URLSearchParams();

  if (options.q?.trim()) {
    params.set("q", options.q.trim());
  }
  if (options.codigo?.trim()) {
    params.set("codigo", options.codigo.trim());
  }
  if (options.pedidoId?.trim()) {
    params.set("pedidoId", options.pedidoId.trim());
  }

  params.set(
    "limit",
    String(options.limit ?? PRODUTOS_INITIAL_LIMIT)
  );

  const response = await apiFetch(
    `${QUALIDADE_API_BASE}/produtos?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error("Não foi possível carregar os produtos.");
  }

  const data = (await response.json()) as { produtos: ProdutoErp[] };
  return data.produtos;
}

export {
  PRODUTOS_INITIAL_LIMIT,
  PRODUTOS_MIN_SEARCH_CHARS,
  PRODUTOS_SEARCH_LIMIT,
};
