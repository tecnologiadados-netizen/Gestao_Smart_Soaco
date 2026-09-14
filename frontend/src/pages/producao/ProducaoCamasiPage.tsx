import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  fetchCamasiDashboard,
  getCamasiRecursoEscala,
  putCamasiRecursoEscalaExcecoes,
  type CamasiDashboardResponse,
  type CamasiParadaValida,
  type CamasiProducaoValida,
} from '../../api/producaoCamasi';
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
import GradeFiltroCabecalhoBtn from '../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../components/grade/GradeFiltroExcelPortal';
import SequenciamentoDateField from '../../components/sequenciamento-carradas/SequenciamentoDateField';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import { CalendarClock } from 'lucide-react';

type Filtros = { dataIni: string; dataFim: string };

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
    justificativa: p.justificativa?.trim() || 'Produção',
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

type PontoPrevistoParado = {
  chave: string;
  label: string;
  previsto: number;
  parado: number;
  paradoOperacional: number;
  paradoJornada: number;
  /** previsto − parado (não negativo). */
  producao: number;
};

function pontoComProducao(
  base: Omit<PontoPrevistoParado, 'producao'>
): PontoPrevistoParado {
  return {
    ...base,
    producao: roundHoras(Math.max(0, base.previsto - base.parado)),
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
    | undefined
): PontoPrevistoParado[] {
  const paradoMap = new Map<string, { all: number; op: number; jor: number }>();
  for (const d of resumoDias ?? []) {
    paradoMap.set(d.data, {
      all: d.paradoHoras,
      op: d.paradoOperacionalHoras ?? 0,
      jor: d.paradoJornadaHoras ?? 0,
    });
  }
  const dias = ymdRange(dataIni, dataFim);
  if (dias.length === 0) return [];

  if (dias.length <= 62) {
    const pontos: PontoPrevistoParado[] = [];
    for (const ymd of dias) {
      const previsto = roundHoras(horasEscalaNoDia(ymd, escala));
      const p = paradoMap.get(ymd);
      const parado = roundHoras(p?.all ?? 0);
      const paradoOperacional = roundHoras(p?.op ?? 0);
      const paradoJornada = roundHoras(p?.jor ?? 0);
      if (previsto <= 0 && parado <= 0) continue;
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
      pontos.push(
        pontoComProducao({
          chave: ymd,
          label: m ? `${m[3]}/${m[2]}` : ymd,
          previsto,
          parado,
          paradoOperacional,
          paradoJornada,
        })
      );
    }
    return pontos;
  }

  const mesMap = new Map<
    string,
    { previsto: number; parado: number; paradoOperacional: number; paradoJornada: number }
  >();
  for (const ymd of dias) {
    const mes = ymd.slice(0, 7);
    const acc = mesMap.get(mes) ?? {
      previsto: 0,
      parado: 0,
      paradoOperacional: 0,
      paradoJornada: 0,
    };
    const p = paradoMap.get(ymd);
    acc.previsto += horasEscalaNoDia(ymd, escala);
    acc.parado += p?.all ?? 0;
    acc.paradoOperacional += p?.op ?? 0;
    acc.paradoJornada += p?.jor ?? 0;
    mesMap.set(mes, acc);
  }
  return [...mesMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, v]) => {
      const [y, mo] = mes.split('-');
      const idx = Number(mo) - 1;
      return pontoComProducao({
        chave: mes,
        label: idx >= 0 && idx < 12 ? `${MESES_ABREV[idx]}/${y}` : mes,
        previsto: roundHoras(v.previsto),
        parado: roundHoras(v.parado),
        paradoOperacional: roundHoras(v.paradoOperacional),
        paradoJornada: roundHoras(v.paradoJornada),
      });
    });
}

