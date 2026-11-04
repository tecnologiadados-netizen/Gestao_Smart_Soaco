import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ClipboardCheck, Percent, Send, Timer } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import {
  fetchConferenciaFisicaPainel,
  type PainelConferenciaFisica,
  type RecorteConferenciaFisica,
  type VoltaConferenciaFisica,
} from '../../api/gestaoEntradas';
import GestaoEntradasConferenciaFisicaModal, {
  fmtHorasConferencia,
  fmtTaxaDivergencia,
} from './GestaoEntradasConferenciaFisicaModal';

const panelSurface =
  'rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.05)] backdrop-blur-sm dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(22,26,40,0.96),rgba(12,14,22,0.96))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_40px_rgba(0,0,0,0.28)]';

const COR_DESTINACOES = '#5C92D6';
const COR_RETORNOS = '#00A859';

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
type Ponto = { key: string; label: string; destinacoes: number; finalizadas: number };
type Abertura = { recorte: RecorteConferenciaFisica; rotulo?: string };

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
  onClick,
}: {
  tone: Tone;
  titulo: string;
  valor: string;
  detalhe?: string;
  icone: ReactNode;
  onClick?: () => void;
}) {
  const tom = TONE[tone];
  return (
    <article
      className={`relative overflow-hidden rounded-2xl border p-4 text-left ${tom.card} ${
        onClick
          ? 'cursor-pointer transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400'
          : ''
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
      {detalhe ? <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{detalhe}</p> : null}
    </article>
  );
}

function labelChance(chance: 1 | 2 | 3): string {
  if (chance === 1) return '1ª chance';
  if (chance === 2) return '2ª chance';
  return '3ª chance';
}

function fraseAcertoConferente(
  acertosPorChance: Array<{ chance: 1 | 2 | 3; acertos: number }>,
): string {
  if (acertosPorChance.length === 0) return 'Nenhum acerto de quantidade';
  const maior = Math.max(...acertosPorChance.map((item) => item.acertos));
  const melhores = acertosPorChance.filter((item) => item.acertos === maior);
  const acertos = `${fmtNum(maior)} ${maior === 1 ? 'acerto' : 'acertos'}`;
  if (melhores.length === 1) {
    return `Acerta mais na ${labelChance(melhores[0]!.chance)} · ${acertos}`;
  }
  const chances = melhores.map((item) => labelChance(item.chance).replace(' chance', '')).join(' e na ');
  return `Acerta igual na ${chances} chance · ${acertos}`;
}

function agregarPorMes(serie: PainelConferenciaFisica['serieDiaria']): Ponto[] {
  const map = new Map<string, { destinacoes: number; finalizadas: number }>();
  for (const dia of serie) {
    const key = dia.data.slice(0, 7);
    const atual = map.get(key) ?? { destinacoes: 0, finalizadas: 0 };
    atual.destinacoes += dia.destinacoes;
    atual.finalizadas += dia.finalizadas;
    map.set(key, atual);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, valor]) => {
      const [ano, mes] = key.split('-');
      return { key, label: `${mes}/${ano}`, destinacoes: valor.destinacoes, finalizadas: valor.finalizadas };
    });
}

function Bolinha({
  cx,
  cy,
  payload,
  fill,
  r = 4,
  onAbrir,
}: {
  cx?: number;
  cy?: number;
  payload?: Ponto;
  fill: string;
  r?: number;
  onAbrir: (ponto: Ponto) => void;
}) {
  if (cx == null || cy == null || !payload) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={fill}
      stroke="#0b0d14"
      strokeWidth={1.5}
      style={{ cursor: 'pointer', filter: `drop-shadow(0 0 5px ${fill})` }}
      onClick={(e) => {
        e.stopPropagation();
        onAbrir(payload);
      }}
    />
  );
}

export default function GestaoEntradasConferenciaFisicaPanel() {
  const [dataInicio, setDataInicio] = useState(inicioMesYmd());
  const [dataFim, setDataFim] = useState(hojeYmd());
  const [granularidade, setGranularidade] = useState<Granularidade>('dia');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [painel, setPainel] = useState<PainelConferenciaFisica | null>(null);
  const [abertura, setAbertura] = useState<Abertura | null>(null);
  const cacheRef = useRef(new Map<string, VoltaConferenciaFisica[]>());

  const carregar = useCallback(async (di: string, df: string) => {
    cacheRef.current.clear();
    setAbertura(null);
    setLoading(true);
    setErro(null);
    try {
      const r = await fetchConferenciaFisicaPainel({ dataInicio: di, dataFim: df });
      if (r.erro || !r.data) {
        setErro(r.erro ?? 'Falha ao carregar a conferência física.');
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
    void carregar(di, df);
  }, [carregar]);

  const k = painel?.kpis;
  const serieChart = useMemo(() => {
    if (!painel) return [];
    if (granularidade === 'mes') return agregarPorMes(painel.serieDiaria);
    return painel.serieDiaria.map((dia) => ({
      key: dia.data,
      label: fmtDataBr(dia.data),
      destinacoes: dia.destinacoes,
      finalizadas: dia.finalizadas,
    }));
  }, [granularidade, painel]);

  const pico = useMemo(() => {
    if (serieChart.length === 0) return null;
    return serieChart.reduce((melhor, ponto) => (ponto.destinacoes > melhor.destinacoes ? ponto : melhor));
  }, [serieChart]);

  const barras = (painel?.porConferente ?? []).map((item) => ({
    key: item.nome,
    label: item.nome,
    valor: item.destinacoes,
    detalhe: fraseAcertoConferente(item.acertosPorChance),
  }));
  const maxBarra = barras[0]?.valor || 1;
  const abrirPonto = (ponto: Ponto) => setAbertura({ recorte: { tipo: 'dia', dia: ponto.key }, rotulo: ponto.label });

  return (
    <div className="relative space-y-4">
      <CarregandoInformacoesOverlay show={loading} mensagem="Carregando conferência física…" mode="viewport" />
      <div className={`flex flex-wrap items-end gap-3 px-4 py-3 ${panelSurface}`}>
        <div>
          <label className={labelClass} htmlFor="ge-fisica-inicio">
            Destinação início
          </label>
          <input
            id="ge-fisica-inicio"
            type="date"
            className={inputClass}
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="ge-fisica-fim">
            Destinação fim
          </label>
          <input
            id="ge-fisica-fim"
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
            void carregar(di, df);
          }}
        >
          Mês atual
        </button>
        <button
          type="button"
          className={btnPrimary}
          disabled={loading || !dataInicio || !dataFim || dataFim < dataInicio}
          onClick={() => void carregar(dataInicio, dataFim)}
        >
          Filtrar
        </button>
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
              tone="cyan"
              titulo="Destinações"
              valor={fmtNum(k.qtdeDestinacoes)}
              detalhe={k.qtdeEmConferencia > 0 ? `${fmtNum(k.qtdeEmConferencia)} em aberto` : undefined}
              icone={<Send className="h-4 w-4" strokeWidth={2.2} />}
              onClick={() => setAbertura({ recorte: { tipo: 'destinacoes' } })}
            />
            <KpiCard
              tone="emerald"
              titulo="Conferidas e finalizadas"
              valor={fmtNum(k.qtdeFinalizadas)}
              icone={<ClipboardCheck className="h-4 w-4" strokeWidth={2.2} />}
              onClick={() => setAbertura({ recorte: { tipo: 'finalizadas' } })}
            />
            <KpiCard
              tone="amber"
              titulo="Taxa de divergência"
              valor={fmtTaxaDivergencia(k.taxaDivergencia)}
              detalhe={
                k.qtdeFinalizadas > 0
                  ? `${fmtNum(k.qtdeDivergencias)} de ${fmtNum(k.qtdeFinalizadas)}`
                  : undefined
              }
              icone={<Percent className="h-4 w-4" strokeWidth={2.2} />}
              onClick={() => setAbertura({ recorte: { tipo: 'divergencia' } })}
            />
            <KpiCard
              tone="violet"
              titulo="Lead time"
              valor={fmtHorasConferencia(k.leadTimeMedianoHoras)}
              detalhe={
                k.leadTimeMedioHoras != null ? `média ${fmtHorasConferencia(k.leadTimeMedioHoras)}` : undefined
              }
              icone={<Timer className="h-4 w-4" strokeWidth={2.2} />}
              onClick={() => setAbertura({ recorte: { tipo: 'leadtime' } })}
            />
          </div>

          <div className={`flex flex-col p-4 ${panelSurface}`}>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Evolução — destinações vs finalizadas
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {pico
                    ? `Pico de destinações em ${pico.label}: ${fmtNum(pico.destinacoes)}, ${fmtNum(pico.finalizadas)} já finalizadas.`
                    : 'Sem destinação no período.'}{' '}
                  A data é a da destinação. Clique na bolinha para abrir as voltas.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#5C92D6] shadow-[0_0_8px_#5C92D6]" />
                    Destinações
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#00A859] shadow-[0_0_8px_#00A859]" />
                    Finalizadas
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
                <p className="py-16 text-center text-sm text-slate-400">Sem destinação no período.</p>
              ) : (
                <ResponsiveContainer>
                  <LineChart
                    data={serieChart}
                    margin={{ top: 18, right: 12, left: 0, bottom: 0 }}
                    onClick={(state) => {
                      const ponto = (state as { activePayload?: Array<{ payload?: Ponto }> } | undefined)
                        ?.activePayload?.[0]?.payload;
                      if (ponto) abrirPonto(ponto);
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
                    <Tooltip
                      content={({ active, payload }) => {
                        const ponto = payload?.[0]?.payload as Ponto | undefined;
                        if (!active || !ponto) return null;
                        return (
                          <div className="rounded-xl border border-slate-200/80 bg-white/95 px-3 py-2 text-xs shadow-xl backdrop-blur dark:border-white/10 dark:bg-[#12141c]/95">
                            <p className="mb-1 font-medium text-slate-400">{ponto.label}</p>
                            <p className="text-slate-800 dark:text-slate-100">
                              {fmtNum(ponto.destinacoes)}{' '}
                              {ponto.destinacoes === 1 ? 'destinação' : 'destinações'}, {fmtNum(ponto.finalizadas)}{' '}
                              {ponto.finalizadas === 1 ? 'finalizada' : 'finalizadas'}.
                            </p>
                          </div>
                        );
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="destinacoes"
                      name="Destinações"
                      stroke={COR_DESTINACOES}
                      strokeWidth={2.5}
                      style={{ filter: 'drop-shadow(0 0 4px rgba(92,146,214,0.65))' }}
                      dot={(props) => (
                        <Bolinha
                          cx={props.cx}
                          cy={props.cy}
                          payload={props.payload as Ponto}
                          fill={COR_DESTINACOES}
                          onAbrir={abrirPonto}
                        />
                      )}
                      activeDot={(props) => (
                        <Bolinha
                          cx={props.cx}
                          cy={props.cy}
                          payload={props.payload as Ponto}
                          fill={COR_DESTINACOES}
                          r={6}
                          onAbrir={abrirPonto}
                        />
                      )}
                    />
                    <Line
                      type="monotone"
                      dataKey="finalizadas"
                      name="Finalizadas"
                      stroke={COR_RETORNOS}
                      strokeWidth={2.5}
                      style={{ filter: 'drop-shadow(0 0 4px rgba(0,168,89,0.55))' }}
                      dot={(props) => (
                        <Bolinha
                          cx={props.cx}
                          cy={props.cy}
                          payload={props.payload as Ponto}
                          fill={COR_RETORNOS}
                          onAbrir={abrirPonto}
                        />
                      )}
                      activeDot={(props) => (
                        <Bolinha
                          cx={props.cx}
                          cy={props.cy}
                          payload={props.payload as Ponto}
                          fill={COR_RETORNOS}
                          r={6}
                          onAbrir={abrirPonto}
                        />
                      )}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className={`p-4 ${panelSurface}`}>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Conferentes</h2>
              <p className="mb-4 mt-0.5 text-xs text-slate-500">
                A barra é o volume de destinações. O texto diz em qual das 3 chances ele mais acerta a quantidade.
              </p>
              {barras.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Nenhuma destinação no período.</p>
              ) : (
                <ul className="space-y-3.5">
                  {barras.map((item, index) => {
                    const pct = Math.max(4, Math.min(100, (item.valor / maxBarra) * 100));
                    return (
                      <li key={item.key}>
                        <button
                          type="button"
                          className="w-full rounded-lg text-left transition hover:bg-slate-100/80 dark:hover:bg-white/[0.04]"
                          onClick={() => setAbertura({ recorte: { tipo: 'conferente', nome: item.label } })}
                        >
                          <span className="mb-1.5 flex min-w-0 flex-col gap-0.5 text-xs">
                            <span className="flex min-w-0 items-center gap-2">
                              <span className="w-4 shrink-0 tabular-nums text-[11px] font-semibold text-slate-400">
                                {index + 1}
                              </span>
                              <span className="truncate font-medium text-slate-700 dark:text-slate-100">
                                {item.label}
                              </span>
                            </span>
                            <span className="pl-6 text-slate-500">{item.detalhe}</span>
                          </span>
                          <span className="block h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/[0.06]">
                            <span
                              className="block h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 shadow-[0_0_12px_rgba(56,189,248,0.4)]"
                              style={{ width: `${pct}%` }}
                            />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
          </div>
        </div>
      )}

      {abertura && painel && (
        <GestaoEntradasConferenciaFisicaModal
          recorte={abertura.recorte}
          rotulo={abertura.rotulo}
          dataInicio={painel.dataInicio}
          dataFim={painel.dataFim}
          cacheRef={cacheRef}
          onClose={() => setAbertura(null)}
        />
      )}
    </div>
  );
}
