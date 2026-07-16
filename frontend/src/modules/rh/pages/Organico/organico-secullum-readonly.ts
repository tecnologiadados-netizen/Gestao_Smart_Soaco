/**
 * Colunas do orgânico mantidas pela integração Secullum (API).
 * Telefone e telefone emergencial vêm da planilha / RH, não da API.
 */
import { ORGANICO_IDX } from "./organico-derive";

export const ORGANICO_COLUNAS_READONLY_SECULLUM = new Set<number>([
  ORGANICO_IDX.MATRICULA,
  ORGANICO_IDX.NOME,
  ORGANICO_IDX.CPF,
  ORGANICO_IDX.RG,
  ORGANICO_IDX.SEXO,
  ORGANICO_IDX.ADMISSAO,
  ORGANICO_IDX.CARGO,
  ORGANICO_IDX.SETOR,
  ORGANICO_IDX.PIS,
  ORGANICO_IDX.NASCIMENTO,
  ORGANICO_IDX.CTPS,
  ORGANICO_IDX.SITUACAO_TRABALHISTA,
  ORGANICO_IDX.STATUS,
]);

/** Coluna "DETALHAMENTO ARQUIVO" — valor que marca linha criada só pela Secullum. */
export const ORGANICO_DETALHE_ORIGEM_API_SECULLUM = "API_SECULLUM";
