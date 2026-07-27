/**
 * Resolução de empresa/unidade a partir da linha do Orgânico.
 * Alinhado às abas do Orgânico (Só Aço, Só Móveis, Refrigeração, R N Marques, Loja).
 */

export const ORGANICO_EMPRESA_SO_ACO = "SÓ AÇO INDUSTRIAL LTDA";

export function normalizeEmpresaText(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase();
}

export function normalizeEmpresaTabName(value: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) return ORGANICO_EMPRESA_SO_ACO;
  const norm = normalizeEmpresaText(raw);
  if (norm.includes("SO ACO") || norm.includes("ACO INDUSTRIAL")) return ORGANICO_EMPRESA_SO_ACO;
  if (norm.includes("SO MOVEIS") || norm.includes("MOVEIS")) return "SÓ MÓVEIS";
  if (norm.includes("REFRIGER")) return "SO REFRIGERAÇÃO";
  if (norm.includes("RN MARQUES") || norm.includes("R N MARQUES")) return "R N MARQUES ARAUJO";
  if (norm === "LOJA" || norm.startsWith("LOJA ") || norm.includes(" LOJA")) return "LOJA";
  return raw;
}

/**
 * Infere a aba de empresa pela linha (SETOR / ÁREA / DIRETORIA).
 * Área ou setor "LOJA" → unidade Loja (não entra no mapa da Só Aço Industrial).
 */
export function resolveEmpresaFromOrganicoCells(input: {
  setor?: string | null;
  area?: string | null;
  diretoria?: string | null;
  historicoLocal?: boolean;
}): string {
  const setor = normalizeEmpresaText(String(input.setor ?? "").trim());
  const area = normalizeEmpresaText(String(input.area ?? "").trim());
  const diretoria = normalizeEmpresaText(String(input.diretoria ?? "").trim());
  const joined = `${setor} ${area} ${diretoria}`;

  if (joined.includes("REFRIGER")) return normalizeEmpresaTabName("SO REFRIGERAÇÃO");
  if (joined.includes("MOVEIS") || joined.includes("MOVEL")) return normalizeEmpresaTabName("SÓ MÓVEIS");
  if (joined.includes("RN MARQUES") || joined.includes("R N MARQUES")) {
    return normalizeEmpresaTabName("R N MARQUES ARAUJO");
  }
  // Unidade Loja (ex.: PAULO CEZAR com ÁREA=LOJA) — fora do organograma da fábrica.
  if (area === "LOJA" || setor.includes("LOJA")) {
    return "LOJA";
  }
  if (input.historicoLocal && String(input.diretoria ?? "").trim()) {
    return normalizeEmpresaTabName(String(input.diretoria ?? "").trim());
  }
  return ORGANICO_EMPRESA_SO_ACO;
}

export function isEmpresaSoAcoIndustrial(empresaTab: string): boolean {
  return normalizeEmpresaTabName(empresaTab) === ORGANICO_EMPRESA_SO_ACO;
}
