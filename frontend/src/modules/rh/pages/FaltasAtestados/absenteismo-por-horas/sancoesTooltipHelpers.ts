import type { SancaoDisciplinarRow } from "@rh/types/api";

export function clampIsoDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? "").trim()) ? String(value).trim() : "";
}

/** Mesma normalização usada no match Orgânico / planilha de ponto. */
export function normNomeKey(nome: string): string {
  return String(nome ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toUpperCase();
}

/** Sanções do colaborador (match por nome normalizado), mais recentes primeiro. */
export function sancoesDoColaboradorPorNome(
  rows: SancaoDisciplinarRow[],
  nomeAlvo: string,
): SancaoDisciplinarRow[] {
  const k = normNomeKey(nomeAlvo);
  if (!k) return [];
  const list = rows.filter((r) => normNomeKey(r.nomeFuncionario) === k);
  list.sort((a, b) => clampIsoDate(b.dataAplicacao).localeCompare(clampIsoDate(a.dataAplicacao)));
  return list;
}

/** Ex.: "terça-feira, 2 de dezembro de 2025" — alinhado ao painel de sanções do absenteísmo. */
export function formatDataAplicacaoLongaPt(iso: string): string {
  const raw = String(iso ?? "").trim();
  if (!raw) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!m) return "—";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}
