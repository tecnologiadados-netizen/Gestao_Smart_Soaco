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
import { formatarReais, formatarReaisCompacto, rotuloPeriodoMes } from './dashboardFormat';

type Props = { data: DreDashboardPayload['series']['pessoal'] };

export default function DashboardPessoalChart({ data }: Props) {
  const rows = data.map((d) => ({ ...d, label: rotuloPeriodoMes(d.periodo) }));
  return (
    <div className="card-panel p-4">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
        Despesas com Pessoal (segregado)
      </h3>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => formatarReaisCompacto(Number(v))} tick={{ fontSize: 11 }} width={64} />
            <Tooltip formatter={(v) => formatarReais(Number(v))} />
            <Legend />
            <Bar dataKey="operacional" name="Operacional" stackId="p" fill="#1E22AA" />
            <Bar dataKey="logistica" name="Logística" stackId="p" fill="#FFAD00" />
            <Bar dataKey="administrativo" name="Administrativo" stackId="p" fill="#0d9488" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
