/**
 * A conferência simples passou a ser aplicada às entradas de 19/09/2026.
 * Nela, o comparativo NF × PC é somente leitura e basta confirmar o documento.
 *
 * A conferência completa NF × PC foi publicada no fim de 18/09/2026.
 * O primeiro dia útil em que o fluxo com decisões passou a valer foi 21/09/2026.
 */
export const DOUBLE_CHECKIN_CONFERENCIA_DESDE_YMD = '2026-09-19';
export const DOUBLE_CHECKIN_CONFERENCIA_NF_PC_DESDE_YMD = '2026-09-21';
export const DOUBLE_CHECKIN_CONFERENCIA_NF_PC_DESDE =
  new Date('2026-09-21T00:00:00-03:00');

export type RegimeConferenciaDoubleCheck =
  | 'nao_aplicada'
  | 'simples'
  | 'completa';

export function regimeConferenciaPorDataEntrada(
  dataEntrada: string | null | undefined
): RegimeConferenciaDoubleCheck {
  const ymd = String(dataEntrada ?? '').slice(0, 10);
  if (ymd < DOUBLE_CHECKIN_CONFERENCIA_DESDE_YMD) return 'nao_aplicada';
  if (ymd < DOUBLE_CHECKIN_CONFERENCIA_NF_PC_DESDE_YMD) return 'simples';
  return 'completa';
}

export function ehConferenciaNfPcValida(data: Date): boolean {
  return data.getTime() >= DOUBLE_CHECKIN_CONFERENCIA_NF_PC_DESDE.getTime();
}
