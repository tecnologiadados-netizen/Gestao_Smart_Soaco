import { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { DreDashboardPayload } from '../../../api/financeiro';
import DashboardDespesasDetalheModal, { type DespesaFatia } from './DashboardDespesasDetalheModal';
import { formatarPct, formatarReais } from './dashboardFormat';

type Props = { data: DreDashboardPayload['despesasPrincipais'] };

const CORES = ['#1E22AA', '#0d9488', '#FFAD00', '#e11d48', '#7c3aed', '#64748b'];

type SliceRow = {
  id: string;
  name: string;
  value: number;
  fatia: DespesaFatia;
  cor: string;
};

export default function DashboardDespesasPrincipaisChart({ data }: Props) {
  const [selecionada, setSelecionada] = useState<DespesaFatia | null>(null);

  const rows: SliceRow[] = useMemo(
    () =>
      (data?.fatias ?? []).map((f, i) => ({
        id: f.id,
        name: `${f.codigo} ${f.label}`,
        value: Math.abs(f.valor),
        fatia: f,
        cor: CORES[i % CORES.length]!,
      })),
    [data],
  );

  const totalAbs = Math.abs(data?.total ?? 0);

  return (
    <div className="card-panel p-4">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">
        Principais despesas
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
        Clique em uma fatia para ver o detalhe (1º nível da DRE). Total{' '}
        <span className="font-medium tabular-nums text-slate-700 dark:text-slate-200">
          {formatarReais(data?.total ?? 0)}
        </span>
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500 py-8 text-center">Sem despesas no período.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-3 items-center">
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={88}
                  paddingAngle={1.5}
                  cursor="pointer"
                  onClick={(_, index) => {
                    const row = rows[index];
                    if (row) setSelecionada(row.fatia);
                  }}
                >
                  {rows.map((r) => (
                    <Cell key={r.id} fill={r.cor} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, _n, item) => {
                    const row = item?.payload as SliceRow | undefined;
                    const pct = totalAbs > 0 ? (Number(v) / totalAbs) * 100 : null;
                    return [
                      `${formatarReais(-(Number(v) || 0))}${pct != null ? ` (${formatarPct(pct)})` : ''}`,
                      row?.fatia.label ?? 'Despesa',
                    ];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="space-y-1.5 text-xs">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelecionada(r.fatia)}
                  className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/80 transition"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: r.cor }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 text-slate-700 dark:text-slate-200 truncate">
                    <span className="text-slate-400 mr-1">{r.fatia.codigo}</span>
                    {r.fatia.label}
                  </span>
                  <span className="shrink-0 tabular-nums font-medium text-slate-800 dark:text-slate-100">
                    {formatarPct(r.fatia.pctTotal)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <DashboardDespesasDetalheModal
        aberto={selecionada != null}
        fatia={selecionada}
        onClose={() => setSelecionada(null)}
      />
    </div>
  );
}
