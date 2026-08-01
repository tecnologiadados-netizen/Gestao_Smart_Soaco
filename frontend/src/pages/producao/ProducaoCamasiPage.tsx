import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  fetchCamasiDashboard,
  type CamasiDashboardResponse,
  type CamasiDiasResponse,
} from '../../api/producaoCamasi';
import { useTheme } from '../../contexts/ThemeContext';
import { getChartTheme } from '../../utils/painelProducaoFormat';
import ModalCamasiDias, { type CamasiDiasModalParams } from '../../components/producao/ModalCamasiDias';
import {
  formatHoras,
  formatYmdBr,
  hojeYmd,
  mesesAtrasYmd,
} from '../../components/producao/camasiFormat';

type Filtros = { dataIni: string; dataFim: string };

function filtroDefault(): Filtros {
  return { dataIni: mesesAtrasYmd(12), dataFim: hojeYmd() };
}

function KpiCard({
  title,
  value,
  sub,
  loading,
}: {
  title: string;
  value: string;
  sub: string;
  loading?: boolean;
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
    <div className="card-panel p-4">
      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{title}</p>
      <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-slate-50">
        {value}
      </p>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{sub}</p>
    </div>
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

  const detalheCacheRef = useRef(new Map<string, CamasiDiasResponse>());
  const [modalParams, setModalParams] = useState<CamasiDiasModalParams | null>(null);

  const carregar = useCallback(async (f: Filtros) => {
    setLoading(true);
    setErro(null);
    try {
      const res = await fetchCamasiDashboard(f.dataIni, f.dataFim);
      setData(res);
    } catch (e) {
      setData(null);
      setErro(e instanceof Error ? e.message : 'Erro ao carregar dashboard Camasi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar(filtros);
  }, [carregar, filtros]);

  const filtrosPendentes = useMemo(
    () => draft.dataIni !== filtros.dataIni || draft.dataFim !== filtros.dataFim,
    [draft, filtros]
  );

  const aplicarFiltros = useCallback(() => {
    if (draft.dataIni > draft.dataFim) {
      setErro('Data início deve ser menor ou igual à data fim.');
      return;
    }
    detalheCacheRef.current.clear();
    setModalParams(null);
    setFiltros({ ...draft });
  }, [draft]);

  const abrirMes = useCallback(
    (mes: string, tipo: 'producao' | 'parado') => {
      setModalParams({
        dataIni: filtros.dataIni,
        dataFim: filtros.dataFim,
        mes,
        tipo,
      });
    },
    [filtros]
  );

  const chartProducao = useMemo(
    () =>
      (data?.porMes ?? []).map((m) => ({
        mes: m.mes,
        label: m.label,
        horas: m.horasProducao,
      })),
    [data]
  );

  const chartParado = useMemo(
    () =>
      (data?.porMes ?? []).map((m) => ({
        mes: m.mes,
        label: m.label,
        horas: m.horasParado,
      })),
    [data]
  );

  const motivosDisplay = (data?.motivos ?? []).slice(0, 15);
  const maxMotivo = Math.max(...motivosDisplay.map((m) => m.horas), 1);
  const pecasDisplay = (data?.pecas ?? []).slice(0, 20);
  const maxPeca = Math.max(
    ...pecasDisplay.map((p) => p.horasProducao + p.horasParado),
    1
  );

  const kpis = data?.kpis;

  return (
    <div className="px-4 py-5 md:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Produção Camasi
          </h1>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            Tempo de produção e paradas da máquina
            {data
              ? ` · ${formatYmdBr(data.dataIni)} a ${formatYmdBr(data.dataFim)}`
              : ''}
          </p>
          {filtrosPendentes && (
            <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              Filtros alterados — clique em Filtrar para atualizar os indicadores.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-600 dark:text-slate-300">
              Início
              <input
                value={draft.dataIni}
                onChange={(e) => setDraft((d) => ({ ...d, dataIni: e.target.value }))}
                type="date"
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
            <label className="text-xs text-slate-600 dark:text-slate-300">
              Fim
              <input
                value={draft.dataFim}
                onChange={(e) => setDraft((d) => ({ ...d, dataFim: e.target.value }))}
                type="date"
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={aplicarFiltros}
            className="h-9 rounded-md bg-primary-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700"
          >
            Filtrar
          </button>
          <button
            type="button"
            onClick={() => void carregar(filtros)}
            disabled={loading}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {loading ? 'Atualizando…' : 'Atualizar'}
          </button>
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
          title="Produção"
          value={formatHoras(kpis?.horasProducao ?? 0)}
          sub="Horas em produção no período"
        />
        <KpiCard
          loading={loading}
          title="Parado"
          value={formatHoras(kpis?.horasParado ?? 0)}
          sub="Horas parado no período"
        />
        <KpiCard
          loading={loading}
          title="Disponibilidade"
          value={
            kpis?.disponibilidadePct != null
              ? `${new Intl.NumberFormat('pt-BR', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                }).format(kpis.disponibilidadePct)}%`
              : '—'
          }
          sub="Produção ÷ (produção + parado)"
        />
        <KpiCard
          loading={loading}
          title="Eventos de parada"
          value={new Intl.NumberFormat('pt-BR').format(kpis?.qtdeParadas ?? 0)}
          sub="Registros com tempo parado"
        />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <div className="card-panel p-5">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white">
              Produção por mês
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Clique na barra para ver o detalhe por dia
            </p>
          </div>
          {loading ? (
            <div className="flex h-[280px] items-center justify-center text-slate-500">Carregando…</div>
          ) : chartProducao.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center text-slate-500">Sem dados.</div>
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartProducao} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: chartTheme.tick, fontSize: 11 }} axisLine={{ stroke: chartTheme.axis }} />
                  <YAxis
                    tick={{ fill: chartTheme.tick, fontSize: 11 }}
                    axisLine={{ stroke: chartTheme.axis }}
                    tickFormatter={(v) => `${v}`}
                  />
                  <Tooltip
                    contentStyle={chartTheme.tooltip}
                    formatter={(value) => [formatHoras(Number(value)), 'Produção']}
                    labelFormatter={(label) => String(label)}
                  />
                  <Bar
                    dataKey="horas"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(data) => {
                      const payload = data as { mes?: string; payload?: { mes?: string } };
                      const mes = payload?.mes ?? payload?.payload?.mes;
                      if (mes) abrirMes(mes, 'producao');
                    }}
                  >
                    {chartProducao.map((entry) => (
                      <Cell key={entry.mes} fill={isDark ? '#34d399' : '#059669'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card-panel p-5">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white">
              Parado por mês
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Clique na barra para ver o detalhe por dia
            </p>
          </div>
          {loading ? (
            <div className="flex h-[280px] items-center justify-center text-slate-500">Carregando…</div>
          ) : chartParado.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center text-slate-500">Sem dados.</div>
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartParado} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: chartTheme.tick, fontSize: 11 }} axisLine={{ stroke: chartTheme.axis }} />
                  <YAxis
                    tick={{ fill: chartTheme.tick, fontSize: 11 }}
                    axisLine={{ stroke: chartTheme.axis }}
                    tickFormatter={(v) => `${v}`}
                  />
                  <Tooltip
                    contentStyle={chartTheme.tooltip}
                    formatter={(value) => [formatHoras(Number(value)), 'Parado']}
                    labelFormatter={(label) => String(label)}
                  />
                  <Bar
                    dataKey="horas"
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                    onClick={(data) => {
                      const payload = data as { mes?: string; payload?: { mes?: string } };
                      const mes = payload?.mes ?? payload?.payload?.mes;
                      if (mes) abrirMes(mes, 'parado');
                    }}
                  >
                    {chartParado.map((entry) => (
                      <Cell key={entry.mes} fill={isDark ? '#fbbf24' : '#d97706'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <div className="card-panel flex min-h-[380px] flex-col p-5">
          <div className="mb-4 shrink-0">
            <h3 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white">
              Motivos de parada
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Horas paradas por motivo
            </p>
          </div>
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-slate-500">Carregando…</div>
          ) : motivosDisplay.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-slate-500">Sem paradas no período.</div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
              {motivosDisplay.map((m) => {
                const pctBar = (m.horas / maxMotivo) * 100;
                return (
                  <div
                    key={m.motivo}
                    className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_auto] items-center gap-3"
                  >
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
                      <span className="relative z-10 flex h-full items-center px-2 text-[11px] font-semibold text-slate-800 dark:text-slate-100">
                        {formatHoras(m.horas)}
                      </span>
                    </div>
                    <div className="min-w-[4.5rem] text-right text-[11px] text-slate-500 dark:text-slate-400">
                      {m.pct.toFixed(1).replace('.', ',')}% · {m.qtde}x
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card-panel flex min-h-[380px] flex-col p-5">
          <div className="mb-4 shrink-0">
            <h3 className="text-sm font-semibold text-soaco-navy dark:text-soaco-white">
              Por peça
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Produção e parado por peça (NOME_OPERADOR)
            </p>
          </div>
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-slate-500">Carregando…</div>
          ) : pecasDisplay.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-slate-500">Sem dados.</div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-white dark:bg-slate-900">
                  <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="pb-2 pr-2 font-semibold">Peça</th>
                    <th className="pb-2 pr-2 text-right font-semibold">Produção</th>
                    <th className="pb-2 pr-2 text-right font-semibold">Parado</th>
                    <th className="pb-2 font-semibold">Mix</th>
                  </tr>
                </thead>
                <tbody>
                  {pecasDisplay.map((p) => {
                    const total = p.horasProducao + p.horasParado;
                    const pctBar = (total / maxPeca) * 100;
                    const pctProd = total > 0 ? (p.horasProducao / total) * 100 : 0;
                    return (
                      <tr
                        key={p.peca}
                        className="border-b border-slate-100 dark:border-slate-800"
                      >
                        <td className="max-w-[10rem] truncate py-2 pr-2 font-medium text-slate-700 dark:text-slate-200" title={p.peca}>
                          {p.peca}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums text-emerald-700 dark:text-emerald-300">
                          {formatHoras(p.horasProducao)}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums text-amber-700 dark:text-amber-300">
                          {formatHoras(p.horasParado)}
                        </td>
                        <td className="py-2">
                          <div className="relative h-5 w-28 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                            <div
                              className="absolute inset-y-0 left-0 bg-emerald-500/80 dark:bg-emerald-400/70"
                              style={{ width: `${(pctBar * pctProd) / 100}%` }}
                            />
                            <div
                              className="absolute inset-y-0 bg-amber-500/80 dark:bg-amber-400/70"
                              style={{
                                left: `${(pctBar * pctProd) / 100}%`,
                                width: `${(pctBar * (100 - pctProd)) / 100}%`,
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ModalCamasiDias
        open={!!modalParams}
        params={modalParams}
        cacheRef={detalheCacheRef}
        onClose={() => setModalParams(null)}
      />
    </div>
  );
}
