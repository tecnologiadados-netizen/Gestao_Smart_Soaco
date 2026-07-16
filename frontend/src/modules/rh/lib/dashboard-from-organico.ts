/**
 * Deriva indicadores do Dashboard a partir das linhas do Orgânico (planilha/API).
 *
 * - Critério “ativo”: nome preenchido e status ≠ desligado (inclui Ativo, Férias, Afastado).
 * - Custo Folha Mensal: soma da coluna CTPS somente para ativos (folha em exercício).
 * - Total colaboradores / setores / gráficos: mesma base de ativos.
 * - Novas admissões: ativos admitidos no mês civil corrente.
 */

import type { OrganicoRow } from "@rh/types/api";
import type { SecullumFuncionario } from "@rh/lib/api-client";
import { ORGANICO_IDX, parseDateBR, parseCtpsToNumber } from "@rh/pages/Organico/organico-derive";
import { ORGANICO_NUM_COLUNAS } from "@rh/pages/Organico/organico-headers";
import { migrateOrganicoRowSchema } from "@rh/pages/Organico/organico-import-column-map";
import { calcularFormulasRow } from "@rh/pages/Organico/organico-formulas";
import type { OrganicoSheetRow } from "@rh/pages/Organico/useOrganicoImport";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"] as const;

function strCell(row: unknown[], i: number): string {
  return row[i] != null ? String(row[i]).trim() : "";
}

/** Desligados não entram na folha nem no headcount de “ativos”. */
function isDesligadoOrganico(row: unknown[]): boolean {
  const s = strCell(row, ORGANICO_IDX.STATUS).toUpperCase();
  return s.includes("DESLIG") || s === "DESLIGADO";
}

function rowValues(r: OrganicoRow): unknown[] {
  const v = r?.values;
  return Array.isArray(v) ? v : [];
}

export interface DashboardDerivedAlert {
  message: string;
  severity: "red" | "yellow";
  sector: string;
}

/** Ponto da série “Evolução do turnover” (valor + insumos do cálculo mensal). */
export interface TurnoverSeriesPoint {
  month: string;
  year: number;
  value: number;
  admissoesMes: number;
  demissoesMes: number;
  /** (ativos início + ativos fim) ÷ 2 no mês */
  mediaAtivos: number;
  /**
   * Maior headcount ao fim de algum dia civil do mês (só referência; não entra na fórmula do %).
   */
  picoAtivosMes: number;
}

export interface DashboardFromOrganico {
  totalColaboradores: number;
  custoFolhaMensal: number;
  turnoverPct: number;
  absenteismoPct: number;
  mediaTempoCasaMeses: number;
  mediaSalarialCtps: number;
  setoresAtivos: number;
  novasAdmissoesMes: number;
  alertasAtivos: number;
  turnoverData: TurnoverSeriesPoint[];
  headcountData: { sector: string; count: number }[];
  sectorCostData: { name: string; value: number }[];
  alerts: DashboardDerivedAlert[];
}

export interface TurnoverPersonLike {
  admissao?: string;
  demissao?: string;
  /** Setor atual (orgânico ou Secullum) — usado para filtrar a série de turnover. */
  setor?: string;
}

/** Mesma normalização do Top Setores (trim ou "Sem setor"). */
export function normalizeSetorTurnoverLabel(value: unknown): string {
  const s = String(value ?? "").trim();
  return s || "Sem setor";
}

function toMonthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function toMonthEnd(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

function demissaoDateFor(
  row: unknown[],
  demissaoByMatricula?: Record<string, string>
): Date | null {
  if (!demissaoByMatricula) return null;
  const mat = strCell(row, ORGANICO_IDX.MATRICULA);
  if (!mat) return null;
  const dem = demissaoByMatricula[mat];
  if (!dem) return null;
  return parseDateBR(String(dem).trim());
}

function rollingLast12MonthsFromNow(ref: Date): { year: number; month: number; label: string }[] {
  const out: { year: number; month: number; label: string }[] = [];
  for (let offset = 0; offset < 12; offset++) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - offset, 1);
    out.push({ year: d.getFullYear(), month: d.getMonth(), label: MESES[d.getMonth()] });
  }
  return out;
}

/** Média aritmética dos 12 pontos da série (KPI “Turnover” no dashboard). */
function averageTwelveMonthTurnover(turnoverData: { value: number }[]): number {
  if (turnoverData.length === 0) return 0;
  const sum = turnoverData.reduce((acc, d) => acc + d.value, 0);
  return Math.round((sum / turnoverData.length) * 10) / 10;
}

