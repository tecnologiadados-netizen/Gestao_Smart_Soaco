/**
 * A conferência completa NF × PC foi publicada no fim de 18/09/2026.
 * O primeiro dia útil em que o fluxo passou a valer foi 21/09/2026.
 * Registros anteriores pertencem à conferência básica antiga e não representam
 * uma conferência das divergências NF × PC.
 */
export const DOUBLE_CHECKIN_CONFERENCIA_NF_PC_DESDE =
  new Date('2026-09-21T00:00:00-03:00');

export function ehConferenciaNfPcValida(data: Date): boolean {
  return data.getTime() >= DOUBLE_CHECKIN_CONFERENCIA_NF_PC_DESDE.getTime();
}
