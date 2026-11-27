import type { RegimeConferenciaDoubleCheck } from './doubleCheckInConferenciaPeriodo.js';

/**
 * A Mesa só lista e delibera o documento depois que o Double Check foi concluído
 * de fato. Entrada anterior a 19/09/2026 não gera conferência: sem registro, não
 * entra na fila. Divergência já decidida conta como concluída. Pendência sem
 * decisão, item da nota ainda sem pedido, ou conferência reaberta, ainda bloqueia.
 */
export function conferenciaDoubleCheckLiberadaParaMesa(params: {
  regime: RegimeConferenciaDoubleCheck;
  possuiConferenciaValida: boolean;
  pendenciasSemDecisao: number;
  /** Item da nota ainda sem pedido, com outros itens já vinculados. */
  itensSemVinculoPedido?: number;
}): boolean {
  if (!params.possuiConferenciaValida) return false;
  if (params.regime === 'completa' && params.pendenciasSemDecisao > 0) return false;
  if (params.regime === 'completa' && (params.itensSemVinculoPedido ?? 0) > 0) return false;
  return true;
}
