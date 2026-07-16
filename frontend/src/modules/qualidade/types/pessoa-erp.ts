export interface PessoaErp {
  id: string;
  nome: string;
  documento?: string;
}

export const PESSOAS_INITIAL_LIMIT = 40;
export const PESSOAS_SEARCH_LIMIT = 100;
export const PESSOAS_MIN_SEARCH_CHARS = 2;
