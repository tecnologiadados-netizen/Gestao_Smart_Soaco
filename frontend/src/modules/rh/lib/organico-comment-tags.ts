export const ORGANICO_COMMENT_TAGS_CONFIG_KEY = "organico_comment_tags_catalog";

export const ORGANICO_COMMENT_TONE_OPTIONS = [
  { id: "positive", label: "🟢 Positivo" },
  { id: "neutral", label: "🟡 Neutro" },
  { id: "negative", label: "🔴 Negativo" },
  { id: "sensitive", label: "🔴🔒 Sensível" },
] as const;

export type OrganicoCommentToneId = (typeof ORGANICO_COMMENT_TONE_OPTIONS)[number]["id"];

export type OrganicoCommentTagOption = {
  id: string;
  tone: OrganicoCommentToneId;
  label: string;
};

export const DEFAULT_ORGANICO_COMMENT_TAG_OPTIONS: OrganicoCommentTagOption[] = [
  { id: "1", tone: "positive", label: "🌟 Destaque / Reconhecimento" },
  { id: "2", tone: "positive", label: "📈 Evolução / Melhoria" },
  { id: "3", tone: "positive", label: "🤝 Colaboração / Trabalho em equipe" },
  { id: "4", tone: "positive", label: "🎯 Entrega acima do esperado" },
  { id: "5", tone: "positive", label: "💡 Iniciativa / Proatividade" },
  { id: "6", tone: "neutral", label: "📝 Observação geral" },
  { id: "7", tone: "neutral", label: "📅 Registro de evento" },
  { id: "8", tone: "neutral", label: "🔄 Mudança de comportamento" },
  { id: "9", tone: "neutral", label: "📊 Acompanhamento" },
  { id: "10", tone: "neutral", label: "🗂️ Informação administrativa" },
  { id: "11", tone: "negative", label: "⚠️ Alerta / Atenção" },
  { id: "12", tone: "negative", label: "📉 Baixo desempenho" },
  { id: "13", tone: "negative", label: "⏱️ Atraso / Falta" },
  { id: "14", tone: "negative", label: "🚫 Não conformidade (regra/política)" },
  { id: "15", tone: "negative", label: "😐 Comportamento inadequado" },
  { id: "16", tone: "negative", label: "🔁 Reincidência" },
  { id: "17", tone: "negative", label: "📣 Advertência informal" },
  { id: "18", tone: "sensitive", label: "⚖️ Advertência formal" },
  { id: "19", tone: "sensitive", label: "📄 Medida disciplinar" },
  { id: "20", tone: "sensitive", label: "🛑 Risco / Compliance" },
  { id: "21", tone: "sensitive", label: "🧠 Saúde / Bem-estar (sensível)" },
  { id: "22", tone: "sensitive", label: "📢 Denúncia / Ocorrência" },
] as const;

export const ORGANICO_COMMENT_TAG_OPTIONS = DEFAULT_ORGANICO_COMMENT_TAG_OPTIONS;
const LEGACY_DEFAULT_TAG_ID_MAP: Record<string, string> = {
  destaque_reconhecimento: "1",
  evolucao_melhoria: "2",
  colaboracao_trabalho_equipe: "3",
  entrega_acima_esperado: "4",
  iniciativa_proatividade: "5",
  observacao_geral: "6",
  registro_evento: "7",
  mudanca_comportamento: "8",
  acompanhamento: "9",
  informacao_administrativa: "10",
  alerta_atencao: "11",
  baixo_desempenho: "12",
  atraso_falta: "13",
  nao_conformidade: "14",
  comportamento_inadequado: "15",
  reincidencia: "16",
  advertencia_informal: "17",
  advertencia_formal: "18",
  medida_disciplinar: "19",
  risco_compliance: "20",
  saude_bem_estar: "21",
  denuncia_ocorrencia: "22",
};

export const ORGANICO_COMMENT_VISIBILITY_OPTIONS = [
  { id: "public", label: "🔓 Público" },
  { id: "restricted", label: "🔐 Restrito" },
  { id: "confidential", label: "🚫 Confidencial" },
] as const;

export type OrganicoCommentVisibilityId = (typeof ORGANICO_COMMENT_VISIBILITY_OPTIONS)[number]["id"];

function isValidToneId(value: string): value is OrganicoCommentToneId {
  return ORGANICO_COMMENT_TONE_OPTIONS.some((item) => item.id === value);
}

function isNumericTagId(value: string): boolean {
  return /^[1-9]\d*$/.test(value.trim());
}

function normalizeKnownTagId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (isNumericTagId(trimmed)) return String(Number(trimmed));
  return LEGACY_DEFAULT_TAG_ID_MAP[trimmed] ?? trimmed;
}

