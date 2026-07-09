import { mockFornecedores } from "@/lib/mock-data/fornecedores";
import {
  FORNECEDORES_INITIAL_LIMIT,
  FORNECEDORES_MIN_SEARCH_CHARS,
  FORNECEDORES_SEARCH_LIMIT,
  type FornecedoresSearchParams,
} from "@/lib/avaliacao-fornecedor/fornecedores-constants";
import {
  fetchFornecedoresFromSql,
  getSuppliersSqlConfig,
} from "@/lib/avaliacao-fornecedor/suppliers-sql";
import type { Fornecedor } from "@/types/avaliacao-fornecedor";

function filterMockFornecedores(
  params: FornecedoresSearchParams
): Fornecedor[] {
  const q = params.q?.trim().toLowerCase() ?? "";
  const limit = Math.min(
    params.limit ?? FORNECEDORES_INITIAL_LIMIT,
    FORNECEDORES_SEARCH_LIMIT
  );

  let lista = [...mockFornecedores];

  if (q.length >= FORNECEDORES_MIN_SEARCH_CHARS) {
    lista = lista.filter(
      (f) =>
        f.nome.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q) ||
        f.documento?.toLowerCase().includes(q)
    );
  }

  return lista
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, limit);
}

export async function getFornecedores(
  params: FornecedoresSearchParams = {}
): Promise<Fornecedor[]> {
  const sqlConfig = getSuppliersSqlConfig();

  if (!sqlConfig) {
    return filterMockFornecedores(params);
  }

  try {
    return await fetchFornecedoresFromSql(sqlConfig, params);
  } catch {
    return filterMockFornecedores(params);
  }
}
