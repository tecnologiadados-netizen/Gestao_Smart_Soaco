import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SearchableSelect } from '../../../components/painel-producao/SearchableSelect';
import { MonthFilter } from '../../../components/painel-producao/MonthFilter';
import { ProducaoPedidosKpi } from '../../../components/painel-producao/ProducaoPedidosKpi';
import { PainelProducaoShell } from '../../../components/painel-producao/PainelProducaoShell';
import { useTheme } from '../../../contexts/ThemeContext';
import {
  fetchPainelProducaoDashboard,
  fetchPainelProducaoFilters,
  type PainelProducaoDashboard,
  type PainelProducaoRankingItem,
} from '../../../api/painelProducao';
import { formatMesLabel, formatNumber, formatPercent, getChartTheme } from '../../../utils/painelProducaoFormat';
import { useTelaFavorita } from '../../../hooks/useTelaFavorita';
import { useRegistrarVisaoFavorito } from '../../../hooks/useRegistrarVisaoFavorito';
import {
  isRotaFavoritavel,
  resumoFiltrosFavorito,
  TELAS_FAVORITAVEIS_CFG,
  type RotaFavoritavel,
} from '../../../config/telasFavoritaveis';

interface ChartPoint {
  label: string;
  producao: number;
  meta?: number | null;
}

type RankingItem = PainelProducaoRankingItem;

const DIAS_SEMANA_ABREV = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']

function weekdayAbbr(mes: string, day: number): string {
  const [year, month] = mes.split('-').map(Number)
  if (!year || !month || !day) return ''
  return DIAS_SEMANA_ABREV[new Date(year, month - 1, day).getDay()]
}

interface DayAxisTickProps {
  x?: number | string
  y?: number | string
  payload?: { value?: string | number }
  mes: string
  dark?: boolean
}

function DayAxisTick({ x = 0, y = 0, payload, mes, dark = false }: DayAxisTickProps) {
  const dayLabel = String(payload?.value ?? '')
  const day = Number(dayLabel)
  const weekday = weekdayAbbr(mes, day)
  const weekdayY = 32
  const dayColor = dark ? '#c5cdd8' : '#5a6270'
  const weekdayColor = dark ? '#7a8699' : '#9ca3af'

  return (
    <g transform={`translate(${Number(x)},${Number(y)})`} className="chart-day-tick">
      <text textAnchor="middle" fill={dayColor} fontSize={11} fontWeight={600} dy={9}>
        {dayLabel}
      </text>
      {weekday && (
        <text
          x={0}
          y={weekdayY}
          textAnchor="middle"
          fill={weekdayColor}
          fontSize={9}
          fontWeight={500}
          transform={`rotate(-90, 0, ${weekdayY})`}
        >
          {weekday}
        </text>
      )}
    </g>
  )
}

interface BarValueLabelProps {
  x?: number | string
  y?: number | string
  width?: number | string
  value?: unknown
  color?: string
  fontSize?: number
}

function BarValueLabel({
  x = 0,
  y = 0,
  width = 0,
  value,
  color = '#0a1628',
  fontSize = 12,
}: BarValueLabelProps) {
  const numeric = Number(value ?? 0)
  if (!numeric) return null

  const cx = Number(x) + Number(width) / 2
  const cy = Number(y) - 6

  return (
    <text
      x={cx}
      y={cy}
      fill={color}
      textAnchor="middle"
      fontSize={fontSize}
      fontWeight={700}
      className="bar-value-label"
    >
      {formatNumber(numeric)}
    </text>
  )
}

function KpiIconProduction() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M7 15l4-4 3 3 5-6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function KpiIconMeta() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}

function MetaLineDot({
  cx,
  cy,
  payload,
  metaColor,
  metaHitColor,
}: {
  cx?: number
  cy?: number
  payload?: ChartPoint
  metaColor: string
  metaHitColor: string
}) {
  if (cx == null || cy == null || payload?.meta == null) return null

  const batida = Number(payload.producao) >= Number(payload.meta)
  const color = batida ? metaHitColor : metaColor

  return (
    <circle
      cx={cx}
      cy={cy}
      r={2.5}
      fill={color}
      stroke={color}
      strokeWidth={1}
    />
  )
}

