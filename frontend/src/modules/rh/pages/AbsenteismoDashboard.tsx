import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  Clock3,
  Filter,
  RefreshCw,
  TrendingUp,
  UserX,
  XCircle,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import KpiCard from "@rh/components/KpiCard";
import { Button } from "@rh/components/ui/button";
import { Checkbox } from "@rh/components/ui/checkbox";
import { Input } from "@rh/components/ui/input";
import { Label } from "@rh/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@rh/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rh/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@rh/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@rh/components/ui/dialog";
import {
  getFaltasAtestados,
  getFaltasCadastros,
  getOrganico,
  getSancoesDisciplinares,
  getSecullumFuncionarios,
  isApiConfigured,
  type SecullumFuncionario,
} from "@rh/lib/api-client";
import {
  computeMediaAtivosMesFromPeople,
  listTurnoverPeopleFromOrganico,
  listTurnoverPeopleFromSecullum,
} from "@rh/lib/dashboard-from-organico";
import { AtestadosRelatorioDialog } from "@rh/pages/FaltasAtestados/AtestadosRelatorioDialog";
import {
  diasPerdidosEquivalentes,
  normalizeText,
  parseLooseNumber,
} from "@rh/pages/FaltasAtestados/faltas-dias-equivalentes";
import { textIncludesSearch } from "@rh/lib/normalize-search-text";
import {
  buildFaltasTiposRegrasMap,
  rowContaNosIndicadores,
  rowExibeNoDetalhamento,
  classificarTipoFallback,
  findRegraByTipo,
  type FaltaTipoRegra,
} from "@rh/pages/FaltasAtestados/faltas-tipos-regras";
import { FaltasAusenciasMirrorTable } from "@rh/pages/FaltasAtestados/FaltasAusenciasMirrorTable";
import { getStatusFromRow, ORGANICO_IDX } from "@rh/pages/Organico/organico-derive";
import { cn } from "@rh/lib/utils";
import type { FaltaRow, OrganicoRow, SancaoDisciplinarRow } from "@rh/types/api";

type ClassificacaoAusencia = "justificada" | "injustificada" | "indefinida";

type ColaboradoresBaseModo = "secullum" | "organico-atual" | "media-mensal" | "desligados-snapshot";

type SerieMensal = {
  ym: string;
  label: string;
  totalOcorrencias: number;
  totalQuantidade: number;
  totalQuantidadeEquivalente: number;
  taxaAbsenteismo: number;
  colaboradoresBase: number;
  /** Como `colaboradoresBase` foi obtido (explicado no tooltip do gráfico de tendências). */
  colaboradoresBaseModo: ColaboradoresBaseModo;
  diasUteis: number;
  justificadas: number;
  injustificadas: number;
  indefinidas: number;
};

type RankingFuncionario = {
  nome: string;
  /** Matrícula vazia quando o registro não traz número de folha. */
  matricula: string;
  setor: string;
  totalOcorrencias: number;
  totalQuantidade: number;
};

type SetorImpactado = {
  setor: string;
  totalOcorrencias: number;
  percentual: number;
};

type DiaSemanaImpactado = {
  dia: string;
  /** Índice compatível com `Date.getDay()` (0 = domingo). */
  weekdayIndex: number;
  totalOcorrencias: number;
  percentual: number;
};

/** Filtro cruzado ativado ao clicar nos gráficos (estilo Power BI). Um contexto por vez. */
type ChartDrilldown =
  | null
  | { type: "mes"; ym: string; label: string }
  | { type: "mesClassificacao"; ym: string; label: string; classificacao: ClassificacaoAusencia }
  | { type: "classificacao"; value: ClassificacaoAusencia }
  | { type: "setor"; setor: string }
  | { type: "diaSemana"; weekdayIndex: number; label: string }
  | { type: "colaborador"; key: string; nome?: string };

type ColaboradorFiltroOption = {
  key: string;
  label: string;
};

type SeveridadeSancao = "Alta" | "Média" | "Baixa" | "Sem Registro";

type SancaoPorColaborador = {
  colaboradorKey: string;
  nome: string;
  matricula: string;
  setor: string;
  qntd: number;
  ultimaIso: string;
  ultimaLabel: string;
  severidade: SeveridadeSancao;
};

type SancaoSortKey = "colaborador" | "setor" | "qntd" | "ultima" | "severidade";

const SEVERIDADE_ORDEM: Record<SeveridadeSancao, number> = {
  Alta: 3,
  "Média": 2,
  Baixa: 1,
  "Sem Registro": 0,
};

/** Quantidade máxima de colaboradores pré-ordenados no ranking (o usuário escolhe quantos exibir até esse teto). */
const RANKING_MAX_ROWS = 100;
const RANKING_TOP_OPTIONS = [5, 10, 15, 20, 25, 30, 50, 75, 100] as const;
/** Painel de detalhe só abre após hover contínuo — libera o clique para filtro cruzado. */
/** Tempo antes de abrir o painel ao passar o mouse — maior para não competir com clique direito na barra. */
const RANKING_PANEL_HOVER_DELAY_MS = 1000;

type AbsenteismoDerived = {
  totalAusencias: number;
  totalQuantidadeInformada: number;
  totalQuantidadeEquivalente: number;
  taxaAbsenteismo: number;
  ausenciasJustificadas: number;
  ausenciasInjustificadas: number;
  duracaoMediaRegistrada: number;
  coberturaQuantidade: number;
  periodoLabel: string;
  mesesCobertos: number;
  serieMensal: SerieMensal[];
  setoresImpactados: SetorImpactado[];
  diasSemana: DiaSemanaImpactado[];
  ranking: RankingFuncionario[];
  inconsistencias: string[];
};

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

function formatMonthLabel(date: Date): string {
  const month = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", "");
  return `${month}/${String(date.getFullYear()).slice(-2)}`;
}

function formatPeriodoLabel(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date);
}

function clampIsoDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? "").trim()) ? String(value).trim() : "";
}

function countBusinessDaysInMonth(year: number, monthIndex: number): number {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  let count = 0;
  for (let day = 1; day <= lastDay; day++) {
    const weekday = new Date(year, monthIndex, day).getDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}

function ymFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function severidadePorQuantidadeSancoes(qntd: number): SeveridadeSancao {
  if (qntd >= 4) return "Alta";
  if (qntd >= 2) return "Média";
  if (qntd === 1) return "Baixa";
  return "Sem Registro";
}

function formatDataBRFromIso(iso: string): string {
  const d = parseIsoDate(iso);
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR").format(d);
}

/** Ex.: "terça-feira, 2 de dezembro de 2025" (alinhado ao tooltip do Power BI). */
function formatDataAplicacaoLongaPt(iso: string): string {
  const raw = String(iso ?? "").trim();
  if (!raw) return "—";
  const d = parseIsoDate(raw);
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Setor no orgânico por chave `matricula|||nome` (e fallback só por nome). */
function buildSetorPorColaboradorOrganico(rows: OrganicoRow[] | null | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of rows ?? []) {
    const v = Array.isArray(r?.values) ? r.values : [];
    const nome = String(v[ORGANICO_IDX.NOME] ?? "").trim();
    if (!nome) continue;
    const mat = String(v[ORGANICO_IDX.MATRICULA] ?? "").trim();
    const setor = String(v[ORGANICO_IDX.SETOR] ?? "").trim() || "Sem setor";
    map.set(`${mat}|||${nome}`, setor);
    const nomeOnly = `|||${nome}`;
    if (!map.has(nomeOnly)) map.set(nomeOnly, setor);
  }
  return map;
}

function resolveSetorColaborador(map: Map<string, string>, matricula: string, nome: string): string {
  const k = `${String(matricula).trim()}|||${String(nome).trim()}`;
  return map.get(k) ?? map.get(`|||${String(nome).trim()}`) ?? "—";
}

/** Status Desligado no orgânico por chave `matricula|||nome` (e fallback só por nome). */
function buildIsDesligadoPorColaboradorOrganico(rows: OrganicoRow[] | null | undefined): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const r of rows ?? []) {
    const v = Array.isArray(r?.values) ? r.values : [];
    const nome = String(v[ORGANICO_IDX.NOME] ?? "").trim();
    if (!nome) continue;
    const mat = String(v[ORGANICO_IDX.MATRICULA] ?? "").trim();
    const desligado = getStatusFromRow(v) === "Desligado";
    map.set(`${mat}|||${nome}`, desligado);
    const nomeOnly = `|||${nome}`;
    if (!map.has(nomeOnly)) map.set(nomeOnly, desligado);
  }
  return map;
}

function colaboradorEhDesligadoNoOrganico(map: Map<string, boolean>, matricula: string, nome: string): boolean | null {
  const k = `${String(matricula).trim()}|||${String(nome).trim()}`;
  if (map.has(k)) return map.get(k)!;
  const nn = `|||${String(nome).trim()}`;
  if (map.has(nn)) return map.get(nn)!;
  return null;
}

/**
 * `incluirColaboradoresDesligados`: quando true (“Sim” no filtro), ativos e desligados entram no escopo.
 * Quando false (“Não”), só quem não está desligado no Orgânico; sem correspondência no cadastro = ativo.
 */
function colaboradorPassaFiltroOrganicoStatus(
  map: Map<string, boolean>,
  matricula: string,
  nome: string,
  incluirColaboradoresDesligados: boolean,
): boolean {
  if (!String(nome).trim()) return false;
  if (incluirColaboradoresDesligados) return true;
  const d = colaboradorEhDesligadoNoOrganico(map, matricula, nome);
  if (d == null) return true;
  return !d;
}

function filterSancoesDisciplinaresRows(
  rows: SancaoDisciplinarRow[],
  selectedColaboradores: string[],
  startDate: string,
  endDate: string,
): SancaoDisciplinarRow[] {
  const from = clampIsoDate(startDate);
  const to = clampIsoDate(endDate);
  const effectiveStart = from && to && from > to ? to : from;
  const effectiveEnd = from && to && from > to ? from : to;

  return rows.filter((row) => {
    const rowDate = clampIsoDate(row.dataAplicacao);
    if (selectedColaboradores.length > 0) {
      const nome = String(row.nomeFuncionario ?? "").trim();
      const matricula = String(row.matricula ?? "").trim();
      const key = `${matricula}|||${nome}`;
      if (!selectedColaboradores.includes(key)) return false;
    }
    if (effectiveStart && rowDate && rowDate < effectiveStart) return false;
    if (effectiveEnd && rowDate && rowDate > effectiveEnd) return false;
    return true;
  });
}

function buildSancoesAgregadasPorColaborador(
  rows: SancaoDisciplinarRow[],
  setorMap: Map<string, string>,
): SancaoPorColaborador[] {
  const acc = new Map<
    string,
    { matricula: string; nome: string; qntd: number; ultimaIso: string }
  >();

  for (const row of rows) {
    const nome = String(row.nomeFuncionario ?? "").trim();
    if (!nome) continue;
    const matricula = String(row.matricula ?? "").trim();
    const key = `${matricula}|||${nome}`;
    const iso = clampIsoDate(row.dataAplicacao);
    const cur = acc.get(key);
    if (!cur) {
      acc.set(key, {
        matricula,
        nome,
        qntd: 1,
        ultimaIso: iso || "",
      });
      continue;
    }
    cur.qntd += 1;
    if (iso && (!cur.ultimaIso || iso > cur.ultimaIso)) cur.ultimaIso = iso;
  }

  return [...acc.values()].map((v) => ({
    colaboradorKey: `${v.matricula}|||${v.nome}`,
    nome: v.nome,
    matricula: v.matricula,
    setor: resolveSetorColaborador(setorMap, v.matricula, v.nome),
    qntd: v.qntd,
    ultimaIso: v.ultimaIso,
    ultimaLabel: v.ultimaIso ? formatDataBRFromIso(v.ultimaIso) : "—",
    severidade: severidadePorQuantidadeSancoes(v.qntd),
  }));
}

/**
 * Colaboradores ativos no orgânico (não desligados) para preencher a tabela no estilo Power BI:
 * quem não tem sanção no período aparece com Qntd / Última vazias e severidade "Sem Registro".
 */
