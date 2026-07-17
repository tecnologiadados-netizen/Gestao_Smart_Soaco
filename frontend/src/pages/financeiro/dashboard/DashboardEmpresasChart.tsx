import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DreDashboardPayload } from '../../../api/financeiro';
import { formatarReais, formatarReaisCompacto } from './dashboardFormat';

type Props = { data: DreDashboardPayload['series']['empresas'] };

export default function DashboardEmpresasChart({ data }: Props) {
  return (
    <div className="card-panel p-4">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
        Comparativo entre empresas
      </h3>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => formatarReaisCompacto(Number(v))} tick={{ fontSize: 11 }} width={64} />
            <Tooltip formatter={(v) => formatarReais(Number(v))} />
            <Legend />
            <Bar dataKey="faturamento" name="Faturamento" fill="#1E22AA" radius={[4, 4, 0, 0]} />
            <Bar dataKey="lucroBruto" name="Lucro Bruto" fill="#0d9488" radius={[4, 4, 0, 0]} />
            <Bar dataKey="ebitda" name="EBITDA" fill="#FFAD00" radius={[4, 4, 0, 0]} />
            <Bar dataKey="lucroLiquido" name="Lucro Líquido" fill="#64748b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
