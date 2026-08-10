import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MetricasAgg } from './carteiraAggregates';
import { formatarReais, formatarReaisCompacto } from '../dashboard/dashboardFormat';

const CORES = {
  receber: '#0d9488',
  faturar: '#f59e0b',
  romaneado: '#6366f1',
};

const STATUS_CORES: Record<string, string> = {
  Atrasado: '#e11d48',
  'Em dia': '#059669',
};

const PIE_PALETTE = [
  '#0d9488',
  '#6366f1',
  '#f59e0b',
  '#e11d48',
  '#8b5cf6',
  '#0891b2',
  '#db2777',
  '#65a30d',
  '#ea580c',
  '#475569',
];

const SERIES_LEGENDA = [
  { key: 'Saldo a Receber', cor: CORES.receber },
  { key: 'Saldo a Faturar', cor: CORES.faturar },
  { key: 'Saldo Romaneado', cor: CORES.romaneado },
] as const;

type BarrasProps = {
  title: string;
  data: MetricasAgg[];
  layout?: 'horizontal' | 'vertical';
  height?: number;
  onBarClick?: (chave: string) => void;
  /** Altura reduzida para captura de PDF. */
  compact?: boolean;
};

function TooltipMetricas({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold mb-1 text-slate-800 dark:text-slate-100">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4" style={{ color: p.color }}>
          <span>{p.name}</span>
          <span className="font-medium">{formatarReais(p.value ?? 0)}</span>
        </div>
      ))}
    </div>
  );
}

