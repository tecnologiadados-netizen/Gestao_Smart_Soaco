export const FORNECEDORES_INITIAL_LIMIT = 15;
export const FORNECEDORES_SEARCH_LIMIT = 50;
export const FORNECEDORES_MIN_SEARCH_CHARS = 2;

export interface FornecedoresSearchParams {
  q?: string;
  limit?: number;
}
