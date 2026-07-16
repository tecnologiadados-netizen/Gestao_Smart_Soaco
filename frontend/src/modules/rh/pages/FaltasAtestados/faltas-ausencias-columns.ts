import type { FaltaRow } from "@rh/types/api";

export const ALL_COLUMNS: { key: keyof FaltaRow; label: string; listId?: string }[] = [
  { key: "data", label: "DATA" },
  { key: "mesFalta", label: "MÊS FALTA" },
  { key: "matricula", label: "MATRÍCULA" },
  { key: "nomeFuncionario", label: "NOME FUNCIONÁRIO" },
  { key: "endereco", label: "ENDEREÇO" },
  { key: "area", label: "ÁREA" },
  { key: "setor", label: "SETOR" },
  { key: "lider", label: "LÍDER" },
  { key: "periodo", label: "PERÍODO", listId: "faltas-dl-periodo" },
  { key: "qntd", label: "QNTD" },
  { key: "diasTurno", label: "DIAS/HORAS" },
  { key: "tipo", label: "TIPO", listId: "faltas-dl-tipo" },
  { key: "cid", label: "CID", listId: "faltas-dl-cid" },
  { key: "localAtendimento", label: "LOCAL ATENDIMENTO" },
  { key: "medicoResponsavel", label: "MÉDICO RESPONSAVEL" },
  { key: "observacoes", label: "OBSERVAÇÕES" },
];

export const HIDDEN_COLUMNS_LS_KEY = "faltas-ausencias-hidden-columns-v1";

export function loadHiddenColumns(): Array<keyof FaltaRow> {
  try {
    const raw = localStorage.getItem(HIDDEN_COLUMNS_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const allowed = new Set(ALL_COLUMNS.map((column) => column.key));
    const normalized = parsed.filter((item): item is keyof FaltaRow => typeof item === "string" && allowed.has(item as keyof FaltaRow));
    return normalized.length >= ALL_COLUMNS.length ? [] : normalized;
  } catch {
    return [];
  }
}

/** Mesma convenção da aba Faltas e do painel de ausências do dashboard (`matricula|||nome`). */
export function faltaRowColaboradorKey(row: FaltaRow): string {
  const nome = String(row.nomeFuncionario ?? "").trim() || "Sem nome";
  const mat = String(row.matricula ?? "").trim();
  return mat ? `${mat}|||${nome}` : `|||${nome}`;
}
