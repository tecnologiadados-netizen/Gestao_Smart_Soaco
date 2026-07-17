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
import type { DreDashboardPayload } from '../../../api/financeiro';
import { formatarReais, formatarReaisCompacto } from './dashboardFormat';

type Props = { data: DreDashboardPayload['waterfall'] };

/** Waterfall com barras flutuantes (base + valor). */
export default function DashboardWaterfallChart({ data }: Props) {
  let running = 0;
  const rows = data.map((step) => {
    const isTotal = step.tipo === 'total';
    let base = 0;
    let valor = step.valor;
    if (isTotal) {
      base = 0;
      valor = step.valor;
      running = step.valor;
    } else {
      if (step.valor < 0) {
        base = running + step.valor;
        valor = Math.abs(step.valor);
        running = running + step.valor;
      } else {
        base = running;
        valor = step.valor;
        running = running + step.valor;
      }
    }
    return {
      label: step.label,
      base,
      valor,
      display: step.valor,
      isTotal,
      isNeg: step.valor < 0 && !isTotal,
    };
  });

  return (
    <div className="card-panel p-4">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
        Cascata DRE do período
      </h3>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ top: 8, right: 12, left: 4, bottom: 48 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
            <YAxis tickFormatter={(v) => formatarReaisCompacto(Number(v))} tick={{ fontSize: 11 }} width={64} />
            <Tooltip
              formatter={(_v, _n, item) => {
                const row = item?.payload as { display?: number };
                return formatarReais(row?.display ?? 0);
              }}
            />
            <Bar dataKey="base" stackId="w" fill="transparent" legendType="none" />
            <Bar dataKey="valor" stackId="w" radius={[4, 4, 0, 0]}>
              {rows.map((r, i) => (
                <Cell
                  key={i}
                  fill={r.isTotal ? '#1E22AA' : r.isNeg ? '#dc2626' : '#0d9488'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
