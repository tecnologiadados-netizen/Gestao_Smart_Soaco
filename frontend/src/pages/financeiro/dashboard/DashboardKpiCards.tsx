import type { DreDashboardKpi } from '../../../api/financeiro';
import { corVariacao, formatarPct, formatarReais, setaVariacao } from './dashboardFormat';

type Props = { kpis: DreDashboardKpi[]; loading?: boolean };

type TemaKpi = {
  iconBg: string;
  iconFg: string;
  hint: string;
};

const TEMAS: Record<string, TemaKpi> = {
  faturamento: {
    iconBg: 'bg-violet-100 dark:bg-violet-900/40',
    iconFg: 'text-violet-700 dark:text-violet-300',
    hint: 'Receita bruta do período (antes das deduções de custo e despesa).',
  },
  cpv: {
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    iconFg: 'text-emerald-700 dark:text-emerald-300',
    hint: 'Custo dos produtos/mercadorias vendidos. Variação favorável quando cai.',
  },
  lucroBruto: {
    iconBg: 'bg-sky-100 dark:bg-sky-900/40',
    iconFg: 'text-sky-700 dark:text-sky-300',
    hint: 'Faturamento menos CPV/CMV.',
  },
  despOp: {
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    iconFg: 'text-amber-700 dark:text-amber-300',
    hint: 'Despesas operacionais do período. Variação favorável quando cai.',
  },
  pessoal: {
    iconBg: 'bg-rose-100 dark:bg-rose-900/40',
    iconFg: 'text-rose-700 dark:text-rose-300',
    hint: 'Despesas com pessoal (operacional, logística e administrativo).',
  },
  ebitda: {
    iconBg: 'bg-indigo-100 dark:bg-indigo-900/40',
    iconFg: 'text-indigo-700 dark:text-indigo-300',
    hint: 'Resultado operacional antes de juros, impostos, depreciação e amortização.',
  },
  lucroLiquido: {
    iconBg: 'bg-teal-100 dark:bg-teal-900/40',
    iconFg: 'text-teal-700 dark:text-teal-300',
    hint: 'Resultado líquido do período.',
  },
};

const TEMA_PADRAO: TemaKpi = {
  iconBg: 'bg-slate-100 dark:bg-slate-700',
  iconFg: 'text-slate-600 dark:text-slate-300',
  hint: '',
};

function IconeKpi({ id, className }: { id: string; className?: string }) {
  const c = className ?? 'h-3.5 w-3.5';
  switch (id) {
    case 'faturamento':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'cpv':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M19 5L5 19M9 5h10v10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'lucroBruto':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M3 17l6-6 4 4 8-8M14 7h7v7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'despOp':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path
            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM12 8v4l2.5 1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'pessoal':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path
            d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'ebitda':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M21.21 15.89A10 10 0 118 2.83M22 12A10 10 0 0012 2v10z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'lucroLiquido':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="8" cy="8" r="3" />
          <circle cx="16" cy="16" r="3" />
          <path d="M10.5 6.5l3 3M13.5 14.5l-3-3" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

function textoBreakdown(b: NonNullable<DreDashboardKpi['breakdown']>): string {
  return [
    `Operacional: ${formatarReais(b.operacional.valor)} (${formatarPct(b.operacional.pctTotal)})`,
    `Logística: ${formatarReais(b.logistica.valor)} (${formatarPct(b.logistica.pctTotal)})`,
    `Administrativo: ${formatarReais(b.administrativo.valor)} (${formatarPct(b.administrativo.pctTotal)})`,
  ].join('\n');
}

const CARD =
  'min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 p-2.5 shadow-sm flex flex-col gap-1';

const GRID =
  'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2';

export default function DashboardKpiCards({ kpis, loading }: Props) {
  if (loading) {
    return (
      <div className={GRID}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className={`${CARD} h-[7.25rem] animate-pulse bg-slate-100 dark:bg-slate-800`} />
        ))}
      </div>
    );
  }

  return (
    <div className={GRID}>
      {kpis.map((k) => {
        const tema = TEMAS[k.id] ?? TEMA_PADRAO;
        const hint = k.breakdown ? `${tema.hint}\n\n${textoBreakdown(k.breakdown)}` : tema.hint;

        return (
          <div key={k.id} className={CARD}>
            <div className="flex items-start justify-between gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-md ${tema.iconBg} ${tema.iconFg}`}
                >
                  <IconeKpi id={k.id} />
                </span>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 leading-tight line-clamp-2">
                  {k.label}
                </p>
              </div>
              {hint ? (
                <span
                  className="shrink-0 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-slate-400 border border-slate-200 dark:border-slate-600 cursor-help"
                  title={hint}
                  aria-label={hint}
                >
                  i
                </span>
              ) : null}
            </div>

            <p
              className="text-[13px] sm:text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100 leading-snug tracking-tight break-all"
              title={formatarReais(k.valor)}
            >
              {formatarReais(k.valor)}
            </p>

            {k.pctFaturamento != null && k.id !== 'faturamento' ? (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                {formatarPct(k.pctFaturamento)} do faturamento
              </p>
            ) : (
              <p className="text-[10px] text-transparent leading-tight select-none" aria-hidden>
                —
              </p>
            )}

            <div className="mt-auto flex flex-col gap-0.5 text-[10px] font-medium leading-tight">
              <span className={corVariacao(k.momPct, k.inverso)}>
                MoM {setaVariacao(k.momPct)} {formatarPct(k.momPct, true)}
              </span>
              <span className={corVariacao(k.yoyPct, k.inverso)}>
                YoY {setaVariacao(k.yoyPct)} {formatarPct(k.yoyPct, true)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
