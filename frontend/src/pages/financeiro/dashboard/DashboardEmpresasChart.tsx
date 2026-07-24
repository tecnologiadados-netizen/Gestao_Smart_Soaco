import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DreDashboardPayload } from '../../../api/financeiro';
import { formatarReais, formatarReaisCompacto } from './dashboardFormat';

type Props = { data: DreDashboardPayload['series']['empresas'] };

type MetricaId = 'faturamento' | 'lucroBruto' | 'ebitda' | 'lucroLiquido';

const METRICAS: { id: MetricaId; label: string; cor: string }[] = [
  { id: 'faturamento', label: 'Faturamento Bruto', cor: '#1E22AA' },
  { id: 'lucroBruto', label: 'Lucro Bruto', cor: '#0d9488' },
  { id: 'ebitda', label: 'EBITDA', cor: '#FFAD00' },
  { id: 'lucroLiquido', label: 'Lucro Líquido', cor: '#64748b' },
];

const SELECT_CLASS =
  'rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-2.5 py-1.5 text-xs font-medium focus:ring-2 focus:ring-primary-600 focus:border-transparent max-w-[11rem]';

function rotuloBarra(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return formatarReaisCompacto(n);
}

export default function DashboardEmpresasChart({ data }: Props) {
  const [metrica, setMetrica] = useState<MetricaId>('faturamento');
  const metricaCfg = METRICAS.find((m) => m.id === metrica) ?? METRICAS[0];

  const rows = useMemo(
    () =>
      data.map((d) => ({
        label: d.label,
        valor: Number(d[metrica] ?? 0),
      })),
    [data, metrica],
  );

  return (
    <div className="card-panel p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Comparativo entre empresas
        </h3>
        <label className="flex flex-col items-end gap-0.5 shrink-0">
          <span className="sr-only">Métrica</span>
          <select
            className={SELECT_CLASS}
            value={metrica}
            onChange={(e) => setMetrica(e.target.value as MetricaId)}
            aria-label="Visualizar por métrica"
          >
            {METRICAS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ top: 28, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => formatarReaisCompacto(Number(v))} tick={{ fontSize: 11 }} width={64} />
            <Tooltip
              formatter={(v) => [formatarReais(Number(v)), metricaCfg.label]}
              labelFormatter={(l) => String(l)}
            />
            <Bar dataKey="valor" name={metricaCfg.label} radius={[4, 4, 0, 0]} maxBarSize={72}>
              {rows.map((_, i) => (
                <Cell key={i} fill={metricaCfg.cor} />
              ))}
              <LabelList
                dataKey="valor"
                position="top"
                formatter={rotuloBarra}
                className="fill-slate-700 dark:fill-slate-200"
                style={{ fontSize: 11, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
