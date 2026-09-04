import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { LayoutDashboard, X } from 'lucide-react';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import {
  fetchDoubleCheckInDashboard,
  type DoubleCheckInDashboard,
} from '../../api/compras';

const PIE_COLORS = ['#1E22AA', '#0d9488', '#F59E0B', '#EF4444', '#8B5CF6', '#64748B', '#EC4899'];

const inputClass =
  'rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100';
const labelClass = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1';
const btnPrimary =
  'inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50';
const btnSecondary =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50';

function inicioMesYmd(ref = new Date()): string {
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-01`;
}

function hojeYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDataBr(ymd: string | null | undefined): string {
  if (!ymd) return '—';
  const [y, m, d] = ymd.slice(0, 10).split('-');
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

function fmtNum(n: number | null | undefined, digitos = 1): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', {
    maximumFractionDigits: digitos,
    minimumFractionDigits: digitos > 0 ? Math.min(digitos, 1) : 0,
  });
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const sinal = n > 0 ? '+' : '';
  return `${sinal}${n.toFixed(1).replace('.', ',')}%`;
}

type Granularidade = 'dia' | 'mes';

type Props = {
  aberto: boolean;
  onClose: () => void;
};

function KpiCard({
  titulo,
  valor,
  sub,
}: {
  titulo: string;
  valor: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800/80">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {titulo}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{valor}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</p> : null}
    </div>
  );
}

function GaugeConferencia({ percent }: { percent: number | null }) {
  const r = 58;
  const c = 2 * Math.PI * r;
  const p = percent != null ? Math.min(100, Math.max(0, percent)) : 0;
  const dash = (p / 100) * c;
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-800/80">
      <h3 className="mb-2 w-full self-start text-sm font-semibold text-slate-800 dark:text-slate-100">
        % Conferência
      </h3>
      <div className="relative" style={{ width: 160, height: 160 }}>
        <svg width={160} height={160} viewBox="0 0 140 140" className="-rotate-90">
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            className="text-slate-100 dark:text-slate-700"
          />
          {percent != null && (
            <circle
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke="url(#dciGaugeGrad)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c}`}
              className="transition-all duration-700 ease-out"
            />
          )}
          <defs>
            <linearGradient id="dciGaugeGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="rgb(16 185 129)" />
              <stop offset="100%" stopColor="rgb(30 34 170)" />
            </linearGradient>
          </defs>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-1">
          <span className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {percent != null ? `${fmtNum(percent, 1)}%` : '—'}
          </span>
          <span className="mt-0.5 px-2 text-center text-[11px] text-slate-500">Conferidas ÷ total</span>
        </div>
      </div>
    </div>
  );
}

function agregarSeriePorMes(
  serie: DoubleCheckInDashboard['serieDiaria']
): Array<{ label: string; key: string; notas: number; itens: number; variacaoNotasPct: number | null }> {
  const map = new Map<string, { notas: number; itens: number }>();
  for (const d of serie) {
    const key = d.data.slice(0, 7);
    const cur = map.get(key) ?? { notas: 0, itens: 0 };
    cur.notas += d.notas;
    cur.itens += d.itens;
    map.set(key, cur);
  }
  const keys = [...map.keys()].sort();
  let prev: number | null = null;
  return keys.map((key) => {
    const { notas, itens } = map.get(key)!;
    const [y, m] = key.split('-');
    let variacaoNotasPct: number | null = null;
    if (prev != null && prev !== 0) variacaoNotasPct = ((notas - prev) / prev) * 100;
    else if (prev === 0 && notas > 0) variacaoNotasPct = 100;
    prev = notas;
    return {
      key,
      label: `${m}/${y}`,
      notas,
      itens,
      variacaoNotasPct,
    };
  });
}

