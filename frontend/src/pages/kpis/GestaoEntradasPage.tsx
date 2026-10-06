import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CalendarRange, ClipboardCheck, Clock3, Package } from 'lucide-react';
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ComoLerBtn } from '../../components/AjudaTelaModal';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import KpiPainelVoltarLink from '../../components/kpis/KpiPainelVoltarLink';
import {
  fetchGestaoEntradasPainel,
  type GestaoEntradasPainel,
} from '../../api/gestaoEntradas';
import GestaoEntradasAjudaModal from './GestaoEntradasAjudaModal';
import GestaoEntradasCardModal, { type RecorteGestaoEntrada } from './GestaoEntradasCardModal';
import GestaoEntradasDiaModal, {
  GestaoEntradasRankingModal,
  type FiltroRankingGestao,
} from './GestaoEntradasDiaModal';

const panelSurface =
  'rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.05)] backdrop-blur-sm dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(22,26,40,0.96),rgba(12,14,22,0.96))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_40px_rgba(0,0,0,0.28)]';

const COR_ENTRADAS = '#5C92D6';
const COR_ACEITAS = '#FF6B35';
const MOVIMENTO_COLORS = ['#22D3EE', '#A3E635', '#F472B6'];
const DIVERGENCIA_COLORS = ['#FB7185', '#FB923C', '#FBBF24'];

type Tone = 'emerald' | 'violet' | 'amber' | 'cyan';

const TONE: Record<Tone, { card: string; icon: string }> = {
  emerald: {
    card: 'border-[#00A859]/30 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(0,168,89,0.16),transparent_55%),linear-gradient(180deg,#ffffff,#f3fbf7)] shadow-[0_12px_32px_rgba(0,168,89,0.08)] dark:border-[#00A859]/35 dark:bg-[radial-gradient(120%_85%_at_0%_0%,rgba(0,168,89,0.34),transparent_58%),linear-gradient(180deg,#0c2418,#0c1214)] dark:shadow-[0_0_36px_rgba(0,168,89,0.16)]',
    icon: 'bg-[#00A859]/15 text-[#00A859] ring-[#00A859]/35 shadow-[0_0_16px_rgba(0,168,89,0.35)] dark:text-[#7ddea8]',
  },
  violet: {
    card: 'border-[#1E22AA]/25 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(30,34,170,0.16),transparent_55%),linear-gradient(180deg,#ffffff,#f4f5fb)] shadow-[0_12px_32px_rgba(30,34,170,0.08)] dark:border-[#2B36C1]/40 dark:bg-[radial-gradient(120%_85%_at_0%_0%,rgba(30,34,170,0.48),transparent_58%),linear-gradient(180deg,#101433,#0c1018)] dark:shadow-[0_0_36px_rgba(30,34,170,0.22)]',
    icon: 'bg-[#1E22AA]/12 text-[#1E22AA] ring-[#1E22AA]/30 shadow-[0_0_16px_rgba(30,34,170,0.28)] dark:text-[#C5C9EF]',
  },
  amber: {
    card: 'border-[#FFAD00]/40 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(255,173,0,0.22),transparent_55%),linear-gradient(180deg,#ffffff,#fffaf0)] shadow-[0_12px_32px_rgba(255,173,0,0.1)] dark:border-[#FFAD00]/35 dark:bg-[radial-gradient(120%_85%_at_0%_0%,rgba(255,173,0,0.32),transparent_58%),linear-gradient(180deg,#2a220c,#120e0c)] dark:shadow-[0_0_36px_rgba(255,173,0,0.14)]',
    icon: 'bg-[#FFAD00]/15 text-[#C48400] ring-[#FFAD00]/40 shadow-[0_0_16px_rgba(255,173,0,0.35)] dark:text-[#FBB03B]',
  },
  cyan: {
    card: 'border-[#041E42]/20 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(4,30,66,0.12),transparent_55%),linear-gradient(180deg,#ffffff,#f3f6fa)] shadow-[0_12px_32px_rgba(4,30,66,0.08)] dark:border-[#041E42]/80 dark:bg-[radial-gradient(120%_85%_at_0%_0%,rgba(4,30,66,0.95),transparent_62%),linear-gradient(180deg,#0a2244,#0c1218)] dark:shadow-[0_0_36px_rgba(4,30,66,0.45)]',
    icon: 'bg-[#041E42]/10 text-[#041E42] ring-[#041E42]/25 shadow-[0_0_16px_rgba(4,30,66,0.2)] dark:text-[#C5C9EF]',
  },
};

