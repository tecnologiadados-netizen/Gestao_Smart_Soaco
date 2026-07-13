import type { FaltaRow } from "@rh/types/api";
import { diasPerdidosEquivalentes, normalizeText } from "@rh/pages/FaltasAtestados/faltas-dias-equivalentes";

const DIA_SEMANA_LABEL = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
] as const;

const DIA_SEMANA_ORDEM = [1, 2, 3, 4, 5, 6, 0] as const;

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Registros cujo tipo indica atestado médico (variações como ATESTADO, ATESTADO MÉDICO). */
export function isRegistroAtestado(row: FaltaRow): boolean {
  const tipo = normalizeText(row.tipo);
  if (!tipo) return false;
  return tipo.includes("ATEST");
}

export type AtestadosRelatorioBarItem = { name: string; quantidade: number };

/** Um ponto da série mensal (contagem de atestados no mês). */
export type AtestadosEvolucaoPonto = {
  ym: string;
  /** Rótulo curto para o eixo (ex.: jan. de 2024). */
  label: string;
  quantidade: number;
  /** Soma dos dias perdidos equivalentes dos atestados naquele mês. */
  diasPerdidosMes: number;
};

export type AtestadosRelatorioModel = {
  totalAtestados: number;
  totalDiasPerdidos: number;
  localMaisRecorrente: string;
  diaMaisRecorrente: string;
  medicoMaisRecorrente: string;
  /** Contagem de atestados por mês (YYYY-MM), ordenado no tempo. */
  evolucaoTemporal: AtestadosEvolucaoPonto[];
  barrasLocais: AtestadosRelatorioBarItem[];
  barrasDiasSemana: AtestadosRelatorioBarItem[];
  barrasMedicos: AtestadosRelatorioBarItem[];
  /** Ranking dos CIDs / motivos registrados na coluna CID. */
  barrasMotivosCid: AtestadosRelatorioBarItem[];
};

function modeStringKey(map: Map<string, number>, emptyLabel: string): string {
  let best = emptyLabel;
  let bestN = 0;
  for (const [k, v] of map) {
    if (v > bestN || (v === bestN && k.localeCompare(best, "pt-BR") < 0)) {
      best = k;
      bestN = v;
    }
  }
  return bestN === 0 ? emptyLabel : best;
}

function modeWeekday(map: Map<number, number>): string {
  let bestIdx = -1;
  let bestN = 0;
  for (const [wd, v] of map) {
    if (v > bestN || (v === bestN && wd < bestIdx)) {
      bestIdx = wd;
      bestN = v;
    }
  }
  if (bestN === 0 || bestIdx < 0) return "—";
  return DIA_SEMANA_LABEL[bestIdx] ?? "—";
}

/** Ordena por quantidade (desc) e nome; devolve todos os itens do mapa (ranking completo). */
function rankingCompletoPorCount(map: Map<string, number>): AtestadosRelatorioBarItem[] {
  const entries = [...map.entries()];
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
  return entries.map(([name, quantidade]) => ({ name, quantidade }));
}

function ymDoRegistro(dataRaw: string): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(String(dataRaw ?? "").trim());
  if (!m) return null;
  return `${m[1]}-${m[2]}`;
}

/** Filtro cruzado (estilo Power BI): várias dimensões em AND sobre os atestados do colaborador. */
export type AtestadoCrossFilter = {
  local?: string;
  medico?: string;
  cid?: string;
  /** 0 = domingo … 6 = sábado (`Date.getDay`). */
  diaSemana?: number;
  /** yyyy-mm */
  mesYm?: string;
};

export function diaSemanaLabelToWeekdayIndex(label: string): number | null {
  const t = label.trim();
  for (let i = 0; i < DIA_SEMANA_LABEL.length; i++) {
    if (DIA_SEMANA_LABEL[i] === t) return i;
  }
  return null;
}

