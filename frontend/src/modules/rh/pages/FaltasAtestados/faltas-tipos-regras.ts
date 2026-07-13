import type { FaltaRow } from "@rh/types/api";
import { normalizeText } from "@rh/pages/FaltasAtestados/faltas-dias-equivalentes";

export const FALTAS_TIPOS_REGRAS_CONFIG_KEY = "faltas_tipos_regras";

export type ClassificacaoAusenciaRegra = "justificada" | "injustificada";

export type FaltaTipoRegra = {
  tipo: string;
  contabilizaIndicadores: boolean;
  classificacao: ClassificacaoAusenciaRegra | null;
  exibirNoDetalhamento: boolean;
};

export const TIPOS_JUSTIFICADAS_DEFAULT = new Set([
  "ATESTADO",
  "DECLARACAO COMPARECIMENTO",
  "DECLARACAO ACOMPANHAMENTO",
  "SUSPENSAO DISCIPLINAR",
  "LICENCA OBITO",
  "COMPENSACAO BH",
  "LIBERACAO RH",
  "COMPENSACAO BH ( FALTA PROCEDENTE TODAVIA LIDER ACAO CONTIGENTE )",
  "FOLGA TRE",
  "CR DESLIGADO ANTES DA APLICACAO",
  "LICENCA PATERNIDADE",
  "LICENSA PATERNIDADE",
  "LICENCA CASAMENTO",
  "CR PEDIU DESLIGAMENTO",
]);

export const TIPOS_INJUSTIFICADAS_DEFAULT = new Set([
  "FALTA INJUSTIFICADA PELO COLABORADOR",
  "FALTA INJUSTIFICADA PROCEDENTE",
  "FALTA JUSTIFICADA PELO COLABORADOR",
]);

type ConfigPayload = {
  version?: number;
  regras?: unknown;
};

export function normalizeTipoRegraKey(value: string): string {
  return normalizeText(value);
}

function normalizeRegra(raw: unknown): FaltaTipoRegra | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const tipo = String(obj.tipo ?? "").trim();
  if (!tipo) return null;

  const contabilizaIndicadores = obj.contabilizaIndicadores !== false;
  const classificacaoRaw = String(obj.classificacao ?? "").trim().toLowerCase();
  const classificacao =
    classificacaoRaw === "justificada" || classificacaoRaw === "injustificada"
      ? (classificacaoRaw as ClassificacaoAusenciaRegra)
      : null;
  const exibirNoDetalhamento = obj.exibirNoDetalhamento !== false;

  return {
    tipo,
    contabilizaIndicadores,
    classificacao: contabilizaIndicadores ? classificacao : null,
    exibirNoDetalhamento,
  };
}

export function parseFaltasTiposRegrasConfig(value: string | null | undefined): FaltaTipoRegra[] {
  if (!value || !String(value).trim()) return [];
  try {
    const parsed = JSON.parse(value) as ConfigPayload;
    const regras = Array.isArray(parsed?.regras) ? parsed.regras : [];
    const map = new Map<string, FaltaTipoRegra>();
    for (const item of regras) {
      const regra = normalizeRegra(item);
      if (!regra) continue;
      const key = normalizeTipoRegraKey(regra.tipo);
      if (!key) continue;
      map.set(key, regra);
    }
    return [...map.values()].sort((a, b) => a.tipo.localeCompare(b.tipo, "pt-BR"));
  } catch {
    return [];
  }
}

export function stringifyFaltasTiposRegrasConfig(regras: FaltaTipoRegra[]): string {
  const sanitized = regras
    .map((r) => normalizeRegra(r))
    .filter((r): r is FaltaTipoRegra => r != null)
    .sort((a, b) => a.tipo.localeCompare(b.tipo, "pt-BR"));
  return JSON.stringify({ version: 1, regras: sanitized });
}

export function buildFaltasTiposRegrasMap(regras: FaltaTipoRegra[]): Map<string, FaltaTipoRegra> {
  const map = new Map<string, FaltaTipoRegra>();
  for (const regra of regras) {
    const key = normalizeTipoRegraKey(regra.tipo);
    if (!key) continue;
    map.set(key, regra);
  }
  return map;
}

export function findRegraByTipo(
  map: Map<string, FaltaTipoRegra>,
  tipoValue: string | null | undefined,
): FaltaTipoRegra | null {
  const key = normalizeTipoRegraKey(String(tipoValue ?? ""));
  if (!key) return null;
  return map.get(key) ?? null;
}

export function rowContaNosIndicadores(row: FaltaRow, map: Map<string, FaltaTipoRegra>): boolean {
  const regra = findRegraByTipo(map, row.tipo);
  if (!regra) return true;
  return regra.contabilizaIndicadores;
}

export function rowExibeNoDetalhamento(row: FaltaRow, map: Map<string, FaltaTipoRegra>): boolean {
  const regra = findRegraByTipo(map, row.tipo);
  if (!regra) return true;
  if (regra.contabilizaIndicadores) return true;
  return regra.exibirNoDetalhamento;
}

export function classificarTipoFallback(tipo: string): ClassificacaoAusenciaRegra | null {
  const n = normalizeTipoRegraKey(tipo);
  if (!n) return null;
  if (TIPOS_JUSTIFICADAS_DEFAULT.has(n)) return "justificada";
  if (TIPOS_INJUSTIFICADAS_DEFAULT.has(n)) return "injustificada";
  return null;
}