function normalizeChartData(
  data: ChartPoint[] | Record<string, unknown>[],
  labelKey: string,
): ChartPoint[] {
  if (!Array.isArray(data)) return []
  return data.map((item) => {
    const record = item as Record<string, unknown>
    const label =
      String(record.label ?? record[labelKey] ?? record.mes ?? record.dia ?? '')
    const producao = Number(record.producao ?? record.valor ?? record.value ?? 0)
    const rawMeta = record.meta
    const meta =
      rawMeta === null || rawMeta === undefined ? null : Number(rawMeta)
    return { label, producao, meta: Number.isNaN(meta) ? null : meta }
  })
}

const MONTH_CHART_SLOT_PX = 52

function ScrollableMonthChart({
  data,
  comMeta,
  chartTheme,
  scrollKey,
}: {
  data: ChartPoint[]
  comMeta: boolean
  chartTheme: ReturnType<typeof getChartTheme>
  scrollKey: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const chartWidth = Math.max(480, data.length * MONTH_CHART_SLOT_PX)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollLeft = el.scrollWidth - el.clientWidth
  }, [scrollKey, data.length])

  if (data.length === 0) {
    return <p className="state-message">Sem dados mensais.</p>
  }

  return (
    <div className="chart-body-scroll" ref={scrollRef}>
      <div className="chart-scroll-track" style={{ width: chartWidth }}>
        <ResponsiveContainer width={chartWidth} height="100%">
          <ComposedChart data={data} margin={{ top: 22, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: chartTheme.tick }}
              axisLine={{ stroke: chartTheme.axis }}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={52}
            />
            <YAxis
              tick={{ fontSize: 13, fill: chartTheme.tick }}
              axisLine={{ stroke: chartTheme.axis }}
              tickFormatter={(v) => formatNumber(v)}
            />
            <Tooltip
              formatter={(value, name) => {
                const label = name === 'meta' ? 'Meta' : 'Produção'
                return [formatNumber(Number(value ?? 0)), label]
              }}
              labelFormatter={(label) => `Mês: ${label}`}
              contentStyle={chartTheme.tooltip}
            />
            <Bar dataKey="producao" fill={chartTheme.barMonth} radius={[4, 4, 0, 0]}>
              <LabelList
                dataKey="producao"
                content={({ x, y, width, value }) => (
                  <BarValueLabel
                    x={x}
                    y={y}
                    width={width}
                    value={value}
                    color={chartTheme.barMonthLabel}
                    fontSize={11}
                  />
                )}
              />
            </Bar>
            {comMeta && (
              <Line
                type="monotone"
                dataKey="meta"
                name="meta"
                stroke={chartTheme.lineMeta}
                strokeWidth={1.5}
                dot={(props) => (
                  <MetaLineDot
                    {...props}
                    payload={props.payload as ChartPoint}
                    metaColor={chartTheme.lineMeta}
                    metaHitColor={chartTheme.lineMetaHit}
                  />
                )}
                activeDot={{
                  r: 3.5,
                  strokeWidth: 1,
                  fill: chartTheme.lineMetaHit,
                  stroke: chartTheme.lineMetaHit,
                }}
                connectNulls={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function targetColor(cor?: string, percent?: number): 'green' | 'amber' | 'red' {
  if (cor === 'green' || cor === 'amber' || cor === 'red') return cor
  if (percent === undefined) return 'green'
  if (percent >= 80) return 'green'
  if (percent >= 50) return 'amber'
  return 'red'
}

function rankBadgeClass(rank: number): string {
  if (rank === 1) return 'rank-badge top1'
  if (rank === 2) return 'rank-badge top2'
  if (rank === 3) return 'rank-badge top3'
  return 'rank-badge'
}

function PodiumCrown() {
  return (
    <svg className="podium-crown" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M5 16l-1-9 5 4 3-6 3 6 5-4-1 9H5zm1.2 2h11.6l.6 2H5.6l.6-2z" />
    </svg>
  )
}

function RankingPodium({
  ranking,
  selectedSetor,
}: {
  ranking: RankingItem[]
  selectedSetor: string
}) {
  const first = ranking.find((r) => r.ranking === 1)
  const second = ranking.find((r) => r.ranking === 2)
  const third = ranking.find((r) => r.ranking === 3)
  const slots: (RankingItem | undefined)[] = [second, first, third]

  if (!first && !second && !third) return null

  return (
    <div className="ranking-podium" aria-label="Pódio do ranking">
      {slots.map((row, index) => {
        if (!row) {
          return <div key={`empty-${index}`} className="podium-slot podium-slot-empty" />
        }

        const place = row.ranking
        return (
          <div
            key={row.setor}
            className={`podium-slot place-${place}${row.setor === selectedSetor ? ' selected' : ''}`}
          >
            <div className="podium-rank">{place}º</div>
            {place === 1 && <PodiumCrown />}
            <div className="podium-avatar" aria-hidden="true">
              {row.setor.slice(0, 2).toUpperCase()}
            </div>
            <div className="podium-name" title={row.setor}>
              {row.setor}
            </div>
            <div className="podium-pct">{formatPercent(row.percentual_meta)}%</div>
            <div className="podium-prod">{formatNumber(row.producao)} prod.</div>
            <div className="podium-step" aria-hidden="true" />
          </div>
        )
      })}
    </div>
  )
}

function LoadingOverlay({ message = 'Atualizando dados...' }: { message?: string }) {
  return (
    <div className="loading-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="loading-overlay-card">
        <div className="loading-spinner" aria-hidden="true">
          <span className="loading-spinner-ring" />
          <span className="loading-spinner-core" />
        </div>
        <p className="loading-overlay-text">{message}</p>
      </div>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="state-box">
      <p className="state-message error">{message}</p>
    </div>
  )
}

function DashboardFullscreenButton({
  ativo,
  onClick,
}: {
  ativo: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="dashboard-fullscreen-btn"
      title={ativo ? 'Sair da tela cheia' : 'Tela cheia'}
      aria-label={ativo ? 'Sair da tela cheia' : 'Visualizar em tela cheia'}
      aria-pressed={ativo}
    >
      {ativo ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        </svg>
      )}
    </button>
  )
}

function PainelProducaoDashboardPage({ variant = 'gestao' }: { variant?: 'gestao' | 'tv' }) {
  const isTv = variant === 'tv';
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [telaCheia, setTelaCheia] = useState(false);
  const [setores, setSetores] = useState<string[]>([]);
  const [meses, setMeses] = useState<string[]>([]);
  const [setor, setSetor] = useState('');
  const [mes, setMes] = useState('');

  const [filtersLoading, setFiltersLoading] = useState(true);
  const [filtersError, setFiltersError] = useState<string | null>(null);
  const [filtrosProntos, setFiltrosProntos] = useState(false);
  const defaultsRef = useRef({ setor: '', mes: '' });

  const [dashboard, setDashboard] = useState<PainelProducaoDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const chartTheme = getChartTheme(isDark);

  const validarFiltrosPainel = useCallback(
    (raw: Record<string, string>) => {
      const setorV = raw.setor?.trim();
      const mesV = raw.mes?.trim();
      if (!setorV || !mesV) return null;
      if (!setores.includes(setorV) || !meses.includes(mesV)) return null;
      return { setor: setorV, mes: mesV };
    },
    [setores, meses],
  );

  const aplicarFiltrosPainel = useCallback((f: { setor: string; mes: string }) => {
    setSetor(f.setor);
    setMes(f.mes);
  }, []);

  const listasCarregadas = !filtersLoading && setores.length > 0 && meses.length > 0;

  const { resolving, rota, limparFavNaUrl } = useTelaFavorita({
    filtrosAtuais: { setor, mes },
    aplicarFiltros: aplicarFiltrosPainel,
    validarFiltros: validarFiltrosPainel,
    onResolved: () => setFiltrosProntos(true),
    enabled: listasCarregadas,
  });

  const visaoFavorito = useMemo(() => {
    if (!setor || !mes || !isRotaFavoritavel(rota)) return null;
    const cfg = TELAS_FAVORITAVEIS_CFG[rota as RotaFavoritavel];
    const filtros = { setor, mes };
    return {
      rota,
      filtros,
      telaLabel: cfg.label,
      resumoFiltros: resumoFiltrosFavorito(rota, filtros),
    };
  }, [rota, setor, mes]);

  useRegistrarVisaoFavorito(filtrosProntos && !filtersLoading ? visaoFavorito : null);

  useEffect(() => {
    let cancelled = false

    async function loadFilters() {
      setFiltersLoading(true)
      setFiltersError(null)
      setFiltrosProntos(false)
      try {
        const data = await fetchPainelProducaoFilters();
        if (cancelled) return

        setSetores(data.setores ?? [])
        setMeses(data.meses ?? [])

        const defaultSetor =
          data.default_setor && data.setores?.includes(data.default_setor)
            ? data.default_setor
            : data.setores?.[0] ?? ''
        const defaultMes =
          data.default_mes && data.meses?.includes(data.default_mes)
            ? data.default_mes
            : data.meses?.[0] ?? ''
        defaultsRef.current = { setor: defaultSetor, mes: defaultMes }
      } catch (err) {
        if (!cancelled) {
          setFiltersError(
            err instanceof Error ? err.message : 'Falha ao carregar filtros.',
          )
        }
      } finally {
        if (!cancelled) setFiltersLoading(false)
      }
    }

    loadFilters()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!filtrosProntos || resolving) return
    if (setor && mes) return
    const d = defaultsRef.current
    if (d.setor && setores.includes(d.setor)) setSetor(d.setor)
    else if (setores[0]) setSetor(setores[0])
    if (d.mes && meses.includes(d.mes)) setMes(d.mes)
    else if (meses[0]) setMes(meses[0])
  }, [filtrosProntos, resolving, setor, mes, setores, meses])

  const loadDashboard = useCallback(async (selectedSetor: string, selectedMes: string) => {
    if (!selectedSetor || !selectedMes) return

    setDashboardLoading(true)
    setDashboardError(null)
    try {
      const data = await fetchPainelProducaoDashboard(selectedSetor, selectedMes);
      setDashboard(data)
    } catch (err) {
      setDashboard(null)
      setDashboardError(
        err instanceof Error ? err.message : 'Falha ao carregar dados do painel.',
      )
    } finally {
      setDashboardLoading(false)
    }
  }, [])

  useEffect(() => {
    if (setor && mes) loadDashboard(setor, mes)
  }, [setor, mes, loadDashboard])

  const color = targetColor(dashboard?.cor_target, dashboard?.percentual_meta)
  const progressWidth = Math.min(Math.max(dashboard?.percentual_meta ?? 0, 0), 100)
  const semMeta = !!dashboard?.sem_meta
  const porMes = normalizeChartData(dashboard?.por_mes ?? [], 'mes')
  const porMesComMeta = porMes.some((p) => p.meta != null)
  const porDia = normalizeChartData(dashboard?.por_dia ?? [], 'dia')
  const rankingAll = dashboard?.ranking ?? []
  const rankingRest = rankingAll.filter((row) => row.ranking > 3)
  const aguardandoFiltros = filtersLoading || resolving || (listasCarregadas && !filtrosProntos)

  const onSetorChange = useCallback(
    (value: string) => {
      setSetor(value);
      limparFavNaUrl();
    },
    [limparFavNaUrl],
  );

  const onMesChange = useCallback(
    (value: string) => {
      setMes(value);
      limparFavNaUrl();
    },
    [limparFavNaUrl],
  );

  const alternarTelaCheia = useCallback(async () => {
    const el = dashboardRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* navegador pode negar fullscreen */
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setTelaCheia(document.fullscreenElement === dashboardRef.current);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const renderHeader = () => (
    <header className="header">
      <div className="title-bar">
        {dashboard?.titulo ?? `SETOR DE ${(setor || '—').toUpperCase()}`}
      </div>
      <div className="header-side">
        <DashboardFullscreenButton
          ativo={telaCheia}
          onClick={() => void alternarTelaCheia()}
        />
        <div className="filters">
          <SearchableSelect
            id="setor-select"
            label="Setor"
            value={setor}
            options={setores.map((s) => ({ value: s, label: s }))}
            onChange={onSetorChange}
            searchPlaceholder="Pesquisar setor..."
          />
          <MonthFilter
            id="mes-select"
            mes={mes}
            meses={meses}
            onChange={onMesChange}
            onMesesChange={(lista, selected) => {
              setMeses(lista);
              onMesChange(selected);
            }}
            disabled={dashboardLoading}
          />
        </div>
      </div>
    </header>
  );

  if (aguardandoFiltros) {
    return (
      <PainelProducaoShell>
        <div ref={dashboardRef} className={`dashboard${isTv ? ' dashboard-tv' : ''}`}>
          {renderHeader()}
          <LoadingOverlay message="Carregando filtros..." />
        </div>
      </PainelProducaoShell>
    );
  }

  if (filtersError) {
    return (
      <PainelProducaoShell>
        <div ref={dashboardRef} className={`dashboard${isTv ? ' dashboard-tv' : ''}`}>
          {renderHeader()}
          <ErrorState message={filtersError} />
        </div>
      </PainelProducaoShell>
    );
  }

  return (
    <PainelProducaoShell>
    <div ref={dashboardRef} className={`dashboard${isTv ? ' dashboard-tv' : ''}`}>
      {renderHeader()}

      {dashboardLoading && <LoadingOverlay />}

      {dashboardError && !dashboard ? (
        <ErrorState message={dashboardError} />
      ) : dashboard ? (
        <div className={`main-grid${dashboardLoading ? ' is-loading' : ''}`}>
            <div className="card ranking-card">
              <h2>Produção por setor: {dashboard.mes_label ?? formatMesLabel(mes)}</h2>
              <RankingPodium ranking={rankingAll} selectedSetor={setor} />
              {rankingRest.length > 0 && (
                <div className="ranking-table-wrap">
                  <table className="ranking-table">
                    <thead>
                      <tr>
                        <th>Ranking</th>
                        <th>Setor</th>
                        <th>Produção</th>
                        <th>% Meta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankingRest.map((row) => (
                        <tr
                          key={`${row.ranking}-${row.setor}`}
                          className={row.setor === setor ? 'highlight' : undefined}
                        >
                          <td>
                            <span className={rankBadgeClass(row.ranking)}>
                              {row.ranking}
                            </span>
                          </td>
                          <td>{row.setor}</td>
                          <td>{formatNumber(row.producao)}</td>
                          <td>{formatPercent(row.percentual_meta)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div
              className={`left-panel${semMeta ? ' left-panel-no-meta' : ''}${isTv && !semMeta ? ' left-panel-tv' : ''}`}
            >
              {semMeta ? (
                <div className="no-meta-banner no-meta-banner-standalone" role="status">
                  <div className="no-meta-banner-icon" aria-hidden="true">—</div>
                  <div className="no-meta-banner-text">
                    <span className="no-meta-banner-title">Não haverá meta</span>
                    <span className="no-meta-banner-sub">
                      Este setor não possui meta definida para {dashboard.mes_label ?? formatMesLabel(mes)}.
                      O ranking ao lado considera apenas os demais setores.
                    </span>
                  </div>
                </div>
              ) : (
                <>
              <div className="kpi-row">
                {dashboard.unidade === 'pedidos' ? (
                  <ProducaoPedidosKpi
                    producao={dashboard.producao}
                    pedidosDetalhe={dashboard.pedidos_detalhe ?? []}
                    resetKey={`${setor}-${mes}`}
                    icon={<KpiIconProduction />}
                  />
                ) : (
                <div className="kpi-card-modern kpi-card-production">
                  <div className="kpi-card-body">
                    <div className="kpi-icon">
                      <KpiIconProduction />
                    </div>
                    <div className="kpi-label">Produção</div>
                    <div className="kpi-value">{formatNumber(dashboard.producao)}</div>
                    <div className="kpi-sub">
                      {dashboard.unidade === 'kg' ? 'Quilogramas' : 'Unidades'}
                    </div>
                  </div>
                  <div className="kpi-accent" aria-hidden="true" />
                </div>
                )}
                <div className="kpi-card-modern kpi-card-meta">
                  <div className="kpi-card-body">
                    <div className="kpi-icon">
                      <KpiIconMeta />
                    </div>
                    <div className="kpi-label">Meta</div>
                    <div className="kpi-value">{formatNumber(dashboard.meta)}</div>
                    <div className="kpi-sub">Referência do período</div>
                  </div>
                  <div className="kpi-accent" aria-hidden="true" />
                </div>
              </div>

              <div className={`progress-card-glass${isTv ? ' progress-card-tv' : ''}`}>
                <div className="progress-header">
                  <span className="progress-label">% da Meta</span>
                  <span className={`progress-percent-glass ${color}`}>
                    {formatPercent(dashboard.percentual_meta)}%
                  </span>
                </div>
                <div
                  className="progress-glass-shell"
                  role="progressbar"
                  aria-valuenow={progressWidth}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Percentual da meta"
                >
                  <div className="progress-glass-track">
                    <div
                      className="progress-spectrum-clip"
                      style={{ width: `${progressWidth}%` }}
                      aria-hidden="true"
                    >
                      {progressWidth > 0 && (
                        <div
                          className="progress-spectrum"
                          style={{ width: `${10000 / progressWidth}%` }}
                        />
                      )}
                    </div>
                    <div className="progress-glass-highlight" aria-hidden="true" />
                    <div
                      className="progress-glass-marker"
                      style={{ left: `${progressWidth}%` }}
                      aria-hidden="true"
                    />
                    <div className="progress-glass-glow" style={{ width: `${progressWidth}%` }} aria-hidden="true" />
                  </div>
                  <div className="progress-scale" aria-hidden="true">
                    <span className="progress-scale-tick" style={{ left: '0%' }} data-align="start">
                      0%
                    </span>
                    <span className="progress-scale-tick" style={{ left: '50%' }}>
                      50%
                    </span>
                    <span className="progress-scale-tick" style={{ left: '100%' }} data-align="end">
                      100%
                    </span>
                  </div>
                </div>
              </div>

              {!isTv && (
              <div className="charts-row">
                <div className="card chart-card">
                  <div className="chart-card-title-row">
                    <h2>Produção por Mês</h2>
                    {porMesComMeta && (
                      <span className="chart-meta-legend" aria-hidden="true">
                        <span className="chart-meta-legend-line" />
                        Meta
                      </span>
                    )}
                  </div>
                  <div className="chart-body chart-body-month">
                    <ScrollableMonthChart
                      data={porMes}
                      comMeta={porMesComMeta}
                      chartTheme={chartTheme}
                      scrollKey={`${setor}-${mes}`}
                    />
                  </div>
                </div>

                <div className="card chart-card">
                  <h2>Produção por Dia</h2>
                  <div className="chart-body">
                    {porDia.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={porDia} margin={{ top: 22, right: 12, left: 4, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                          <XAxis
                            dataKey="label"
                            axisLine={{ stroke: chartTheme.axis }}
                            tickLine={false}
                            interval={0}
                            height={44}
                            tick={(props) => <DayAxisTick {...props} mes={mes} dark={isDark} />}
                          />
                          <YAxis
                            tick={{ fontSize: 13, fill: chartTheme.tick }}
                            axisLine={{ stroke: chartTheme.axis }}
                            tickFormatter={(v) => formatNumber(v)}
                          />
                          <Tooltip
                            formatter={(value) => [
                              formatNumber(Number(value ?? 0)),
                              'Produção',
                            ]}
                            labelFormatter={(label) => {
                              const day = Number(label)
                              const wd = weekdayAbbr(mes, day)
                              return wd ? `Dia ${label} (${wd})` : `Dia: ${label}`
                            }}
                            contentStyle={chartTheme.tooltip}
                          />
                          <Bar dataKey="producao" fill="#ffae00" radius={[4, 4, 0, 0]}>
                            <LabelList
                              dataKey="producao"
                              content={({ x, y, width, value }) => (
                                <BarValueLabel
                                  x={x}
                                  y={y}
                                  width={width}
                                  value={value}
                                  color={chartTheme.barDayLabel}
                                  fontSize={11}
                                />
                              )}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="state-message">Sem dados diários.</p>
                    )}
                  </div>
                </div>
              </div>
              )}
                </>
              )}
            </div>
        </div>
      ) : null}
    </div>
    </PainelProducaoShell>
  );
}

export default PainelProducaoDashboardPage;
