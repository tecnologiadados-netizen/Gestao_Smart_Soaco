/**
 * Padrão da coluna MÊS FALTA: abreviação minúscula com ponto (`jan.`, `fev.`, `set.`).
 * Manter em sincronia com `backend/src/rh/utils/normalizarMesFalta.ts`.
 */
const MES_FALTA_PADRAO: Record<string, string> = {
  jan: "jan.",
  janeiro: "jan.",
  fev: "fev.",
  fevereiro: "fev.",
  mar: "mar.",
  marco: "mar.",
  abr: "abr.",
  abril: "abr.",
  mai: "mai.",
  maio: "mai.",
  jun: "jun.",
  junho: "jun.",
  jul: "jul.",
  julho: "jul.",
  ago: "ago.",
  agosto: "ago.",
  set: "set.",
  setembro: "set.",
  out: "out.",
  outubro: "out.",
  nov: "nov.",
  novembro: "nov.",
  dez: "dez.",
  dezembro: "dez.",
};

/** Converte nome ou abreviação de mês para `mmm.`. Texto que não é mês permanece como está. */
export function normalizarMesFalta(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const key = raw
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\./g, "")
    .replace(/\s+/g, "");
  return MES_FALTA_PADRAO[key] ?? raw;
}
