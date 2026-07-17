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
import { formatarReais, formatarReaisCompacto, rotuloPeriodoMes } from './dashboardFormat';

type Props = { data: DreDashboardPayload['series']['evolucao12m']; mostrarYoy: boolean };

export default function DashboardEvolucaoChart({ data, mostrarYoy }: Props) {
  const rows = data.map((d) => ({
    ...d,
    label: rotuloPeriodoMes(d.periodo),
  }));

  return (
    <div className="card-panel p-4">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
        Evolução mensal (12 meses)
      </h3>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <LineChart data={rows} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => formatarReaisCompacto(Number(v))} tick={{ fontSize: 11 }} width={64} />
            <Tooltip
              formatter={(v) => formatarReais(Number(v))}
              labelFormatter={(l) => String(l)}
            />
            <Legend />
            <Line type="monotone" dataKey="faturamento" name="Faturamento" stroke="#1E22AA" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="lucroBruto" name="Lucro Bruto" stroke="#0d9488" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="ebitda" name="EBITDA" stroke="#FFAD00" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="lucroLiquido" name="Lucro Líquido" stroke="#64748b" strokeWidth={2} dot={false} />
            {mostrarYoy ? (
              <>
                <Line type="monotone" dataKey="faturamentoAnoAnt" name="Fat. ano ant." stroke="#1E22AA" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="ebitdaAnoAnt" name="EBITDA ano ant." stroke="#FFAD00" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
              </>
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
