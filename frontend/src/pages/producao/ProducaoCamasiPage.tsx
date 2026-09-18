import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  fetchCamasiDashboard,
  getCamasiRecursoEscala,
  putCamasiRecursoEscalaExcecoes,
  type CamasiDashboardKpis,
  type CamasiDashboardResponse,
  type CamasiParadaValida,
  type CamasiProducaoValida,
} from '../../api/producaoCamasi';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getChartTheme } from '../../utils/painelProducaoFormat';
import ModalCamasiKpi, { type CamasiKpiModalTipo } from '../../components/producao/ModalCamasiKpi';
import ModalEscalaPontualRecurso from '../../components/programacao-producao/ModalEscalaPontualRecurso';
import type { ProgramacaoProducaoRecurso, RecursoEscalaExcecao } from '../../components/programacao-producao/types';
import KpiPainelVoltarLink from '../../components/kpis/KpiPainelVoltarLink';
import {
  formatDuracaoDidatica,
  formatHmsCurto,
  formatHoraCurtaAgora,
  formatHoras,
  formatYmdBr,
  formatYmdBrComSemana,
  hojeYmd,
  inicioMesAtualYmd,
  inicioSemanaAtualYmd,
  fimSemanaUtilAtualYmd,
  mesesAtrasYmd,
} from '../../components/producao/camasiFormat';
import { formatEscalaExcecaoResumo } from '../../utils/recursoEscalaLabel';
import { excecoesSobrepostasAoPeriodo, horasEscalaNoDia } from '../../utils/recursoEscalaHoras';
import { categoriaParadaCamasi } from '../../utils/camasiMotivoJornada';
import { classesBlocoDia } from '../../components/producao/camasiTabelaDia';
import { downloadCamasiLinhaTempoXlsx } from '../../components/producao/exportCamasiLinhaTempoXlsx';
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import SequenciamentoDateField from '../../components/sequenciamento-carradas/SequenciamentoDateField';
import MultiSelectWithSearch from '../../components/MultiSelectWithSearch';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import { CalendarClock, CircleHelp, FileSpreadsheet } from 'lucide-react';

type Filtros = { dataIni: string; dataFim: string };

const JUSTIFICATIVA_SEP = '|';
/** Último dia com produção em virada de meia-noite (Camasi). */
const CAMASI_VIRADA_24H_YMD = '2026-07-15';

function chaveJustificativa(valor: string | null | undefined, fallback = '—'): string {
  const t = valor?.trim();
  return t ? t : fallback;
}

type ChartLinhaId = 'parado' | 'producao';

const CHART_CORES = {
  producaoLight: '#22c55e',
  producaoDark: '#22c55e',
  paradoLight: '#ef4444',
  paradoDark: '#ef4444',
  previstoLight: '#3b82f6',
  previstoDark: '#60a5fa',
} as const;

const CHART_LINHAS: {
  id: ChartLinhaId;
  label: string;
  colorLight: string;
  colorDark: string;
}[] = [
  { id: 'producao', label: 'Em produção', colorLight: CHART_CORES.producaoLight, colorDark: CHART_CORES.producaoDark },
  { id: 'parado', label: 'Parada', colorLight: CHART_CORES.paradoLight, colorDark: CHART_CORES.paradoDark },
];

const PARADAS_COL_IDS = [
  'data',
  'inicio',
  'fim',
  'duracao',
  'peca',
  'justificativa',
  'observacao',
] as const;
type LinhaTempoColId = (typeof PARADAS_COL_IDS)[number];

const PARADAS_COL_LABELS: Record<LinhaTempoColId, string> = {
  data: 'Data',
  inicio: 'Início',
  fim: 'Fim',
  duracao: 'Duração',
  peca: 'Peça',
  justificativa: 'Justificativa',
  observacao: 'Observação',
};

type LinhaTempoTipo = 'parada' | 'producao';

type LinhaTempo = {
  key: string;
  tipo: LinhaTempoTipo;
  data: string;
  inicio: string | null;
  fim: string | null;
  horas: number;
  minutos: number;
  peca: string;
  justificativa: string;
  observacao: string | null;
  categoria?: 'jornada' | 'operacional';
};

function minutosLinha(p: LinhaTempo): number {
  return p.minutos ?? Math.max(0, Math.floor((p.horas ?? 0) * 60 + 1e-9));
}

function getLinhaCellText(row: LinhaTempo, colId: string): string {
  switch (colId as LinhaTempoColId) {
    case 'data':
      return formatYmdBr(row.data);
    case 'inicio':
      return formatHmsCurto(row.inicio);
    case 'fim':
      return formatHmsCurto(row.fim);
    case 'duracao':
      return formatDuracaoDidatica(minutosLinha(row));
    case 'peca':
      return row.peca || '—';
    case 'justificativa':
      return row.justificativa || '—';
    case 'observacao':
      return row.observacao?.trim() || '—';
    default:
      return '';
  }
}

function getLinhaSortValue(row: LinhaTempo, colId: string): string | number {
  switch (colId as LinhaTempoColId) {
    case 'data':
      return row.data;
    case 'inicio':
      return row.inicio ?? '';
    case 'fim':
      return row.fim ?? '';
    case 'duracao':
      return minutosLinha(row);
    case 'peca':
      return row.peca;
    case 'justificativa':
      return row.justificativa;
    case 'observacao':
      return row.observacao ?? '';
    default:
      return '';
  }
}

function paradaParaLinha(p: CamasiParadaValida, idx: number): LinhaTempo {
  return {
    key: `parada-${p.id}-${p.inicioParado ?? ''}-${idx}`,
    tipo: 'parada',
    data: p.data,
    inicio: p.inicioParado,
    fim: p.fimParado,
    horas: p.horas,
    minutos: p.minutos ?? Math.max(0, Math.floor((p.horas ?? 0) * 60 + 1e-9)),
    peca: p.peca,
    justificativa: p.justificativa,
    observacao: p.observacao,
    categoria: p.categoria ?? categoriaParadaCamasi(p.justificativa),
  };
}

function producaoParaLinha(p: CamasiProducaoValida, idx: number): LinhaTempo {
  return {
    key: `producao-${p.id}-${p.inicioProducao ?? ''}-${idx}`,
    tipo: 'producao',
    data: p.data,
    inicio: p.inicioProducao,
    fim: p.fimProducao,
    horas: p.horas,
    minutos: p.minutos ?? Math.max(0, Math.floor((p.horas ?? 0) * 60 + 1e-9)),
    peca: p.peca,
    justificativa: p.justificativa?.trim() || 'EM PRODUÇÃO',
    observacao: null,
  };
}

function filtroDefault(): Filtros {
  const hoje = hojeYmd();
  return { dataIni: hoje, dataFim: hoje };
}

type PresetPeriodo = 'hoje' | 'semana' | 'mes' | '12meses' | 'periodo';