type TurnoverAdmDemCard = { adm: Date | null; dem: Date | null };

/**
 * Mesma regra do gráfico “Evolução do Turnover” (dashboard executivo): média entre headcount no 1º dia
 * e no último dia do mês civil, usando datas de admissão e demissão já parseadas.
 */
function computeMediaAtivosFromCards(cards: TurnoverAdmDemCard[], year: number, month: number): number {
  const monthStart = new Date(year, month, 1);
  const monthEnd = toMonthEnd(monthStart);
  let ativosInicio = 0;
  let ativosFim = 0;
  for (const { adm, dem } of cards) {
    const admittedAtStart = adm ? adm <= monthStart : true;
    const admittedAtEnd = adm ? adm <= monthEnd : true;
    const activeAtStart = admittedAtStart && (!dem || dem >= monthStart);
    const activeAtEnd = admittedAtEnd && (!dem || dem > monthEnd);
    if (activeAtStart) ativosInicio += 1;
    if (activeAtEnd) ativosFim += 1;
  }
  return (ativosInicio + ativosFim) / 2;
}

/**
 * “Média de ativos” do mês — idêntica ao memorial do turnover (Secullum ou orgânico+ dem por matrícula).
 * `month` = índice 0–11 (janeiro = 0).
 */
export function computeMediaAtivosMesFromPeople(
  people: TurnoverPersonLike[] | null | undefined,
  year: number,
  month: number,
  sectorFilter?: string | null,
): number {
  const list = Array.isArray(people) ? people : [];
  const filtered =
    sectorFilter != null && sectorFilter !== ""
      ? list.filter((p) => normalizeSetorTurnoverLabel(p.setor) === sectorFilter)
      : list;
  const cards: TurnoverAdmDemCard[] = filtered.map((p) => ({
    adm: parseDateBR(String(p.admissao ?? "").trim()),
    dem: parseDateBR(String(p.demissao ?? "").trim()),
  }));
  return computeMediaAtivosFromCards(cards, year, month);
}

/**
 * Série mensal (últimos 12 meses): ((Admissões + Desligamentos) / 2) / média de ativos no mês × 100.
 * “Média de ativos” = (headcount no 1º dia + headcount no último dia) / 2, por pessoa com admissão/demissão.
 * “Pico” = maior headcount ao fim de algum dia do mês (referência visual apenas).
 */
function buildTurnoverSeriesFromPeople(
  people: TurnoverPersonLike[],
  ref: Date,
  sectorFilter?: string | null
): TurnoverSeriesPoint[] {
  const filtered =
    sectorFilter != null && sectorFilter !== ""
      ? people.filter((p) => normalizeSetorTurnoverLabel(p.setor) === sectorFilter)
      : people;
  const rollingMonths = rollingLast12MonthsFromNow(ref);
  return rollingMonths.map(({ year, month, label }) => {
    const monthStart = new Date(year, month, 1);
    const monthEnd = toMonthEnd(monthStart);
    const cards = filtered.map((p) => ({
      adm: parseDateBR(String(p.admissao ?? "").trim()),
      dem: parseDateBR(String(p.demissao ?? "").trim()),
    }));

    let admissoesMes = 0;
    let demissoesMes = 0;

    for (const { adm, dem } of cards) {
      if (adm && adm.getFullYear() === year && adm.getMonth() === month) {
        admissoesMes += 1;
      }
      if (dem && dem.getFullYear() === year && dem.getMonth() === month) {
        demissoesMes += 1;
      }
    }

    const mediaAtivos = computeMediaAtivosFromCards(cards, year, month);

    const lastDay = monthEnd.getDate();
    let picoAtivosMes = 0;
    for (let day = 1; day <= lastDay; day++) {
      const dayEnd = new Date(year, month, day, 23, 59, 59, 999);
      let nFimDia = 0;
      for (const { adm, dem } of cards) {
        const admittedAtEnd = adm ? adm <= dayEnd : true;
        const activeAtEnd = admittedAtEnd && (!dem || dem > dayEnd);
        if (activeAtEnd) nFimDia += 1;
      }
      if (nFimDia > picoAtivosMes) picoAtivosMes = nFimDia;
    }

    const mediaMovimentacao = (admissoesMes + demissoesMes) / 2;
    const value = mediaAtivos > 0 ? (mediaMovimentacao / mediaAtivos) * 100 : 0;
    return {
      month: label,
      year,
      value: Math.round(value * 10) / 10,
      admissoesMes,
      demissoesMes,
      mediaAtivos: Math.round(mediaAtivos * 10) / 10,
      picoAtivosMes,
    };
  });
}

