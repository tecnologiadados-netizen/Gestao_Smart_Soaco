import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Cell,
  Legend,
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
import GestaoEntradasDiaModal from './GestaoEntradasDiaModal';

const cardSurface =
  'border border-slate-200 bg-white shadow-sm dark:border-white/[0.08] dark:bg-[linear-gradient(180deg,#2a2d3d_0%,#1b1e2b_100%)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]';

const MOVIMENTO_COLORS = ['#1E22AA', '#0891B2', '#0D9488'];
const DIVERGENCIA_COLORS = ['#DC2626', '#F97316', '#F59E0B'];

const inputClass =
  'rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100';
const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1';
const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50';
const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50';

type Granularidade = 'dia' | 'mes';
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

function KpiCard({ titulo, valor, sub }: { titulo: string; valor: string; sub?: string }) {
  return (
    <div className={`rounded-xl p-4 ${cardSurface}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{titulo}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{valor}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p> : null}
    </div>
  );
}

/** 0 = pior (vermelho), 100 = melhor (azul padrão do sistema). */
function corAnelPorPercentual(percent: number): string {
  const p = Math.min(100, Math.max(0, percent)) / 100;
  const stops: Array<{ t: number; c: [number, number, number] }> = [
    { t: 0, c: [239, 68, 68] },
    { t: 0.35, c: [249, 115, 22] },
    { t: 0.55, c: [234, 179, 8] },
    { t: 0.75, c: [59, 66, 212] },
    { t: 1, c: [30, 34, 170] },
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

function GaugeDivergencia({ percent, detalhe }: { percent: number | null; detalhe: string }) {
  const p = percent != null ? Math.min(100, Math.max(0, percent)) : 0;
  const cor = percent != null ? corAnelPorPercentual(p) : '#64748b';
  const cx = 100;
  const cy = 100;
  const r = 68;
  const circ = 2 * Math.PI * r;
  const dash = percent != null ? (p / 100) * circ : 0;

  return (
    <div
      className={`flex h-full flex-col rounded-2xl p-4 ${cardSurface}`}
      style={{ boxShadow: percent != null ? `0 0 36px ${cor}33` : undefined }}
    >
      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">% sem divergência</h2>
      <p className="mb-1 text-xs text-slate-500 dark:text-slate-400">Entre as entradas conferidas. Quanto mais baixo, pior.</p>
      <svg viewBox="0 0 200 200" className="mx-auto w-full max-w-[240px]" role="img" aria-label="Percentual de entradas conferidas sem divergência">
        <defs>
          <filter id="ge-anel-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#3a3e52" strokeWidth="12" />
        {percent != null && p > 0 && (
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={cor}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            transform={`rotate(135 ${cx} ${cy})`}
            filter="url(#ge-anel-glow)"
          />
        )}
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill={cor}
          fontSize="34"
          fontWeight="700"
        >
          {percent != null ? `${fmtNum(p, 0)}%` : '—'}
        </text>
      </svg>
      <p className="mt-1 text-center text-xs text-slate-400">{detalhe}</p>
    </div>
  );
}

function BarrasRanking({
  itens,
  vazio,
}: {
  itens: Array<{ key: string; label: string; detalhe: string; valor: number }>;
  vazio: string;
}) {
  if (itens.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">{vazio}</p>;
  }
  const max = itens[0]?.valor || 1;
  return (
    <ul className="space-y-3">
      {itens.map((item) => {
        const pct = Math.max(0, Math.min(100, (item.valor / max) * 100));
        return (
          <li key={item.key}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                {item.label}
              </span>
              <span className="shrink-0 tabular-nums text-slate-500">{item.detalhe}</span>
            </div>
            <div className="h-3.5 overflow-hidden rounded-[4px] bg-slate-200 dark:bg-[#10131c]">
              <div
                className="h-full min-w-1 rounded-[4px] bg-primary-600"
                style={{
                  width: `${pct}%`,
                }}
              />
            </div>
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
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-slate-500">{ponto.label}</p>
      <p className="text-[#1E22AA]">{fraseTooltipEntradas(ponto.notas, ponto.aceitas)}</p>
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
      stroke="#fff"
      strokeWidth={1}
      style={{ cursor: 'pointer' }}
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
  const [contextoMovimentacao, setContextoMovimentacao] =
    useState<ContextoMovimentacao>('volume');

  const carregar = useCallback(async (di: string, df: string) => {
    setLoading(true);
    setErro(null);
    try {
      const r = await fetchGestaoEntradasPainel({ dataInicio: di, dataFim: df });
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
    void carregar(di, df);
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
      detalhe: `${c.qtde} · ${c.aceitas} aceitas · ${c.recusas} recusas`,
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
  const totalTiposMaisUsados = tiposMaisUsados.reduce(
    (total, tipo) => total + valorTipo(tipo),
    0
  );
  const coresMovimentacao =
    contextoMovimentacao === 'volume' ? MOVIMENTO_COLORS : DIVERGENCIA_COLORS;

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col px-3 py-4 md:px-4">
      <CarregandoInformacoesOverlay show={loading} mensagem="Carregando Gestão entradas…" mode="viewport" />
      <div className="mx-auto w-full max-w-[1920px] space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <KpiPainelVoltarLink painelId="gestao-entradas" />
            <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Gestão entradas</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Acuracidade das notas de entrada por data de entrada
            </p>
          </div>
          <ComoLerBtn onClick={() => setAjudaAberta(true)} title="Como ler Gestão entradas" />
        </header>

        <div className={`flex flex-wrap items-end gap-3 rounded-xl px-4 py-3 ${cardSurface}`}>
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
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-500">Gráfico:</span>
            <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600">
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-medium ${
                  granularidade === 'dia'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
                onClick={() => setGranularidade('dia')}
              >
                Dia
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-medium ${
                  granularidade === 'mes'
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
                onClick={() => setGranularidade('mes')}
              >
                Mês
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
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard titulo="Total de entradas" valor={fmtNum(k.qtdeNotas)} />
              <KpiCard titulo="Total de entradas conferidas" valor={fmtNum(k.qtdeConferidas)} />
              <KpiCard titulo="Total de entradas pendentes" valor={fmtNum(k.qtdePendentes)} />
              <KpiCard titulo="Média de entradas ao dia" valor={fmtNum(k.mediaNotasPorDia, 1)} />
            </div>

            <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-3">
              <GaugeDivergencia
                percent={k.qtdeConferidas > 0 ? (k.qtdeLimpas / k.qtdeConferidas) * 100 : null}
                detalhe={
                  k.qtdeConferidas > 0
                    ? `${fmtNum(k.qtdeLimpas)} de ${fmtNum(k.qtdeConferidas)} conferidas sem divergência`
                    : 'Nenhuma entrada conferida no período'
                }
              />
              <div className={`rounded-xl p-4 xl:col-span-2 ${cardSurface}`}>
                <h2 className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Entradas {granularidade === 'dia' ? 'ao dia' : 'ao mês'}
                </h2>
                <p className="mb-3 text-xs text-slate-500">
                  Azul: total de notas. Âmbar: divergência aceita que ainda existe na NF × PC. Clique na bolinha para ver as entradas.
                </p>
                <div className="h-72 w-full">
                  {serieChart.length === 0 ? (
                    <p className="py-16 text-center text-sm text-slate-400">Sem entradas no período.</p>
                  ) : (
                    <ResponsiveContainer>
                      <LineChart
                        data={serieChart}
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                        onClick={(state) => {
                          const ponto = state?.activePayload?.[0]?.payload as SeriePonto | undefined;
                          if (ponto) setPontoAberto(ponto);
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 11 }} width={36} allowDecimals={false} />
                        <Tooltip content={<TooltipEntradasDia />} />
                        <Legend
                          wrapperStyle={{ fontSize: 12 }}
                          formatter={(value) => (
                            <span className="text-slate-600 dark:text-slate-300">{value}</span>
                          )}
                        />
                        <Line
                          type="monotone"
                          dataKey="notas"
                          name="Entradas"
                          stroke="#1E22AA"
                          strokeWidth={2}
                          dot={(props) => (
                            <BolinhaDia
                              cx={props.cx}
                              cy={props.cy}
                              payload={props.payload as SeriePonto}
                              fill="#1E22AA"
                              onAbrir={setPontoAberto}
                            />
                          )}
                          activeDot={(props) => (
                            <BolinhaDia
                              cx={props.cx}
                              cy={props.cy}
                              payload={props.payload as SeriePonto}
                              fill="#1E22AA"
                              r={6}
                              onAbrir={setPontoAberto}
                            />
                          )}
                        />
                        <Line
                          type="monotone"
                          dataKey="aceitas"
                          name="Divergência aceita"
                          stroke="#F59E0B"
                          strokeWidth={2}
                          dot={(props) => (
                            <BolinhaDia
                              cx={props.cx}
                              cy={props.cy}
                              payload={props.payload as SeriePonto}
                              fill="#F59E0B"
                              onAbrir={setPontoAberto}
                            />
                          )}
                          activeDot={(props) => (
                            <BolinhaDia
                              cx={props.cx}
                              cy={props.cy}
                              payload={props.payload as SeriePonto}
                              fill="#F59E0B"
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
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className={`rounded-xl p-4 ${cardSurface}`}>
                <h2 className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Tipos de divergência
                </h2>
                <p className="mb-3 text-xs text-slate-500">Decisões das notas já conferidas, por campo.</p>
                <BarrasRanking itens={campos} vazio="Nenhuma divergência decidida no período." />
              </div>
              <div className={`rounded-xl p-4 ${cardSurface}`}>
                <h2 className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Motivos das divergências aceitas
                </h2>
                <p className="mb-3 text-xs text-slate-500">Justificativa escolhida ao aceitar o campo.</p>
                <BarrasRanking itens={justificativas} vazio="Nenhuma divergência aceita no período." />
              </div>
            </div>

            <div className={`rounded-xl p-4 ${cardSurface}`}>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {contextoMovimentacao === 'volume'
                      ? '3 tipos de movimentação mais usados'
                      : '3 tipos com mais divergências'}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {contextoMovimentacao === 'volume'
                      ? 'Participação das NFs entre os três tipos com maior volume.'
                      : 'NFs conferidas que ainda divergem do pedido, por tipo de movimentação.'}
                  </p>
                </div>
                <div className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-1 dark:border-white/10 dark:bg-black/20">
                  <button
                    type="button"
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      contextoMovimentacao === 'volume'
                        ? 'bg-[#1E22AA] text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-white/5'
                    }`}
                    onClick={() => setContextoMovimentacao('volume')}
                  >
                    Mais usadas
                  </button>
                  <button
                    type="button"
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      contextoMovimentacao === 'divergencias'
                        ? 'bg-red-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-white/5'
                    }`}
                    onClick={() => setContextoMovimentacao('divergencias')}
                  >
                    Mais divergências
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
                  <div className="grid min-h-72 items-center gap-6 md:grid-cols-[minmax(280px,0.9fr)_minmax(320px,1.1fr)]">
                    <div className="relative mx-auto h-64 w-full max-w-sm">
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
                            innerRadius={68}
                            outerRadius={104}
                            paddingAngle={4}
                            cornerRadius={7}
                            stroke="rgba(255,255,255,0.16)"
                            strokeWidth={2}
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

                    <ol className="space-y-3">
                      {tiposMaisUsados.map((tipo, i) => {
                        const valor = valorTipo(tipo);
                        const percentual =
                          totalTiposMaisUsados > 0 ? (valor / totalTiposMaisUsados) * 100 : 0;
                        return (
                          <li
                            key={tipo.idTipoMovimentacao}
                            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3 dark:border-white/[0.08] dark:bg-black/15"
                          >
                            <span
                              className="h-10 w-1.5 shrink-0 rounded-sm"
                              style={{ backgroundColor: coresMovimentacao[i] }}
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
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}
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
          onClose={() => setPontoAberto(null)}
        />
      )}
    </div>
  );
}
