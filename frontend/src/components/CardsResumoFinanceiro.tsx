import type { ResumoFinanceiro } from '../api/pedidos';

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
}

interface CardsResumoFinanceiroProps {
  resumo: ResumoFinanceiro | null;
  loading?: boolean;
  overrideQuantidadePedidos?: {
    label: string;
    value: number;
    onClick?: () => void;
  };
}

const CARDS = [
  {
    key: 'quantidadePedidos',
    label: 'Quantidade de Pedidos',
    color: 'text-primary-600 dark:text-primary-400',
    format: (v: number) => v.toLocaleString('pt-BR'),
    alert: false,
  },
  {
    key: 'saldoFaturarPrazo',
    label: 'Saldo a Faturar a Prazo',
    color: 'text-emerald-600 dark:text-emerald-400',
    format: formatarMoeda,
    alert: false,
  },
  {
    key: 'valorAdiantamento',
    label: 'Valor Adiantamento',
    color: 'text-accent-600 dark:text-accent-500',
    format: formatarMoeda,
    alert: false,
  },
  {
    key: 'saldoFaturar',
    label: 'Saldo a Faturar',
    color: 'text-soaco-navy dark:text-soaco-white',
    format: formatarMoeda,
    alert: true,
  },
] as const;

export default function CardsResumoFinanceiro({ resumo, loading, overrideQuantidadePedidos }: CardsResumoFinanceiroProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-slate-200 dark:bg-slate-800 rounded-xl p-5 animate-pulse">
            <div className="h-4 bg-slate-300 dark:bg-slate-700 rounded w-2/3 mb-3" />
            <div className="h-8 bg-slate-300 dark:bg-slate-700 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (!resumo) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {CARDS.map((c) => (
        (() => {
          const override =
            c.key === 'quantidadePedidos' && overrideQuantidadePedidos
              ? overrideQuantidadePedidos
              : null;
          const clickable = !!override?.onClick;
          const label = override?.label ?? c.label;
          const value = override?.value ?? (resumo[c.key] as number);
          const format = override ? (v: number) => v.toLocaleString('pt-BR') : c.format;
          const onClick = override?.onClick;

          return (
        <div
          key={c.key}
          className={`${c.alert ? 'card-kpi-alert' : 'card-kpi'}${clickable ? ' cursor-pointer hover:brightness-[1.03]' : ''}`}
          role={clickable ? 'button' : undefined}
          tabIndex={clickable ? 0 : undefined}
          onClick={onClick}
          onKeyDown={
            clickable
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') onClick?.();
                }
              : undefined
          }
        >
          <p className="card-kpi-label">{label}</p>
          <p className={`card-kpi-value mt-1 ${c.color}`}>
            {format(value)}
          </p>
        </div>
          );
        })()
      ))}
    </div>
  );
}