export default function DoubleCheckInDashboardModal({ aberto, onClose }: Props) {
  const [dataInicio, setDataInicio] = useState(inicioMesYmd());
  const [dataFim, setDataFim] = useState(hojeYmd());
  const [granularidade, setGranularidade] = useState<Granularidade>('dia');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dash, setDash] = useState<DoubleCheckInDashboard | null>(null);

  const carregar = useCallback(async (di: string, df: string) => {
    setLoading(true);
    setErro(null);
    try {
      const r = await fetchDoubleCheckInDashboard({ dataInicio: di, dataFim: df });
      if (r.erro || !r.data) {
        setErro(r.erro ?? 'Falha ao carregar dashboard.');
        setDash(null);
        return;
      }
      setDash(r.data);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
      setDash(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const di = inicioMesYmd();
    const df = hojeYmd();
    setDataInicio(di);
    setDataFim(df);
    setGranularidade('dia');
    void carregar(di, df);
  }, [aberto, carregar]);

  const serieChart = useMemo(() => {
    if (!dash) return [];
    if (granularidade === 'mes') return agregarSeriePorMes(dash.serieDiaria);
    return dash.serieDiaria.map((d) => ({
      key: d.data,
      label: fmtDataBr(d.data),
      notas: d.notas,
      itens: d.itens,
      variacaoNotasPct: d.variacaoNotasPct,
    }));
  }, [dash, granularidade]);

  if (!aberto || typeof document === 'undefined') return null;

  const k = dash?.kpis;

  return createPortal(
    <div
      className="fixed inset-0 z-[10070] flex flex-col bg-slate-100 dark:bg-slate-950"
      role="dialog"
      aria-modal="true"
      aria-label="Dashboard Double Check NFe"
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Dashboard Double Check NFe
            </h2>
            <p className="text-xs text-slate-500">Indicadores por data de entrada (padrão: mês corrente)</p>
          </div>
        </div>
        <button type="button" className={btnSecondary} onClick={onClose} aria-label="Fechar">
          <X className="h-4 w-4" />
          Fechar
        </button>
      </header>

      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className={labelClass}>Entrada início</label>
            <input
              type="date"
              className={inputClass}
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Entrada fim</label>
            <input
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
            <span className="text-xs text-slate-500">Gráficos de tempo:</span>
            <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden">
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
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto p-4">
        <CarregandoInformacoesOverlay show={loading} mode="contained" />
        {erro && (
          <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
            {erro}
          </p>
        )}

        {dash && k && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
              <KpiCard titulo="NFs lançadas" valor={fmtNum(k.qtdeNotas, 0)} />
              <KpiCard titulo="Itens lançados" valor={fmtNum(k.qtdeItens, 0)} />
              <KpiCard
                titulo="Média itens/NF"
                valor={fmtNum(k.mediaItensPorNota, 1)}
              />
              <KpiCard titulo="Conferidas" valor={fmtNum(k.qtdeConferidas, 0)} />
              <KpiCard titulo="Pendentes" valor={fmtNum(k.qtdePendentes, 0)} />
              <KpiCard
                titulo="Com atenção"
                valor={fmtNum(k.qtdeComAtencao, 0)}
                sub={k.pctAtencao != null ? `${fmtNum(k.pctAtencao, 1)}% do total (sync)` : undefined}
              />
              <KpiCard
                titulo="Média NFs/dia"
                valor={fmtNum(k.mediaNotasPorDia, 1)}
                sub={
                  k.tempoMedioConferenciaDias != null
                    ? `Tempo médio conf.: ${fmtNum(k.tempoMedioConferenciaDias, 1)} d`
                    : undefined
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-800/80 xl:col-span-2">
                <h3 className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  NFs lançadas ({granularidade === 'dia' ? 'dia a dia' : 'mês a mês'})
                </h3>
                <p className="mb-3 text-xs text-slate-500">
                  Linha de NFs e variação % vs período anterior
                </p>
                <div className="h-72 w-full">
                  {serieChart.length === 0 ? (
                    <p className="py-16 text-center text-sm text-slate-400">Sem dados no período.</p>
                  ) : (
                    <ResponsiveContainer>
                      <LineChart data={serieChart} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} width={40} allowDecimals={false} />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{ fontSize: 10 }}
                          width={44}
                          tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
                        />
                        <Tooltip
                          formatter={(value, name) => {
                            const n = Number(value);
                            if (name === 'Variação %') return fmtPct(n);
                            return fmtNum(n, 0);
                          }}
                        />
                        <Legend />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="notas"
                          name="NFs"
                          stroke="#1E22AA"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="variacaoNotasPct"
                          name="Variação %"
                          stroke="#F59E0B"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          dot={false}
                          connectNulls={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <GaugeConferencia percent={k.pctConferencia} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-800/80">
                <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  NFs por tipo de movimento
                </h3>
                <div className="h-64 w-full">
                  {(dash.porTipo ?? []).length === 0 ? (
                    <p className="py-16 text-center text-sm text-slate-400">Sem dados.</p>
                  ) : (
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={dash.porTipo}
                          dataKey="notas"
                          nameKey="nomeTipo"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          label={({ name, percent }) =>
                            `${String(name ?? '').slice(0, 16)}${String(name ?? '').length > 16 ? '…' : ''} (${((percent ?? 0) * 100).toFixed(0)}%)`
                          }
                        >
                          {dash.porTipo.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => fmtNum(Number(v), 0)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-800/80">
                <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Top 5 fornecedores (NFs)
                </h3>
                {(dash.topParceiros ?? []).length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-400">Sem dados.</p>
                ) : (
                  <ul className="space-y-2">
                    {dash.topParceiros.map((p, idx) => {
                      const max = dash.topParceiros[0]?.notas || 1;
                      const pct = Math.round((p.notas / max) * 100);
                      return (
                        <li key={`${p.idParceiro ?? 'x'}-${idx}`}>
                          <div className="mb-0.5 flex justify-between gap-2 text-xs">
                            <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                              {p.nomeParceiro ?? `Parceiro ${p.idParceiro ?? '—'}`}
                            </span>
                            <span className="shrink-0 tabular-nums text-slate-500">
                              {p.notas} NF · {p.itens} itens
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                            <div
                              className="h-full rounded-full bg-primary-600"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="mt-4 text-[11px] text-slate-400">
                  “Com atenção” considera NFs já analisadas na sincronização com outlier detectado.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
