/**
 * O selo "Conferido c/ divergência" vale só quando a nota conferida ainda tem
 * divergência real. Divergência só benigna permanece "Conferido".
 */
export function documentoConferidoComDivergencia(
  conferido: boolean,
  temDivergenciaReal: boolean
): boolean {
  return conferido && temDivergenciaReal;
}
