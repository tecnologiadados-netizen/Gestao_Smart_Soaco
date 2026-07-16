import { DEFAULT_DOCUMENT_CATEGORY_LABELS, resolveDocumentCategoryOptions } from "@rh/lib/organico-documents";
import type { ArchiveFolderOption } from "@rh/lib/organico-documents-api";
import { LAUNCH_DOC_TEST_FOLDER_ID } from "@rh/lib/launch-document-queue";
import { isSuspensaoDisciplinarAusenciaTipo } from "@rh/pages/FaltasAtestados/sync-suspensao-ausencia-to-sancoes";

function normalizeTipoTexto(tipo: string): string {
  return String(tipo ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

export function tipoExigeAtendimentoMedico(tipo: string): boolean {
  const u = normalizeTipoTexto(tipo);
  return u.includes("ATESTADO") || u.includes("DECLARACAO");
}

export function tipoEhAtestado(tipo: string): boolean {
  return normalizeTipoTexto(tipo).includes("ATESTADO");
}

export const CATEGORIA_DOCUMENTO_FALTA_JUSTIFICADA_COLABORADOR = "Justificativa pontual de falta";

export function isFaltaJustificadaPeloColaboradorTipo(tipo: string): boolean {
  return normalizeTipoTexto(tipo) === "FALTA JUSTIFICADA PELO COLABORADOR";
}

export function ausenciaExigeObservacoes(tipo: string): boolean {
  return isFaltaJustificadaPeloColaboradorTipo(tipo);
}

export function ausenciaExigeAnexoDocumento(tipo: string): boolean {
  const t = String(tipo ?? "").trim();
  if (!t) return false;
  return tipoExigeAtendimentoMedico(t) || isSuspensaoDisciplinarAusenciaTipo(t);
}

/** Exibe anexo no lançamento; o arquivo em si é opcional (ex.: falta justificada pelo colaborador). */
export function ausenciaPermiteAnexoOpcionalDocumento(tipo: string): boolean {
  return isFaltaJustificadaPeloColaboradorTipo(tipo);
}

export function ausenciaSuportaAnexoDocumento(tipo: string): boolean {
  return ausenciaExigeAnexoDocumento(tipo) || ausenciaPermiteAnexoOpcionalDocumento(tipo);
}

export function isAdvertenciaVerbalSancaoTipo(tipo: string): boolean {
  const u = normalizeTipoTexto(tipo);
  if (!u.includes("VERBAL")) return false;
  if (u.includes("DISCIPLINAR")) return false;
  return /^AD\.?\s*VERBAL/.test(u) || (u.startsWith("AD") && u.includes("VERBAL")) || u.includes("ADVERT");
}

export function sancaoExigeAnexoDocumento(isNewLaunch: boolean, tipo = ""): boolean {
  if (!isNewLaunch) return false;
  return !isAdvertenciaVerbalSancaoTipo(tipo);
}

/** Advertência verbal (ex.: AD. VERBAL): anexo exibido, mas opcional na maioria dos lançamentos. */
export function sancaoPermiteAnexoOpcionalDocumento(isNewLaunch: boolean, tipo: string): boolean {
  return isNewLaunch && isAdvertenciaVerbalSancaoTipo(tipo);
}

export function sancaoSuportaAnexoDocumento(isNewLaunch: boolean, tipo: string): boolean {
  return sancaoExigeAnexoDocumento(isNewLaunch, tipo) || sancaoPermiteAnexoOpcionalDocumento(isNewLaunch, tipo);
}

function pickCategoryFromOptions(preferred: string, categoryOptions: string[]): string {
  const normalizedPreferred = preferred.trim();
  const exact = categoryOptions.find((c) => c.localeCompare(normalizedPreferred, "pt-BR", { sensitivity: "base" }) === 0);
  if (exact) return exact;
  const partial = categoryOptions.find((c) =>
    c.toLocaleLowerCase("pt-BR").includes(normalizedPreferred.toLocaleLowerCase("pt-BR")),
  );
  if (partial) return partial;
  if (categoryOptions.includes(normalizedPreferred)) return normalizedPreferred;
  if (normalizedPreferred) return normalizedPreferred;
  return categoryOptions[0] ?? "";
}

export function resolveLaunchDocumentCategory(input: {
  source: "ausencia" | "sancao";
  tipo: string;
  categoryOptions?: string[];
}): string {
  const options =
    input.categoryOptions && input.categoryOptions.length > 0
      ? input.categoryOptions
      : [...DEFAULT_DOCUMENT_CATEGORY_LABELS];

  if (input.source === "sancao" || isSuspensaoDisciplinarAusenciaTipo(input.tipo)) {
    return pickCategoryFromOptions("Sanção", options);
  }
  if (tipoEhAtestado(input.tipo)) {
    return pickCategoryFromOptions("Atestado", options);
  }
  if (normalizeTipoTexto(input.tipo).includes("DECLARACAO")) {
    const declaracao = options.find((c) => c.toLocaleLowerCase("pt-BR").includes("declara"));
    return declaracao ?? pickCategoryFromOptions("Atestado", options);
  }
  if (isFaltaJustificadaPeloColaboradorTipo(input.tipo)) {
    return pickCategoryFromOptions(CATEGORIA_DOCUMENTO_FALTA_JUSTIFICADA_COLABORADOR, options);
  }
  return pickCategoryFromOptions("Atestado", options);
}

export function buildLaunchDocumentTitle(input: {
  category: string;
  dataIso: string;
  colaboradorNome: string;
  customTitle?: string;
}): string {
  const custom = String(input.customTitle ?? "").trim();
  if (custom) return custom;
  const data = String(input.dataIso ?? "").trim().slice(0, 10);
  const dataFmt = data ? data.split("-").reverse().join("/") : "";
  const nome = String(input.colaboradorNome ?? "").trim();
  const parts = [input.category.trim(), dataFmt, nome].filter(Boolean);
  return parts.join(" — ");
}

/** Nomes preferidos para pasta de destino ao lançar ausência/sanção com anexo. */
const PREFERRED_LAUNCH_FOLDER_NAMES = [
  "atestados",
  "atestado",
  "justificativa",
  "justificativas",
  "atendimento",
  "saude",
  "sanção",
  "sancao",
];

function normalizeFolderLabel(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function folderOptionDisplayName(option: ArchiveFolderOption): string {
  const parts = option.label.split("·");
  return (parts.length > 1 ? parts[parts.length - 1] : option.label).trim();
}

/** Escolhe pasta padrão (ex.: global "Atestados") ignorando a pasta sintética de teste. */
export function pickDefaultLaunchFolderOption(
  options: ArchiveFolderOption[],
): { id: string; scope: "global" | "local" } | null {
  const realOptions = options.filter((option) => option.id !== LAUNCH_DOC_TEST_FOLDER_ID);
  if (realOptions.length === 0) {
    if (options.length === 1) {
      return { id: options[0].id, scope: options[0].scope };
    }
    return null;
  }

  for (const preferred of PREFERRED_LAUNCH_FOLDER_NAMES) {
    const match = realOptions.find((option) => {
      const name = normalizeFolderLabel(folderOptionDisplayName(option));
      return name === preferred || name.includes(preferred) || preferred.includes(name);
    });
    if (match) {
      return { id: match.id, scope: match.scope };
    }
  }

  if (realOptions.length === 1) {
    return { id: realOptions[0].id, scope: realOptions[0].scope };
  }

  return null;
}

export { resolveDocumentCategoryOptions };