export function deriveTurnoverFromPeople(
  people: TurnoverPersonLike[] | null | undefined,
  ref: Date = new Date(),
  sectorFilter?: string | null
): { turnoverPct: number; turnoverData: TurnoverSeriesPoint[] } {
  const list = Array.isArray(people) ? people : [];
  const turnoverData = buildTurnoverSeriesFromPeople(list, ref, sectorFilter);
  return { turnoverPct: averageTwelveMonthTurnover(turnoverData), turnoverData };
}

/**
 * Lista admissão/demissão/setor para cálculo de turnover (alinha ao orgânico + datas Secullum por matrícula).
 */
export function listTurnoverPeopleFromOrganico(
  rows: OrganicoRow[] | undefined | null,
  demissaoByMatricula?: Record<string, string>
): TurnoverPersonLike[] {
  const list = Array.isArray(rows) ? rows : [];
  const rowsComNome: unknown[][] = [];
  for (const r of list) {
    const row = rowValues(r);
    const nome = strCell(row, ORGANICO_IDX.NOME);
    if (!nome) continue;
    rowsComNome.push(row);
  }
  return rowsComNome.map((row) => ({
    admissao: strCell(row, ORGANICO_IDX.ADMISSAO),
    demissao: demissaoDateFor(row, demissaoByMatricula)?.toISOString().slice(0, 10) ?? "",
    setor: strCell(row, ORGANICO_IDX.SETOR) || "Sem setor",
  }));
}

/**
 * Mesma entrada do turnover executivo quando há API Secullum: admissão e demissão vindas do cadastro de ponto.
 */
export function listTurnoverPeopleFromSecullum(rows: SecullumFuncionario[] | undefined | null): TurnoverPersonLike[] {
  const list = Array.isArray(rows) ? rows : [];
  return list.map((p) => ({
    admissao: String(p.admissao ?? "").trim(),
    demissao: String(p.demissao ?? "").trim(),
    setor: String(p.setor ?? "").trim() || "Sem setor",
  }));
}

/**
 * Agrega orgânico em estrutura de dashboard.
 * Indicadores sem base no orgânico ficam em 0; gráficos sem série usam zeros ou placeholder mínimo.
 */
