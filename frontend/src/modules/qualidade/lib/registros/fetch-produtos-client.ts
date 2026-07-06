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

  params.set(
    "limit",
    String(options.limit ?? PRODUTOS_INITIAL_LIMIT)
  );

  const response = await fetch(`${QUALIDADE_API_BASE}/produtos?${params.toString()}`, {
    cache: "no-store",
  });

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
