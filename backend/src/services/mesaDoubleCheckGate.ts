import type { RegimeConferenciaDoubleCheck } from './doubleCheckInConferenciaPeriodo.js';

/**
 * A Mesa só delibera conferente depois que o Double Check concluiu a NF.
 * Divergência já decidida conta como concluída. Pendência sem decisão, ou
 * conferência reaberta, ainda bloqueia. Entrada anterior a 19/09/2026 não exige
 * essa etapa.
 */
export function conferenciaDoubleCheckLiberadaParaMesa(params: {
  regime: RegimeConferenciaDoubleCheck;
  possuiConferenciaValida: boolean;
  pendenciasSemDecisao: number;
}): boolean {
  if (params.regime === 'nao_aplicada') return true;
  if (!params.possuiConferenciaValida) return false;
  if (params.regime === 'completa' && params.pendenciasSemDecisao > 0) return false;
  return true;
}