function KpiCard({
  title,
  value,
  sub,
  loading,
  onClick,
}: {
  title: string;
  value: string;
  sub: string;
  loading?: boolean;
  onClick?: () => void;
}) {
  if (loading) {
    return (
      <div className="card-panel h-[110px] animate-pulse p-4">
        <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-4 h-7 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="mt-3 h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="card-panel w-full p-4 text-left transition hover:ring-2 hover:ring-primary-400/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{title}</p>
      <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-slate-50">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{sub}</p>
      <p className="mt-1.5 text-[10px] font-medium text-primary-600 dark:text-primary-400">
        Clique para ver o detalhe
      </p>
    </button>
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
    }, 90_000);
    return () => window.clearInterval(id);
  }, [isFiltroHoje, filtros, carregar, kpiModal, pontualRecurso]);

  const filtrosPendentes = useMemo(
    () => draft.dataIni !== filtros.dataIni || draft.dataFim !== filtros.dataFim,
    [draft, filtros]
  );

  const chartPrevistoParado = useMemo(() => {
    if (!data) return [];
    return buildSeriePrevistoParado(data.dataIni, data.dataFim, data.escala, data.resumoDias);
  }, [data]);

  const pontuaisNoPeriodo = useMemo(
    () =>
      data?.escala
        ? excecoesSobrepostasAoPeriodo(data.escala.excecoes, data.dataIni, data.dataFim)
        : [],
    [data]
  );

  const chartPrevistoParadoGranularidade =
    chartPrevistoParado.length > 0 && chartPrevistoParado[0]?.chave.length === 10
      ? 'dia'
      : 'mês';

  const motivosDisplay = (data?.motivos ?? []).slice(0, 12);
  const maxMotivo = Math.max(...motivosDisplay.map((m) => m.horas), 1);

  const paradasValidas = data?.paradasValidas ?? [];
  const producaoValidas = data?.producaoValidas ?? [];
  const linhasTempoBase = useMemo(() => {
    const linhas: LinhaTempo[] = [];
    if (filtroTipoEvento !== 'producao') {
      paradasValidas.forEach((p, idx) => {
        const cat = p.categoria ?? categoriaParadaCamasi(p.justificativa);
        if (filtroCategoria !== 'todas' && cat !== filtroCategoria) return;
        linhas.push(paradaParaLinha(p, idx));
      });
    }
    if (filtroTipoEvento !== 'paradas') {
      producaoValidas.forEach((p, idx) => linhas.push(producaoParaLinha(p, idx)));
    }
    linhas.sort(
      (a, b) =>
        a.data.localeCompare(b.data) ||
        (a.inicio ?? '').localeCompare(b.inicio ?? '') ||
        a.tipo.localeCompare(b.tipo)
    );
    return linhas;
  }, [paradasValidas, producaoValidas, filtroCategoria, filtroTipoEvento]);
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

  const kpis = data?.kpis;

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
            Paradas operacionais dentro da escala
            {data
              ? ` · ${formatYmdBr(data.dataIni)} a ${formatYmdBr(data.dataFim)}`
              : ''}
            {isFiltroHoje && atualizadoAs ? ` · atualizado às ${atualizadoAs}` : ''}
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
          title="Eventos de parada"
          value={new Intl.NumberFormat('pt-BR').format(kpis?.qtdeParadasOperacionais ?? 0)}
          sub={
            (kpis?.qtdeParadasJornada ?? 0) > 0
              ? `Operacionais · início/fim de jornada: ${new Intl.NumberFormat('pt-BR').format(kpis?.qtdeParadasJornada ?? 0)}`
              : 'Quantidade de paradas operacionais no período'
          }
          onClick={() => {
            setMotivoModal(null);
            setKpiModal('eventos');
          }}
        />
        <KpiCard
          loading={loading}
          title="Tempo parado"
          value={formatHoras(kpis?.horasParado ?? 0)}
          sub={
            (kpis?.horasParadoJornada ?? 0) > 0
              ? `Na escala · operacional ${formatHoras(kpis?.horasParadoOperacional ?? 0)} · jornada início/fim ${formatHoras(kpis?.horasParadoJornada ?? 0)}`
              : 'Paradas na escala no período'
          }
          onClick={() => {
            setMotivoModal(null);
            setKpiModal('parado');
          }}
        />
        <KpiCard
          loading={loading}
          title="Tempo previsto de produção"
          value={kpis?.horasEscala != null ? formatHoras(kpis.horasEscala) : '—'}
          sub={
            data?.escala?.recursoNome
              ? `Escala do recurso ${data.escala.recursoNome}`
              : 'Horas de escala no período'
          }
          onClick={() => {
            setMotivoModal(null);
            setKpiModal('previsto');
          }}
        />
        <KpiCard
          loading={loading}
          title="Produção"
          value={formatHoras(kpis?.horasProducao ?? 0)}
          sub={
            kpis?.disponibilidadePct != null
              ? `Disponibilidade ${new Intl.NumberFormat('pt-BR', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }).format(kpis.disponibilidadePct)}% · produção ÷ escala`
              : 'Horas em produção no período'
          }
          onClick={() => {
            setMotivoModal(null);
            setKpiModal('producao');
          }}
        />
      </div>

      <div className="card-panel mt-3 p-5">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white">
            Previsto × parado ao longo do período
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            No detalhe ao passar o mouse: produção = previsto − parado operacional
            {chartPrevistoParadoGranularidade === 'dia'
              ? ' — por dia (período curto)'
              : ' — por mês (período longo)'}
          </p>
        </div>
        {loading ? (
          <div className="flex h-[300px] items-center justify-center text-slate-500">Carregando…</div>
        ) : chartPrevistoParado.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-slate-500">
            Sem dados de escala ou paradas no período.
          </div>
        ) : (
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartPrevistoParado} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: chartTheme.tick, fontSize: 11 }}
                  axisLine={{ stroke: chartTheme.axis }}
                  interval="preserveStartEnd"
                  minTickGap={chartPrevistoParadoGranularidade === 'dia' ? 28 : 8}
                />
                <YAxis
                  tick={{ fill: chartTheme.tick, fontSize: 11 }}
                  axisLine={{ stroke: chartTheme.axis }}
                  tickFormatter={(v) => formatHoras(Number(v))}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as PontoPrevistoParado | undefined;
                    if (!row) return null;
                    return (
                      <div
                        className="rounded-md px-3 py-2 text-sm shadow-md"
                        style={chartTheme.tooltip}
                      >
                        <p className="mb-1.5 font-semibold">{String(label)}</p>
                        <p className="tabular-nums" style={{ color: isDark ? '#60a5fa' : '#2563eb' }}>
                          Tempo previsto: {formatHoras(row.previsto)}
                        </p>
                        <p className="tabular-nums" style={{ color: isDark ? '#fbbf24' : '#d97706' }}>
                          Parada operacional: {formatHoras(row.paradoOperacional)}
                        </p>
                        <p
                          className="mt-1 border-t border-slate-200 pt-1 font-medium tabular-nums dark:border-slate-600"
                          style={{ color: isDark ? '#34d399' : '#059669' }}
                        >
                          Tempo de produção: {formatHoras(row.producao)}
                        </p>
                      </div>
                    );
                  }}
                />
                <Legend
                  formatter={(value) =>
                    value === 'previsto' ? 'Previsto' : 'Parada operacional'
                  }
                />
                <Line
                  type="monotone"
                  dataKey="previsto"
                  name="previsto"
                  stroke={isDark ? '#60a5fa' : '#2563eb'}
                  strokeWidth={2}
                  dot={chartPrevistoParadoGranularidade === 'dia' ? false : { r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="paradoOperacional"
                  name="paradoOperacional"
                  stroke={isDark ? '#fbbf24' : '#d97706'}
                  strokeWidth={2}
                  dot={chartPrevistoParadoGranularidade === 'dia' ? false : { r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="mt-3">
        <div className="card-panel flex min-h-[420px] flex-col p-5">
          <div className="mb-4 shrink-0">
            <h3 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white">
              Principais motivos de parada
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Sem início/fim de jornada — clique na barra para ver os eventos do motivo
              {(kpis?.horasParadoJornada ?? 0) > 0
                ? ` · jornada ociosa ${formatHoras(kpis?.horasParadoJornada ?? 0)}`
                : ''}
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
            {temFiltrosParadas ? (
              <button
                type="button"
                onClick={limparFiltrosParadas}
                className="text-xs font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
              >
                Limpar filtros
              </button>
            ) : null}
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

      <ModalCamasiKpi
        open={!!kpiModal}
        tipo={kpiModal}
        data={data}
        motivoFiltro={motivoModal}
        categoriaFiltro={
          motivoModal || kpiModal === 'parado' ? null : 'operacional'
        }
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
