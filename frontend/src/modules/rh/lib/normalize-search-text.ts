/** Minúsculas + sem acentos/diacríticos — busca pt-BR insensível a maiúsculas e acentuação. */
export function normalizeSearchText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/** `haystack` contém `needle` (ambos normalizados para busca). */
export function textIncludesSearch(haystack: unknown, needle: unknown): boolean {
  const q = normalizeSearchText(needle).trim();
  if (!q) return true;
  return normalizeSearchText(haystack).includes(q);
}

/** Todas as palavras de `query` aparecem em `haystack` (busca por tokens). */
export function textMatchesSearchQuery(haystack: unknown, query: unknown): boolean {
  const q = String(query ?? "").trim();
  if (!q) return true;
  const hay = normalizeSearchText(haystack);
  const tokens = q
    .split(/\s+/)
    .map((t) => normalizeSearchText(t.trim()))
    .filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((t) => hay.includes(t));
}

/** Pontuação para `Command filter` (cmdk): 1 = match, 0 = sem match. */
export function commandFilterScore(value: unknown, search: unknown): number {
  return textIncludesSearch(value, search) ? 1 : 0;
}