function LegendaSeries({ compact }: { compact?: boolean }) {
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-slate-600 dark:text-slate-300 ${
        compact ? 'text-[11px] mb-1.5' : 'text-xs mb-2'
      }`}
    >
      {SERIES_LEGENDA.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.cor }} />
          {s.key}
        </span>
      ))}
    </div>
  );
}

function LegendaItens({
  itens,
  compact,
}: {
  itens: { label: string; cor: string }[];
  compact?: boolean;
}) {
  return (
    <div
      className={`grid gap-x-3 gap-y-1 text-slate-600 dark:text-slate-300 ${
        compact
          ? 'grid-cols-2 text-[11px] mt-1.5 leading-snug'
          : 'grid-cols-1 sm:grid-cols-2 text-xs mt-2 leading-snug'
      }`}
    >
      {itens.map((item) => (
        <span key={item.label} className="inline-flex items-start gap-1.5 min-w-0">
          <span
            className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: item.cor }}
          />
          <span className="break-words">{item.label}</span>
        </span>
      ))}
    </div>
  );
}

function handleBarClick(data: unknown, onBarClick?: (chave: string) => void) {
  if (!onBarClick) return;
  const payload = data as { payload?: { fullName?: string }; fullName?: string };
  const full = payload?.payload?.fullName ?? payload?.fullName;
  if (full) onBarClick(full);
}

function truncarRotulo(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  return `${texto.slice(0, Math.max(1, max - 1))}…`;
}

export function CarteiraBarrasAgrupadas({
  title,
  data,
  layout = 'horizontal',
  height = 320,
  onBarClick,
  compact = false,
}: BarrasProps) {
  const maxNome = compact ? (layout === 'vertical' ? 14 : 18) : 28;
  const chartData = data.map((d) => ({
    name: truncarRotulo(d.chave, maxNome),
    fullName: d.chave,
    'Saldo a Receber': d.saldoAReceber,
    'Saldo a Faturar': d.saldoAFaturar,
    'Saldo Romaneado': d.saldoRomaneado,
  }));

  const barCursor = onBarClick ? 'pointer' : undefined;
  const barClick = (d: unknown) => handleBarClick(d, onBarClick);
  // Em compacto, barras verticais precisam de mais altura para o eixo X inclinado;
  // horizontais usam a altura informada (lista de categorias).
  const chartH = compact
    ? layout === 'vertical'
      ? 210
      : Math.max(160, Math.min(height, 340))
    : height;
  const tickSize = compact ? 10 : 12;

  return (
    <div className={`card-panel ${compact ? 'p-2.5' : 'p-4'}`}>
      <h3
        className={`font-semibold text-slate-800 dark:text-slate-100 ${
          compact ? 'text-xs mb-1' : 'text-sm mb-2'
        }`}
      >
        {title}
      </h3>
      {chartData.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">Sem dados para o filtro.</p>
      ) : (
        <>
          <LegendaSeries compact={compact} />
          <ResponsiveContainer width="100%" height={chartH}>
            {layout === 'horizontal' ? (
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 4, right: 12, top: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis
                  type="number"
                  tickFormatter={(v) => formatarReaisCompacto(Number(v))}
                  tick={{ fontSize: tickSize }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={compact ? 88 : 110}
                  tick={{ fontSize: tickSize }}
                />
                <Tooltip content={<TooltipMetricas />} />
                <Bar dataKey="Saldo a Receber" fill={CORES.receber} cursor={barCursor} onClick={barClick} />
                <Bar dataKey="Saldo a Faturar" fill={CORES.faturar} cursor={barCursor} onClick={barClick} />
                <Bar dataKey="Saldo Romaneado" fill={CORES.romaneado} cursor={barCursor} onClick={barClick} />
              </BarChart>
            ) : (
              <BarChart
                data={chartData}
                margin={{ left: 4, right: 8, top: 4, bottom: compact ? 8 : 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis
                  dataKey="name"
                  angle={-32}
                  textAnchor="end"
                  height={compact ? 62 : 78}
                  tick={{ fontSize: tickSize }}
                  interval={0}
                />
                <YAxis
                  tickFormatter={(v) => formatarReaisCompacto(Number(v))}
                  tick={{ fontSize: tickSize }}
                />
                <Tooltip content={<TooltipMetricas />} />
                <Bar dataKey="Saldo a Receber" fill={CORES.receber} cursor={barCursor} onClick={barClick} />
                <Bar dataKey="Saldo a Faturar" fill={CORES.faturar} cursor={barCursor} onClick={barClick} />
                <Bar dataKey="Saldo Romaneado" fill={CORES.romaneado} cursor={barCursor} onClick={barClick} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}

/** Fatias abaixo disso não ganham rótulo externo (evita sobreposição). */
const PIE_LABEL_MIN_PCT = 0.08;

type PieLabelLineProps = {
  percent?: number;
  points?: { x: number; y: number }[];
  stroke?: string;
};

function CondicaoLabelLine({ percent = 0, points, stroke }: PieLabelLineProps) {
  if (percent < PIE_LABEL_MIN_PCT || !points || points.length < 2) return null;
  return (
    <polyline
      points={points.map((p) => `${p.x},${p.y}`).join(' ')}
      stroke={stroke}
      fill="none"
      strokeWidth={1}
    />
  );
}

export function CarteiraPizzaCondicao({
  data,
  onSliceClick,
  compact = false,
}: {
  data: MetricasAgg[];
  onSliceClick?: (chave: string) => void;
  compact?: boolean;
}) {
  const pieData = data.map((d) => ({
    name: truncarRotulo(d.chave, compact ? 18 : 22),
    fullName: d.chave,
    value: d.saldoAReceber,
    qtd: d.qtdPedidos,
  }));

  const legendItens = pieData.map((d, i) => ({
    label: d.fullName,
    cor: PIE_PALETTE[i % PIE_PALETTE.length]!,
  }));

  // Só o desenho da pizza — legenda HTML fica fora (não distorce)
  const chartH = compact ? 150 : 260;

  return (
    <div className={`card-panel ${compact ? 'p-2.5' : 'p-4'}`}>
      <h3
        className={`font-semibold text-slate-800 dark:text-slate-100 ${
          compact ? 'text-xs mb-1' : 'text-sm mb-2'
        }`}
      >
        Por Condição de Pagamento
      </h3>
      {pieData.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">Sem dados para o filtro.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={chartH}>
            <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={compact ? 58 : 95}
                paddingAngle={1}
                labelLine={
                  compact
                    ? false
                    : (props) => <CondicaoLabelLine {...(props as PieLabelLineProps)} />
                }
                label={
                  compact
                    ? false
                    : ({ percent }) => {
                        if ((percent ?? 0) < PIE_LABEL_MIN_PCT) return null;
                        return `${((percent ?? 0) * 100).toFixed(0)}%`;
                      }
                }
                cursor={onSliceClick ? 'pointer' : undefined}
                onClick={(entry) => {
                  const full =
                    (entry as { fullName?: string; payload?: { fullName?: string } })?.payload
                      ?.fullName ?? (entry as { fullName?: string }).fullName;
                  if (full && onSliceClick) onSliceClick(full);
                }}
              >
                {pieData.map((d, i) => (
                  <Cell key={d.fullName} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, _name, item) => {
                  const payload = item?.payload as { fullName?: string; qtd?: number } | undefined;
                  const qtd = payload?.qtd ?? 0;
                  const label = payload?.fullName ?? String(_name);
                  return [`${formatarReais(Number(value))} · ${qtd} pedidos`, label];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <LegendaItens itens={legendItens} compact={compact} />
        </>
      )}
    </div>
  );
}

export function CarteiraDonutStatus({
  data,
  onSliceClick,
  compact = false,
}: {
  data: MetricasAgg[];
  onSliceClick?: (chave: string) => void;
  compact?: boolean;
}) {
  const pieData = data.map((d) => ({
    name: d.chave,
    fullName: d.chave,
    value: d.saldoAReceber,
    qtd: d.qtdPedidos,
  }));

  const legendItens = pieData.map((d) => ({
    label: d.name,
    cor: STATUS_CORES[d.name] ?? '#64748b',
  }));

  const chartH = compact ? 150 : 240;

  return (
    <div className={`card-panel h-full ${compact ? 'p-2.5' : 'p-4'}`}>
      <h3
        className={`font-semibold text-slate-800 dark:text-slate-100 ${
          compact ? 'text-xs mb-1' : 'text-sm mb-2'
        }`}
      >
        Distribuição por Status de entrega
      </h3>
      {pieData.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">Sem dados para o filtro.</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={chartH}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={compact ? 36 : 55}
                outerRadius={compact ? 58 : 90}
                paddingAngle={2}
                label={({ name, percent }) =>
                  compact
                    ? `${((percent ?? 0) * 100).toFixed(0)}%`
                    : `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
                cursor={onSliceClick ? 'pointer' : undefined}
                onClick={(entry) => {
                  const full =
                    (entry as { name?: string; payload?: { fullName?: string; name?: string } })
                      ?.payload?.fullName ??
                    (entry as { payload?: { name?: string } }).payload?.name ??
                    (entry as { name?: string }).name;
                  if (full && onSliceClick) onSliceClick(full);
                }}
              >
                {pieData.map((d) => (
                  <Cell key={d.name} fill={STATUS_CORES[d.name] ?? '#64748b'} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name, item) => {
                  const qtd = (item?.payload as { qtd?: number })?.qtd ?? 0;
                  return [`${formatarReais(Number(value))} · ${qtd} pedidos`, String(name)];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <LegendaItens itens={legendItens} compact={compact} />
        </>
      )}
    </div>
  );
}
