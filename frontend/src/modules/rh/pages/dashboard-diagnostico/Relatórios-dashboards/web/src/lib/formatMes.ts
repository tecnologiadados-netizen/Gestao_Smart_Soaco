const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Converte `YYYY-MM` em `jan/2024`. */
export function formatMesCurto(anoMes: string): string {
  const [y, m] = anoMes.split('-')
  if (!y || !m) return anoMes
  const mi = Number(m) - 1
  const label = MESES[mi] ?? m
  return `${label}/${y}`
}
