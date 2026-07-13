import { apiFetch } from "@/api/client";
import { QUALIDADE_API_BASE } from "@qualidade/lib/api-base";
import {
  PESSOAS_INITIAL_LIMIT,
  PESSOAS_MIN_SEARCH_CHARS,
  PESSOAS_SEARCH_LIMIT,
  type PessoaErp,
} from "@qualidade/types/pessoa-erp";

export interface FetchPessoasOptions {
  q?: string;
  limit?: number;
}

export async function fetchPessoasClient(
  options: FetchPessoasOptions = {}
): Promise<PessoaErp[]> {
  const params = new URLSearchParams();
  if (options.q?.trim()) params.set("q", options.q.trim());
  params.set("limit", String(options.limit ?? PESSOAS_INITIAL_LIMIT));

  const response = await apiFetch(
    `${QUALIDADE_API_BASE}/pessoas?${params.toString()}`
  );
  if (!response.ok) {
    throw new Error("Não foi possível carregar as pessoas.");
  }

  const data = (await response.json()) as { pessoas: PessoaErp[] };
  return data.pessoas;
}

export {
  PESSOAS_INITIAL_LIMIT,
  PESSOAS_MIN_SEARCH_CHARS,
  PESSOAS_SEARCH_LIMIT,
};
