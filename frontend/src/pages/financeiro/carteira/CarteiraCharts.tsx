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

  return (
    <div className="card-panel p-4">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">{title}</h3>
      {chartData.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">Sem dados para o filtro.</p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          {layout === 'horizontal' ? (
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 12, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
              <XAxis type="number" tickFormatter={(v) => formatarReaisCompacto(Number(v))} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
              <Tooltip content={<TooltipMetricas />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar
                dataKey="Saldo a Receber"
                fill={CORES.receber}
                cursor={onBarClick ? 'pointer' : undefined}
                onClick={(data) => {
                  const payload = data as { payload?: { fullName?: string }; fullName?: string };
                  const full = payload?.payload?.fullName ?? payload?.fullName;
                  if (full && onBarClick) onBarClick(full);
                }}
              />
              <Bar dataKey="Saldo a Faturar" fill={CORES.faturar} />
              <Bar dataKey="Saldo Romaneado" fill={CORES.romaneado} />
            </BarChart>
          ) : (
            <BarChart data={chartData} margin={{ left: 4, right: 8, top: 4, bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
              <XAxis dataKey="name" angle={-35} textAnchor="end" height={60} tick={{ fontSize: 9 }} interval={0} />
              <YAxis tickFormatter={(v) => formatarReaisCompacto(Number(v))} tick={{ fontSize: 10 }} />
              <Tooltip content={<TooltipMetricas />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Saldo a Receber" fill={CORES.receber} />
              <Bar dataKey="Saldo a Faturar" fill={CORES.faturar} />
              <Bar dataKey="Saldo Romaneado" fill={CORES.romaneado} />
            </BarChart>
          )}
        </ResponsiveContainer>
      )}
    </div>
  );
}

export function CarteiraDonutStatus({ data }: { data: MetricasAgg[] }) {
  const pieData = data.map((d) => ({
    name: d.chave,
    value: d.saldoAReceber,
    qtd: d.qtdPedidos,
  }));

  return (
    <div className="card-panel p-4">
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
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
