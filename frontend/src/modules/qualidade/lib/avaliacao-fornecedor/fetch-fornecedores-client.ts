import { apiFetch } from "@/api/client";
import { QUALIDADE_API_BASE } from "@qualidade/lib/api-base";
import {
  FORNECEDORES_INITIAL_LIMIT,
  FORNECEDORES_SEARCH_LIMIT,
} from "@qualidade/lib/avaliacao-fornecedor/fornecedores-constants";
import type { Fornecedor } from "@qualidade/types/avaliacao-fornecedor";

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

  const response = await apiFetch(
    `${QUALIDADE_API_BASE}/fornecedores?${params.toString()}`
  );

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
} from "@qualidade/lib/avaliacao-fornecedor/fornecedores-constants";
