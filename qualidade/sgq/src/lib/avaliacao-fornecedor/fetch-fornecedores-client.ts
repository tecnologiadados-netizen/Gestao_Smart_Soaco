import { QUALIDADE_API_BASE } from "@/lib/api-base";
import {
  FORNECEDORES_INITIAL_LIMIT,
  FORNECEDORES_SEARCH_LIMIT,
} from "@/lib/avaliacao-fornecedor/fornecedores-constants";
import type { Fornecedor } from "@/types/avaliacao-fornecedor";

export interface FetchFornecedoresOptions {
  q?: string;
  limit?: number;
}

export async function fetchFornecedoresClient(
  options: FetchFornecedoresOptions = {}
): Promise<Fornecedor[]> {
  const params = new URLSearchParams();

  if (options.q?.trim()) {
    params.set("q", options.q.trim());
  }

  params.set(
    "limit",
    String(options.limit ?? FORNECEDORES_INITIAL_LIMIT)
  );

  const response = await fetch(`${QUALIDADE_API_BASE}/fornecedores?${params.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Não foi possível carregar os fornecedores.");
  }

  const data = (await response.json()) as { fornecedores: Fornecedor[] };
  return data.fornecedores;
}

export {
  FORNECEDORES_INITIAL_LIMIT,
  FORNECEDORES_MIN_SEARCH_CHARS,
  FORNECEDORES_SEARCH_LIMIT,
} from "@/lib/avaliacao-fornecedor/fornecedores-constants";
