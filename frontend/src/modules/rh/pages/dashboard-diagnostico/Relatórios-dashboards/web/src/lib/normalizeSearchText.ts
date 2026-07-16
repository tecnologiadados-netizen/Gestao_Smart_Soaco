/** Minúsculas + sem acentos/diacríticos — busca pt-BR insensível a maiúsculas e acentuação. */
export function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

/** `haystack` contém `needle` (ambos normalizados para busca). */
export function textIncludesSearch(haystack: unknown, needle: unknown): boolean {
  const q = normalizeSearchText(needle).trim()
  if (!q) return true
  return normalizeSearchText(haystack).includes(q)
}
