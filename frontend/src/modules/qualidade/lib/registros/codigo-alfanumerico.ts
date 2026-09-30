/** Letras e números, sempre em caixa alta. */
export function codigoAlfanumericoMaiusculo(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^0-9A-Za-z]/g, "")
    .toUpperCase();
}