export function buildDashboardFromOrganico(
  rows: OrganicoRow[] | undefined | null,
  demissaoByMatricula?: Record<string, string>
): DashboardFromOrganico {
  const list = Array.isArray(rows) ? rows : [];

  const rowsComNome: unknown[][] = [];
  for (const r of list) {
    const row = rowValues(r);
    const nome = strCell(row, ORGANICO_IDX.NOME);
    if (!nome) continue;
    rowsComNome.push(row);
  }

  const rowsAtivos = rowsComNome.filter((row) => !isDesligadoOrganico(row));

  const totalColaboradores = rowsAtivos.length;
  let mediaTempoCasaMeses = 0;

  let custoFolhaMensal = 0;
  const costBySetor = new Map<string, number>();

  // Custo folha = soma CTPS só de quem está ativo (exclui desligados — alinha à folha em exercício)
  for (const row of rowsAtivos) {
    const ctps = parseCtpsToNumber(row[ORGANICO_IDX.CTPS]);
    custoFolhaMensal += ctps;
    const setorRaw = strCell(row, ORGANICO_IDX.SETOR);
    const setor = setorRaw || "Sem setor";
    costBySetor.set(setor, (costBySetor.get(setor) ?? 0) + ctps);
  }

  const ctpsValues: number[] = [];
  const tenureMeses: number[] = [];
  const countBySetor = new Map<string, number>();
  for (const row of rowsAtivos) {
    const ctps = parseCtpsToNumber(row[ORGANICO_IDX.CTPS]);
    if (ctps > 0) ctpsValues.push(ctps);
    const setorRaw = strCell(row, ORGANICO_IDX.SETOR);
    const setor = setorRaw || "Sem setor";
    countBySetor.set(setor, (countBySetor.get(setor) ?? 0) + 1);
    const adm = parseDateBR(strCell(row, ORGANICO_IDX.ADMISSAO));
    if (adm) {
      const now = new Date();
      let meses = (now.getFullYear() - adm.getFullYear()) * 12 + (now.getMonth() - adm.getMonth());
      if (now.getDate() < adm.getDate()) meses -= 1;
      if (meses >= 0) tenureMeses.push(meses);
    }
  }

  const sumCtpsPos = ctpsValues.reduce((a, b) => a + b, 0);
  const mediaSalarialCtps =
    ctpsValues.length > 0 ? sumCtpsPos / ctpsValues.length : 0;
  mediaTempoCasaMeses =
    tenureMeses.length > 0
      ? tenureMeses.reduce((acc, v) => acc + v, 0) / tenureMeses.length
      : 0;

  const setoresAtivos = countBySetor.size;

  // % do custo por setor (para pizza); se custo total 0, usa % de headcount
  let sectorCostData: { name: string; value: number }[] = [];
  if (custoFolhaMensal > 0) {
    const entries = [...costBySetor.entries()].filter(([, v]) => v > 0);
    entries.sort((a, b) => b[1] - a[1]);
    sectorCostData = entries.map(([name, v]) => ({
      name,
      value: Math.round((v / custoFolhaMensal) * 1000) / 10,
    }));
  } else if (totalColaboradores > 0) {
    for (const [name, c] of countBySetor.entries()) {
      sectorCostData.push({
        name,
        value: Math.round((c / totalColaboradores) * 1000) / 10,
      });
    }
    sectorCostData.sort((a, b) => b.value - a.value);
  }

  if (sectorCostData.length === 0) {
    // Pizza precisa de valor > 0 para desenhar; legenda deixa claro que não há base.
    sectorCostData = [{ name: "Sem colaboradores ativos", value: 100 }];
  }

  const headcountData = [...countBySetor.entries()]
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count);

  const now = new Date();
  const turnoverPeople: TurnoverPersonLike[] = rowsComNome.map((row) => ({
    admissao: strCell(row, ORGANICO_IDX.ADMISSAO),
    demissao: demissaoDateFor(row, demissaoByMatricula)?.toISOString().slice(0, 10) ?? "",
    setor: strCell(row, ORGANICO_IDX.SETOR) || "Sem setor",
  }));
  const turnoverData = buildTurnoverSeriesFromPeople(turnoverPeople, now);

  const novasLista = listNovasAdmissoesMesAtual(rows);
  const novasAdmissoesMes = novasLista.length;
  const turnoverPct = averageTwelveMonthTurnover(turnoverData);

  return {
    totalColaboradores,
    custoFolhaMensal,
    turnoverPct,
    absenteismoPct: 0,
    mediaTempoCasaMeses,
    mediaSalarialCtps,
    setoresAtivos,
    novasAdmissoesMes,
    alertasAtivos: 0,
    turnoverData,
    headcountData: headcountData.length > 0 ? headcountData : [{ sector: "—", count: 0 }],
    sectorCostData,
    alerts: [],
  };
}

/**
 * Linhas do orgânico (com fórmulas recalculadas) para colaboradores ativos
 * admitidos no mês civil corrente — mesma regra do KPI "Novas Admissões".
 */
export function listNovasAdmissoesMesAtual(rows: OrganicoRow[] | undefined | null): OrganicoSheetRow[] {
  const list = Array.isArray(rows) ? rows : [];
  const ref = new Date();
  const yRef = ref.getFullYear();
  const mRef = ref.getMonth();
  const out: OrganicoSheetRow[] = [];

  for (const r of list) {
    const row = rowValues(r);
    const nome = strCell(row, ORGANICO_IDX.NOME);
    if (!nome) continue;
    if (isDesligadoOrganico(row)) continue;

    const admStr = strCell(row, ORGANICO_IDX.ADMISSAO);
    if (!admStr) continue;
    const d = parseDateBR(admStr);
    if (!d) continue;
    if (d.getFullYear() !== yRef || d.getMonth() !== mRef) continue;

    const arr: OrganicoSheetRow = migrateOrganicoRowSchema(
      Array.isArray(r.values) ? [...r.values] : [],
    ) as OrganicoSheetRow;
    while (arr.length < ORGANICO_NUM_COLUNAS) arr.push("");
    calcularFormulasRow(arr);
    out.push(arr);
  }

  return out;
}