const inputClass =
  'rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100';
const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1';
const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50';
const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50';

type Granularidade = 'dia' | 'mes';
type EscopoDivergencia = 'reais' | 'geral';
type ContextoMovimentacao = 'volume' | 'divergencias';
type SeriePonto = {
  key: string;
  label: string;
  notas: number;
  aceitas: number;
};

function inicioMesYmd(ref = new Date()): string {
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-01`;
}

function hojeYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDataBr(ymd: string): string {
  const [y, m, d] = ymd.slice(0, 10).split('-');
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

function fmtNum(n: number | null | undefined, digitos = 0): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', {
    maximumFractionDigits: digitos,
    minimumFractionDigits: digitos > 0 ? Math.min(digitos, 1) : 0,
  });
}

function KpiCard({
  tone,
  titulo,
  valor,
  detalhe,
  icone,
  extra,
  onClick,
}: {
  tone: Tone;
  titulo: string;
  valor: string;
  detalhe?: string;
  icone: ReactNode;
  extra?: ReactNode;
  onClick?: () => void;
}) {
  const tom = TONE[tone];
  return (
    <article
      className={`relative overflow-hidden rounded-2xl border p-4 text-left ${tom.card} ${
        onClick ? 'cursor-pointer transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400' : ''
      }`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            {titulo}
          </p>
          <p className="mt-2 text-[1.7rem] font-semibold leading-none tracking-tight tabular-nums text-slate-900 dark:text-white">
            {valor}
          </p>
        </div>
        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${tom.icon}`}>
          {icone}
        </span>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          {detalhe ? <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{detalhe}</p> : null}
          {onClick ? <p className="mt-1 text-[11px] text-slate-400">Clique para ver os documentos</p> : null}
        </div>
        {extra}
      </div>
    </article>
  );
}

/** 0 = pior (vermelho), 100 = melhor (azul-marinho claro, legível no fundo escuro). */
function corAnelPorPercentual(percent: number): string {
  const p = Math.min(100, Math.max(0, percent)) / 100;
  const stops: Array<{ t: number; c: [number, number, number] }> = [
    { t: 0, c: [239, 68, 68] },
    { t: 0.35, c: [249, 115, 22] },
    { t: 0.55, c: [234, 179, 8] },
    { t: 0.75, c: [92, 146, 214] },
    { t: 1, c: [92, 146, 214] },
  ];
  let i = 0;
  while (i < stops.length - 2 && p > stops[i + 1]!.t) i += 1;
  const a = stops[i]!;
  const b = stops[i + 1]!;
  const span = b.t - a.t || 1;
  const u = (p - a.t) / span;
  const mix = (k: 0 | 1 | 2) => Math.round(a.c[k] + (b.c[k] - a.c[k]) * u);
  return `rgb(${mix(0)} ${mix(1)} ${mix(2)})`;
}

