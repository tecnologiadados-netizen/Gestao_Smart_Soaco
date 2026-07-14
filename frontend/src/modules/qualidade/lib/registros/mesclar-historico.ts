import type { Registro } from "@qualidade/types/registro";

/** Histórico Nomus de RNC/RCC foi descontinuado — mantém apenas registros do sistema. */
export function mesclarHistoricoRncNomus(
  registrosAtuais: Registro[]
): Registro[] {
  return registrosAtuais;
}

export function mesclarHistoricoRccNomus(
  registrosAtuais: Registro[]
): Registro[] {
  return registrosAtuais;
}

export function mesclarHistoricoNomus(registrosAtuais: Registro[]): Registro[] {
  return registrosAtuais;
}

export const TOTAL_HISTORICO_RNC_NOMUS = 0;
export const TOTAL_HISTORICO_RCC_NOMUS = 0;
