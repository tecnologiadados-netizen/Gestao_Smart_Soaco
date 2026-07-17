import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DreDashboardPayload } from '../../../api/financeiro';
import { formatarPct, rotuloPeriodoMes } from './dashboardFormat';

type Props = { data: DreDashboardPayload['series']['margens'] };

export default function DashboardMargensChart({ data }: Props) {
  const rows = data.map((d) => ({
    label: rotuloPeriodoMes(d.periodo),
    margemBruta: d.margemBruta,
    margemEbitda: d.margemEbitda,
    margemLiquida: d.margemLiquida,
  }));

  return (
    <div className="card-panel p-4">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
        Margens (%) ao longo do tempo
      </h3>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `${Number(v).toFixed(0)}%`} tick={{ fontSize: 11 }} width={48} />
            <Tooltip formatter={(v) => formatarPct(Number(v))} />
            <Legend />
            <Line type="monotone" dataKey="margemBruta" name="Margem Bruta" stroke="#0d9488" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="margemEbitda" name="Margem EBITDA" stroke="#FFAD00" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="margemLiquida" name="Margem Líquida" stroke="#1E22AA" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
