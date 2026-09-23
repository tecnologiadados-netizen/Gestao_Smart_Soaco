/** Setor virtual: endereçamento válido para todos os setores do sistema. */
export const ENDERECAMENTO_SETOR_GERAL_ID = "sgq-setor-geral";

export const ENDERECAMENTO_SETOR_GERAL_LABEL = "Geral";

export interface Enderecamento {
  id: string;
  /** Id do setor ou {@link ENDERECAMENTO_SETOR_GERAL_ID}. */
  setorId: string;
  endereco: string;
}

export function isEnderecamentoSetorGeral(setorId: string): boolean {
  return setorId === ENDERECAMENTO_SETOR_GERAL_ID;
}
