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

const EMPRESA_SO_MOVEIS = "SÓ MÓVEIS";
const EMPRESA_REFRIGERACAO = "SO REFRIGERAÇÃO";
const EMPRESA_RN_MARQUES = "R N MARQUES ARAUJO";
const EMPRESA_LOJA = "LOJA";

function textoIndicaLoja(norm: string): boolean {
  return norm === "LOJA" || norm.startsWith("LOJA ") || norm.endsWith(" LOJA") || norm.includes(" LOJA ");
}

/**
 * Unidade específica do grupo. Móveis, refrigeração, R N Marques e Loja vencem
 * o nome genérico "Só Aço", senão "SÓ AÇO MÓVEIS" e "SÓ AÇO - LOJA" caem todos
 * na mesma aba.
 */
export function unidadeEspecificaEmpresa(parts: Array<string | null | undefined>): string | null {
  const norms = parts.map((part) => normalizeEmpresaText(String(part ?? "").trim())).filter(Boolean);
  if (norms.length === 0) return null;
  const joined = norms.join(" ");
  if (joined.includes("REFRIGER")) return EMPRESA_REFRIGERACAO;
  if (joined.includes("MOVEIS") || joined.includes("MOVEL")) return EMPRESA_SO_MOVEIS;
  if (joined.includes("RN MARQUES") || joined.includes("R N MARQUES")) return EMPRESA_RN_MARQUES;
  if (norms.some(textoIndicaLoja)) return EMPRESA_LOJA;
  return null;
}

export function normalizeEmpresaTabName(value: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) return ORGANICO_EMPRESA_SO_ACO;
  const especifica = unidadeEspecificaEmpresa([raw]);
  if (especifica) return especifica;
  const norm = normalizeEmpresaText(raw);
  if (norm.includes("SO ACO") || norm.includes("ACO INDUSTRIAL")) return ORGANICO_EMPRESA_SO_ACO;
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
  const especifica = unidadeEspecificaEmpresa([input.setor, input.area, input.diretoria]);
  if (especifica) return especifica;
  if (input.historicoLocal && String(input.diretoria ?? "").trim()) {
    return normalizeEmpresaTabName(String(input.diretoria ?? "").trim());
  }
  return ORGANICO_EMPRESA_SO_ACO;
}

export function isEmpresaSoAcoIndustrial(empresaTab: string): boolean {
  return normalizeEmpresaTabName(empresaTab) === ORGANICO_EMPRESA_SO_ACO;
}

/**
 * Empresa da Secullum no mesmo critério das abas do Orgânico.
 * Nome da empresa vem primeiro; se não houver, infere por setor, área e diretoria.
 */
export function resolveEmpresaTabFromSecullumFuncionario(f: {
  empresaNome?: string | null;
  setor?: string | null;
  area?: string | null;
  [key: string]: unknown;
}): string {
  const raw = f as Record<string, unknown>;
  const estrutura = String(
    raw.Estrutura && typeof raw.Estrutura === "object"
      ? (raw.Estrutura as Record<string, unknown>).Descricao ?? ""
      : "",
  ).trim();
  const departamento = String(
    raw.Departamento && typeof raw.Departamento === "object"
      ? (raw.Departamento as Record<string, unknown>).Descricao ?? ""
      : "",
  ).trim();
  const empresaExtra = String(
    raw.EmpresaDescricao ??
      raw.empresaDescricao ??
      raw.Empresa ??
      raw.empresa ??
      raw.FilialDescricao ??
      raw.filialDescricao ??
      "",
  ).trim();
  const empresaNomeDireta = String(f.empresaNome ?? "").trim();
  const especifica = unidadeEspecificaEmpresa([
    empresaNomeDireta,
    empresaExtra,
    f.setor,
    f.area,
    estrutura,
    departamento,
  ]);
  if (especifica) return especifica;
  if (empresaNomeDireta) return normalizeEmpresaTabName(empresaNomeDireta);
  if (empresaExtra) return normalizeEmpresaTabName(empresaExtra);
  return ORGANICO_EMPRESA_SO_ACO;
}