function mergeSancoesComColaboradoresOrganico(
  agregadas: SancaoPorColaborador[],
  organicoRows: OrganicoRow[] | undefined | null,
  setorMap: Map<string, string>,
  selectedColaboradores: string[],
  incluirColaboradoresDesligados: boolean,
): SancaoPorColaborador[] {
  const byKey = new Map<string, SancaoPorColaborador>();
  for (const r of agregadas) byKey.set(r.colaboradorKey, r);

  const seen = new Set<string>();
  for (const row of organicoRows ?? []) {
    const v = Array.isArray(row?.values) ? row.values : [];
    const nome = String(v[ORGANICO_IDX.NOME] ?? "").trim();
    if (!nome) continue;
    const isDesligado = getStatusFromRow(v) === "Desligado";
    if (!incluirColaboradoresDesligados && isDesligado) continue;
    const matricula = String(v[ORGANICO_IDX.MATRICULA] ?? "").trim();
    const key = `${matricula}|||${nome}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (selectedColaboradores.length > 0 && !selectedColaboradores.includes(key)) continue;
    if (byKey.has(key)) continue;
    byKey.set(key, {
      colaboradorKey: key,
      nome,
      matricula,
      setor: resolveSetorColaborador(setorMap, matricula, nome),
      qntd: 0,
      ultimaIso: "",
      ultimaLabel: "",
      severidade: "Sem Registro",
    });
  }

  return [...byKey.values()];
}

/** Linhas brutas por colaborador (para tooltip), mais recente primeiro. */
function buildSancoesDetalhePorColaborador(rows: SancaoDisciplinarRow[]): Map<string, SancaoDisciplinarRow[]> {
  const map = new Map<string, SancaoDisciplinarRow[]>();
  for (const row of rows) {
    const nome = String(row.nomeFuncionario ?? "").trim();
    if (!nome) continue;
    const matricula = String(row.matricula ?? "").trim();
    const key = `${matricula}|||${nome}`;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  for (const [, list] of map) {
    list.sort((a, b) => {
      const ia = clampIsoDate(a.dataAplicacao);
      const ib = clampIsoDate(b.dataAplicacao);
      return ib.localeCompare(ia);
    });
  }
  return map;
}

function isPositiveFlag(value: unknown): boolean {
  const raw = normalizeText(value);
  return raw === "SIM" || raw === "S" || raw === "OK" || raw === "APROVADO" || raw === "TRUE";
}

function classifyRow(
  row: FaltaRow,
  tiposRegrasMap: Map<string, FaltaTipoRegra>,
): ClassificacaoAusencia {
  const regra = findRegraByTipo(tiposRegrasMap, row.tipo);
  if (regra?.contabilizaIndicadores && regra.classificacao) {
    return regra.classificacao;
  }
  const tipo = normalizeText(row.tipo);
  if (!tipo) return "justificada";
  const fallback = classificarTipoFallback(tipo);
  if (fallback) return fallback;
  if (isPositiveFlag(row.aprovado)) return "justificada";
  if (isPositiveFlag(row.reprovado)) return "injustificada";
  return "indefinida";
}

function drilldownSame(a: ChartDrilldown, b: ChartDrilldown): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (a.type !== b.type) return false;
  switch (a.type) {
    case "mes":
      return a.ym === (b as { type: "mes" }).ym;
    case "mesClassificacao": {
      const bb = b as { type: "mesClassificacao" };
      return a.ym === bb.ym && a.classificacao === bb.classificacao;
    }
    case "classificacao":
      return a.value === (b as { type: "classificacao" }).value;
    case "setor":
      return a.setor === (b as { type: "setor" }).setor;
    case "diaSemana":
      return a.weekdayIndex === (b as { type: "diaSemana" }).weekdayIndex;
    case "colaborador": {
      const bb = b as { type: "colaborador" };
      return a.key === bb.key;
    }
    default:
      return false;
  }
}

function toggleChartDrilldown(prev: ChartDrilldown, next: Exclude<ChartDrilldown, null>): ChartDrilldown {
  return drilldownSame(prev, next) ? null : next;
}

function chartDrilldownLabel(d: Exclude<ChartDrilldown, null>): string {
  switch (d.type) {
    case "mes":
      return `Mês ${d.label}`;
    case "mesClassificacao": {
      const frag =
        d.classificacao === "justificada"
          ? "justificadas"
          : d.classificacao === "injustificada"
            ? "injustificadas"
            : "sem classificação";
      return `${d.label} · ${frag}`;
    }
    case "classificacao":
      return d.value === "justificada"
        ? "Só justificadas"
        : d.value === "injustificada"
          ? "Só injustificadas"
          : "Só sem classificação";
    case "setor":
      return `Setor: ${d.setor}`;
    case "diaSemana":
      return d.label;
    case "colaborador":
      return d.nome?.trim() ? d.nome.trim() : "Colaborador";
    default:
      return "Filtro do gráfico";
  }
}

function rowMatchesChartDrilldown(
  row: FaltaRow,
  d: ChartDrilldown,
  tiposRegrasMap: Map<string, FaltaTipoRegra>,
): boolean {
  if (d === null) return true;
  const rowDate = clampIsoDate(row.data);
  const date = parseIsoDate(rowDate);
  switch (d.type) {
    case "mes":
      return !!rowDate && rowDate.startsWith(d.ym);
    case "mesClassificacao":
      return !!rowDate && rowDate.startsWith(d.ym) && classifyRow(row, tiposRegrasMap) === d.classificacao;
    case "classificacao":
      return classifyRow(row, tiposRegrasMap) === d.value;
    case "setor": {
      const s = String(row.setor ?? "").trim() || "Sem setor";
      return s === d.setor;
    }
    case "diaSemana":
      return date ? date.getDay() === d.weekdayIndex : false;
    case "colaborador": {
      const nome = String(row.nomeFuncionario ?? "").trim();
      const matricula = String(row.matricula ?? "").trim();
      return `${matricula}|||${nome}` === d.key;
    }
    default:
      return true;
  }
}

function sancaoRowMatchesChartDrilldown(
  row: SancaoDisciplinarRow,
  d: ChartDrilldown,
  setorMap: Map<string, string>,
): boolean {
  if (d === null) return true;
  const iso = clampIsoDate(row.dataAplicacao);
  const date = parseIsoDate(iso);
  const nome = String(row.nomeFuncionario ?? "").trim();
  const matricula = String(row.matricula ?? "").trim();
  const key = `${matricula}|||${nome}`;
  switch (d.type) {
    case "mes":
    case "mesClassificacao":
      return !!iso && iso.startsWith(d.ym);
    case "classificacao":
      return true;
    case "setor":
      return resolveSetorColaborador(setorMap, matricula, nome) === d.setor;
    case "diaSemana":
      return date ? date.getDay() === d.weekdayIndex : false;
    case "colaborador":
      return key === d.key;
    default:
      return true;
  }
}

function formatIntPt(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
}

function formatDecimalPt(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Rótulo tipo "setembro de 2024" para eixo do gráfico no tooltip do ranking. */
function formatMesAnoLongoFromYm(ym: string): string {
  const [yStr, mStr] = String(ym).split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return ym;
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
}

type RankingColaboradorMesPoint = {
  ym: string;
  /** Legenda longa (fallback / acessibilidade). */
  label: string;
  /** Nome do mês em minúsculas, só o mês (ex.: "setembro"). */
  mesCurto: string;
  ano: number;
  /** Exibe o ano na linha de baixo (mudança de ano ou primeiro ponto). */
  showAnoLinha: boolean;
  /** Linha vertical antes deste mês (início de ano novo na série). */
  yearDividerBefore: boolean;
  justificadas: number;
  injustificadas: number;
};

type RankingColaboradorTooltipModel = {
  nome: string;
  setor: string;
  serie: RankingColaboradorMesPoint[];
  pctJustificadas: number;
  pctInjustificadas: number;
  totalDiasPerdidos: number;
  temClassificacao: boolean;
};

/** Chave única do colaborador no ranking e no painel de ausências (alinha a filtros `matricula|||nome`). */
function rankingColaboradorKeyFromNomeMatricula(nomeRaw: unknown, matriculaRaw: unknown): string {
  const nome = String(nomeRaw ?? "").trim() || "Sem nome";
  const mat = String(matriculaRaw ?? "").trim();
  return mat ? `${mat}|||${nome}` : `|||${nome}`;
}

function rankingColaboradorKeyFromFaltaRow(row: FaltaRow): string {
  return rankingColaboradorKeyFromNomeMatricula(row.nomeFuncionario, row.matricula);
}

/** Bucket para linhas sem coluna tipo preenchida (comparável no multi-filtro do ranking). */
const RANKING_TIPO_VAZIO = "__SEM_TIPO__";

function rankingTipoKeyFromFaltaRow(row: FaltaRow): string {
  const raw = String(row.tipo ?? "").trim();
  return raw ? normalizeText(row.tipo) : RANKING_TIPO_VAZIO;
}

/** `undefined` = todos os tipos; `[]` = nenhum (gráficos vazios até selecionar de novo). */
function filterRowsByTiposAusencia(rows: FaltaRow[], tiposAusencia: string[] | undefined): FaltaRow[] {
  if (tiposAusencia === undefined) return rows;
  if (tiposAusencia.length === 0) return [];
  const allow = new Set(tiposAusencia);
  return rows.filter((row) => allow.has(rankingTipoKeyFromFaltaRow(row)));
}

/** Ranking só a partir das linhas informadas (mesma métrica QNTD/ocorrências do dashboard). */
function buildRankingFromFaltasRows(rows: FaltaRow[] | undefined | null): RankingFuncionario[] {
  const list = Array.isArray(rows) ? rows.filter((row) => String(row.data ?? "").trim()) : [];
  type RankingAcc = {
    nome: string;
    matricula: string;
    setorCounts: Map<string, number>;
    totalOcorrencias: number;
    totalQuantidade: number;
  };
  const byFuncionario = new Map<string, RankingAcc>();

  for (const row of list) {
    const date = parseIsoDate(row.data);
    if (!date) continue;
    const nome = String(row.nomeFuncionario ?? "").trim() || "Sem nome";
    const matricula = String(row.matricula ?? "").trim();
    const setor = String(row.setor ?? "").trim() || "Sem setor";
    const funcionarioKey = rankingColaboradorKeyFromFaltaRow(row);
    const qntdBruta = parseLooseNumber(row.qntd);

    let fAcc = byFuncionario.get(funcionarioKey);
    if (!fAcc) {
      fAcc = {
        nome,
        matricula,
        setorCounts: new Map(),
        totalOcorrencias: 0,
        totalQuantidade: 0,
      };
      byFuncionario.set(funcionarioKey, fAcc);
    }
    fAcc.totalOcorrencias += 1;
    fAcc.totalQuantidade += qntdBruta ?? 0;
    fAcc.setorCounts.set(setor, (fAcc.setorCounts.get(setor) ?? 0) + 1);
  }

  return [...byFuncionario.values()]
    .map((v) => {
      const setorTop =
        [...v.setorCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))[0]?.[0] ?? "Sem setor";
      return {
        nome: v.nome,
        matricula: v.matricula,
        setor: setorTop,
        totalOcorrencias: v.totalOcorrencias,
        totalQuantidade: v.totalQuantidade,
      };
    })
    .sort((a, b) => {
      if (b.totalQuantidade !== a.totalQuantidade) return b.totalQuantidade - a.totalQuantidade;
      if (b.totalOcorrencias !== a.totalOcorrencias) return b.totalOcorrencias - a.totalOcorrencias;
      return a.nome.localeCompare(b.nome, "pt-BR");
    })
    .slice(0, RANKING_MAX_ROWS);
}

/** Série mensal + KPIs por colaborador (mesma chave do ranking: matrícula + nome). */
function buildRankingColaboradorTooltipModelByKey(
  rows: FaltaRow[] | undefined | null,
  tiposRegrasMap: Map<string, FaltaTipoRegra>,
): Map<string, RankingColaboradorTooltipModel> {
  const list = Array.isArray(rows) ? rows.filter((row) => String(row.data ?? "").trim()) : [];
  type Acc = {
    nome: string;
    setorCounts: Map<string, number>;
    byMonth: Map<string, { just: number; unjust: number }>;
    totalJust: number;
    totalUnjust: number;
    totalQntd: number;
  };
  const accByKey = new Map<string, Acc>();

  for (const row of list) {
    const date = parseIsoDate(row.data);
    if (!date) continue;
    const nome = String(row.nomeFuncionario ?? "").trim() || "Sem nome";
    const setor = String(row.setor ?? "").trim() || "Sem setor";
    const key = rankingColaboradorKeyFromFaltaRow(row);
    const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const classificacao = classifyRow(row, tiposRegrasMap);
    const qntdForClassificacao = parseLooseNumber(row.qntd) ?? 0;

    let acc = accByKey.get(key);
    if (!acc) {
      acc = { nome, setorCounts: new Map(), byMonth: new Map(), totalJust: 0, totalUnjust: 0, totalQntd: 0 };
      accByKey.set(key, acc);
    }
    acc.setorCounts.set(setor, (acc.setorCounts.get(setor) ?? 0) + 1);
    acc.totalQntd += qntdForClassificacao;

    let bucket = acc.byMonth.get(ym);
    if (!bucket) {
      bucket = { just: 0, unjust: 0 };
      acc.byMonth.set(ym, bucket);
    }
    if (classificacao === "justificada") {
      bucket.just += qntdForClassificacao;
      acc.totalJust += qntdForClassificacao;
    } else if (classificacao === "injustificada") {
      bucket.unjust += qntdForClassificacao;
      acc.totalUnjust += qntdForClassificacao;
    }
  }

  const out = new Map<string, RankingColaboradorTooltipModel>();
  for (const [key, acc] of accByKey) {
    const denom = acc.totalJust + acc.totalUnjust;
    const temClassificacao = denom > 0;
    const entries = [...acc.byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0], "en-CA"));
    const serie: RankingColaboradorMesPoint[] = entries.map(([ym, v], i) => {
      const [yStr, mStr] = ym.split("-");
      const y = Number(yStr);
      const m = Number(mStr);
      const mesLongo = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(y, m - 1, 1));
      const mesCurto = mesLongo.toLowerCase();
      const prevY = i > 0 ? Number(entries[i - 1]![0].split("-")[0]) : null;
      const showAnoLinha = prevY == null || y !== prevY;
      const yearDividerBefore = i > 0 && y !== prevY;
      return {
        ym,
        label: formatMesAnoLongoFromYm(ym),
        mesCurto,
        ano: y,
        showAnoLinha,
        yearDividerBefore,
        justificadas: v.just,
        injustificadas: v.unjust,
      };
    });
    const setorTop =
      [...acc.setorCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))[0]?.[0] ?? "Sem setor";
    out.set(key, {
      nome: acc.nome,
      setor: setorTop,
      serie,
      pctJustificadas: temClassificacao ? (acc.totalJust / denom) * 100 : 0,
      pctInjustificadas: temClassificacao ? (acc.totalUnjust / denom) * 100 : 0,
      totalDiasPerdidos: acc.totalQntd,
      temClassificacao,
    });
  }
  return out;
}

function buildBaseColaboradoresAtivos(
  yms: string[],
  organicoRows: OrganicoRow[] | undefined | null,
  secullumRows: SecullumFuncionario[] | undefined | null,
  apenasDesligados: boolean,
): Map<string, { valor: number; modo: ColaboradoresBaseModo }> {
  const orgList = Array.isArray(organicoRows) ? organicoRows : [];
  const activeCurrent = orgList.filter((row) => {
    const values = Array.isArray(row?.values) ? row.values : [];
    const nome = String(values[1] ?? "").trim();
    if (!nome) return false;
    return getStatusFromRow(values) !== "Desligado";
  }).length;

  const desligadosCurrent = orgList.filter((row) => {
    const values = Array.isArray(row?.values) ? row.values : [];
    const nome = String(values[1] ?? "").trim();
    if (!nome) return false;
    return getStatusFromRow(values) === "Desligado";
  }).length;

  const demissaoByMatricula: Record<string, string> = {};
  for (const row of secullumRows ?? []) {
    const matricula = String(row.numeroFolha ?? "").trim();
    const demissao = String(row.demissao ?? "").trim();
    if (matricula && demissao) demissaoByMatricula[matricula] = demissao;
  }

  /** Igual ao dashboard executivo: com API Secullum, turnover e média de ativos usam adm+dem da Secullum para todos os meses. */
  const useSecullumBase = (secullumRows?.length ?? 0) > 0;
  const peopleSecullum = useSecullumBase ? listTurnoverPeopleFromSecullum(secullumRows) : null;
  const peopleOrganicoFallback = useSecullumBase
    ? null
    : listTurnoverPeopleFromOrganico(organicoRows, demissaoByMatricula);

  const currentYm = ymFromDate(new Date());
  const baseByMonth = new Map<string, { valor: number; modo: ColaboradoresBaseModo }>();

  if (apenasDesligados) {
    const fallbackDesligadosSecullum = (secullumRows ?? []).filter((p) => String(p.demissao ?? "").trim()).length;
    const valorBase = desligadosCurrent > 0 ? desligadosCurrent : fallbackDesligadosSecullum;
    for (const ym of yms) {
      baseByMonth.set(ym, { valor: valorBase, modo: "desligados-snapshot" });
    }
    return baseByMonth;
  }

  for (const ym of yms) {
    const [yearStr, monthStr] = ym.split("-");
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;

    if (peopleSecullum) {
      const valor = computeMediaAtivosMesFromPeople(peopleSecullum, year, monthIndex, null);
      baseByMonth.set(ym, { valor, modo: "secullum" });
      continue;
    }

    if (ym >= currentYm) {
      baseByMonth.set(ym, { valor: activeCurrent, modo: "organico-atual" });
      continue;
    }

    const valor = computeMediaAtivosMesFromPeople(peopleOrganicoFallback, year, monthIndex, null);
    baseByMonth.set(ym, { valor, modo: "media-mensal" });
  }

  return baseByMonth;
}

function buildAbsenteismoFromFaltas(
  rows: FaltaRow[] | undefined | null,
  organicoRows: OrganicoRow[] | undefined | null,
  secullumRows: SecullumFuncionario[] | undefined | null,
  apenasDesligados: boolean,
  tiposRegrasMap: Map<string, FaltaTipoRegra>,
): AbsenteismoDerived {
  const list = Array.isArray(rows) ? rows.filter((row) => String(row.data ?? "").trim()) : [];

  const byMonth = new Map<string, SerieMensal>();
  const bySetor = new Map<string, number>();
  type RankingAcc = {
    nome: string;
    matricula: string;
    setorCounts: Map<string, number>;
    totalOcorrencias: number;
    totalQuantidade: number;
  };
  const byFuncionario = new Map<string, RankingAcc>();
  const byWeekday = new Map<number, number>();

  let totalQuantidade = 0;
  let totalQuantidadeEquivalente = 0;
  let totalLinhasComQuantidade = 0;
  let totalLinhasConvertidas = 0;
  let justificadas = 0;
  let injustificadas = 0;
  let indefinidas = 0;
  let indefinidasCount = 0;
  let qntdInvalidaCount = 0;
  let minDate: Date | null = null;
  let maxDate: Date | null = null;
  const tiposNaoMapeados = new Map<string, number>();

  for (const row of list) {
    const date = parseIsoDate(row.data);
    if (!date) continue;

    if (!minDate || date < minDate) minDate = date;
    if (!maxDate || date > maxDate) maxDate = date;

    const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const diasPerdidos = diasPerdidosEquivalentes(row);
    const qntdBruta = parseLooseNumber(row.qntd);
    const classificacao = classifyRow(row, tiposRegrasMap);
    const tipoNormalizado = normalizeText(row.tipo);

    const monthEntry = byMonth.get(ym) ?? {
      ym,
      label: formatMonthLabel(date),
      totalOcorrencias: 0,
      totalQuantidade: 0,
      totalQuantidadeEquivalente: 0,
      taxaAbsenteismo: 0,
      colaboradoresBase: 0,
      colaboradoresBaseModo: "media-mensal" as ColaboradoresBaseModo,
      diasUteis: 0,
      justificadas: 0,
      injustificadas: 0,
      indefinidas: 0,
    };

    const qntdForClassificacao = qntdBruta ?? 0;

    monthEntry.totalOcorrencias += 1;
    monthEntry.totalQuantidade += qntdForClassificacao;
    monthEntry.totalQuantidadeEquivalente += diasPerdidos.value;
    if (classificacao === "justificada") monthEntry.justificadas += qntdForClassificacao;
    else if (classificacao === "injustificada") monthEntry.injustificadas += qntdForClassificacao;
    else monthEntry.indefinidas += qntdForClassificacao;
    byMonth.set(ym, monthEntry);
    const nome = String(row.nomeFuncionario ?? "").trim() || "Sem nome";

    const setor = String(row.setor ?? "").trim() || "Sem setor";
    bySetor.set(setor, (bySetor.get(setor) ?? 0) + 1);

    const matricula = String(row.matricula ?? "").trim();
    const funcionarioKey = rankingColaboradorKeyFromFaltaRow(row);
    let fAcc = byFuncionario.get(funcionarioKey);
    if (!fAcc) {
      fAcc = {
        nome,
        matricula,
        setorCounts: new Map(),
        totalOcorrencias: 0,
        totalQuantidade: 0,
      };
      byFuncionario.set(funcionarioKey, fAcc);
    }
    fAcc.totalOcorrencias += 1;
    fAcc.totalQuantidade += qntdBruta ?? 0;
    fAcc.setorCounts.set(setor, (fAcc.setorCounts.get(setor) ?? 0) + 1);
    byFuncionario.set(funcionarioKey, fAcc);

    const weekday = date.getDay();
    byWeekday.set(weekday, (byWeekday.get(weekday) ?? 0) + 1);

    if (classificacao === "justificada") justificadas += qntdForClassificacao;
    else if (classificacao === "injustificada") injustificadas += qntdForClassificacao;
    else {
      indefinidas += qntdForClassificacao;
      indefinidasCount += 1;
      if (tipoNormalizado) {
        tiposNaoMapeados.set(tipoNormalizado, (tiposNaoMapeados.get(tipoNormalizado) ?? 0) + 1);
      }
    }

    if (qntdBruta != null) {
      totalQuantidade += qntdBruta;
      totalLinhasComQuantidade += 1;
    } else {
      qntdInvalidaCount += 1;
    }
    if (diasPerdidos.converted) {
      totalQuantidadeEquivalente += diasPerdidos.value;
      totalLinhasConvertidas += 1;
    }
  }

  const totalAusencias = list.length;
  const coberturaQuantidade = totalAusencias > 0 ? (totalLinhasComQuantidade / totalAusencias) * 100 : 0;
  const duracaoMediaRegistrada = totalLinhasComQuantidade > 0 ? totalQuantidade / totalLinhasComQuantidade : 0;
  const baseColaboradoresByMonth = buildBaseColaboradoresAtivos(
    [...byMonth.keys()],
    organicoRows,
    secullumRows,
    apenasDesligados,
  );
  const serieMensal = [...byMonth.values()]
    .sort((a, b) => a.ym.localeCompare(b.ym, "en-CA"))
    .map((item) => {
      const [yearStr, monthStr] = item.ym.split("-");
      const year = Number(yearStr);
      const monthIndex = Number(monthStr) - 1;
      const diasUteis = countBusinessDaysInMonth(year, monthIndex);
      const baseEntry = baseColaboradoresByMonth.get(item.ym);
      const colaboradoresBase = baseEntry?.valor ?? 0;
      const colaboradoresBaseModo = baseEntry?.modo ?? "media-mensal";
      const taxaAbsenteismo =
        colaboradoresBase > 0 && diasUteis > 0 ? (item.totalQuantidadeEquivalente / (colaboradoresBase * diasUteis)) * 100 : 0;
      return {
        ...item,
        diasUteis,
        colaboradoresBase,
        colaboradoresBaseModo,
        taxaAbsenteismo,
      };
    });

  const somaDenominadores = serieMensal.reduce((acc, item) => acc + item.colaboradoresBase * item.diasUteis, 0);
  const taxaAbsenteismo = somaDenominadores > 0 ? (totalQuantidadeEquivalente / somaDenominadores) * 100 : 0;
  const setoresImpactados = [...bySetor.entries()]
    .map(([setor, totalOcorrencias]) => ({
      setor,
      totalOcorrencias,
      percentual: totalAusencias > 0 ? (totalOcorrencias / totalAusencias) * 100 : 0,
    }))
    .sort((a, b) => b.totalOcorrencias - a.totalOcorrencias)
    .slice(0, 6);

  const ranking: RankingFuncionario[] = [...byFuncionario.values()]
    .map((v) => {
      const setorTop =
        [...v.setorCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))[0]?.[0] ?? "Sem setor";
      return {
        nome: v.nome,
        matricula: v.matricula,
        setor: setorTop,
        totalOcorrencias: v.totalOcorrencias,
        totalQuantidade: v.totalQuantidade,
      };
    })
    .sort((a, b) => {
      if (b.totalQuantidade !== a.totalQuantidade) return b.totalQuantidade - a.totalQuantidade;
      if (b.totalOcorrencias !== a.totalOcorrencias) return b.totalOcorrencias - a.totalOcorrencias;
      return a.nome.localeCompare(b.nome, "pt-BR");
    })
    .slice(0, RANKING_MAX_ROWS);

  const diasSemana = DIA_SEMANA_ORDEM.map((index) => {
    const totalOcorrencias = byWeekday.get(index) ?? 0;
    return {
      dia: DIA_SEMANA_LABEL[index],
      weekdayIndex: index,
      totalOcorrencias,
      percentual: totalAusencias > 0 ? (totalOcorrencias / totalAusencias) * 100 : 0,
    };
  }).sort((a, b) => {
    if (b.totalOcorrencias !== a.totalOcorrencias) return b.totalOcorrencias - a.totalOcorrencias;
    return a.dia.localeCompare(b.dia, "pt-BR");
  });

  const inconsistencias: string[] = [];
  if (tiposNaoMapeados.size > 0) {
    const tipos = [...tiposNaoMapeados.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
      .map(([tipo, count]) => `${tipo} (${formatIntPt(count)})`)
      .join(", ");
    inconsistencias.push(`Tipos sem regra de classificação: ${tipos}.`);
  }
  if (totalAusencias > 0 && coberturaQuantidade < 100) {
    inconsistencias.push(
      `${formatIntPt(qntdInvalidaCount)} linha(s) sem QNTD válida — dias perdidos e taxa podem ficar abaixo do real.`,
    );
  }
  const mesesSemBase = serieMensal.filter((item) => item.totalOcorrencias > 0 && item.colaboradoresBase <= 0).length;
  if (mesesSemBase > 0) {
    inconsistencias.push(
      `${formatIntPt(mesesSemBase)} mês(es) sem base de colaboradores — taxa pode aparecer como 0%.`,
    );
  }

  const periodoLabel =
    minDate && maxDate
      ? `${formatPeriodoLabel(minDate)} a ${formatPeriodoLabel(maxDate)}`
      : "Sem período";

  return {
    totalAusencias,
    totalQuantidadeInformada: totalQuantidade,
    totalQuantidadeEquivalente,
    taxaAbsenteismo,
    ausenciasJustificadas: justificadas,
    ausenciasInjustificadas: injustificadas,
    duracaoMediaRegistrada,
    coberturaQuantidade,
    periodoLabel,
    mesesCobertos: serieMensal.length,
    serieMensal,
    setoresImpactados,
    diasSemana,
    ranking,
    inconsistencias,
  };
}

const RANKING_TOOLTIP_JUST_FILL = "#059669";
const RANKING_TOOLTIP_INJUST_FILL = "#dc2626";

/**
 * Deve ser ≥ largura do YAxis: o Recharts reserva `margin.left` para o eixo; se for menor que o eixo,
 * o gráfico desloca as barras (efeito “vazio à esquerda”).
 */
const RANKING_INNER_CHART_MARGIN_LEFT = 56;
const RANKING_INNER_CHART_MARGIN_RIGHT = 24;

function RankingAusenciasDetalheConteudo({
  bar,
  det,
}: {
  bar: RankingFuncionario & { funcionarioKey?: string };
  det: RankingColaboradorTooltipModel | undefined;
}) {
  const pctJ = det?.temClassificacao ? det.pctJustificadas : null;
  const pctI = det?.temClassificacao ? det.pctInjustificadas : null;
  const totalDias = det?.totalDiasPerdidos ?? bar.totalQuantidade;
  const serie = det?.serie ?? [];

  const chartBlockHeight = Math.min(440, Math.max(300, 140 + serie.length * 26));

  return (
    <>
      <div className="shrink-0 border-b border-slate-200 bg-slate-100/90 px-8 py-5 dark:border-border dark:bg-muted/40">
        <p id="ranking-ausencias-detalhe-titulo" className="text-lg font-semibold tracking-tight text-slate-900 dark:text-foreground">
          Ausências por colaborador
        </p>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-muted-foreground">
          Histórico completo na base: ignora o recorte de datas e o drill-down dos gráficos; respeita colaboradores
          selecionados e o filtro de tipos de ausência do ranking, quando ativos.
        </p>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-auto bg-white px-6 py-5 dark:bg-popover sm:px-8 sm:py-6 [scrollbar-gutter:stable]">
        <div className="flex justify-end border-b border-slate-100 pb-4 dark:border-border">
          <div
            className="max-w-full rounded-lg bg-slate-100 px-4 py-2.5 text-right text-[11px] font-semibold uppercase leading-snug tracking-tight text-slate-800 dark:bg-muted dark:text-foreground sm:max-w-[min(90%,520px)]"
            title={bar.setor ? `${bar.nome} · ${bar.setor}` : bar.nome}
          >
            {bar.nome}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3.5 shadow-sm dark:border-border dark:bg-muted/30">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
              Ausências justificadas
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-foreground">
              {pctJ != null ? `${formatDecimalPt(pctJ)}%` : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3.5 shadow-sm dark:border-border dark:bg-muted/30">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
              Ausências injustificadas
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-foreground">
              {pctI != null ? `${formatDecimalPt(pctI)}%` : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3.5 shadow-sm dark:border-border dark:bg-muted/30">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
              Total de dias perdidos
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-foreground">{formatDecimalPt(totalDias)}</p>
          </div>
        </div>

        <div className="mt-5 border-t border-slate-100 pt-4 dark:border-border">
          <p className="text-center text-xs font-semibold text-slate-800 dark:text-foreground">Por mês</p>
          <div className="mt-3 w-full min-w-0">
            {serie.length === 0 ? (
              <p className="flex min-h-[200px] items-center justify-center text-center text-sm text-slate-500 dark:text-muted-foreground">
                Sem dados para este colaborador com os critérios do histórico (tipos / seleção).
              </p>
            ) : (
              <div className="flex w-full min-w-0 max-w-full flex-col">
                <div className="w-full min-w-0 max-w-full" style={{ height: chartBlockHeight }}>
                  <ResponsiveContainer className="max-w-full [&_.recharts-surface]:max-w-full" width="100%" height="100%">
                    <BarChart
                      data={serie}
                      margin={{
                        top: 28,
                        right: RANKING_INNER_CHART_MARGIN_RIGHT,
                        left: RANKING_INNER_CHART_MARGIN_LEFT,
                        bottom: 44,
                      }}
                      barCategoryGap="8%"
                      barGap={3}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(20,2%,90%)" vertical={false} />
                      {serie.map((p) =>
                        p.yearDividerBefore ? (
                          <ReferenceLine key={`ranking-yl-${p.ym}`} x={p.ym} stroke="hsl(220,9%,82%)" strokeWidth={1} />
                        ) : null,
                      )}
                      <XAxis
                        dataKey="ym"
                        type="category"
                        tickLine={false}
                        axisLine={{ stroke: "hsl(220,9%,88%)" }}
                        interval={0}
                        height={48}
                        tick={(props: { x: number; y: number; payload: { value: string } }) => {
                          const { x, y, payload } = props;
                          const p = serie.find((s) => s.ym === String(payload?.value ?? ""));
                          if (!p) return null;
                          return (
                            <g transform={`translate(${x},${y})`}>
                              <text
                                textAnchor="middle"
                                fill="hsl(215,16%,40%)"
                                fontSize={10}
                                dy={p.showAnoLinha ? 10 : 16}
                              >
                                {p.mesCurto}
                              </text>
                              {p.showAnoLinha ? (
                                <text textAnchor="middle" fill="hsl(215,11%,50%)" fontSize={9} dy={20}>
                                  {p.ano}
                                </text>
                              ) : null}
                            </g>
                          );
                        }}
                      />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(215,16%,45%)" }} width={48} allowDecimals domain={[0, "auto"]} />
                      <Legend
                        layout="horizontal"
                        verticalAlign="bottom"
                        align="center"
                        wrapperStyle={{
                          fontSize: 12,
                          paddingTop: 12,
                          width: "100%",
                          display: "flex",
                          justifyContent: "center",
                        }}
                        formatter={(value) => <span className="text-slate-700 dark:text-foreground">{value}</span>}
                      />
                      <Bar
                        dataKey="justificadas"
                        name="Justificadas"
                        fill={RANKING_TOOLTIP_JUST_FILL}
                        maxBarSize={64}
                        radius={[2, 2, 0, 0]}
                      >
                        <LabelList
                          dataKey="justificadas"
                          position="top"
                          formatter={(v: number | string) => (Number(v) > 0 ? formatDecimalPt(Number(v)) : "")}
                          className="fill-slate-500 text-[9px] dark:fill-muted-foreground"
                        />
                      </Bar>
                      <Bar
                        dataKey="injustificadas"
                        name="Injustificadas"
                        fill={RANKING_TOOLTIP_INJUST_FILL}
                        maxBarSize={64}
                        radius={[2, 2, 0, 0]}
                      >
                        <LabelList
                          dataKey="injustificadas"
                          position="top"
                          formatter={(v: number | string) => (Number(v) > 0 ? formatDecimalPt(Number(v)) : "")}
                          className="fill-slate-600 text-[9px] dark:fill-muted-foreground"
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function DiasSemanaBarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: DiaSemanaImpactado }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div className="min-w-[200px] rounded-sm border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <div className="space-y-1.5">
        <div className="flex justify-between gap-6">
          <span className="text-muted-foreground">Dia</span>
          <span className="shrink-0 font-semibold text-foreground">{row.dia}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-muted-foreground">% do total</span>
          <span className="shrink-0 font-semibold tabular-nums text-foreground">{formatDecimalPt(row.percentual)}%</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-muted-foreground">Ocorrências</span>
          <span className="shrink-0 font-semibold tabular-nums text-foreground">{formatIntPt(row.totalOcorrencias)}</span>
        </div>
      </div>
    </div>
  );
}

function DashboardTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ color?: string; name?: string; value?: number | string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sm border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-2 font-semibold text-foreground">{label}</p>
      <div className="space-y-1">
        {payload.map((item, index) => {
          const raw = item.value;
          const display =
            item.name === "Taxa de absenteísmo" && typeof raw === "number"
              ? `${formatDecimalPt(raw)}%`
              : String(raw ?? "");
          return (
            <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                {item.name}
              </span>
              <span className="font-medium text-foreground">{display}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TendenciasFaltasTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    payload?: SerieMensal;
    color?: string;
    name?: string;
    value?: number | string;
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const diasPerdidosTooltip =
    typeof payload.find((item) => item.name === "Dias perdidos")?.value === "number"
      ? Number(payload.find((item) => item.name === "Dias perdidos")?.value)
      : row.totalQuantidade;
  const taxaTooltip =
    typeof payload.find((item) => item.name === "Taxa de absenteísmo")?.value === "number"
      ? Number(payload.find((item) => item.name === "Taxa de absenteísmo")?.value)
      : row.taxaAbsenteismo;

  const denominador = row.colaboradoresBase * row.diasUteis;
  const taxaFmt = `${formatDecimalPt(taxaTooltip)}%`;

  const equiv = row.totalQuantidadeEquivalente;

  return (
    <div className="max-w-[260px] rounded-sm border border-border bg-popover px-3 py-2.5 text-xs text-popover-foreground shadow-md">
      <p className="font-semibold text-foreground">{label}</p>
      <div className="mt-2 space-y-1.5 border-b border-border pb-2">
        <div className="flex justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-[#2438b8]" />
            Dias perdidos
          </span>
          <span className="shrink-0 font-semibold text-foreground tabular-nums">{formatDecimalPt(diasPerdidosTooltip)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-[#d99000]" />
            Taxa de absenteísmo
          </span>
          <span className="shrink-0 font-semibold text-foreground tabular-nums">{taxaFmt}</span>
        </div>
      </div>

      <p className="mb-1.5 mt-2.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Cálculo</p>
      <div className="space-y-1 border-t border-border pt-1.5">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Dias perdidos</span>
          <span className="shrink-0 font-semibold text-foreground tabular-nums">{formatDecimalPt(diasPerdidosTooltip)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">
            {row.colaboradoresBaseModo === "desligados-snapshot" ? "Base (desligados)" : "Base (média)"}
          </span>
          <span className="shrink-0 font-semibold text-foreground tabular-nums">{formatDecimalPt(row.colaboradoresBase)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Dias úteis</span>
          <span className="shrink-0 font-semibold text-foreground tabular-nums">{formatIntPt(row.diasUteis)}</span>
        </div>
      </div>

      {denominador > 0 ? (
        <div className="mt-2 border-t border-border pt-2 text-[10px] leading-snug text-muted-foreground">
          <p>Taxa ≈ dias equivalentes ÷ (base × dias úteis)</p>
          <p className="mt-0.5 font-medium tabular-nums text-foreground">
            {formatDecimalPt(equiv)} ÷ {formatDecimalPt(denominador)}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-[10px] leading-snug text-amber-700 dark:text-amber-400">Sem base ou dias úteis — taxa 0%.</p>
      )}
    </div>
  );
}

function severidadeCellClass(s: SeveridadeSancao): string {
  switch (s) {
    case "Alta":
      return "bg-primary text-primary-foreground font-semibold";
    case "Média":
      return "bg-amber-200/90 text-amber-950 font-medium dark:bg-amber-900/45 dark:text-amber-50";
    case "Baixa":
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function SancaoSortTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SancaoSortKey;
  activeKey: SancaoSortKey;
  dir: "asc" | "desc";
  onSort: (k: SancaoSortKey) => void;
  align?: "left" | "center" | "right";
}) {
  const active = activeKey === sortKey;
  const justify = align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start";
  return (
    <th
      className={cn(
        "border-b border-border bg-muted/60 px-3 py-2.5",
        align === "center" && "text-center",
        align === "right" && "text-right",
      )}
    >
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-foreground hover:bg-muted/80 rounded-sm px-0.5 -mx-0.5",
          justify,
        )}
        onClick={() => onSort(sortKey)}
      >
        <span>{label}</span>
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-35" aria-hidden />
        )}
      </button>
    </th>
  );
}

type SancoesDetalheColPct = { nome: number; tipo: number; data: number; obs: number };

const SANCOES_DETALHE_COL_PCT_DEFAULT: SancoesDetalheColPct = {
  nome: 38,
  tipo: 13,
  data: 20,
  obs: 29,
};

const SANCOES_DETALHE_COL_KEYS = ["nome", "tipo", "data", "obs"] as const satisfies readonly (keyof SancoesDetalheColPct)[];

function SancoesColResizeHandle({
  onPointerDown,
}: {
  onPointerDown: (e: React.PointerEvent<HTMLSpanElement>) => void;
}) {
  return (
    <span
      role="separator"
      aria-orientation="vertical"
      aria-hidden
      className="absolute right-0 top-0 z-[2] flex h-full w-3 translate-x-1/2 cursor-col-resize select-none items-center justify-center touch-none"
      onPointerDown={onPointerDown}
    >
      <span className="h-[60%] w-px rounded-full bg-slate-300/90 hover:bg-primary/70 dark:bg-border dark:hover:bg-primary/60" />
    </span>
  );
}

function SancoesDetalhePainelConteudo({
  detalhes,
  colPct,
  setColPct,
}: {
  detalhes: SancaoDisciplinarRow[];
  colPct: SancoesDetalheColPct;
  setColPct: React.Dispatch<React.SetStateAction<SancoesDetalheColPct>>;
}) {
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const resizeDragRef = useRef<{
    pairIndex: 0 | 1 | 2;
    startX: number;
    startPct: SancoesDetalheColPct;
  } | null>(null);

  const startColResize = useCallback(
    (pairIndex: 0 | 1 | 2, e: React.PointerEvent<HTMLSpanElement>) => {
      e.preventDefault();
      e.stopPropagation();
      resizeDragRef.current = {
        pairIndex,
        startX: e.clientX,
        startPct: { ...colPct },
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const el = tableScrollRef.current;
      const onMove = (ev: PointerEvent) => {
        const d = resizeDragRef.current;
        if (!d || !el) return;
        const w = el.clientWidth;
        if (w < 40) return;
        const a = SANCOES_DETALHE_COL_KEYS[d.pairIndex];
        const b = SANCOES_DETALHE_COL_KEYS[d.pairIndex + 1];
        const dPct = ((ev.clientX - d.startX) / w) * 100;
        const sum2 = d.startPct[a] + d.startPct[b];
        const minA = d.pairIndex === 0 ? 22 : 10;
        const minB = d.pairIndex === 2 ? 14 : 10;
        let nextA = d.startPct[a] + dPct;
        nextA = Math.max(minA, Math.min(sum2 - minB, nextA));
        const nextB = sum2 - nextA;
        setColPct((prev) => ({ ...prev, [a]: nextA, [b]: nextB }));
      };

      const onUp = () => {
        resizeDragRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [colPct, setColPct],
  );

  return (
    <>
      <div className="shrink-0 border-b border-slate-200 bg-slate-100/90 px-8 py-5 dark:border-border dark:bg-muted/40">
        <p id="sancoes-detalhe-titulo" className="text-lg font-semibold tracking-tight text-slate-900 dark:text-foreground">
          Sanções do colaborador
        </p>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-muted-foreground">Lista no período filtrado.</p>
      </div>
      <div
        ref={tableScrollRef}
        className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-auto overscroll-contain bg-white px-6 py-4 dark:bg-popover [scrollbar-gutter:stable]"
      >
        <table className="w-full min-w-[880px] table-fixed border-collapse text-sm">
          <colgroup>
            <col style={{ width: `${colPct.nome}%` }} />
            <col style={{ width: `${colPct.tipo}%` }} />
            <col style={{ width: `${colPct.data}%` }} />
            <col style={{ width: `${colPct.obs}%` }} />
          </colgroup>
          <thead>
            <tr className="border-b-2 border-slate-300 text-left dark:border-border">
              <th className="relative sticky top-0 z-[1] bg-white pb-2.5 pr-4 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:bg-popover dark:text-muted-foreground">
                <span className="block pr-1">Nome</span>
                <SancoesColResizeHandle onPointerDown={(e) => startColResize(0, e)} />
              </th>
              <th className="relative sticky top-0 z-[1] bg-white pb-2.5 pr-4 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:bg-popover dark:text-muted-foreground">
                <span className="block pr-1">Tipo</span>
                <SancoesColResizeHandle onPointerDown={(e) => startColResize(1, e)} />
              </th>
              <th className="relative sticky top-0 z-[1] bg-white pb-2.5 pr-4 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:bg-popover dark:text-muted-foreground">
                <span className="block pr-1 leading-snug">Data aplicação</span>
                <SancoesColResizeHandle onPointerDown={(e) => startColResize(2, e)} />
              </th>
              <th className="sticky top-0 z-[1] bg-white pb-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:bg-popover dark:text-muted-foreground">
                Obs.
              </th>
            </tr>
          </thead>
          <tbody>
            {detalhes.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="py-10 text-center text-sm text-slate-600 dark:text-muted-foreground"
                >
                  Nenhuma sanção neste período.
                </td>
              </tr>
            ) : (
              detalhes.map((s, idx) => (
                <tr
                  key={`${String(s.id)}-${idx}`}
                  className={cn(
                    "align-top border-b border-slate-200/90 last:border-0 dark:border-border/60",
                    idx % 2 === 1 ? "bg-slate-50/95 dark:bg-muted/15" : "bg-white dark:bg-transparent",
                  )}
                >
                  <td className="max-w-0 break-words py-3 pr-4 align-top font-medium text-slate-900 dark:text-foreground">
                    {s.nomeFuncionario}
                  </td>
                  <td className="max-w-0 break-words py-3 pr-4 align-top text-slate-800 dark:text-foreground">
                    {String(s.tipo ?? "").trim() || "—"}
                  </td>
                  <td className="max-w-0 break-words py-3 pr-4 align-top text-slate-600 [overflow-wrap:anywhere] dark:text-muted-foreground">
                    {formatDataAplicacaoLongaPt(clampIsoDate(s.dataAplicacao))}
                  </td>
                  <td className="max-w-0 break-words py-3 align-top text-slate-700 leading-relaxed [overflow-wrap:anywhere] dark:text-muted-foreground">
                    {String(s.observacoes ?? "").trim() || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function AbsenteismoDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedColaboradores, setSelectedColaboradores] = useState<string[]>([]);
  /** false = “Não”: só ativos no escopo; true = “Sim”: ativos e desligados. */
  const [incluirColaboradoresDesligados, setIncluirColaboradoresDesligados] = useState(false);
  const [filtroBuscaNomeColaborador, setFiltroBuscaNomeColaborador] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rankingTopN, setRankingTopN] = useState(10);
  /** `undefined` = todos os tipos; `[]` = nenhum selecionado; senão subconjunto (chaves normalizadas). */
  const [rankingTiposAusencia, setRankingTiposAusencia] = useState<string[] | undefined>(undefined);
  const [rankingTiposOpen, setRankingTiposOpen] = useState(false);
  const [sancaoSort, setSancaoSort] = useState<{ key: SancaoSortKey; dir: "asc" | "desc" }>({
    key: "qntd",
    dir: "desc",
  });
  const [sancaoPanelKey, setSancaoPanelKey] = useState<string | null>(null);
  const [rankingPanelKey, setRankingPanelKey] = useState<string | null>(null);
  const [chartDrilldown, setChartDrilldown] = useState<ChartDrilldown>(null);
  const [sancoesDetalheColPct, setSancoesDetalheColPct] = useState<SancoesDetalheColPct>(SANCOES_DETALHE_COL_PCT_DEFAULT);
  const sancaoHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rankingHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rankingPanelOpenDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rankingAusenciasCtx, setRankingAusenciasCtx] = useState<{
    x: number;
    y: number;
    key: string;
    nome: string;
  } | null>(null);
  const [rankingAusenciasDialogOpen, setRankingAusenciasDialogOpen] = useState(false);
  const [rankingAusenciasDialogColabKey, setRankingAusenciasDialogColabKey] = useState<string | null>(null);
  const [rankingAusenciasDialogNome, setRankingAusenciasDialogNome] = useState("");
  const [atestadosRelatorioOpen, setAtestadosRelatorioOpen] = useState(false);
  const [atestadosRelatorioColabKey, setAtestadosRelatorioColabKey] = useState<string | null>(null);
  const [atestadosRelatorioNome, setAtestadosRelatorioNome] = useState("");

  const openRankingAusenciasContextMenu = useCallback((clientX: number, clientY: number, key: string, nome: string) => {
    const pad = 8;
    const w = 300;
    const h = 120;
    const vw = typeof window !== "undefined" ? window.innerWidth : 800;
    const vh = typeof window !== "undefined" ? window.innerHeight : 600;
    const x = Math.max(pad, Math.min(clientX, vw - w - pad));
    const y = Math.max(pad, Math.min(clientY, vh - h - pad));
    setRankingAusenciasCtx({ x, y, key, nome });
  }, []);

  const rankingBarShape = useCallback(
    (shapeProps: Record<string, unknown>) => {
      const x = Number(shapeProps.x ?? 0);
      const y = Number(shapeProps.y ?? 0);
      const width = Number(shapeProps.width ?? 0);
      const height = Number(shapeProps.height ?? 0);
      const fill = String(shapeProps.fill ?? "#2438b8");
      const payload = shapeProps.payload as (RankingFuncionario & { funcionarioKey?: string }) | undefined;
      if (!payload) {
        return <rect x={x} y={y} width={width} height={height} fill={fill} rx={2} ry={2} />;
      }
      const key = payload.funcionarioKey ?? rankingColaboradorKeyFromNomeMatricula(payload.nome, payload.matricula);
      return (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={fill}
          rx={2}
          ry={2}
          onContextMenu={(e) => {
            e.preventDefault();
            openRankingAusenciasContextMenu(e.clientX, e.clientY, key, payload.nome);
          }}
        />
      );
    },
    [openRankingAusenciasContextMenu],
  );

  useEffect(() => {
    if (!rankingAusenciasCtx) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRankingAusenciasCtx(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rankingAusenciasCtx]);

  const clearSancaoHoverTimer = useCallback(() => {
    if (sancaoHoverTimerRef.current) {
      clearTimeout(sancaoHoverTimerRef.current);
      sancaoHoverTimerRef.current = null;
    }
  }, []);

  const clearRankingHoverTimer = useCallback(() => {
    if (rankingHoverTimerRef.current) {
      clearTimeout(rankingHoverTimerRef.current);
      rankingHoverTimerRef.current = null;
    }
  }, []);

  const clearRankingPanelOpenDelay = useCallback(() => {
    if (rankingPanelOpenDelayRef.current) {
      clearTimeout(rankingPanelOpenDelayRef.current);
      rankingPanelOpenDelayRef.current = null;
    }
  }, []);

  /** Abre ou troca o colaborador no painel central (imediato ao mudar de linha). */
  const openSancaoPanel = useCallback(
    (key: string) => {
      clearSancaoHoverTimer();
      clearRankingHoverTimer();
      clearRankingPanelOpenDelay();
      setRankingPanelKey(null);
      setSancaoPanelKey(key);
    },
    [clearSancaoHoverTimer, clearRankingHoverTimer, clearRankingPanelOpenDelay],
  );

  const closeSancaoPanelNow = useCallback(() => {
    clearSancaoHoverTimer();
    setSancaoPanelKey(null);
  }, [clearSancaoHoverTimer]);

  /** Ao sair da área da tabela ou do painel: fecha após curto atraso (permite ir da tabela ao painel). */
  const scheduleCloseSancaoPanel = useCallback(() => {
    clearSancaoHoverTimer();
    sancaoHoverTimerRef.current = setTimeout(() => {
      setSancaoPanelKey(null);
      sancaoHoverTimerRef.current = null;
    }, 220);
  }, [clearSancaoHoverTimer]);

  const openRankingPanel = useCallback(
    (key: string) => {
      clearRankingPanelOpenDelay();
      clearRankingHoverTimer();
      clearSancaoHoverTimer();
      setSancaoPanelKey(null);
      setRankingPanelKey(key);
    },
    [clearRankingPanelOpenDelay, clearRankingHoverTimer, clearSancaoHoverTimer],
  );

  const scheduleOpenRankingPanelAfterHover = useCallback(
    (key: string) => {
      clearRankingPanelOpenDelay();
      rankingPanelOpenDelayRef.current = setTimeout(() => {
        rankingPanelOpenDelayRef.current = null;
        openRankingPanel(key);
      }, RANKING_PANEL_HOVER_DELAY_MS);
    },
    [clearRankingPanelOpenDelay, openRankingPanel],
  );

  const closeRankingPanelNow = useCallback(() => {
    clearRankingPanelOpenDelay();
    clearRankingHoverTimer();
    setRankingPanelKey(null);
  }, [clearRankingPanelOpenDelay, clearRankingHoverTimer]);

  const scheduleCloseRankingPanel = useCallback(() => {
    clearRankingHoverTimer();
    rankingHoverTimerRef.current = setTimeout(() => {
      setRankingPanelKey(null);
      rankingHoverTimerRef.current = null;
    }, 220);
  }, [clearRankingHoverTimer]);

  useEffect(
    () => () => {
      clearSancaoHoverTimer();
      clearRankingHoverTimer();
      clearRankingPanelOpenDelay();
    },
    [clearSancaoHoverTimer, clearRankingHoverTimer, clearRankingPanelOpenDelay],
  );

  useEffect(() => {
    if (!sancaoPanelKey && !rankingPanelKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (sancaoPanelKey) closeSancaoPanelNow();
      if (rankingPanelKey) closeRankingPanelNow();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sancaoPanelKey, rankingPanelKey, closeSancaoPanelNow, closeRankingPanelNow]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["faltas-atestados", "dashboard-absenteismo", "all"],
    queryFn: () => getFaltasAtestados(),
  });
  const {
    data: organicoRows,
    isLoading: isLoadingOrganico,
    isError: isErrorOrganico,
    refetch: refetchOrganico,
  } = useQuery({
    queryKey: ["organico", "dashboard-absenteismo"],
    queryFn: getOrganico,
  });
  const { data: secullumRows } = useQuery({
    queryKey: ["secullum-funcionarios-dashboard-absenteismo"],
    queryFn: getSecullumFuncionarios,
    enabled: isApiConfigured(),
    staleTime: 5 * 60 * 1000,
  });
  const {
    data: sancoesRowsRaw,
    isLoading: isLoadingSancoes,
    isError: isErrorSancoes,
    refetch: refetchSancoes,
  } = useQuery({
    queryKey: ["sancoes-disciplinares", "dashboard-absenteismo", "all"],
    queryFn: () => getSancoesDisciplinares(),
  });
  const { data: cadastrosData } = useQuery({
    queryKey: ["faltas-cadastros", "dashboard-absenteismo"],
    queryFn: getFaltasCadastros,
  });
  const tiposRegrasMap = useMemo(
    () =>
      buildFaltasTiposRegrasMap(
        (cadastrosData?.tipos ?? []).map((item) => {
          const tipo = String(item.valor ?? "").trim();
          const contabilizaIndicadores = item.contabilizaIndicadores !== false;
          return {
            tipo,
            contabilizaIndicadores,
            classificacao: contabilizaIndicadores
              ? item.classificacaoIndicador === "justificada" || item.classificacaoIndicador === "injustificada"
                ? item.classificacaoIndicador
                : classificarTipoFallback(tipo)
              : null,
            exibirNoDetalhamento: item.exibirNoDetalhamento !== false,
          };
        }),
      ),
    [cadastrosData],
  );

  const availableRows = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const availableRowsIndicadores = useMemo(
    () => availableRows.filter((row) => rowContaNosIndicadores(row, tiposRegrasMap)),
    [availableRows, tiposRegrasMap],
  );
  const availableRowsDetalhamento = useMemo(
    () => availableRows.filter((row) => rowExibeNoDetalhamento(row, tiposRegrasMap)),
    [availableRows, tiposRegrasMap],
  );
  const desligadoPorColaboradorKey = useMemo(
    () => buildIsDesligadoPorColaboradorOrganico(organicoRows),
    [organicoRows],
  );
  const colaboradorOptions = useMemo<ColaboradorFiltroOption[]>(() => {
    const map = new Map<string, ColaboradorFiltroOption>();
    for (const row of availableRowsDetalhamento) {
      const nome = String(row.nomeFuncionario ?? "").trim();
      if (!nome) continue;
      const matricula = String(row.matricula ?? "").trim();
      if (!colaboradorPassaFiltroOrganicoStatus(desligadoPorColaboradorKey, matricula, nome, incluirColaboradoresDesligados)) {
        continue;
      }
      const key = `${matricula}|||${nome}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          label: matricula ? `${nome} • ${matricula}` : nome,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [availableRowsDetalhamento, desligadoPorColaboradorKey, incluirColaboradoresDesligados]);

  const colaboradorOptionsFiltradosPorBusca = useMemo(() => {
    if (!filtroBuscaNomeColaborador.trim()) return colaboradorOptions;
    return colaboradorOptions.filter((o) => textIncludesSearch(o.label, filtroBuscaNomeColaborador));
  }, [colaboradorOptions, filtroBuscaNomeColaborador]);

  const dataBounds = useMemo(() => {
    const dates = availableRows.map((row) => clampIsoDate(row.data)).filter(Boolean).sort((a, b) => a.localeCompare(b));
    return {
      min: dates[0] ?? "",
      max: dates[dates.length - 1] ?? "",
    };
  }, [availableRows]);

  const filteredRows = useMemo(() => {
    const from = clampIsoDate(startDate);
    const to = clampIsoDate(endDate);
    const effectiveStart = from && to && from > to ? to : from;
    const effectiveEnd = from && to && from > to ? from : to;

    return availableRowsIndicadores.filter((row) => {
      const nome = String(row.nomeFuncionario ?? "").trim();
      const matricula = String(row.matricula ?? "").trim();
      if (!colaboradorPassaFiltroOrganicoStatus(desligadoPorColaboradorKey, matricula, nome, incluirColaboradoresDesligados)) {
        return false;
      }
      const rowDate = clampIsoDate(row.data);
      if (selectedColaboradores.length > 0) {
        const key = `${matricula}|||${nome}`;
        if (!selectedColaboradores.includes(key)) return false;
      }
      if (effectiveStart && rowDate && rowDate < effectiveStart) return false;
      if (effectiveEnd && rowDate && rowDate > effectiveEnd) return false;
      if (!rowMatchesChartDrilldown(row, chartDrilldown, tiposRegrasMap)) return false;
      return true;
    });
  }, [
    availableRowsIndicadores,
    desligadoPorColaboradorKey,
    incluirColaboradoresDesligados,
    selectedColaboradores,
    startDate,
    endDate,
    chartDrilldown,
    tiposRegrasMap,
  ]);

  const filteredRowsComTiposAusencia = useMemo(
    () => filterRowsByTiposAusencia(filteredRows, rankingTiposAusencia),
    [filteredRows, rankingTiposAusencia],
  );

  /** Faltas para o painel “Ausências por colaborador”: sem recorte de data nem drill-down; mantém orgânico, colaboradores e tipos do ranking. */
  const filteredRowsParaRankingTooltip = useMemo(() => {
    return availableRowsDetalhamento.filter((row) => {
      const nome = String(row.nomeFuncionario ?? "").trim();
      const matricula = String(row.matricula ?? "").trim();
      if (!colaboradorPassaFiltroOrganicoStatus(desligadoPorColaboradorKey, matricula, nome, incluirColaboradoresDesligados)) {
        return false;
      }
      if (selectedColaboradores.length > 0) {
        const key = `${matricula}|||${nome}`;
        if (!selectedColaboradores.includes(key)) return false;
      }
      return true;
    });
  }, [availableRowsDetalhamento, desligadoPorColaboradorKey, incluirColaboradoresDesligados, selectedColaboradores]);

  /** Trajetória completa de atestados: ignora período e drill-down do painel; mantém orgânico e multiseleção de colaboradores. */
  const atestadosRelatorioRows = useMemo(() => {
    if (!atestadosRelatorioColabKey) return [];
    return filteredRowsParaRankingTooltip.filter(
      (r) => rankingColaboradorKeyFromFaltaRow(r) === atestadosRelatorioColabKey,
    );
  }, [atestadosRelatorioColabKey, filteredRowsParaRankingTooltip]);

  const filteredRowsComTiposAusenciaParaRankingTooltip = useMemo(
    () => filterRowsByTiposAusencia(filteredRowsParaRankingTooltip, rankingTiposAusencia),
    [filteredRowsParaRankingTooltip, rankingTiposAusencia],
  );

  const colaboradorKeysFromFaltasFiltradas = useMemo(() => {
    const s = new Set<string>();
    for (const row of filteredRowsComTiposAusencia) {
      const nome = String(row.nomeFuncionario ?? "").trim();
      if (!nome) continue;
      const matricula = String(row.matricula ?? "").trim();
      s.add(`${matricula}|||${nome}`);
    }
    return s;
  }, [filteredRowsComTiposAusencia]);

  const rankingTipoOptions = useMemo(() => {
    const firstLabel = new Map<string, string>();
    for (const row of filteredRows) {
      const key = rankingTipoKeyFromFaltaRow(row);
      if (firstLabel.has(key)) continue;
      const raw = String(row.tipo ?? "").trim();
      const label = key === RANKING_TIPO_VAZIO ? "Sem tipo" : raw || key;
      firstLabel.set(key, label);
    }
    return [...firstLabel.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
      .map(([value, label]) => ({ value, label }));
  }, [filteredRows]);

  const rankingTipoOpcoesValores = useMemo(() => rankingTipoOptions.map((o) => o.value), [rankingTipoOptions]);

  const rankingTiposModoTodos = useMemo(() => {
    if (rankingTiposAusencia === undefined) return true;
    const all = rankingTipoOpcoesValores;
    if (all.length === 0) return true;
    return rankingTiposAusencia.length === all.length && all.every((v) => rankingTiposAusencia.includes(v));
  }, [rankingTiposAusencia, rankingTipoOpcoesValores]);

  /** Sanções acompanham o recorte de faltas quando o tipo não é “todos”. */
  const restringeSancoesPorTiposAusencia = useMemo(() => {
    if (rankingTiposAusencia === undefined) return false;
    if (rankingTiposAusencia.length === 0) return true;
    const all = rankingTipoOpcoesValores;
    if (all.length === 0) return false;
    const cobreTudo =
      rankingTiposAusencia.length === all.length && all.every((v) => rankingTiposAusencia.includes(v));
    return !cobreTudo;
  }, [rankingTiposAusencia, rankingTipoOpcoesValores]);

  /** Denominador da taxa: sempre base de colaboradores ativos (não alterna com o toggle de ver desligados). */
  const derived = useMemo(
    () => buildAbsenteismoFromFaltas(filteredRowsComTiposAusencia, organicoRows, secullumRows, false, tiposRegrasMap),
    [filteredRowsComTiposAusencia, organicoRows, secullumRows, tiposRegrasMap],
  );

  const setorPorColabOrganico = useMemo(() => buildSetorPorColaboradorOrganico(organicoRows), [organicoRows]);

  /** Sanções na tabela do painel: histórico completo (sem recorte por data); demais filtros do painel permanecem. */
  const sancoesFiltradas = useMemo(() => {
    const list = Array.isArray(sancoesRowsRaw) ? sancoesRowsRaw : [];
    const step = filterSancoesDisciplinaresRows(list, selectedColaboradores, "", "");
    const needsClassifKeys =
      chartDrilldown?.type === "classificacao" || chartDrilldown?.type === "mesClassificacao";
    return step.filter((row) => {
      const nome = String(row.nomeFuncionario ?? "").trim();
      const matricula = String(row.matricula ?? "").trim();
      if (!colaboradorPassaFiltroOrganicoStatus(desligadoPorColaboradorKey, matricula, nome, incluirColaboradoresDesligados)) {
        return false;
      }
      if (!sancaoRowMatchesChartDrilldown(row, chartDrilldown, setorPorColabOrganico)) return false;
      if (needsClassifKeys || restringeSancoesPorTiposAusencia) {
        const key = `${matricula}|||${nome}`;
        if (!colaboradorKeysFromFaltasFiltradas.has(key)) return false;
      }
      return true;
    });
  }, [
    sancoesRowsRaw,
    selectedColaboradores,
    desligadoPorColaboradorKey,
    incluirColaboradoresDesligados,
    chartDrilldown,
    setorPorColabOrganico,
    colaboradorKeysFromFaltasFiltradas,
    restringeSancoesPorTiposAusencia,
  ]);

  const sancoesDetalhePorColaborador = useMemo(() => {
    const rows = sancoesFiltradas.filter((row) =>
      colaboradorPassaFiltroOrganicoStatus(
        desligadoPorColaboradorKey,
        String(row.matricula ?? "").trim(),
        String(row.nomeFuncionario ?? "").trim(),
        incluirColaboradoresDesligados,
      ),
    );
    return buildSancoesDetalhePorColaborador(rows);
  }, [sancoesFiltradas, desligadoPorColaboradorKey, incluirColaboradoresDesligados]);

  const sancoesPorColaborador = useMemo(() => {
    const merged = mergeSancoesComColaboradoresOrganico(
      buildSancoesAgregadasPorColaborador(sancoesFiltradas, setorPorColabOrganico),
      organicoRows,
      setorPorColabOrganico,
      selectedColaboradores,
      incluirColaboradoresDesligados,
    );
    /** Garante o mesmo critério do painel “Deseja visualizar os colaboradores desligados?” (agregados vindos só de sanções podiam escapar se matrícula/nome não batiam com o Orgânico). */
    return merged.filter((r) =>
      colaboradorPassaFiltroOrganicoStatus(
        desligadoPorColaboradorKey,
        r.matricula,
        r.nome,
        incluirColaboradoresDesligados,
      ),
    );
  }, [
    sancoesFiltradas,
    setorPorColabOrganico,
    organicoRows,
    selectedColaboradores,
    incluirColaboradoresDesligados,
    desligadoPorColaboradorKey,
  ]);

  const sancoesTabelaOrdenada = useMemo(() => {
    const rows = [...sancoesPorColaborador];
    const { key, dir } = sancaoSort;
    const mul = dir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      let c = 0;
      switch (key) {
        case "colaborador":
          c = a.nome.localeCompare(b.nome, "pt-BR");
          break;
        case "setor":
          c = a.setor.localeCompare(b.setor, "pt-BR");
          break;
        case "qntd":
          c = a.qntd - b.qntd;
          break;
        case "ultima":
          c = (a.ultimaIso || "").localeCompare(b.ultimaIso || "");
          break;
        case "severidade":
          c = SEVERIDADE_ORDEM[a.severidade] - SEVERIDADE_ORDEM[b.severidade];
          break;
        default:
          c = 0;
      }
      if (c !== 0) return c * mul;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
    return rows;
  }, [sancoesPorColaborador, sancaoSort]);

  const toggleSancaoSort = useCallback((k: SancaoSortKey) => {
    setSancaoSort((prev) => {
      if (prev.key === k) return { key: k, dir: prev.dir === "asc" ? "desc" : "asc" };
      const defaultDesc = k === "qntd" || k === "ultima" || k === "severidade";
      return { key: k, dir: defaultDesc ? "desc" : "asc" };
    });
  }, []);

  /** Eixo da taxa em escala 0–100% (não “encolher” até o pico local ~20%, o que igualava visualmente à linha de dias). */
  const taxaTrendAxisMax = useMemo(() => {
    let maxT = 0;
    for (const r of derived.serieMensal) {
      if (typeof r.taxaAbsenteismo === "number" && r.taxaAbsenteismo > maxT) maxT = r.taxaAbsenteismo;
    }
    return Math.max(100, Math.ceil(maxT * 1.08));
  }, [derived.serieMensal]);

  const rankingFiltradoPorTipo = useMemo(
    () => buildRankingFromFaltasRows(filteredRowsComTiposAusencia),
    [filteredRowsComTiposAusencia],
  );

  const rankingExibicao = useMemo(
    () =>
      rankingFiltradoPorTipo.slice(0, rankingTopN).map((r) => ({
        ...r,
        funcionarioKey: rankingColaboradorKeyFromNomeMatricula(r.nome, r.matricula),
      })),
    [rankingFiltradoPorTipo, rankingTopN],
  );

  const rankingTooltipByKey = useMemo(
    () => buildRankingColaboradorTooltipModelByKey(filteredRowsComTiposAusenciaParaRankingTooltip, tiposRegrasMap),
    [filteredRowsComTiposAusenciaParaRankingTooltip, tiposRegrasMap],
  );

  const rankingPainelBar = useMemo(() => {
    if (!rankingPanelKey) return null;
    return rankingExibicao.find((r) => r.funcionarioKey === rankingPanelKey) ?? null;
  }, [rankingPanelKey, rankingExibicao]);

  const rankingChartHeight = useMemo(
    () => Math.min(900, Math.max(280, rankingTopN * 30 + 150)),
    [rankingTopN],
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (incluirColaboradoresDesligados) count += 1;
    if (selectedColaboradores.length > 0) count += 1;
    if (startDate) count += 1;
    if (endDate) count += 1;
    if (chartDrilldown !== null) count += 1;
    if (rankingTiposAusencia !== undefined) count += 1;
    return count;
  }, [incluirColaboradoresDesligados, selectedColaboradores, startDate, endDate, chartDrilldown, rankingTiposAusencia]);

  const handleClearFilters = useCallback(() => {
    setIncluirColaboradoresDesligados(false);
    setFiltroBuscaNomeColaborador("");
    setSelectedColaboradores([]);
    setStartDate("");
    setEndDate("");
    setChartDrilldown(null);
    setRankingTiposAusencia(undefined);
  }, []);

  const toggleRankingTiposSelecionarOuDesmarcarTodos = useCallback(() => {
    const allValues = rankingTipoOptions.map((o) => o.value);
    setRankingTiposAusencia((prev) => {
      const isAll =
        prev === undefined ||
        (prev.length === allValues.length && allValues.every((v) => prev.includes(v)));
      if (isAll) return [];
      return undefined;
    });
  }, [rankingTipoOptions]);

  const toggleRankingTipoCheckbox = useCallback((value: string) => {
    const allValues = rankingTipoOptions.map((o) => o.value);
    setRankingTiposAusencia((prev) => {
      if (prev === undefined) {
        return allValues.filter((v) => v !== value);
      }
      if (prev.length === 0) {
        return [value];
      }
      if (prev.includes(value)) {
        const next = prev.filter((v) => v !== value);
        return next.length === 0 ? [] : next;
      }
      const next = [...prev, value];
      if (next.length === allValues.length) return undefined;
      return next;
    });
  }, [rankingTipoOptions]);

  const handleTrendMesClick = useCallback((payload: SerieMensal) => {
    setChartDrilldown((p) => toggleChartDrilldown(p, { type: "mes", ym: payload.ym, label: payload.label }));
  }, []);

  const renderTendenciaDot =
    (strokeColor: string, lineKey: "dias" | "taxa") =>
    (dotProps: { cx?: number; cy?: number; payload?: SerieMensal }) => {
      const { cx = 0, cy = 0, payload } = dotProps;
      if (!payload?.ym) return null;
      const isActive =
        chartDrilldown !== null &&
        (chartDrilldown.type === "mes" || chartDrilldown.type === "mesClassificacao") &&
        chartDrilldown.ym === payload.ym;
      return (
        <circle
          key={`tendencia-dot-${lineKey}-${payload.ym}`}
          cx={cx}
          cy={cy}
          r={isActive ? 6 : 4}
          fill={strokeColor}
          stroke={isActive ? "hsl(220, 14%, 96%)" : "transparent"}
          strokeWidth={isActive ? 2 : 0}
          className="cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            handleTrendMesClick(payload);
          }}
        />
      );
    };

  useEffect(() => {
    const valid = new Set(colaboradorOptions.map((o) => o.key));
    setSelectedColaboradores((prev) => {
      const next = prev.filter((k) => valid.has(k));
      return next.length === prev.length ? prev : next;
    });
  }, [colaboradorOptions]);

  useEffect(() => {
    const valid = new Set(rankingTipoOptions.map((o) => o.value));
    setRankingTiposAusencia((prev) => {
      if (prev === undefined) return undefined;
      const next = prev.filter((k) => valid.has(k));
      if (next.length === prev.length) return prev;
      if (next.length === 0) return undefined;
      if (next.length === valid.size) return undefined;
      return next;
    });
  }, [rankingTipoOptions]);

  const toggleColaborador = useCallback((key: string) => {
    setSelectedColaboradores((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  }, []);

  const handleSyncDashboard = useCallback(async () => {
    setIsSyncing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["faltas-atestados"] });
      await queryClient.invalidateQueries({ queryKey: ["faltas-atestados-months-meta"] });
      await queryClient.invalidateQueries({ queryKey: ["sancoes-disciplinares"] });
      await Promise.all([refetch(), refetchOrganico(), refetchSancoes()]);
    } finally {
      setIsSyncing(false);
    }
  }, [queryClient, refetch, refetchOrganico, refetchSancoes]);

  const rankingBarEventToColaboradorKey = useCallback((data: unknown): string | null => {
    const d = data as
      | (RankingFuncionario & { funcionarioKey?: string })
      | { payload?: RankingFuncionario & { funcionarioKey?: string } };
    const row = d && typeof d === "object" && "payload" in d && d.payload ? d.payload : (d as RankingFuncionario);
    if (!row?.nome) return null;
    return typeof row.funcionarioKey === "string" && row.funcionarioKey.length > 0
      ? row.funcionarioKey
      : rankingColaboradorKeyFromNomeMatricula(row.nome, row.matricula);
  }, []);

  if (isLoading || isLoadingOrganico) {
    return (
      <div className="flex items-center justify-center min-h-[38vh]">
        <p className="text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  if (isError || isErrorOrganico) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[38vh] gap-3">
        <p className="text-destructive">Não foi possível carregar os dados.</p>
        <Button variant="outline" size="sm" onClick={() => { void refetch(); void refetchOrganico(); }}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Absenteísmo &amp; People Analytics</h2>
          <p className="text-sm text-muted-foreground">Ausências registradas em Faltas e Atestados.</p>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {formatIntPt(derived.totalAusencias)} lançamentos · {formatIntPt(derived.mesesCobertos)} mês(es) · {derived.periodoLabel}
            {activeFilterCount > 0 ? ` · ${formatIntPt(activeFilterCount)} filtro(s)` : ""}
          </p>
          
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Popover
            open={filterOpen}
            onOpenChange={(open) => {
              setFilterOpen(open);
              if (!open) setFiltroBuscaNomeColaborador("");
            }}
          >
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="mr-1.5 h-4 w-4" />
                Filtros
                {activeFilterCount > 0 ? <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-[10px] text-primary">{activeFilterCount}</span> : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[min(92vw,360px)] p-4">
              <div className="space-y-4">
                <div>
                  <p className="text-lg font-semibold text-foreground">Seleção de Filtros</p>
                  <p className="text-xs text-muted-foreground">Ativos ou desligados; em seguida datas e nomes.</p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Deseja visualizar os colaboradores desligados?</p>
                  <RadioGroup
                    value={incluirColaboradoresDesligados ? "sim" : "nao"}
                    onValueChange={(v) => setIncluirColaboradoresDesligados(v === "sim")}
                    className="flex flex-wrap gap-4"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="nao" id="filtro-colab-nao" />
                      <Label htmlFor="filtro-colab-nao" className="cursor-pointer text-sm font-normal text-foreground">
                        Não
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="sim" id="filtro-colab-sim" />
                      <Label htmlFor="filtro-colab-sim" className="cursor-pointer text-sm font-normal text-foreground">
                        Sim
                      </Label>
                    </div>
                  </RadioGroup>
                  <p className="text-[10px] leading-snug text-muted-foreground">Status conforme Orgânico. Fora do cadastro: vale como ativo (Não).</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Nome do funcionário</label>
                  <Input
                    type="search"
                    value={filtroBuscaNomeColaborador}
                    onChange={(e) => setFiltroBuscaNomeColaborador(e.target.value)}
                    placeholder="Pesquisar por nome ou matrícula…"
                    className="h-9 text-sm"
                    autoComplete="off"
                  />
                  <div className="rounded-md border border-input bg-background">
                    <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                      <span className="text-sm text-foreground">
                        {selectedColaboradores.length === 0
                          ? "Todos"
                          : `${formatIntPt(selectedColaboradores.length)} colaborador(es) selecionado(s)`}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => setSelectedColaboradores(colaboradorOptions.map((option) => option.key))}
                        >
                          Todos
                        </button>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:underline"
                          onClick={() => setSelectedColaboradores([])}
                        >
                          Limpar
                        </button>
                      </div>
                    </div>
                    <div className="max-h-56 overflow-y-auto p-2 space-y-1">
                      {colaboradorOptionsFiltradosPorBusca.length === 0 ? (
                        <p className="px-2 py-3 text-xs text-muted-foreground">
                          Nenhum colaborador encontrado para esta pesquisa.
                        </p>
                      ) : (
                        colaboradorOptionsFiltradosPorBusca.map((option) => (
                          <label
                            key={option.key}
                            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/60 cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedColaboradores.includes(option.key)}
                              onCheckedChange={() => toggleColaborador(option.key)}
                            />
                            <span className="min-w-0 truncate">{option.label}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Período</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="date" value={startDate} min={dataBounds.min || undefined} max={dataBounds.max || undefined} onChange={(e) => setStartDate(e.target.value)} />
                    <Input type="date" value={endDate} min={dataBounds.min || undefined} max={dataBounds.max || undefined} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <Button variant="ghost" size="sm" onClick={handleClearFilters} disabled={activeFilterCount === 0}>
                    Limpar filtros
                  </Button>
                  <Button size="sm" onClick={() => setFilterOpen(false)}>
                    Aplicar
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={() => navigate("/rh/faltas-atestados")}>
            Abrir Faltas e Atestados
          </Button>
          <Button variant="outline" size="sm" disabled={isFetching || isSyncing} onClick={handleSyncDashboard}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${isFetching || isSyncing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <span className="text-xs text-muted-foreground">
            {isFetching || isSyncing ? "Atualizando…" : "Alinhado à tela operacional"}
          </span>
        </div>
      </div>

      {chartDrilldown ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
          <span>
            <span className="font-medium text-foreground">Filtro do gráfico:</span>{" "}
            <span className="text-muted-foreground">{chartDrilldownLabel(chartDrilldown)}</span>
          </span>
          <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0" onClick={() => setChartDrilldown(null)}>
            Limpar
          </Button>
        </div>
      ) : null}

      {derived.inconsistencias.length > 0 ? (
        <div className="border border-amber-200 bg-amber-50/70 p-4 shadow-level-1 dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-foreground">Atenção</p>
              {derived.inconsistencias.map((item) => (
                <p key={item} className="text-muted-foreground">
                  {item}
                </p>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <KpiCard
          title="Total de Ausências"
          value={formatIntPt(derived.totalAusencias)}
          icon={UserX}
          alertColor="yellow"
        />
        <KpiCard
          title="Dias Perdidos"
          value={formatDecimalPt(derived.totalQuantidadeInformada)}
          change={`${formatDecimalPt(derived.coberturaQuantidade)}% com QNTD`}
          changeType="neutral"
          icon={CalendarDays}
          alertColor="green"
        />
        <KpiCard
          title="Taxa de Absenteísmo"
          value={`${formatDecimalPt(derived.taxaAbsenteismo)}%`}
          icon={TrendingUp}
          alertColor="red"
        />
        <KpiCard
          title="Dias Perdidos Justificadas"
          value={formatDecimalPt(derived.ausenciasJustificadas)}
          icon={CheckCircle2}
          alertColor="green"
        />
        <KpiCard
          title="Dias Perdidos Injustificadas"
          value={formatDecimalPt(derived.ausenciasInjustificadas)}
          icon={XCircle}
          alertColor="red"
        />
        <KpiCard
          title="Duração Média Registrada"
          value={formatDecimalPt(derived.duracaoMediaRegistrada)}
          icon={Clock3}
          alertColor="yellow"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="border border-border bg-card p-6 shadow-level-1">
          <div className="mb-4">
            <p className="text-lg font-semibold text-foreground">Análise de Tendências de Faltas</p>
            <p className="text-xs text-muted-foreground">Dias perdidos e taxa de abs por mês.</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#2438b8]" />
                Dias perdidos
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#d99000]" />
                Taxa de absenteísmo
              </span>
            </div>
          </div>
          <div className="h-[320px] [&_.recharts-layer.recharts-line-dots]:outline-none">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={derived.serieMensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(20,2%,90%)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#64748b" }} allowDecimals={false} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  domain={[0, taxaTrendAxisMax]}
                  tickFormatter={(v) => `${formatIntPt(Number(v))}%`}
                />
                <Tooltip content={<TendenciasFaltasTooltip />} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="totalQuantidade"
                  name="Dias perdidos"
                  stroke="#2438b8"
                  strokeWidth={2.4}
                  dot={renderTendenciaDot("#2438b8", "dias")}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="taxaAbsenteismo"
                  name="Taxa de absenteísmo"
                  stroke="#d99000"
                  strokeWidth={2}
                  dot={renderTendenciaDot("#d99000", "taxa")}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border border-border bg-card p-6 shadow-level-1">
          <div className="mb-4">
            <p className="text-lg font-semibold text-foreground">Faltas Justificadas vs Injustificadas</p>
            <p className="text-xs text-muted-foreground">
              Total de dias perdidos por classificação. Clique na coluna para filtrar o mês.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-600" />
                Justificadas
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-600" />
                Injustificadas
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full border border-border bg-slate-300" />
                Sem classificação
              </span>
            </div>
          </div>
          <div className="h-[320px] [&_.recharts-rectangle]:cursor-pointer">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={derived.serieMensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(20,2%,90%)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} allowDecimals={false} />
                <Tooltip content={<DashboardTooltip />} />
                <Bar
                  dataKey="justificadas"
                  name="Justificadas"
                  stackId="status"
                  radius={[2, 2, 0, 0]}
                  onClick={(row: SerieMensal) => {
                    setChartDrilldown((p) =>
                      toggleChartDrilldown(p, { type: "mes", ym: row.ym, label: row.label }),
                    );
                  }}
                >
                  {derived.serieMensal.map((entry) => (
                    <Cell
                      key={`j-${entry.ym}`}
                      fill={
                        chartDrilldown?.type === "mes" && chartDrilldown.ym === entry.ym
                          ? "#34d399"
                          : "#059669"
                      }
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="injustificadas"
                  name="Injustificadas"
                  stackId="status"
                  radius={[2, 2, 0, 0]}
                  onClick={(row: SerieMensal) => {
                    setChartDrilldown((p) =>
                      toggleChartDrilldown(p, { type: "mes", ym: row.ym, label: row.label }),
                    );
                  }}
                >
                  {derived.serieMensal.map((entry) => (
                    <Cell
                      key={`i-${entry.ym}`}
                      fill={
                        chartDrilldown?.type === "mes" && chartDrilldown.ym === entry.ym
                          ? "#f87171"
                          : "#dc2626"
                      }
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey="indefinidas"
                  name="Sem classificação"
                  stackId="status"
                  radius={[2, 2, 0, 0]}
                  onClick={(row: SerieMensal) => {
                    setChartDrilldown((p) =>
                      toggleChartDrilldown(p, { type: "mes", ym: row.ym, label: row.label }),
                    );
                  }}
                >
                  {derived.serieMensal.map((entry) => (
                    <Cell
                      key={`u-${entry.ym}`}
                      fill={
                        chartDrilldown?.type === "mes" && chartDrilldown.ym === entry.ym
                          ? "#cbd5e1"
                          : "#94a3b8"
                      }
                    />
                  ))}
                  <LabelList
                    dataKey="totalQuantidade"
                    position="top"
                    formatter={(v: number | string) => {
                      const num = Number(v);
                      return Number.isFinite(num) && num > 0 ? formatDecimalPt(num) : "";
                    }}
                    className="fill-muted-foreground text-[10px] font-semibold"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="border border-border bg-card p-6 shadow-level-1">
          <div className="mb-4">
            <p className="text-lg font-semibold text-foreground">Setores Mais Impactados</p>
            <p className="text-xs text-muted-foreground">Por setor — clique para filtrar.</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#2438b8]" />
                Padrão
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#ffad00]" />
                Selecionado
              </span>
            </div>
          </div>
          <div className="h-[320px] [&_.recharts-rectangle]:cursor-pointer">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={derived.setoresImpactados}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 12, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(20,2%,90%)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} allowDecimals={false} />
                <YAxis
                  dataKey="setor"
                  type="category"
                  width={140}
                  tick={{ fontSize: 11, fill: "#041E42" }}
                  interval={0}
                />
                <Tooltip content={<DashboardTooltip />} />
                <Bar
                  dataKey="totalOcorrencias"
                  name="Ocorrências"
                  radius={[0, 2, 2, 0]}
                  onClick={(row: SetorImpactado) => {
                    setChartDrilldown((p) => toggleChartDrilldown(p, { type: "setor", setor: row.setor }));
                  }}
                >
                  {derived.setoresImpactados.map((entry) => (
                    <Cell
                      key={entry.setor}
                      fill={
                        chartDrilldown?.type === "setor" && chartDrilldown.setor === entry.setor ? "#ffad00" : "#2438b8"
                      }
                    />
                  ))}
                  <LabelList
                    dataKey="totalOcorrencias"
                    position="right"
                    formatter={(v: number | string) => {
                      const num = Number(v);
                      return Number.isFinite(num) && num > 0 ? formatDecimalPt(num) : "";
                    }}
                    className="fill-muted-foreground text-[10px]"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border border-border bg-card p-6 shadow-level-1">
          <div className="mb-4">
            <p className="text-lg font-semibold text-foreground">Dias da Semana Mais Afetados</p>
            <p className="text-xs text-muted-foreground">% por dia — clique para filtrar.</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#cdd3ff]" />
                Padrão
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#ffad00]" />
                Selecionado
              </span>
            </div>
          </div>
          <div className="h-[320px] [&_.recharts-rectangle]:cursor-pointer">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={derived.diasSemana} margin={{ top: 28, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(20,2%,90%)" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "#64748b" }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickFormatter={(v) => `${formatIntPt(Number(v))}%`}
                  width={44}
                  domain={[0, (max: number) => (Number.isFinite(max) && max > 0 ? Math.min(100, Math.ceil(max / 5) * 5 + 5) : 5)]}
                />
                <Tooltip content={<DiasSemanaBarTooltip />} cursor={{ fill: "hsl(20,2%,96%)" }} />
                <Bar
                  dataKey="percentual"
                  name="Total de ausências %"
                  radius={[2, 2, 0, 0]}
                  onClick={(row: DiaSemanaImpactado) => {
                    setChartDrilldown((p) =>
                      toggleChartDrilldown(p, { type: "diaSemana", weekdayIndex: row.weekdayIndex, label: row.dia }),
                    );
                  }}
                >
                  {derived.diasSemana.map((entry) => (
                    <Cell
                      key={entry.dia}
                      fill={
                        chartDrilldown?.type === "diaSemana" && chartDrilldown.weekdayIndex === entry.weekdayIndex
                          ? "#ffad00"
                          : "#cdd3ff"
                      }
                    />
                  ))}
                  <LabelList
                    dataKey="percentual"
                    position="top"
                    formatter={(v: number | string) => `${formatDecimalPt(Number(v))}%`}
                    className="fill-muted-foreground text-[10px]"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="border border-border bg-card p-6 shadow-level-1">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-lg font-semibold text-foreground">Ranking de Funcionários com Mais Ausências</p>
            <p className="text-xs text-muted-foreground">
              Mantenha o mouse sobre a barra para o painel de detalhe. Clique com o botão direito na barra para abrir a
              tabela de ausências (mesmo recorte do painel).
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-4 text-xs">
            <div className="space-y-1">
              <span className="block text-xs font-medium text-muted-foreground">Tipo de ausência</span>
              <Popover open={rankingTiposOpen} onOpenChange={setRankingTiposOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-[200px] justify-between gap-2 px-2 text-xs font-normal sm:w-[220px]"
                    aria-label="Filtrar tipos de ausência (toda a página)"
                  >
                    <span className="min-w-0 truncate">
                      {rankingTipoOptions.length === 0
                        ? "—"
                        : rankingTiposAusencia === undefined ||
                            (rankingTiposAusencia.length === rankingTipoOptions.length &&
                              rankingTipoOptions.every((o) => rankingTiposAusencia.includes(o.value)))
                          ? "Todos"
                          : rankingTiposAusencia.length === 0
                            ? "Nenhum tipo"
                            : `${formatIntPt(rankingTiposAusencia.length)} tipo(s)`}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[min(92vw,300px)] p-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                      <span className="text-sm font-medium text-foreground">Tipos</span>
                      <button
                        type="button"
                        className="shrink-0 text-xs text-primary hover:underline disabled:pointer-events-none disabled:opacity-40"
                        disabled={rankingTipoOptions.length === 0}
                        onClick={toggleRankingTiposSelecionarOuDesmarcarTodos}
                      >
                        {rankingTiposModoTodos ? "Desmarcar todos" : "Selecionar todos"}
                      </button>
                    </div>
                    <div className="max-h-56 space-y-1 overflow-y-auto pr-0.5">
                      {rankingTipoOptions.length === 0 ? (
                        <p className="py-2 text-xs text-muted-foreground">Nenhum tipo no período.</p>
                      ) : (
                        rankingTipoOptions.map((opt) => {
                          const checked =
                            rankingTiposAusencia === undefined ||
                            (rankingTiposAusencia.length > 0 && rankingTiposAusencia.includes(opt.value));
                          return (
                            <label
                              key={opt.value}
                              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/60"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleRankingTipoCheckbox(opt.value)}
                              />
                              <span className="min-w-0 truncate" title={opt.label}>
                                {opt.label.length > 42 ? `${opt.label.slice(0, 40)}…` : opt.label}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarClock className="h-4 w-4 shrink-0" />
              <span className="shrink-0">Top ranking</span>
              <Select value={String(rankingTopN)} onValueChange={(v) => setRankingTopN(Number(v))}>
                <SelectTrigger className="h-8 w-[88px] text-xs" aria-label="Quantidade no ranking">
                  <SelectValue placeholder="Top" />
                </SelectTrigger>
                <SelectContent>
                  {RANKING_TOP_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)} className="text-xs">
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div
          className="[&_.recharts-rectangle]:cursor-pointer"
          style={{ height: rankingChartHeight }}
          onMouseEnter={clearRankingHoverTimer}
          onMouseLeave={scheduleCloseRankingPanel}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rankingExibicao}
              layout="vertical"
              margin={{ top: 8, right: 56, left: 12, bottom: 8 }}
            >
              <Tooltip
                cursor={false}
                content={() => null}
                wrapperStyle={{ pointerEvents: "none", visibility: "hidden" }}
              />
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(20,2%,90%)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis
                dataKey="nome"
                type="category"
                width={170}
                tick={{ fontSize: 10, fill: "#041E42" }}
                interval={0}
              />
              <Bar
                dataKey="totalQuantidade"
                name="Dias perdidos"
                radius={[0, 2, 2, 0]}
                shape={rankingBarShape}
                activeBar={false}
                onMouseEnter={(data: unknown) => {
                  const key = rankingBarEventToColaboradorKey(data);
                  if (!key) return;
                  scheduleOpenRankingPanelAfterHover(key);
                }}
                onMouseLeave={() => {
                  clearRankingPanelOpenDelay();
                }}
                onMouseDown={() => {
                  clearRankingPanelOpenDelay();
                }}
                onClick={(data: unknown) => {
                  clearRankingPanelOpenDelay();
                  const key = rankingBarEventToColaboradorKey(data);
                  if (!key) return;
                  const d = data as
                    | (RankingFuncionario & { funcionarioKey?: string })
                    | { payload?: RankingFuncionario & { funcionarioKey?: string } };
                  const row = d && typeof d === "object" && "payload" in d && d.payload ? d.payload : (d as RankingFuncionario);
                  clearRankingHoverTimer();
                  setRankingPanelKey(null);
                  setChartDrilldown((p) => toggleChartDrilldown(p, { type: "colaborador", key, nome: row.nome }));
                }}
              >
                <LabelList
                  dataKey="totalQuantidade"
                  position="right"
                  offset={6}
                  formatter={(v: number | string) => formatIntPt(Number(v))}
                  className="fill-muted-foreground text-[10px]"
                />
                {rankingExibicao.map((entry) => (
                  <Cell
                    key={entry.funcionarioKey ?? entry.nome}
                    fill={
                      chartDrilldown?.type === "colaborador" &&
                      chartDrilldown.key ===
                        (entry.funcionarioKey ?? rankingColaboradorKeyFromNomeMatricula(entry.nome, entry.matricula))
                        ? "#ffad00"
                        : "#2438b8"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="border border-border bg-card p-6 shadow-level-1">
        <div className="mb-4">
          <p className="text-lg font-semibold text-foreground">Sanções por colaborador</p>
          <p className="text-xs text-muted-foreground">
            Histórico completo de sanções na base (não usa o recorte de datas do painel). Respeita a opção “Deseja
            visualizar os colaboradores desligados?”. Severidade: 4+ alta, 2+ média, 1 baixa. Passe o mouse na linha para o
            detalhe; Esc fecha.
          </p>
        </div>
        {isErrorSancoes ? (
          <p className="mb-3 text-sm text-destructive">Falha ao carregar sanções. Use Atualizar ou abra Faltas e Atestados.</p>
        ) : null}
        <div
          className="max-h-[480px] overflow-auto rounded-md border border-border"
          onMouseEnter={clearSancaoHoverTimer}
          onMouseLeave={scheduleCloseSancaoPanel}
        >
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="sticky top-0 z-10 shadow-sm">
              <tr>
                <SancaoSortTh
                  label="Colaborador"
                  sortKey="colaborador"
                  activeKey={sancaoSort.key}
                  dir={sancaoSort.dir}
                  onSort={toggleSancaoSort}
                />
                <SancaoSortTh
                  label="Setor"
                  sortKey="setor"
                  activeKey={sancaoSort.key}
                  dir={sancaoSort.dir}
                  onSort={toggleSancaoSort}
                />
                <SancaoSortTh
                  label="Qntd sanções"
                  sortKey="qntd"
                  activeKey={sancaoSort.key}
                  dir={sancaoSort.dir}
                  onSort={toggleSancaoSort}
                  align="center"
                />
                <SancaoSortTh
                  label="Última sanção"
                  sortKey="ultima"
                  activeKey={sancaoSort.key}
                  dir={sancaoSort.dir}
                  onSort={toggleSancaoSort}
                  align="center"
                />
                <SancaoSortTh
                  label="Severidade"
                  sortKey="severidade"
                  activeKey={sancaoSort.key}
                  dir={sancaoSort.dir}
                  onSort={toggleSancaoSort}
                  align="center"
                />
              </tr>
            </thead>
            <tbody>
              {isLoadingSancoes ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                    Carregando…
                  </td>
                </tr>
              ) : sancoesTabelaOrdenada.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                    Nenhum registro para os filtros atuais.
                  </td>
                </tr>
              ) : (
                sancoesTabelaOrdenada.map((row, i) => (
                  <tr
                    key={row.colaboradorKey}
                    className={cn(
                      "transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      row.qntd > 0 ? "cursor-help" : "cursor-default",
                      i % 2 === 1 && "bg-muted/20",
                    )}
                    onMouseEnter={() => openSancaoPanel(row.colaboradorKey)}
                  >
                    <td className="border-b border-border px-3 py-2 align-middle font-medium text-foreground">{row.nome}</td>
                    <td className="border-b border-border px-3 py-2 align-middle text-muted-foreground">{row.setor}</td>
                    <td className="border-b border-border px-3 py-2 align-middle text-center font-medium tabular-nums">
                      {row.qntd > 0 ? formatIntPt(row.qntd) : ""}
                    </td>
                    <td className="border-b border-border px-3 py-2 align-middle text-center tabular-nums text-muted-foreground">
                      {row.ultimaIso ? row.ultimaLabel : ""}
                    </td>
                    <td
                      className={cn(
                        "border-b border-border px-3 py-2 align-middle text-center text-xs",
                        severidadeCellClass(row.severidade),
                      )}
                    >
                      {row.severidade}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {typeof document !== "undefined" && sancaoPanelKey
        ? createPortal(
            <div className="fixed inset-0 z-[130] flex items-center justify-center p-5 sm:p-8 pointer-events-none">
              <div
                className="pointer-events-auto flex max-h-[min(82vh,720px)] min-h-0 w-[min(90vw,1140px)] flex-col overflow-hidden rounded-[1.75rem] border border-slate-200/90 bg-white text-slate-900 shadow-[0_25px_60px_-12px_rgba(15,23,42,0.35)] dark:border-border dark:bg-popover dark:text-popover-foreground dark:shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="sancoes-detalhe-titulo"
                onMouseEnter={clearSancaoHoverTimer}
                onMouseLeave={scheduleCloseSancaoPanel}
              >
                <SancoesDetalhePainelConteudo
                  detalhes={sancoesDetalhePorColaborador.get(sancaoPanelKey) ?? []}
                  colPct={sancoesDetalheColPct}
                  setColPct={setSancoesDetalheColPct}
                />
              </div>
            </div>,
            document.body,
          )
        : null}

      {typeof document !== "undefined" && rankingPanelKey && rankingPainelBar
        ? createPortal(
            <div className="fixed inset-0 z-[130] flex items-center justify-center p-5 sm:p-8">
              <button
                type="button"
                className="absolute inset-0 z-0 cursor-default border-0 bg-slate-950/25 p-0 dark:bg-black/40"
                aria-label="Fechar detalhe de ausências"
                onClick={closeRankingPanelNow}
              />
              <div
                className="relative z-10 flex max-h-[min(82vh,720px)] min-h-0 w-[min(90vw,1140px)] max-w-full flex-col overflow-hidden rounded-[1.75rem] border border-slate-200/90 bg-white text-slate-900 shadow-[0_25px_60px_-12px_rgba(15,23,42,0.35)] dark:border-border dark:bg-popover dark:text-popover-foreground dark:shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="ranking-ausencias-detalhe-titulo"
                onMouseEnter={clearRankingHoverTimer}
                onMouseLeave={scheduleCloseRankingPanel}
              >
                <RankingAusenciasDetalheConteudo
                  bar={rankingPainelBar}
                  det={rankingTooltipByKey.get(rankingPanelKey)}
                />
              </div>
            </div>,
            document.body,
          )
        : null}

      {rankingAusenciasCtx ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[185] cursor-default bg-transparent"
            aria-label="Fechar menu"
            onClick={() => setRankingAusenciasCtx(null)}
          />
          <div
            className="fixed z-[186] w-[min(calc(100vw-1rem),20rem)] rounded-lg border border-border bg-popover p-1 shadow-lg"
            style={{ left: rankingAusenciasCtx.x, top: rankingAusenciasCtx.y }}
            role="menu"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto w-full justify-start whitespace-normal px-3 py-2.5 text-left text-sm font-normal"
              onClick={() => {
                setRankingAusenciasDialogColabKey(rankingAusenciasCtx.key);
                setRankingAusenciasDialogNome(rankingAusenciasCtx.nome);
                setRankingAusenciasDialogOpen(true);
                setRankingAusenciasCtx(null);
              }}
            >
              Abrir detalhamento de ausências…
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto w-full justify-start whitespace-normal px-3 py-2.5 text-left text-sm font-normal"
              onClick={() => {
                setAtestadosRelatorioColabKey(rankingAusenciasCtx.key);
                setAtestadosRelatorioNome(rankingAusenciasCtx.nome);
                setAtestadosRelatorioOpen(true);
                setRankingAusenciasCtx(null);
              }}
            >
              Relatório de atestados
            </Button>
          </div>
        </>
      ) : null}

      <Dialog
        open={rankingAusenciasDialogOpen}
        onOpenChange={(open) => {
          setRankingAusenciasDialogOpen(open);
          if (!open) {
            setRankingAusenciasDialogColabKey(null);
            setRankingAusenciasDialogNome("");
          }
        }}
      >
        <DialogContent className="flex max-h-[min(92vh,900px)] w-[min(96vw,1180px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
          <DialogHeader className="shrink-0 space-y-1 border-b border-border px-5 py-4 text-left">
            <DialogTitle>Detalhamento de ausências</DialogTitle>
            <DialogDescription className="text-muted-foreground leading-relaxed">
              Mesma grade da aba Faltas e Atestados, só leitura. Ao abrir, mostramos o recorte do painel; use{" "}
              <span className="font-medium text-foreground">Ver todas as ausências deste colaborador</span> para carregar
              todo o histórico lançado no sistema para essa pessoa.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <FaltasAusenciasMirrorTable
              rowsScope={filteredRowsParaRankingTooltip}
              colaboradorKey={rankingAusenciasDialogColabKey}
              colaboradorNomeCurto={rankingAusenciasDialogNome}
            />
          </div>
        </DialogContent>
      </Dialog>

      <AtestadosRelatorioDialog
        open={atestadosRelatorioOpen}
        onOpenChange={(open) => {
          setAtestadosRelatorioOpen(open);
          if (!open) {
            setAtestadosRelatorioColabKey(null);
            setAtestadosRelatorioNome("");
          }
        }}
        colaboradorNome={atestadosRelatorioNome}
        rows={atestadosRelatorioRows}
      />
    </div>
  );
}
