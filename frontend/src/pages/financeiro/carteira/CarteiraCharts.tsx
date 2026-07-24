import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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

type BarrasProps = {
  title: string;
  data: MetricasAgg[];
  layout?: 'horizontal' | 'vertical';
  height?: number;
  onBarClick?: (chave: string) => void;
};

function TooltipMetricas({ active, payload, label }: {
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

function handleBarClick(
  data: unknown,
  onBarClick?: (chave: string) => void
) {
  if (!onBarClick) return;
  const payload = data as { payload?: { fullName?: string }; fullName?: string };
  const full = payload?.payload?.fullName ?? payload?.fullName;
  if (full) onBarClick(full);
}

export function CarteiraBarrasAgrupadas({
  title,
  data,
  layout = 'horizontal',
  height = 320,
  onBarClick,
}: BarrasProps) {
  const chartData = data.map((d) => ({
    name: d.chave.length > 28 ? `${d.chave.slice(0, 26)}…` : d.chave,
    fullName: d.chave,
    'Saldo a Receber': d.saldoAReceber,
    'Saldo a Faturar': d.saldoAFaturar,
    'Saldo Romaneado': d.saldoRomaneado,
  }));

  const barCursor = onBarClick ? 'pointer' : undefined;
  const barClick = (d: unknown) => handleBarClick(d, onBarClick);

  return (
    <div className="card-panel p-4">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">{title}</h3>
      {chartData.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">Sem dados para o filtro.</p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          {layout === 'horizontal' ? (
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 12, top: 28, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
              <XAxis type="number" tickFormatter={(v) => formatarReaisCompacto(Number(v))} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
              <Tooltip content={<TooltipMetricas />} />
              <Legend
                verticalAlign="top"
                align="center"
                wrapperStyle={{ fontSize: 12, paddingBottom: 4, top: 0 }}
              />
              <Bar dataKey="Saldo a Receber" fill={CORES.receber} cursor={barCursor} onClick={barClick} />
              <Bar dataKey="Saldo a Faturar" fill={CORES.faturar} cursor={barCursor} onClick={barClick} />
              <Bar dataKey="Saldo Romaneado" fill={CORES.romaneado} cursor={barCursor} onClick={barClick} />
            </BarChart>
          ) : (
            <BarChart data={chartData} margin={{ left: 4, right: 8, top: 28, bottom: 64 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
              <XAxis
                dataKey="name"
                angle={-35}
                textAnchor="end"
                height={78}
                tick={{ fontSize: 12 }}
                interval={0}
              />
              <YAxis tickFormatter={(v) => formatarReaisCompacto(Number(v))} tick={{ fontSize: 12 }} />
              <Tooltip content={<TooltipMetricas />} />
              <Legend
                verticalAlign="top"
                align="center"
                wrapperStyle={{ fontSize: 12, paddingBottom: 4, top: 0 }}
              />
              <Bar dataKey="Saldo a Receber" fill={CORES.receber} cursor={barCursor} onClick={barClick} />
              <Bar dataKey="Saldo a Faturar" fill={CORES.faturar} cursor={barCursor} onClick={barClick} />
              <Bar dataKey="Saldo Romaneado" fill={CORES.romaneado} cursor={barCursor} onClick={barClick} />
            </BarChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function CarteiraPizzaCondicao({
  data,
  onSliceClick,
}: {
  data: MetricasAgg[];
  onSliceClick?: (chave: string) => void;
}) {
  const pieData = data.map((d) => ({
    name: d.chave.length > 28 ? `${d.chave.slice(0, 26)}…` : d.chave,
    fullName: d.chave,
    value: d.saldoAReceber,
    qtd: d.qtdPedidos,
  }));

  return (
    <div className="card-panel p-4">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
        Por Condição de Pagamento
      </h3>
      {pieData.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">Sem dados para o filtro.</p>
      ) : (
        <ResponsiveContainer width="100%" height={360}>
          <PieChart margin={{ top: 8, right: 12, bottom: 8, left: 12 }}>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={105}
              paddingAngle={1}
              labelLine={{ strokeWidth: 1 }}
              label={({ name, percent }) => {
                const pct = (percent ?? 0) * 100;
                if (pct < 2.5) return '';
                return `${name} (${pct.toFixed(0)}%)`;
              }}
              cursor={onSliceClick ? 'pointer' : undefined}
              onClick={(entry) => {
                const full = (entry as { fullName?: string; payload?: { fullName?: string } })
                  ?.payload?.fullName
                  ?? (entry as { fullName?: string }).fullName;
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
      )}
    </div>
  );
}

export function CarteiraDonutStatus({
  data,
  onSliceClick,
}: {
  data: MetricasAgg[];
  onSliceClick?: (chave: string) => void;
}) {
  const pieData = data.map((d) => ({
    name: d.chave,
    fullName: d.chave,
    value: d.saldoAReceber,
    qtd: d.qtdPedidos,
  }));

  return (
    <div className="card-panel p-4 h-full">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
        Distribuição por Status
      </h3>
      {pieData.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">Sem dados para o filtro.</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={2}
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              cursor={onSliceClick ? 'pointer' : undefined}
              onClick={(entry) => {
                const full = (entry as { name?: string; payload?: { fullName?: string; name?: string } })
                  ?.payload?.fullName
                  ?? (entry as { payload?: { name?: string } }).payload?.name
                  ?? (entry as { name?: string }).name;
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
      )}
    </div>
  );
}