export function applyFiltrosAtestados(rows: FaltaRow[], f: AtestadoCrossFilter): FaltaRow[] {
  let out = rows.filter(isRegistroAtestado);
  const emptyLoc = "—";
  const emptyMed = "—";
  const emptyCid = "—";

  if (f.local !== undefined) {
    const want = String(f.local).trim() || emptyLoc;
    out = out.filter((r) => (String(r.localAtendimento ?? "").trim() || emptyLoc) === want);
  }
  if (f.medico !== undefined) {
    const want = String(f.medico).trim() || emptyMed;
    out = out.filter((r) => (String(r.medicoResponsavel ?? "").trim() || emptyMed) === want);
  }
  if (f.cid !== undefined) {
    const want = String(f.cid).trim() || emptyCid;
    out = out.filter((r) => (String(r.cid ?? "").trim() || emptyCid) === want);
  }
  if (f.diaSemana !== undefined) {
    const wd = f.diaSemana;
    out = out.filter((r) => {
      const d = parseIsoDate(String(r.data ?? ""));
      return d != null && d.getDay() === wd;
    });
  }
  if (f.mesYm !== undefined) {
    const ym = f.mesYm;
    out = out.filter((r) => ymDoRegistro(String(r.data ?? "")) === ym);
  }
  return out;
}

function labelMesAnoCurto(ym: string): string {
  const [yStr, mStr] = ym.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return ym;
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(new Date(y, m - 1, 1));
}

export function buildAtestadosRelatorioModel(rows: FaltaRow[]): AtestadosRelatorioModel {
  const atest = rows.filter(isRegistroAtestado);

  let totalDias = 0;
  for (const r of atest) {
    totalDias += diasPerdidosEquivalentes(r).value;
  }

  const byLocal = new Map<string, number>();
  const byWd = new Map<number, number>();
  const byMed = new Map<string, number>();
  const byCid = new Map<string, number>();
  const byMes = new Map<string, number>();
  const byMesDiasPerdidos = new Map<string, number>();

  const emptyLoc = "—";
  const emptyMed = "—";
  const emptyCid = "—";

  for (const r of atest) {
    const locRaw = String(r.localAtendimento ?? "").trim();
    const loc = locRaw || emptyLoc;
    byLocal.set(loc, (byLocal.get(loc) ?? 0) + 1);

    const d = parseIsoDate(String(r.data ?? ""));
    if (d) {
      const wd = d.getDay();
      byWd.set(wd, (byWd.get(wd) ?? 0) + 1);
    }

    const medRaw = String(r.medicoResponsavel ?? "").trim();
    const med = medRaw || emptyMed;
    byMed.set(med, (byMed.get(med) ?? 0) + 1);

    const cidRaw = String(r.cid ?? "").trim();
    const cidLabel = cidRaw || emptyCid;
    byCid.set(cidLabel, (byCid.get(cidLabel) ?? 0) + 1);

    const ym = ymDoRegistro(String(r.data ?? ""));
    if (ym) {
      byMes.set(ym, (byMes.get(ym) ?? 0) + 1);
      const diasEq = diasPerdidosEquivalentes(r).value;
      byMesDiasPerdidos.set(ym, (byMesDiasPerdidos.get(ym) ?? 0) + diasEq);
    }
  }

  const evolucaoTemporal: AtestadosEvolucaoPonto[] = [...byMes.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([ym, quantidade]) => ({
      ym,
      label: labelMesAnoCurto(ym),
      quantidade,
      diasPerdidosMes: byMesDiasPerdidos.get(ym) ?? 0,
    }));

  const barrasDiasSemana: AtestadosRelatorioBarItem[] = DIA_SEMANA_ORDEM.map((wd) => ({
    name: DIA_SEMANA_LABEL[wd],
    quantidade: byWd.get(wd) ?? 0,
  }));

  return {
    totalAtestados: atest.length,
    totalDiasPerdidos: totalDias,
    localMaisRecorrente: modeStringKey(byLocal, emptyLoc),
    diaMaisRecorrente: modeWeekday(byWd),
    medicoMaisRecorrente: modeStringKey(byMed, emptyMed),
    evolucaoTemporal,
    barrasLocais: rankingCompletoPorCount(byLocal),
    barrasDiasSemana,
    barrasMedicos: rankingCompletoPorCount(byMed),
    barrasMotivosCid: rankingCompletoPorCount(byCid),
  };
}