function getNextNumericTagId(usedIds: Set<string>): string {
  let next = 1;
  while (usedIds.has(String(next))) {
    next += 1;
  }
  return String(next);
}

export function buildNextOrganicoCommentTagId(options: Array<Pick<OrganicoCommentTagOption, "id">>): string {
  const usedIds = new Set(options.map((item) => normalizeKnownTagId(item.id)).filter(isNumericTagId));
  return getNextNumericTagId(usedIds);
}

export function normalizeOrganicoCommentTagId(tagId: string): string {
  return normalizeKnownTagId(tagId);
}

export function normalizeOrganicoCommentTagCatalog(input: unknown): OrganicoCommentTagOption[] {
  if (!Array.isArray(input)) {
    return [...DEFAULT_ORGANICO_COMMENT_TAG_OPTIONS];
  }

  const unique = new Map<string, OrganicoCommentTagOption>();
  const usedIds = new Set<string>();
  for (const entry of input) {
    if (!entry || typeof entry !== "object") continue;
    const source = entry as Record<string, unknown>;
    const label = String(source.label ?? "").trim();
    const rawTone = String(source.tone ?? "").trim();
    const normalizedTone = isValidToneId(rawTone) ? rawTone : null;
    const candidateId = normalizeKnownTagId(String(source.id ?? ""));
    if (!label || !normalizedTone) continue;
    const normalizedId =
      isNumericTagId(candidateId) && !usedIds.has(candidateId) ? candidateId : getNextNumericTagId(usedIds);
    usedIds.add(normalizedId);
    unique.set(normalizedId, {
      id: normalizedId,
      label,
      tone: normalizedTone,
    });
  }

  return unique.size > 0 ? Array.from(unique.values()) : [...DEFAULT_ORGANICO_COMMENT_TAG_OPTIONS];
}

export function stringifyOrganicoCommentTagCatalog(options: OrganicoCommentTagOption[]): string {
  return JSON.stringify(normalizeOrganicoCommentTagCatalog(options));
}

export function parseOrganicoCommentTagCatalog(raw: string | null | undefined): OrganicoCommentTagOption[] {
  if (!raw?.trim()) return [...DEFAULT_ORGANICO_COMMENT_TAG_OPTIONS];
  try {
    return normalizeOrganicoCommentTagCatalog(JSON.parse(raw));
  } catch {
    return [...DEFAULT_ORGANICO_COMMENT_TAG_OPTIONS];
  }
}

export function buildCommentTagAccess(
  optionsOrDefaultValue: OrganicoCommentTagOption[] | boolean = DEFAULT_ORGANICO_COMMENT_TAG_OPTIONS,
  defaultValue = true,
): Record<string, boolean> {
  const options = Array.isArray(optionsOrDefaultValue) ? optionsOrDefaultValue : DEFAULT_ORGANICO_COMMENT_TAG_OPTIONS;
  const resolvedDefaultValue = typeof optionsOrDefaultValue === "boolean" ? optionsOrDefaultValue : defaultValue;
  return Object.fromEntries(options.map((item) => [item.id, resolvedDefaultValue])) as Record<string, boolean>;
}

export function buildCommentVisibilityAccess(defaultValue = true): Record<OrganicoCommentVisibilityId, boolean> {
  return Object.fromEntries(
    ORGANICO_COMMENT_VISIBILITY_OPTIONS.map((item) => [item.id, defaultValue]),
  ) as Record<OrganicoCommentVisibilityId, boolean>;
}

export function getOrganicoCommentToneLabel(tone: OrganicoCommentToneId): string {
  return ORGANICO_COMMENT_TONE_OPTIONS.find((item) => item.id === tone)?.label ?? tone;
}

export function getOrganicoCommentTagLabel(tagId: string, options: OrganicoCommentTagOption[] = DEFAULT_ORGANICO_COMMENT_TAG_OPTIONS): string {
  const normalizedTagId = normalizeKnownTagId(tagId);
  return options.find((item) => item.id === normalizedTagId || item.id === tagId)?.label ?? String(tagId);
}

export function getOrganicoCommentTagTone(tagId: string, options: OrganicoCommentTagOption[] = DEFAULT_ORGANICO_COMMENT_TAG_OPTIONS): OrganicoCommentToneId {
  const normalizedTagId = normalizeKnownTagId(tagId);
  return options.find((item) => item.id === normalizedTagId || item.id === tagId)?.tone ?? "neutral";
}

export function getOrganicoCommentVisibilityLabel(visibility: OrganicoCommentVisibilityId | string): string {
  return ORGANICO_COMMENT_VISIBILITY_OPTIONS.find((item) => item.id === visibility)?.label ?? String(visibility);
}