function GraficoSemDivergencia({
  percent,
  detalhe,
  legenda,
  onFatia,
}: {
  percent: number | null;
  detalhe: string;
  legenda: string;
  onFatia?: (fatia: 'sem' | 'com') => void;
}) {
  const p = percent != null ? Math.min(100, Math.max(0, percent)) : 0;
  const cor = percent != null ? corAnelPorPercentual(p) : '#64748b';
  const trilha = 'rgba(148,163,184,0.22)';
  const dados =
    percent == null
      ? [{ name: 'vazio', value: 1, fill: trilha }]
      : p <= 0
        ? [{ name: 'com', value: 100, fill: trilha }]
        : p >= 100
          ? [{ name: 'sem', value: 100, fill: cor }]
          : [
              { name: 'sem', value: p, fill: cor },
              { name: 'com', value: 100 - p, fill: trilha },
            ];
  return (
    <div className={`flex h-full flex-col p-4 ${panelSurface}`}>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Sem divergência</h2>
      <p className="mt-0.5 text-xs text-slate-500">{legenda}</p>
      <div className="relative mx-auto mt-2 h-72 w-full max-w-md">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={dados}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={86}
              outerRadius={122}
              startAngle={90}
              endAngle={-270}
              cornerRadius={14}
              paddingAngle={dados.length > 1 ? 3 : 0}
              stroke="transparent"
              isAnimationActive={false}
              cursor={onFatia ? 'pointer' : undefined}
              onClick={(_, index) => {
                const fatia = dados[index];
                if (!onFatia || !fatia || (fatia.name !== 'sem' && fatia.name !== 'com')) return;
                onFatia(fatia.name);
              }}
            >
              {dados.map((fatia) => (
                <Cell
                  key={fatia.name}
                  fill={fatia.fill}
                  style={
                    fatia.name === 'sem' ? { filter: `drop-shadow(0 0 10px ${cor})` } : undefined
                  }
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-bold tabular-nums leading-none" style={{ color: cor }}>
            {percent != null ? `${fmtNum(p, 0)}%` : '—'}
          </span>
          <span className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">
            conferidas
          </span>
        </div>
      </div>
      <div className="mt-2 text-center">
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detalhe}</p>
      </div>
    </div>
  );
}

function BarrasRanking({
  itens,
  vazio,
  gradiente,
  onItem,
}: {
  itens: Array<{ key: string; label: string; detalhe: string; valor: number }>;
  vazio: string;
  gradiente: string;
  onItem?: (item: { key: string; label: string }) => void;
}) {
  if (itens.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">{vazio}</p>;
  }
  const max = itens[0]?.valor || 1;
  return (
    <ul className="space-y-3.5">
      {itens.map((item, index) => {
        const pct = Math.max(4, Math.min(100, (item.valor / max) * 100));
        return (
          <li key={item.key}>
            <button
              type="button"
              className="w-full rounded-lg text-left transition hover:bg-slate-100/80 dark:hover:bg-white/[0.04]"
              onClick={() => onItem?.({ key: item.key, label: item.label })}
            >
              <span className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-4 shrink-0 tabular-nums text-[11px] font-semibold text-slate-400">
                    {index + 1}
                  </span>
                  <span className="truncate font-medium text-slate-700 dark:text-slate-100">{item.label}</span>
                </span>
                <span className="shrink-0 tabular-nums text-slate-500">{item.detalhe}</span>
              </span>
              <span className="block h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/[0.06]">
                <span className={`block h-full rounded-full ${gradiente}`} style={{ width: `${pct}%` }} />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function agregarSeriePorMes(serie: GestaoEntradasPainel['serieDiaria']): SeriePonto[] {
  const map = new Map<string, { notas: number; aceitas: number }>();
  for (const d of serie) {
    const key = d.data.slice(0, 7);
    const atual = map.get(key) ?? { notas: 0, aceitas: 0 };
    atual.notas += d.notas;
    atual.aceitas += d.aceitas;
    map.set(key, atual);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => {
      const [y, m] = key.split('-');
      return { key, label: `${m}/${y}`, notas: v.notas, aceitas: v.aceitas };
    });
}

function fraseTooltipEntradas(notas: number, aceitas: number): string {
  const artigo = notas === 1 ? 'Da' : 'Das';
  const entradas = notas === 1 ? 'entrada' : 'entradas';
  const verbo = aceitas === 1 ? 'teve' : 'tiveram';
  return `${artigo} ${fmtNum(notas)} ${entradas}, ${fmtNum(aceitas)} ${verbo} divergência aceita.`;
}

function TooltipEntradasDia({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: SeriePonto }>;
}) {
  const ponto = payload?.[0]?.payload;
  if (!active || !ponto) return null;
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 text-xs shadow-xl backdrop-blur dark:border-white/10 dark:bg-[#12141c]/95">
      <p className="mb-1 font-medium text-slate-400">{ponto.label}</p>
      <p className="text-slate-800 dark:text-slate-100">{fraseTooltipEntradas(ponto.notas, ponto.aceitas)}</p>
    </div>
  );
}

function intervaloDoPonto(key: string): { dataInicio: string; dataFim: string } | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return { dataInicio: key, dataFim: key };
  const mes = /^(\d{4})-(\d{2})$/.exec(key);
  if (!mes) return null;
  const ultimo = new Date(Number(mes[1]), Number(mes[2]), 0).getDate();
  return {
    dataInicio: `${mes[1]}-${mes[2]}-01`,
    dataFim: `${mes[1]}-${mes[2]}-${String(ultimo).padStart(2, '0')}`,
  };
}

function BolinhaDia({
  cx,
  cy,
  payload,
  fill,
  r = 4,
  onAbrir,
}: {
  cx?: number;
  cy?: number;
  payload?: SeriePonto;
  fill: string;
  r?: number;
  onAbrir: (ponto: SeriePonto) => void;
}) {
  if (cx == null || cy == null || !payload) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={fill}
      stroke="rgba(255,255,255,0.9)"
      strokeWidth={1.5}
      style={{ cursor: 'pointer', filter: `drop-shadow(0 0 5px ${fill})` }}
      onClick={(e) => {
        e.stopPropagation();
        onAbrir(payload);
      }}
    />
  );
}

export default function GestaoEntradasPage() {
  const [dataInicio, setDataInicio] = useState(inicioMesYmd());
  const [dataFim, setDataFim] = useState(hojeYmd());
  const [granularidade, setGranularidade] = useState<Granularidade>('dia');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [painel, setPainel] = useState<GestaoEntradasPainel | null>(null);
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [pontoAberto, setPontoAberto] = useState<SeriePonto | null>(null);
  const [recorteAberto, setRecorteAberto] = useState<RecorteGestaoEntrada | null>(null);
  const [rankingAberto, setRankingAberto] = useState<FiltroRankingGestao | null>(null);
  const [contextoMovimentacao, setContextoMovimentacao] =
    useState<ContextoMovimentacao>('volume');
  const [escopo, setEscopo] = useState<EscopoDivergencia>('reais');

  const carregar = useCallback(async (di: string, df: string, escopoArg: EscopoDivergencia) => {
    setLoading(true);
    setErro(null);
    try {
      const r = await fetchGestaoEntradasPainel({ dataInicio: di, dataFim: df, escopo: escopoArg });
      if (r.erro || !r.data) {
        setErro(r.erro ?? 'Falha ao carregar o painel.');
        setPainel(null);
        return;
      }
      setPainel(r.data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setPainel(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const di = inicioMesYmd();
    const df = hojeYmd();
    setDataInicio(di);
    setDataFim(df);
    void carregar(di, df, 'reais');
  }, [carregar]);

  const serieChart = useMemo(() => {
    if (!painel) return [];
    if (granularidade === 'mes') return agregarSeriePorMes(painel.serieDiaria);
    return painel.serieDiaria.map((d) => ({
      key: d.data,
      label: fmtDataBr(d.data),
      notas: d.notas,
      aceitas: d.aceitas,
    }));
  }, [painel, granularidade]);

  const intervaloAberto = pontoAberto ? intervaloDoPonto(pontoAberto.key) : null;

  const k = painel?.kpis;
  const campos = (painel?.porCampo ?? [])
    .filter((c) => c.qtde > 0)
    .map((c) => ({
      key: c.campo,
      label: c.label,
      valor: c.qtde,
      detalhe: `${c.qtde} em ${c.documentos ?? 0} ${(c.documentos ?? 0) === 1 ? 'documento' : 'documentos'} · ${c.aceitas} aceitas · ${c.recusas} recusas`,
    }));
  const justificativas = (painel?.porJustificativa ?? []).map((j) => ({
    key: j.codigo,
    label: j.label,
    valor: j.qtde,
    detalhe: `${j.qtde}`,
  }));
  const valorTipo = (tipo: GestaoEntradasPainel['porTipo'][number]) =>
    contextoMovimentacao === 'volume' ? tipo.notas : tipo.divergencias;
  const tiposMaisUsados = [...(painel?.porTipo ?? [])]
    .filter((tipo) => valorTipo(tipo) > 0)
    .sort((a, b) => valorTipo(b) - valorTipo(a) || b.notas - a.notas)
    .slice(0, 3);
  const abrirTipo = (tipo: GestaoEntradasPainel['porTipo'][number]) => {
    setRecorteAberto({
      origem: 'tipo',
      idTipoMovimentacao: tipo.idTipoMovimentacao,
      nomeTipo: tipo.nomeTipo,
      modo: contextoMovimentacao,
    });
  };
  const totalTiposMaisUsados = tiposMaisUsados.reduce(
    (total, tipo) => total + valorTipo(tipo),
    0
  );
  const coresMovimentacao =
    contextoMovimentacao === 'volume' ? MOVIMENTO_COLORS : DIVERGENCIA_COLORS;
  const picoEntradas = useMemo(() => {
    if (serieChart.length === 0) return null;
    return serieChart.reduce((melhor, ponto) => (ponto.notas > melhor.notas ? ponto : melhor));
  }, [serieChart]);
  const pctSemDivergencia =
    k && k.qtdeConferidas > 0 ? (k.qtdeLimpas / k.qtdeConferidas) * 100 : null;
  const liderMovimento = tiposMaisUsados[0];
  const liderPercentual =
    liderMovimento && totalTiposMaisUsados > 0
      ? (valorTipo(liderMovimento) / totalTiposMaisUsados) * 100
      : 0;

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col px-3 py-4 md:px-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 hidden h-72 dark:block">
        <div className="absolute left-[8%] top-0 h-48 w-48 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute right-[12%] top-8 h-40 w-40 rounded-full bg-emerald-500/15 blur-3xl" />
      </div>
      <CarregandoInformacoesOverlay show={loading} mensagem="Carregando Gestão entradas…" mode="viewport" />
      <div className="relative mx-auto w-full max-w-[1920px] space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <KpiPainelVoltarLink painelId="gestao-entradas" />
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Gestão entradas</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Acuracidade das notas de entrada por data de entrada
            </p>
          </div>
          <ComoLerBtn onClick={() => setAjudaAberta(true)} title="Como ler Gestão entradas" />
        </header>

        <div className={`flex flex-wrap items-end gap-3 px-4 py-3 ${panelSurface}`}>
          <div>
            <label className={labelClass} htmlFor="ge-inicio">
              Entrada início
            </label>
            <input
              id="ge-inicio"
              type="date"
              className={inputClass}
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="ge-fim">
              Entrada fim
            </label>
            <input
              id="ge-fim"
              type="date"
              className={inputClass}
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => {
              const di = inicioMesYmd();
              const df = hojeYmd();
              setDataInicio(di);
              setDataFim(df);
              void carregar(di, df, escopo);
            }}
          >
            Mês atual
          </button>
          <button
            type="button"
            className={btnPrimary}
            disabled={loading || !dataInicio || !dataFim || dataFim < dataInicio}
            onClick={() => void carregar(dataInicio, dataFim, escopo)}
          >
            Filtrar
          </button>
          <div>
            <span className={labelClass}>Divergências</span>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-white/10 dark:bg-black/25">
              <button
                type="button"
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  escopo === 'reais'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-white/10 dark:text-white'
                    : 'text-slate-500'
                }`}
                onClick={() => {
                  setEscopo('reais');
                  void carregar(dataInicio, dataFim, 'reais');
                }}
              >
                Visão real
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  escopo === 'geral'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-white/10 dark:text-white'
                    : 'text-slate-500'
                }`}
                onClick={() => {
                  setEscopo('geral');
                  void carregar(dataInicio, dataFim, 'geral');
                }}
              >
                Visão geral
              </button>
            </div>
          </div>
        </div>

        {erro && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
            {erro}
          </p>
        )}

        {painel && k && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                tone="emerald"
                titulo="Entradas"
                valor={fmtNum(k.qtdeNotas)}
                detalhe={`${fmtNum(k.qtdeItens)} itens`}
                icone={<Package className="h-4 w-4" strokeWidth={2.2} />}
                onClick={() => setRecorteAberto({ origem: 'card', card: 'entradas' })}
              />
              <KpiCard
                tone="violet"
                titulo="Conferidas"
                valor={fmtNum(k.qtdeConferidas)}
                detalhe={
                  k.qtdeNotas > 0
                    ? `${fmtNum((k.qtdeConferidas / k.qtdeNotas) * 100, 0)}% do total`
                    : 'Nenhuma nota no período'
                }
                icone={<ClipboardCheck className="h-4 w-4" strokeWidth={2.2} />}
                onClick={() => setRecorteAberto({ origem: 'card', card: 'conferidas' })}
              />
              <KpiCard
                tone="amber"
                titulo="Pendentes"
                valor={fmtNum(k.qtdePendentes)}
                detalhe={
                  k.qtdeNotas > 0
                    ? `${fmtNum((k.qtdePendentes / k.qtdeNotas) * 100, 0)}% do total`
                    : 'Nenhuma nota no período'
                }
                icone={<Clock3 className="h-4 w-4" strokeWidth={2.2} />}
                onClick={() => setRecorteAberto({ origem: 'card', card: 'pendentes' })}
              />
              <KpiCard
                tone="cyan"
                titulo="Média ao dia"
                valor={fmtNum(k.mediaNotasPorDia, 1)}
                detalhe={`${fmtNum(painel.serieDiaria.length)} ${painel.serieDiaria.length === 1 ? 'dia' : 'dias'} com movimento`}
                icone={<CalendarRange className="h-4 w-4" strokeWidth={2.2} />}
                onClick={() => setRecorteAberto({ origem: 'card', card: 'media' })}
              />
            </div>

            <div className={`flex flex-col p-4 ${panelSurface}`}>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Evolução — entradas vs divergência aceita
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {picoEntradas
                        ? `Pico de entradas em ${picoEntradas.label}: ${fmtNum(picoEntradas.notas)} notas, ${fmtNum(picoEntradas.aceitas)} com divergência aceita.`
                        : 'Sem entradas no período.'}{' '}
                      {escopo === 'reais'
                        ? 'A linha laranja conta só divergência real.'
                        : 'A linha laranja inclui divergência benigna e real.'}{' '}
                      Clique na bolinha para abrir o detalhe.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#5C92D6] shadow-[0_0_8px_#5C92D6]" />
                        Entradas
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-[#FF6B35] shadow-[0_0_8px_#FF6B35]" />
                        Divergência aceita
                      </span>
                    </div>
                    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-white/10 dark:bg-black/25">
                      <button
                        type="button"
                        className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                          granularidade === 'dia'
                            ? 'bg-white text-slate-900 shadow-sm dark:bg-white/10 dark:text-white'
                            : 'text-slate-500'
                        }`}
                        onClick={() => setGranularidade('dia')}
                      >
                        Dia
                      </button>
                      <button
                        type="button"
                        className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                          granularidade === 'mes'
                            ? 'bg-white text-slate-900 shadow-sm dark:bg-white/10 dark:text-white'
                            : 'text-slate-500'
                        }`}
                        onClick={() => setGranularidade('mes')}
                      >
                        Mês
                      </button>
                    </div>
                  </div>
                </div>
                <div className="h-80 w-full">
                  {serieChart.length === 0 ? (
                    <p className="py-16 text-center text-sm text-slate-400">Sem entradas no período.</p>
                  ) : (
                    <ResponsiveContainer>
                      <LineChart
                        data={serieChart}
                        margin={{ top: 18, right: 12, left: 0, bottom: 0 }}
                        onClick={(state) => {
                          const ponto = (
                            state as { activePayload?: Array<{ payload?: SeriePonto }> } | undefined
                          )?.activePayload?.[0]?.payload;
                          if (ponto) setPontoAberto(ponto);
                        }}
                      >
                        <CartesianGrid vertical={false} stroke="rgba(148,163,184,0.16)" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: '#94a3b8' }}
                          interval="preserveStartEnd"
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: '#94a3b8' }}
                          width={36}
                          allowDecimals={false}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip content={<TooltipEntradasDia />} />
                        <Line
                          type="monotone"
                          dataKey="notas"
                          name="Entradas"
                          stroke={COR_ENTRADAS}
                          strokeWidth={2.5}
                          style={{ filter: 'drop-shadow(0 0 4px rgba(92,146,214,0.65))' }}
                          dot={(props) => (
                            <BolinhaDia
                              cx={props.cx}
                              cy={props.cy}
                              payload={props.payload as SeriePonto}
                              fill={COR_ENTRADAS}
                              onAbrir={setPontoAberto}
                            />
                          )}
                          activeDot={(props) => (
                            <BolinhaDia
                              cx={props.cx}
                              cy={props.cy}
                              payload={props.payload as SeriePonto}
                              fill={COR_ENTRADAS}
                              r={6}
                              onAbrir={setPontoAberto}
                            />
                          )}
                        />
                        <Line
                          type="monotone"
                          dataKey="aceitas"
                          name="Divergência aceita"
                          stroke={COR_ACEITAS}
                          strokeWidth={2.5}
                          style={{ filter: 'drop-shadow(0 1px 2px rgba(255,107,53,0.55))' }}
                          dot={(props) => (
                            <BolinhaDia
                              cx={props.cx}
                              cy={props.cy}
                              payload={props.payload as SeriePonto}
                              fill={COR_ACEITAS}
                              onAbrir={setPontoAberto}
                            />
                          )}
                          activeDot={(props) => (
                            <BolinhaDia
                              cx={props.cx}
                              cy={props.cy}
                              payload={props.payload as SeriePonto}
                              fill={COR_ACEITAS}
                              r={6}
                              onAbrir={setPontoAberto}
                            />
                          )}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
            </div>

            <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
              <GraficoSemDivergencia
                percent={pctSemDivergencia}
                legenda={
                  escopo === 'reais'
                    ? 'Visão real: só divergência real entre as conferidas. Quanto mais alto, melhor.'
                    : 'Visão geral: inclui divergência benigna e real. Quanto mais alto, melhor.'
                }
                detalhe={
                  k.qtdeConferidas > 0
                    ? `${fmtNum(k.qtdeLimpas)} de ${fmtNum(k.qtdeConferidas)} conferidas`
                    : 'Nenhuma conferida no período'
                }
                onFatia={(fatia) => setRecorteAberto({ origem: 'anel', fatia })}
              />
              <div className={`flex h-full flex-col p-4 ${panelSurface}`}>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {contextoMovimentacao === 'volume'
                      ? 'Movimentação'
                      : 'Divergências por tipo'}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {liderMovimento
                      ? `${liderMovimento.nomeTipo} lidera com ${fmtNum(liderPercentual, 1)}%.`
                      : contextoMovimentacao === 'volume'
                        ? 'Os três tipos com mais notas no período.'
                        : 'Os três tipos com mais NFs que ainda divergem do pedido.'}
                  </p>
                </div>
                <div className="inline-flex shrink-0 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-white/10 dark:bg-black/25">
                  <button
                    type="button"
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                      contextoMovimentacao === 'volume'
                        ? 'bg-white text-slate-900 shadow-sm dark:bg-cyan-400/20 dark:text-cyan-200'
                        : 'text-slate-500'
                    }`}
                    onClick={() => setContextoMovimentacao('volume')}
                  >
                    Volume
                  </button>
                  <button
                    type="button"
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                      contextoMovimentacao === 'divergencias'
                        ? 'bg-white text-rose-700 shadow-sm dark:bg-rose-500/20 dark:text-rose-200'
                        : 'text-slate-500'
                    }`}
                    onClick={() => setContextoMovimentacao('divergencias')}
                  >
                    Divergências
                  </button>
                </div>
              </div>
              <div className="min-h-72 w-full">
                {tiposMaisUsados.length === 0 ? (
                  <p className="py-16 text-center text-sm text-slate-400">
                    {contextoMovimentacao === 'volume'
                      ? 'Sem dados.'
                      : 'Nenhuma NF conferida ainda apresenta divergência no período.'}
                  </p>
                ) : (
                  <div className="flex flex-col gap-1">
                    <div className="relative mx-auto h-72 w-full max-w-md">
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={tiposMaisUsados}
                            dataKey={
                              contextoMovimentacao === 'volume' ? 'notas' : 'divergencias'
                            }
                            nameKey="nomeTipo"
                            cx="50%"
                            cy="50%"
                            innerRadius={86}
                            outerRadius={122}
                            paddingAngle={3}
                            cornerRadius={10}
                            stroke="transparent"
                            isAnimationActive={false}
                            cursor="pointer"
                            onClick={(_, index) => {
                              const tipo = tiposMaisUsados[index];
                              if (tipo) abrirTipo(tipo);
                            }}
                          >
                            {tiposMaisUsados.map((t, i) => (
                              <Cell
                                key={t.idTipoMovimentacao}
                                fill={coresMovimentacao[i]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              borderRadius: 12,
                              border: '1px solid rgba(148,163,184,0.25)',
                              background: '#161822',
                              color: '#f8fafc',
                              boxShadow: '0 12px 30px rgba(0,0,0,0.3)',
                            }}
                            itemStyle={{ color: '#f8fafc' }}
                            formatter={(value, _name, item) => {
                              const row = item?.payload as
                                | { notas?: number; itens?: number; divergencias?: number }
                                | undefined;
                              return contextoMovimentacao === 'volume'
                                ? [
                                    `${fmtNum(Number(value))} NFs · ${fmtNum(row?.itens ?? 0)} itens`,
                                    'Volume',
                                  ]
                                : [
                                    `${fmtNum(Number(value))} divergentes de ${fmtNum(row?.notas ?? 0)} NFs`,
                                    'Divergências',
                                  ];
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
                          {fmtNum(totalTiposMaisUsados)}
                        </span>
                        <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                          {contextoMovimentacao === 'volume'
                            ? 'NFs no top 3'
                            : 'NFs divergentes'}
                        </span>
                      </div>
                    </div>

                    <ol className="space-y-2">
                      {tiposMaisUsados.map((tipo, i) => {
                        const valor = valorTipo(tipo);
                        const percentual =
                          totalTiposMaisUsados > 0 ? (valor / totalTiposMaisUsados) * 100 : 0;
                        return (
                          <li key={tipo.idTipoMovimentacao}>
                            <button
                              type="button"
                              className="flex w-full items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 text-left transition hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
                              onClick={() => abrirTipo(tipo)}
                            >
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{
                                backgroundColor: coresMovimentacao[i],
                                boxShadow: `0 0 10px ${coresMovimentacao[i]}`,
                              }}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                                {tipo.nomeTipo}
                              </span>
                              <span className="text-xs text-slate-500">
                                {contextoMovimentacao === 'volume'
                                  ? `${fmtNum(tipo.itens)} itens`
                                  : `${fmtNum(tipo.divergencias)} de ${fmtNum(tipo.notas)} NFs do tipo`}
                              </span>
                            </span>
                            <span className="text-right">
                              <span className="block text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                                {fmtNum(valor)}
                              </span>
                              <span className="text-xs tabular-nums text-slate-500">
                                {fmtNum(percentual, 0)}%
                              </span>
                            </span>
                          </button>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}
              </div>
            </div>
            </div>

            <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
              <div className={`p-4 ${panelSurface}`}>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Tipos de divergência
                </h2>
                <p className="mb-4 mt-0.5 text-xs text-slate-500">
                  {escopo === 'reais'
                    ? 'Decisões de divergência real nas notas já conferidas, por campo.'
                    : 'Decisões de divergência benigna e real nas notas já conferidas, por campo.'}
                </p>
                <BarrasRanking
                  itens={campos}
                  vazio="Nenhuma divergência decidida no período."
                  gradiente="bg-gradient-to-r from-violet-500 to-cyan-400 shadow-[0_0_12px_rgba(139,92,246,0.45)]"
                  onItem={(item) => setRankingAberto({ tipo: 'campo', campo: item.key, label: item.label })}
                />
              </div>
              <div className={`p-4 ${panelSurface}`}>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Motivos das divergências aceitas
                </h2>
                <p className="mb-4 mt-0.5 text-xs text-slate-500">
                  {escopo === 'reais'
                    ? 'Justificativa das divergências reais aceitas.'
                    : 'Justificativa ao aceitar, incluindo divergência benigna.'}
                </p>
                <BarrasRanking
                  itens={justificativas}
                  vazio="Nenhuma divergência aceita no período."
                  gradiente="bg-gradient-to-r from-amber-400 to-rose-500 shadow-[0_0_12px_rgba(251,113,133,0.4)]"
                  onItem={(item) => setRankingAberto({ tipo: 'motivo', codigo: item.key, label: item.label })}
                />
              </div>
            </div>
          </div>
        )}
      </div>
      <GestaoEntradasAjudaModal aberto={ajudaAberta} onClose={() => setAjudaAberta(false)} />
      {pontoAberto && intervaloAberto && (
        <GestaoEntradasDiaModal
          titulo={pontoAberto.label}
          dataInicio={intervaloAberto.dataInicio}
          dataFim={intervaloAberto.dataFim}
          escopo={escopo}
          onClose={() => setPontoAberto(null)}
        />
      )}
      {rankingAberto && painel && (
        <GestaoEntradasRankingModal
          filtro={rankingAberto}
          dataInicio={painel.dataInicio}
          dataFim={painel.dataFim}
          escopo={painel.escopo}
          onClose={() => setRankingAberto(null)}
        />
      )}
      {recorteAberto && painel && (
        <GestaoEntradasCardModal
          recorte={recorteAberto}
          dataInicio={painel.dataInicio}
          dataFim={painel.dataFim}
          escopo={painel.escopo}
          media={painel.kpis.mediaNotasPorDia}
          diasComMovimento={painel.serieDiaria.length}
          onClose={() => setRecorteAberto(null)}
        />
      )}
    </div>
  );
}