function presetDeFiltros(f: Filtros): PresetPeriodo {
  const hoje = hojeYmd();
  if (f.dataIni === hoje && f.dataFim === hoje) return 'hoje';
  if (f.dataIni === inicioSemanaAtualYmd() && f.dataFim === fimSemanaUtilAtualYmd()) return 'semana';
  if (f.dataIni === inicioMesAtualYmd() && f.dataFim === hoje) return 'mes';
  if (f.dataIni === mesesAtrasYmd(12) && f.dataFim === hoje) return '12meses';
  return 'periodo';
}

function filtrosDoPreset(p: Exclude<PresetPeriodo, 'periodo'>): Filtros {
  const hoje = hojeYmd();
  if (p === 'hoje') return { dataIni: hoje, dataFim: hoje };
  if (p === 'semana') return { dataIni: inicioSemanaAtualYmd(), dataFim: fimSemanaUtilAtualYmd() };
  if (p === 'mes') return { dataIni: inicioMesAtualYmd(), dataFim: hoje };
  return { dataIni: mesesAtrasYmd(12), dataFim: hoje };
}

const MESES_ABREV = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const;

function ymdRange(dataIni: string, dataFim: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${dataIni}T00:00:00`);
  const fim = new Date(`${dataFim}T00:00:00`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(fim.getTime()) || cur > fim) return out;
  while (cur.getTime() <= fim.getTime()) {
    const y = cur.getFullYear();
    const mo = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    out.push(`${y}-${mo}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function roundHoras(n: number): number {
  return Math.round(n * 3600) / 3600;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

type EventosPorDia = Map<
  string,
  { parado: number; paradoOp: number; paradoJor: number; producao: number }
>;

function agregarEventosPorDia(
  paradas: CamasiParadaValida[],
  producao: CamasiProducaoValida[]
): EventosPorDia {
  const map: EventosPorDia = new Map();
  const acc = (ymd: string) => {
    const atual = map.get(ymd) ?? { parado: 0, paradoOp: 0, paradoJor: 0, producao: 0 };
    map.set(ymd, atual);
    return atual;
  };
  for (const p of paradas) {
    const row = acc(p.data);
    const horas = p.horas ?? 0;
    row.parado += horas;
    if ((p.categoria ?? categoriaParadaCamasi(p.justificativa)) === 'jornada') {
      row.paradoJor += horas;
    } else {
      row.paradoOp += horas;
    }
  }
  for (const p of producao) {
    acc(p.data).producao += p.horas ?? 0;
  }
  return map;
}

function kpisAPartirDeEventos(
  base: CamasiDashboardKpis,
  paradas: CamasiParadaValida[],
  producao: CamasiProducaoValida[],
  escala?: CamasiDashboardResponse['escala'] | null
): CamasiDashboardKpis {
  let horasParado = 0;
  let horasParadoOperacional = 0;
  let horasParadoJornada = 0;
  let qtdeParadasOperacionais = 0;
  let qtdeParadasJornada = 0;
  for (const p of paradas) {
    const horas = p.horas ?? 0;
    horasParado += horas;
    if ((p.categoria ?? categoriaParadaCamasi(p.justificativa)) === 'jornada') {
      horasParadoJornada += horas;
      qtdeParadasJornada += 1;
    } else {
      horasParadoOperacional += horas;
      qtdeParadasOperacionais += 1;
    }
  }
  const horasProducao = producao.reduce((s, p) => s + (p.horas ?? 0), 0);
  const diasEvento = new Set<string>();
  for (const p of paradas) diasEvento.add(p.data);
  for (const p of producao) diasEvento.add(p.data);
  let horasEscala = 0;
  for (const ymd of diasEvento) {
    horasEscala += horasEscalaNoDia(ymd, escala);
  }
  horasEscala = roundHoras(horasEscala);
  const baseDisp = horasEscala > 0 ? horasEscala : (base.horasEscalaDecorrida ?? base.horasEscala);
  const totalEventos = horasProducao + horasParado;
  return {
    ...base,
    horasEscala,
    horasEscalaDecorrida: horasEscala,
    horasParado: roundHoras(horasParado),
    horasParadoOperacional: roundHoras(horasParadoOperacional),
    horasParadoJornada: roundHoras(horasParadoJornada),
    horasProducao: roundHoras(horasProducao),
    qtdeParadas: paradas.length,
    qtdeParadasOperacionais,
    qtdeParadasJornada,
    disponibilidadePct:
      baseDisp != null && baseDisp > 0
        ? round1((horasProducao / baseDisp) * 100)
        : totalEventos > 0
          ? round1((horasProducao / totalEventos) * 100)
          : null,
  };
}

type PontoPrevistoParado = {
  chave: string;
  label: string;
  previsto: number;
  parado: number;
  paradoOperacional: number;
  paradoJornada: number;
  /** previsto − parado (não negativo), ou horas dos eventos quando há filtro de justificativa. */
  producao: number;
};

function pontoComProducao(
  base: Omit<PontoPrevistoParado, 'producao'>,
  producaoEventos?: number
): PontoPrevistoParado {
  const previsto = Math.max(0, base.previsto);
  const parado =
    previsto > 0 ? roundHoras(Math.min(Math.max(0, base.parado), previsto)) : roundHoras(Math.max(0, base.parado));
  const resto = Math.max(0, previsto - parado);
  return {
    ...base,
    parado,
    producao:
      producaoEventos != null
        ? roundHoras(Math.max(0, Math.min(producaoEventos, resto)))
        : roundHoras(resto),
  };
}

/** Série prevista × parado × produção: diária até 62 dias; mensal em períodos longos. */
function buildSeriePrevistoParado(
  dataIni: string,
  dataFim: string,
  escala: CamasiDashboardResponse['escala'] | null | undefined,
  resumoDias:
    | {
        data: string;
        paradoHoras: number;
        paradoOperacionalHoras?: number;
        paradoJornadaHoras?: number;
      }[]
    | undefined,
  eventosPorDia?: EventosPorDia
): PontoPrevistoParado[] {
  const paradoMap = new Map<string, { all: number; op: number; jor: number; producao?: number }>();
  if (eventosPorDia) {
    for (const [ymd, v] of eventosPorDia) {
      paradoMap.set(ymd, {
        all: v.parado,
        op: v.paradoOp,
        jor: v.paradoJor,
        producao: v.producao,
      });
    }
  } else {
    for (const d of resumoDias ?? []) {
      paradoMap.set(d.data, {
        all: d.paradoHoras,
        op: d.paradoOperacionalHoras ?? 0,
        jor: d.paradoJornadaHoras ?? 0,
      });
    }
  }
  const dias = ymdRange(dataIni, dataFim);
  if (dias.length === 0) return [];

  if (dias.length <= 62) {
    const pontos: PontoPrevistoParado[] = [];
    for (const ymd of dias) {
      if (eventosPorDia && !paradoMap.has(ymd)) continue;
      const previsto = roundHoras(horasEscalaNoDia(ymd, escala));
      const p = paradoMap.get(ymd);
      const parado = roundHoras(p?.all ?? 0);
      const paradoOperacional = roundHoras(p?.op ?? 0);
      const paradoJornada = roundHoras(p?.jor ?? 0);
      const producaoEventos = eventosPorDia ? p?.producao ?? 0 : undefined;
      if (previsto <= 0 && parado <= 0 && (producaoEventos ?? 0) <= 0) continue;
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
      pontos.push(
        pontoComProducao(
          {
            chave: ymd,
            label: m ? `${m[3]}/${m[2]}` : ymd,
            previsto,
            parado,
            paradoOperacional,
            paradoJornada,
          },
          producaoEventos
        )
      );
    }
    return pontos;
  }

  const mesMap = new Map<
    string,
    {
      previsto: number;
      parado: number;
      paradoOperacional: number;
      paradoJornada: number;
      producao: number;
    }
  >();
  for (const ymd of dias) {
    if (eventosPorDia && !paradoMap.has(ymd)) continue;
    const mes = ymd.slice(0, 7);
    const acc = mesMap.get(mes) ?? {
      previsto: 0,
      parado: 0,
      paradoOperacional: 0,
      paradoJornada: 0,
      producao: 0,
    };
    const p = paradoMap.get(ymd);
    acc.previsto += horasEscalaNoDia(ymd, escala);
    acc.parado += p?.all ?? 0;
    acc.paradoOperacional += p?.op ?? 0;
    acc.paradoJornada += p?.jor ?? 0;
    acc.producao += p?.producao ?? 0;
    mesMap.set(mes, acc);
  }
  return [...mesMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => {
      const [y, mo] = mes.split('-');
      const idx = Number(mo) - 1;
      return pontoComProducao(
        {
          chave: mes,
          label: idx >= 0 && idx < 12 ? `${MESES_ABREV[idx]}/${y}` : mes,
          previsto: roundHoras(v.previsto),
          parado: roundHoras(v.parado),
          paradoOperacional: roundHoras(v.paradoOperacional),
          paradoJornada: roundHoras(v.paradoJornada),
        },
        eventosPorDia ? v.producao : undefined
      );
    });
}

function formatPct1(n: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n);
}

function CamasiBarSegmentoLabel({
  x,
  y,
  width,
  height,
  value,
  fill,
}: {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: number | string | null;
  fill: string;
}) {
  const h = Number(height ?? 0);
  const n = Number(value ?? 0);
  if (x == null || y == null || width == null) return null;
  if (!Number.isFinite(n) || Math.round(n) <= 0 || h < 16) return null;
  return (
    <text
      x={Number(x) + Number(width) / 2}
      y={Number(y) + h / 2}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={10}
      fontWeight={600}
      fill={fill}
    >
      {Math.round(n)}
    </text>
  );
}

function CamasiBarTopoLabel({
  x,
  y,
  width,
  payload,
  fillPct,
  fillTotal,
}: {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  payload?: PontoPrevistoParado;
  fillPct: string;
  fillTotal: string;
}) {
  if (payload == null || x == null || y == null || width == null) return null;
  const cx = Number(x) + Number(width) / 2;
  const pct = payload.previsto > 0 ? Math.round((payload.producao / payload.previsto) * 100) : null;
  return (
    <g>
      {pct != null ? (
        <text
          x={cx}
          y={Number(y) - 16}
          textAnchor="middle"
          fontSize={10}
          fontWeight={700}
          fill={fillPct}
        >
          {pct}%
        </text>
      ) : null}
      <text x={cx} y={Number(y) - 3} textAnchor="middle" fontSize={10} fill={fillTotal}>
        {Math.round(payload.previsto)}
      </text>
    </g>
  );
}

function KpiCard({
  title,
  value,
  loading,
  onClick,
  help,
}: {
  title: string;
  value: string;
  loading?: boolean;
  onClick?: () => void;
  help?: { label: string; onClick: () => void };
}) {
  if (loading) {
    return (
      <div className="card-panel h-[112px] animate-pulse p-4">
        <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-4 h-7 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    );
  }
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        className="card-panel w-full p-4 text-left transition hover:ring-2 hover:ring-primary-400/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <p className={`text-xs font-semibold text-slate-600 dark:text-slate-300 ${help ? 'pr-8' : ''}`}>
          {title}
        </p>
        <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-slate-50">
          {value}
        </p>
      </button>
      {help ? (
        <button
          type="button"
          onClick={help.onClick}
          className="absolute right-2.5 top-2.5 inline-flex size-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          title={help.label}
          aria-label={help.label}
        >
          <CircleHelp className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function ModalMemorialProducaoCamasi({
  open,
  kpis,
  onClose,
}: {
  open: boolean;
  kpis: CamasiDashboardKpis | null | undefined;
  onClose: () => void;
}) {
  useRegisterModalEscape({
    id: 'camasi-memorial-producao',
    onClose,
    zIndex: 13100,
    enabled: open,
  });

  if (!open || !kpis) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[13100] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-600 dark:bg-slate-900"
        role="dialog"
        aria-modal
        aria-labelledby="camasi-memorial-producao-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="camasi-memorial-producao-titulo"
              className="text-base font-semibold text-slate-800 dark:text-slate-100"
            >
              Memorial de cálculo — Produção
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Até hoje, dia útil sem apontamento Camasi entra como produção. No dia em aberto, o
              previsto usa só a escala já decorrida (até agora); a diferença para o tempo disponível
              do período é o restante da jornada de hoje.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Fechar
          </button>
        </div>
        <div className="mt-4 space-y-1 text-sm tabular-nums text-slate-600 dark:text-slate-300">
          <p className="flex items-baseline justify-between gap-3">
            <span>Tempo previsto de produção até o dia atual</span>
            <span className="shrink-0 font-medium text-slate-800 dark:text-slate-100">
              {formatHoras(kpis.horasEscalaDecorrida ?? 0)}
            </span>
          </p>
          <p className="flex items-baseline justify-between gap-3">
            <span>(−) Tempo parado</span>
            <span className="shrink-0 font-medium text-slate-800 dark:text-slate-100">
              {formatHoras(kpis.horasParado ?? 0)}
            </span>
          </p>
          <p className="flex items-baseline justify-between gap-3 border-t border-slate-200 pt-1.5 dark:border-slate-700">
            <span>(=) Produção</span>
            <span className="shrink-0 font-semibold text-slate-900 dark:text-slate-50">
              {formatHoras(kpis.horasProducao ?? 0)}
            </span>
          </p>
        </div>
        {kpis.disponibilidadePct != null ? (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Taxa de disponibilidade{' '}
            <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-50">
              {formatPct1(kpis.disponibilidadePct)}%
            </span>
            <span className="text-slate-400 dark:text-slate-500">
              {' '}
              = produção ÷ previsto até hoje
            </span>
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Sem base de escala para calcular a disponibilidade.
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}

export default function ProducaoCamasiPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const chartTheme = getChartTheme(isDark);

  const [draft, setDraft] = useState<Filtros>(() => filtroDefault());
  const [filtros, setFiltros] = useState<Filtros>(() => filtroDefault());
  const [data, setData] = useState<CamasiDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [kpiModal, setKpiModal] = useState<CamasiKpiModalTipo | null>(null);
  const [memorialProducaoAberto, setMemorialProducaoAberto] = useState(false);
  const [motivoModal, setMotivoModal] = useState<string | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState<'operacional' | 'jornada' | 'todas'>(
    'operacional'
  );
  const [filtroTipoEvento, setFiltroTipoEvento] = useState<'paradas' | 'producao' | 'ambos'>(
    'ambos'
  );
  const [pontualRecurso, setPontualRecurso] = useState<ProgramacaoProducaoRecurso | null>(null);
  const [pontualSalvando, setPontualSalvando] = useState(false);
  const [pontualErro, setPontualErro] = useState<string | null>(null);
  const [atualizadoAs, setAtualizadoAs] = useState<string | null>(null);
  const [exportandoLinhaTempo, setExportandoLinhaTempo] = useState(false);
  const [exportLinhaTempoErro, setExportLinhaTempoErro] = useState<string | null>(null);
  const [chartLinhasVisiveis, setChartLinhasVisiveis] = useState<Record<ChartLinhaId, boolean>>({
    parado: true,
    producao: true,
  });
  const [filtroJustificativasCsv, setFiltroJustificativasCsv] = useState('');
  const carregarEmVoo = useRef(false);

  const carregar = useCallback(async (f: Filtros, opts?: { silencioso?: boolean }) => {
    if (carregarEmVoo.current) return;
    carregarEmVoo.current = true;
    const silencioso = opts?.silencioso === true;
    if (!silencioso) setLoading(true);
    setErro(null);
    try {
      const res = await fetchCamasiDashboard(f.dataIni, f.dataFim);
      setData(res);
      setAtualizadoAs(formatHoraCurtaAgora());
    } catch (e) {
      if (!silencioso) setData(null);
      setErro(e instanceof Error ? e.message : 'Erro ao carregar dashboard Camasi.');
    } finally {
      carregarEmVoo.current = false;
      if (!silencioso) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar(filtros);
  }, [carregar, filtros]);

  const isFiltroHoje =
    filtros.dataIni === filtros.dataFim && filtros.dataIni === hojeYmd();
  const presetAtivo = presetDeFiltros(draft);

  useEffect(() => {
    if (!isFiltroHoje) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      if (kpiModal || pontualRecurso) return;
      void carregar(filtros, { silencioso: true });
    }, 20_000);
    return () => window.clearInterval(id);
  }, [isFiltroHoje, filtros, carregar, kpiModal, pontualRecurso]);

  const filtrosPendentes = useMemo(
    () => draft.dataIni !== filtros.dataIni || draft.dataFim !== filtros.dataFim,
    [draft, filtros]
  );

  const pontuaisNoPeriodo = useMemo(
    () =>
      data?.escala
        ? excecoesSobrepostasAoPeriodo(data.escala.excecoes, data.dataIni, data.dataFim)
        : [],
    [data]
  );

  const paradasValidas = data?.paradasValidas ?? [];
  const producaoValidas = data?.producaoValidas ?? [];
  const justificativasOpcoes = useMemo(() => {
    const set = new Set<string>();
    for (const p of paradasValidas) {
      set.add(chaveJustificativa(p.justificativa));
    }
    for (const p of producaoValidas) {
      set.add(chaveJustificativa(p.justificativa, 'EM PRODUÇÃO'));
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [paradasValidas, producaoValidas]);
  const justificativasSelecionadas = useMemo(
    () =>
      new Set(
        filtroJustificativasCsv
          .split(JUSTIFICATIVA_SEP)
          .map((s) => s.trim())
          .filter(Boolean)
      ),
    [filtroJustificativasCsv]
  );
  const paradasNoContexto = useMemo(() => {
    if (justificativasSelecionadas.size === 0) return paradasValidas;
    return paradasValidas.filter((p) =>
      justificativasSelecionadas.has(chaveJustificativa(p.justificativa))
    );
  }, [paradasValidas, justificativasSelecionadas]);
  const producaoNoContexto = useMemo(() => {
    if (justificativasSelecionadas.size === 0) return producaoValidas;
    return producaoValidas.filter((p) =>
      justificativasSelecionadas.has(chaveJustificativa(p.justificativa, 'EM PRODUÇÃO'))
    );
  }, [producaoValidas, justificativasSelecionadas]);
  const kpis = useMemo(() => {
    if (!data?.kpis) return undefined;
    if (justificativasSelecionadas.size === 0) return data.kpis;
    return kpisAPartirDeEventos(data.kpis, paradasNoContexto, producaoNoContexto, data.escala);
  }, [data?.kpis, data?.escala, justificativasSelecionadas.size, paradasNoContexto, producaoNoContexto]);
  const dataContexto = useMemo((): CamasiDashboardResponse | null => {
    if (!data) return null;
    if (justificativasSelecionadas.size === 0 || !kpis) return data;
    const eventos = agregarEventosPorDia(paradasNoContexto, producaoNoContexto);
    const qtdePorDia = new Map<string, number>();
    for (const p of paradasNoContexto) {
      qtdePorDia.set(p.data, (qtdePorDia.get(p.data) ?? 0) + 1);
    }
    return {
      ...data,
      kpis,
      paradasValidas: paradasNoContexto,
      producaoValidas: producaoNoContexto,
      resumoDias: (data.resumoDias ?? [])
        .filter((d) => eventos.has(d.data))
        .map((d) => {
          const ev = eventos.get(d.data);
          const parado = ev?.parado ?? 0;
          return {
            ...d,
            paradoHoras: roundHoras(parado),
            paradoOperacionalHoras: roundHoras(ev?.paradoOp ?? 0),
            paradoJornadaHoras: roundHoras(ev?.paradoJor ?? 0),
            producaoHoras: roundHoras(ev?.producao ?? 0),
            paradoSomaEventos: roundHoras(parado),
            temSobreposicao: false,
            qtdeParadas: qtdePorDia.get(d.data) ?? 0,
          };
        }),
    };
  }, [data, kpis, justificativasSelecionadas.size, paradasNoContexto, producaoNoContexto]);
  const chartPrevistoParado = useMemo(() => {
    if (!data) return [];
    if (justificativasSelecionadas.size === 0) {
      return buildSeriePrevistoParado(data.dataIni, data.dataFim, data.escala, data.resumoDias);
    }
    return buildSeriePrevistoParado(
      data.dataIni,
      data.dataFim,
      data.escala,
      undefined,
      agregarEventosPorDia(paradasNoContexto, producaoNoContexto)
    );
  }, [data, justificativasSelecionadas.size, paradasNoContexto, producaoNoContexto]);

  const chartPrevistoParadoGranularidade =
    chartPrevistoParado.length > 0 && chartPrevistoParado[0]?.chave.length === 10
      ? 'dia'
      : 'mês';

  const motivosDisplay = useMemo(() => {
    const lista = data?.motivos ?? [];
    const filtrados =
      justificativasSelecionadas.size === 0
        ? lista
        : lista.filter((m) => justificativasSelecionadas.has(m.motivo));
    const total = filtrados.reduce((s, m) => s + m.horas, 0);
    return filtrados.slice(0, 12).map((m) => ({
      ...m,
      pct: total > 0 ? round1((m.horas / total) * 100) : 0,
    }));
  }, [data?.motivos, justificativasSelecionadas]);
  const maxMotivo = Math.max(...motivosDisplay.map((m) => m.horas), 1);
  const linhasTempoBase = useMemo(() => {
    const linhas: LinhaTempo[] = [];
    if (filtroTipoEvento !== 'producao') {
      paradasNoContexto.forEach((p, idx) => {
        const cat = p.categoria ?? categoriaParadaCamasi(p.justificativa);
        if (filtroCategoria !== 'todas' && cat !== filtroCategoria) return;
        linhas.push(paradaParaLinha(p, idx));
      });
    }
    if (filtroTipoEvento !== 'paradas') {
      producaoNoContexto.forEach((p, idx) => linhas.push(producaoParaLinha(p, idx)));
    }
    linhas.sort(
      (a, b) =>
        a.data.localeCompare(b.data) ||
        (a.inicio ?? '').localeCompare(b.inicio ?? '') ||
        a.tipo.localeCompare(b.tipo)
    );
    return linhas;
  }, [paradasNoContexto, producaoNoContexto, filtroCategoria, filtroTipoEvento]);
  const getLinhaCellTextCb = useCallback(
    (row: LinhaTempo, colId: string) => getLinhaCellText(row, colId),
    []
  );
  const getLinhaSortValueCb = useCallback(
    (row: LinhaTempo, colId: string) => getLinhaSortValue(row, colId),
    []
  );
  const gradeParadas = useGradeFiltrosExcel<LinhaTempo>({
    rows: linhasTempoBase,
    columnIds: [...PARADAS_COL_IDS],
    getCellText: getLinhaCellTextCb,
    valueForSort: getLinhaSortValueCb,
    defaultSortLevels: [
      { id: 'data', dir: 'asc' },
      { id: 'inicio', dir: 'asc' },
    ],
    dateColumnIds: ['data'],
  });
  const {
    rowsExibidas: linhasFiltradas,
    limparFiltrosGrade: limparFiltrosParadas,
    temFiltrosOuOrdem: temFiltrosParadas,
  } = gradeParadas;
  const indiceDiaParada = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of linhasFiltradas) {
      if (!map.has(p.data)) map.set(p.data, map.size);
    }
    return map;
  }, [linhasFiltradas]);

  const exportarLinhaTempo = useCallback(async () => {
    if (linhasFiltradas.length === 0 || exportandoLinhaTempo) return;
    setExportLinhaTempoErro(null);
    setExportandoLinhaTempo(true);
    try {
      await downloadCamasiLinhaTempoXlsx({
        linhas: linhasFiltradas.map((p) => ({
          tipo: p.tipo,
          data: p.data,
          inicio: p.inicio,
          fim: p.fim,
          minutos: minutosLinha(p),
          peca: p.peca,
          justificativa: p.justificativa,
          observacao: p.observacao,
        })),
        dataIni: data?.dataIni ?? filtros.dataIni,
        dataFim: data?.dataFim ?? filtros.dataFim,
      });
    } catch (e) {
      setExportLinhaTempoErro(
        e instanceof Error ? e.message : 'Não foi possível gerar o Excel.'
      );
    } finally {
      setExportandoLinhaTempo(false);
    }
  }, [linhasFiltradas, exportandoLinhaTempo, data?.dataIni, data?.dataFim, filtros.dataIni, filtros.dataFim]);

  const aplicarFiltros = useCallback(() => {
    if (draft.dataIni > draft.dataFim) {
      setErro('Data início deve ser menor ou igual à data fim.');
      return;
    }
    setKpiModal(null);
    setMotivoModal(null);
    limparFiltrosParadas();
    setFiltros({ ...draft });
  }, [draft, limparFiltrosParadas]);

  const aplicarPreset = useCallback(
    (p: Exclude<PresetPeriodo, 'periodo'>) => {
      const next = filtrosDoPreset(p);
      setDraft(next);
      setKpiModal(null);
      setMotivoModal(null);
      limparFiltrosParadas();
      setFiltros(next);
    },
    [limparFiltrosParadas]
  );

  const abrirEscalaPontual = useCallback(async () => {
    setPontualErro(null);
    try {
      const rec = await getCamasiRecursoEscala();
      setPontualRecurso(rec);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível abrir a escala pontual.');
    }
  }, []);

  const salvarPontualCamasi = useCallback(
    async (excecoes: RecursoEscalaExcecao[]) => {
      setPontualSalvando(true);
      setPontualErro(null);
      try {
        await putCamasiRecursoEscalaExcecoes(excecoes);
        setPontualRecurso(null);
        await carregar(filtros);
      } catch (e) {
        setPontualErro(e instanceof Error ? e.message : 'Erro ao salvar escala pontual.');
      } finally {
        setPontualSalvando(false);
      }
    },
    [carregar, filtros]
  );

  return (
    <div className="px-4 py-5 md:px-6">
      <div className="mb-4">
        <KpiPainelVoltarLink painelId="producao-camasi" className="mb-1" />
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Produção Camasi
          </h1>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            Paradas na escala (operacionais e início/fim de jornada)
            {data
              ? ` · ${formatYmdBr(data.dataIni)} a ${formatYmdBr(data.dataFim)}`
              : ''}
            {isFiltroHoje && atualizadoAs ? ` · atualizado às ${atualizadoAs}` : ''}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Virada das 24h: {formatYmdBr(CAMASI_VIRADA_24H_YMD)} — depois a jornada é 07:00–17:15
          </p>
          {data && !data.escala ? (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              Sem escala na Perfiladeira 1000 — cadastre em PCP → Recursos para recortar as paradas.
            </p>
          ) : pontuaisNoPeriodo.length > 0 ? (
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
              Escala pontual no período:{' '}
              {pontuaisNoPeriodo
                .slice(0, 4)
                .map((ex) => formatEscalaExcecaoResumo(ex))
                .join(' · ')}
              {pontuaisNoPeriodo.length > 4
                ? ` · e mais ${pontuaisNoPeriodo.length - 4}`
                : ''}
            </p>
          ) : null}
          {filtrosPendentes && (
            <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              Filtros alterados — clique em Filtrar para atualizar os indicadores.
            </p>
          )}
        </div>
        <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
          <div
            className="inline-flex h-9 overflow-hidden rounded-md border border-slate-200 dark:border-slate-700"
            role="group"
            aria-label="Atalhos de período"
          >
            {(
              [
                ['hoje', 'Hoje'],
                ['semana', 'Semana'],
                ['mes', 'Mês'],
                ['12meses', '12 meses'],
              ] as const
            ).map(([id, label], index) => (
              <button
                key={id}
                type="button"
                onClick={() => aplicarPreset(id)}
                className={`h-9 whitespace-nowrap px-3 text-xs font-semibold transition-colors ${
                  index > 0 ? 'border-l border-slate-200 dark:border-slate-700' : ''
                } ${
                  presetAtivo === id
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="w-[9.5rem]">
            <SequenciamentoDateField
              value={draft.dataIni}
              onChange={(iso) => setDraft((d) => ({ ...d, dataIni: iso }))}
              fullWidth
              placeholder="Início"
              className="!h-9 !border-slate-200 !bg-white !py-1.5 shadow-sm dark:!border-slate-700 dark:!bg-slate-900"
            />
          </div>
          <div className="w-[9.5rem]">
            <SequenciamentoDateField
              value={draft.dataFim}
              onChange={(iso) => setDraft((d) => ({ ...d, dataFim: iso }))}
              fullWidth
              placeholder="Fim"
              className="!h-9 !border-slate-200 !bg-white !py-1.5 shadow-sm dark:!border-slate-700 dark:!bg-slate-900"
            />
          </div>
          <div className="w-[13.5rem]">
            <MultiSelectWithSearch
              label="Justificativa"
              placeholder="Justificativa"
              options={justificativasOpcoes}
              value={filtroJustificativasCsv}
              onChange={setFiltroJustificativasCsv}
              labelClass="sr-only"
              inputClass="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              minWidth="13.5rem"
              optionLabel="justificativas"
              valueSeparator={JUSTIFICATIVA_SEP}
              dropdownZIndex={80}
              dropdownMaxWidth="22rem"
              dropdownPortal
              disabled={loading && justificativasOpcoes.length === 0}
            />
          </div>
          <button
            type="button"
            onClick={() => void abrirEscalaPontual()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            title="Folga ou horário especial em um dia ou período"
          >
            <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
            Horário pontual
          </button>
          <button
            type="button"
            onClick={aplicarFiltros}
            className="h-9 rounded-md bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
          >
            Filtrar
          </button>
          <button
            type="button"
            onClick={() => void carregar(filtros)}
            disabled={loading}
            className="h-9 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {loading ? 'Atualizando…' : 'Atualizar'}
          </button>
        </div>
        </div>
      </div>

      {erro && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          {erro}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          loading={loading}
          title="Tempo disponível"
          value={kpis?.horasEscala != null ? formatHoras(kpis.horasEscala) : '—'}
          onClick={() => {
            setMotivoModal(null);
            setKpiModal('previsto');
          }}
        />
        <KpiCard
          loading={loading}
          title="Tempo parado"
          value={formatHoras(kpis?.horasParado ?? 0)}
          onClick={() => {
            setMotivoModal(null);
            setKpiModal('parado');
          }}
        />
        <KpiCard
          loading={loading}
          title="Tempo de produção"
          value={formatHoras(kpis?.horasProducao ?? 0)}
          onClick={() => {
            setMotivoModal(null);
            setKpiModal('producao');
          }}
        />
        <KpiCard
          loading={loading}
          title="Taxa de disponibilidade"
          value={
            kpis?.disponibilidadePct != null ? `${formatPct1(kpis.disponibilidadePct)}%` : '—'
          }
          help={
            kpis
              ? {
                  label: 'Memorial de cálculo',
                  onClick: () => setMemorialProducaoAberto(true),
                }
              : undefined
          }
          onClick={() => setMemorialProducaoAberto(true)}
        />
      </div>

      <div className="card-panel mt-3 p-5">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white">
            Previsto × parado ao longo do período
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Barras: produção e parada · linha: previsto
            {chartPrevistoParadoGranularidade === 'dia'
              ? ' — por dia (período curto)'
              : ' — por mês (período longo)'}
          </p>
        </div>
        {loading ? (
          <div className="flex h-[360px] items-center justify-center text-slate-500">Carregando…</div>
        ) : chartPrevistoParado.length === 0 ? (
          <div className="flex h-[360px] items-center justify-center text-slate-500">
            Sem dados de escala ou paradas no período.
          </div>
        ) : (
          <>
            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartPrevistoParado}
                  margin={{ top: 28, right: 12, left: 0, bottom: 4 }}
                  barCategoryGap="28%"
                >
                  <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: chartTheme.tick, fontSize: 11 }}
                    axisLine={{ stroke: chartTheme.axis }}
                    interval={chartPrevistoParadoGranularidade === 'dia' ? 'preserveStartEnd' : 0}
                    minTickGap={chartPrevistoParadoGranularidade === 'dia' ? 28 : 8}
                  />
                  <YAxis
                    tick={{ fill: chartTheme.tick, fontSize: 11 }}
                    axisLine={{ stroke: chartTheme.axis }}
                    tickFormatter={(v) => String(Math.round(Number(v)))}
                    domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.12)]}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0]?.payload as PontoPrevistoParado | undefined;
                      if (!row) return null;
                      const corPrevisto = isDark ? CHART_CORES.previstoDark : CHART_CORES.previstoLight;
                      const corParado = isDark ? CHART_CORES.paradoDark : CHART_CORES.paradoLight;
                      const corProducao = isDark ? CHART_CORES.producaoDark : CHART_CORES.producaoLight;
                      return (
                        <div
                          className="rounded-md px-3 py-2 text-sm shadow-md"
                          style={chartTheme.tooltip}
                        >
                          <p className="mb-1.5 font-semibold">{String(label)}</p>
                          <p className="tabular-nums" style={{ color: corPrevisto }}>
                            Previsto: {formatHoras(row.previsto)}
                          </p>
                          {chartLinhasVisiveis.parado ? (
                            <p className="tabular-nums" style={{ color: corParado }}>
                              Parada: {formatHoras(row.parado)}
                            </p>
                          ) : null}
                          {chartLinhasVisiveis.producao ? (
                            <p className="font-medium tabular-nums" style={{ color: corProducao }}>
                              Em produção: {formatHoras(row.producao)}
                            </p>
                          ) : null}
                        </div>
                      );
                    }}
                  />
                  {chartLinhasVisiveis.producao ? (
                    <Bar
                      dataKey="producao"
                      name="Em produção"
                      stackId="utilizacao"
                      fill={isDark ? CHART_CORES.producaoDark : CHART_CORES.producaoLight}
                      maxBarSize={52}
                      radius={chartLinhasVisiveis.parado ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                    >
                      {chartPrevistoParado.length <= 16 ? (
                        <LabelList
                          dataKey="producao"
                          content={(props) => (
                            <CamasiBarSegmentoLabel
                              x={props.x}
                              y={props.y}
                              width={props.width}
                              height={props.height}
                              value={
                                typeof props.value === 'number' || typeof props.value === 'string'
                                  ? props.value
                                  : null
                              }
                              fill="#ffffff"
                            />
                          )}
                        />
                      ) : null}
                      {!chartLinhasVisiveis.parado && chartPrevistoParado.length <= 16 ? (
                        <LabelList
                          content={(props) => (
                            <CamasiBarTopoLabel
                              x={props.x}
                              y={props.y}
                              width={props.width}
                              payload={(props as { payload?: PontoPrevistoParado }).payload}
                              fillPct={isDark ? CHART_CORES.producaoDark : CHART_CORES.producaoLight}
                              fillTotal={chartTheme.tick}
                            />
                          )}
                        />
                      ) : null}
                    </Bar>
                  ) : null}
                  {chartLinhasVisiveis.parado ? (
                    <Bar
                      dataKey="parado"
                      name="Parada"
                      stackId="utilizacao"
                      fill={isDark ? CHART_CORES.paradoDark : CHART_CORES.paradoLight}
                      maxBarSize={52}
                      radius={[4, 4, 0, 0]}
                    >
                      {chartPrevistoParado.length <= 16 ? (
                        <LabelList
                          dataKey="parado"
                          content={(props) => (
                            <CamasiBarSegmentoLabel
                              x={props.x}
                              y={props.y}
                              width={props.width}
                              height={props.height}
                              value={
                                typeof props.value === 'number' || typeof props.value === 'string'
                                  ? props.value
                                  : null
                              }
                              fill="#ffffff"
                            />
                          )}
                        />
                      ) : null}
                      {chartPrevistoParado.length <= 16 ? (
                        <LabelList
                          content={(props) => (
                            <CamasiBarTopoLabel
                              x={props.x}
                              y={props.y}
                              width={props.width}
                              payload={(props as { payload?: PontoPrevistoParado }).payload}
                              fillPct={isDark ? CHART_CORES.producaoDark : CHART_CORES.producaoLight}
                              fillTotal={chartTheme.tick}
                            />
                          )}
                        />
                      ) : null}
                    </Bar>
                  ) : null}
                  <Line
                    type="monotone"
                    dataKey="previsto"
                    name="Previsto"
                    stroke={isDark ? CHART_CORES.previstoDark : CHART_CORES.previstoLight}
                    strokeWidth={2}
                    dot={
                      chartPrevistoParadoGranularidade === 'dia'
                        ? false
                        : {
                            r: 4,
                            fill: isDark ? CHART_CORES.previstoDark : CHART_CORES.previstoLight,
                            stroke: isDark ? CHART_CORES.previstoDark : CHART_CORES.previstoLight,
                          }
                    }
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div
              className="mt-2 flex flex-wrap items-center justify-center gap-4"
              role="group"
              aria-label="Exibir séries do gráfico"
            >
              {CHART_LINHAS.map((linha) => {
                const ativo = chartLinhasVisiveis[linha.id];
                const cor = isDark ? linha.colorDark : linha.colorLight;
                return (
                  <button
                    key={linha.id}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() =>
                      setChartLinhasVisiveis((atual) => ({ ...atual, [linha.id]: !atual[linha.id] }))
                    }
                    className={`inline-flex items-center gap-1.5 text-[11px] font-medium transition ${
                      ativo
                        ? 'text-slate-700 dark:text-slate-200'
                        : 'text-slate-400 line-through decoration-slate-400/80 dark:text-slate-500'
                    }`}
                    title={ativo ? `Ocultar ${linha.label}` : `Exibir ${linha.label}`}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                      style={{
                        backgroundColor: ativo ? cor : 'transparent',
                        boxShadow: `inset 0 0 0 1.5px ${cor}`,
                      }}
                      aria-hidden
                    />
                    {linha.label}
                  </button>
                );
              })}
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200">
                <span className="relative h-2.5 w-5" aria-hidden>
                  <span
                    className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full"
                    style={{
                      backgroundColor: isDark ? CHART_CORES.previstoDark : CHART_CORES.previstoLight,
                    }}
                  />
                  <span
                    className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      backgroundColor: isDark ? CHART_CORES.previstoDark : CHART_CORES.previstoLight,
                    }}
                  />
                </span>
                Previsto
              </span>
            </div>
          </>
        )}
      </div>

      <div className="mt-3">
        <div className="card-panel flex min-h-[420px] flex-col p-5">
          <div className="mb-4 shrink-0">
            <h3 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white">
              Principais motivos de parada
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Inclui início/fim de jornada — clique na barra para ver os eventos do motivo
            </p>
          </div>
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-slate-500">Carregando…</div>
          ) : motivosDisplay.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-slate-500">Sem paradas no período.</div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
              {motivosDisplay.map((m, idx) => {
                const pctBar = (m.horas / maxMotivo) * 100;
                return (
                  <button
                    key={m.motivo}
                    type="button"
                    onClick={() => {
                      setMotivoModal(m.motivo);
                      setKpiModal('parado');
                    }}
                    className="grid w-full grid-cols-[auto_minmax(0,1.2fr)_minmax(0,2fr)_auto] items-center gap-3 rounded-lg px-1 py-0.5 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:bg-slate-800/60"
                    title={`Ver paradas de ${m.motivo}`}
                  >
                    <span className="w-5 text-right text-[11px] font-semibold tabular-nums text-slate-400">
                      {idx + 1}
                    </span>
                    <span
                      className="truncate text-xs font-medium text-slate-700 dark:text-slate-200"
                      title={m.motivo}
                    >
                      {m.motivo}
                    </span>
                    <div className="relative h-8 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                      <div
                        className="absolute inset-y-0 left-0 rounded-lg bg-amber-500/80 dark:bg-amber-400/70"
                        style={{ width: `${Math.max(pctBar, m.horas > 0 ? 2 : 0)}%` }}
                      />
                      <span className="relative z-10 flex h-full items-center px-2 text-[11px] font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                        {formatHoras(m.horas)}
                      </span>
                    </div>
                    <div className="min-w-[5.5rem] text-right text-[11px] text-slate-500 dark:text-slate-400">
                      {m.pct.toFixed(1).replace('.', ',')}% · {m.qtde}x
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3">
        <div className="card-panel flex max-h-[520px] min-h-[280px] flex-col p-5">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2 shrink-0">
            <div>
              <h3 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white">
                Linha do tempo na escala
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Paradas e produção intercaladas ·{' '}
                {temFiltrosParadas
                  ? `${linhasFiltradas.length} de ${linhasTempoBase.length}`
                  : linhasTempoBase.length}{' '}
                registro
                {(temFiltrosParadas ? linhasFiltradas.length : linhasTempoBase.length) === 1
                  ? ''
                  : 's'}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {(
                  [
                    ['ambos', 'Ambos'],
                    ['paradas', 'Só paradas'],
                    ['producao', 'Só produção'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFiltroTipoEvento(id)}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                      filtroTipoEvento === id
                        ? 'bg-primary-600 text-white'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {filtroTipoEvento !== 'producao' ? (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {(
                    [
                      ['operacional', 'Operacionais'],
                      ['jornada', 'Início/fim jornada'],
                      ['todas', 'Todas as paradas'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFiltroCategoria(id)}
                      className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                        filtroCategoria === id
                          ? 'bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex flex-wrap items-center justify-end gap-2">
                {temFiltrosParadas || justificativasSelecionadas.size > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      limparFiltrosParadas();
                      setFiltroJustificativasCsv('');
                    }}
                    className="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                  >
                    Limpar filtros
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void exportarLinhaTempo()}
                  disabled={loading || exportandoLinhaTempo || linhasFiltradas.length === 0}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  title="Exportar a grade visível em Excel (tabela, sem células mescladas)"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {exportandoLinhaTempo ? 'Exportando…' : 'Exportar Excel'}
                </button>
              </div>
              {exportLinhaTempoErro ? (
                <p className="max-w-[16rem] text-right text-[11px] text-rose-600 dark:text-rose-300">
                  {exportLinhaTempoErro}
                </p>
              ) : null}
            </div>
          </div>
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-slate-500">Carregando…</div>
          ) : linhasFiltradas.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-slate-500">
              {linhasTempoBase.length === 0 && paradasValidas.length === 0 && producaoValidas.length === 0
                ? 'Sem eventos na escala no período.'
                : 'Nenhum registro neste recorte.'}
            </div>
          ) : (
            <div
              ref={gradeParadas.tableScrollRef}
              className="relative min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700"
            >
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-primary-600 text-white">
                    {PARADAS_COL_IDS.map((colId) => {
                      const sortAtivo =
                        gradeParadas.sortState?.key === colId ||
                        gradeParadas.sortLevels.some((l) => l.id === colId);
                      const alignRight = colId === 'duracao';
                      const alignCenter = colId === 'data';
                      return (
                        <th
                          key={colId}
                          className={`border border-primary-500/40 px-2 py-2 font-semibold ${
                            alignCenter ? 'text-center' : alignRight ? 'text-right' : 'text-left'
                          }`}
                        >
                          <div
                            className={`flex min-w-0 items-start gap-1 ${
                              alignCenter
                                ? 'justify-center'
                                : alignRight
                                  ? 'justify-end'
                                  : 'justify-between'
                            }`}
                          >
                            <span className="min-w-0 flex-1 leading-tight">
                              {PARADAS_COL_LABELS[colId]}
                            </span>
                            <GradeFiltroCabecalhoBtn
                              ativo={gradeParadas.colunaComFiltroAtivo(colId) || sortAtivo}
                              onClick={(e) => gradeParadas.abrirFiltroExcel(colId, e)}
                            />
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {linhasFiltradas.map((p, idx) => {
                    const diaAnterior = idx > 0 ? linhasFiltradas[idx - 1]!.data : null;
                    const mostraData = p.data !== diaAnterior;
                    let rowSpan = 1;
                    if (mostraData) {
                      for (let i = idx + 1; i < linhasFiltradas.length; i++) {
                        if (linhasFiltradas[i]!.data !== p.data) break;
                        rowSpan += 1;
                      }
                    }
                    let inicioIdx = idx;
                    while (inicioIdx > 0 && linhasFiltradas[inicioIdx - 1]!.data === p.data) {
                      inicioIdx -= 1;
                    }
                    const { tr, dataTd } = classesBlocoDia(
                      indiceDiaParada.get(p.data) ?? 0,
                      idx - inicioIdx,
                      mostraData
                    );
                    const isProd = p.tipo === 'producao';
                    return (
                      <tr key={p.key} className={tr}>
                        {mostraData ? (
                          <td
                            rowSpan={rowSpan}
                            className={`whitespace-nowrap px-3 py-2 text-center align-middle text-xs font-bold tabular-nums ${dataTd}`}
                          >
                            {formatYmdBrComSemana(p.data)}
                          </td>
                        ) : null}
                        <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                          {formatHmsCurto(p.inicio)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 tabular-nums">
                          {formatHmsCurto(p.fim)}
                        </td>
                        <td
                          className={`px-2 py-2 text-right font-medium ${
                            isProd
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : 'text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          {formatDuracaoDidatica(minutosLinha(p))}
                        </td>
                        <td className="max-w-[10rem] truncate px-2 py-2" title={p.peca}>
                          {p.peca}
                        </td>
                        <td
                          className={`max-w-[14rem] px-2 py-2 font-medium ${
                            isProd
                              ? 'text-emerald-800 dark:text-emerald-200'
                              : 'text-slate-800 dark:text-slate-100'
                          }`}
                          title={p.justificativa}
                        >
                          {p.justificativa}
                        </td>
                        <td
                          className="max-w-[16rem] whitespace-normal break-words px-2 py-2 align-top text-slate-500 dark:text-slate-400"
                          title={p.observacao ?? ''}
                        >
                          {p.observacao || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {gradeParadas.colunaFiltroAberta && gradeParadas.filtroAbertoRect ? (
                <GradeFiltroExcelPortal
                  colunaAberta={gradeParadas.colunaFiltroAberta}
                  rect={gradeParadas.filtroAbertoRect}
                  dropdownRef={gradeParadas.filtroDropdownRef}
                  excelFilterDrafts={gradeParadas.excelFilterDrafts}
                  setExcelFilterDrafts={gradeParadas.setExcelFilterDrafts}
                  valoresUnicosPorColuna={gradeParadas.valoresUnicosPorColuna}
                  onSortAsc={(colId) => {
                    gradeParadas.setSortState({ key: colId, direction: 'asc' });
                    gradeParadas.setSortLevels([]);
                    gradeParadas.fecharFiltroExcel();
                  }}
                  onSortDesc={(colId) => {
                    gradeParadas.setSortState({ key: colId, direction: 'desc' });
                    gradeParadas.setSortLevels([]);
                    gradeParadas.fecharFiltroExcel();
                  }}
                  onAplicar={gradeParadas.aplicarFiltroExcel}
                  onCancelar={gradeParadas.fecharFiltroExcel}
                  showNumericFilters={gradeParadas.colunaFiltroAberta === 'duracao'}
                  showDateRangeFilters={gradeParadas.colunaFiltroAberta === 'data'}
                />
              ) : null}
            </div>
          )}
        </div>
      </div>

      <ModalMemorialProducaoCamasi
        open={memorialProducaoAberto}
        kpis={kpis}
        onClose={() => setMemorialProducaoAberto(false)}
      />
      <ModalCamasiKpi
        open={!!kpiModal}
        tipo={kpiModal}
        data={dataContexto}
        motivoFiltro={motivoModal}
        categoriaFiltro={null}
        onClose={() => {
          setKpiModal(null);
          setMotivoModal(null);
        }}
      />
      {pontualRecurso ? (
        <ModalEscalaPontualRecurso
          recurso={pontualRecurso}
          canEdit
          salvando={pontualSalvando}
          erro={pontualErro}
          onClose={() => !pontualSalvando && setPontualRecurso(null)}
          onSalvar={(excecoes) => void salvarPontualCamasi(excecoes)}
        />
      ) : null}
    </div>
  );
}
