import type { DreDashboardPayload } from '../../../api/financeiro';

type Props = { insights: DreDashboardPayload['insights'] };

const SEV: Record<string, string> = {
  positivo: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  atencao: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
  critico: 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200',
};

export default function DashboardInsights({ insights }: Props) {
  if (!insights.length) {
    return (
      <div className="card-panel p-4 text-sm text-slate-500">
        Sem insights para o período selecionado.
      </div>
    );
  }
  return (
    <div className="card-panel p-4">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">
        Insights do período
      </h3>
      <ul className="space-y-2">
        {insights.map((ins, i) => (
          <li
            key={`${ins.titulo}-${i}`}
            className={`rounded-lg border px-3 py-2 text-sm ${SEV[ins.severidade] ?? SEV.atencao}`}
          >
            <p className="font-semibold">{ins.titulo}</p>
            <p className="mt-0.5 opacity-90">{ins.texto}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
