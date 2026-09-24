/** Setor virtual: endereçamento válido para todos os setores do sistema. */
export const ENDERECAMENTO_SETOR_GERAL_ID = "sgq-setor-geral";

export const ENDERECAMENTO_SETOR_GERAL_LABEL = "Geral";

export type EnderecamentoCategoria = "fisico" | "eletronico";

export const ENDERECAMENTO_CATEGORIA_LABEL: Record<EnderecamentoCategoria, string> = {
  fisico: "Físico",
  eletronico: "Eletrônico",
};

export interface Enderecamento {
  id: string;
  /** Id do setor ou {@link ENDERECAMENTO_SETOR_GERAL_ID}. */
  setorId: string;
  endereco: string;
  /** Cadastros antigos sem categoria são tratados como físicos. */
  categoria: EnderecamentoCategoria;
}

export function isEnderecamentoSetorGeral(setorId: string): boolean {
  return setorId === ENDERECAMENTO_SETOR_GERAL_ID;
}
