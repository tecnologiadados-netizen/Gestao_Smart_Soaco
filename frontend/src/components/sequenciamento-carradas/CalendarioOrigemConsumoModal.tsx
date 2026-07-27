import type { OrigemConsumoCalendario } from '../../api/sequenciamentoCarradas';
import { formatDataCurta } from './simulacaoCarradas';

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const TH = 'px-2 py-2 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap';
const TD = 'px-2 py-1.5 border-b border-slate-100 dark:border-slate-700';

export type CalendarioOrigemConsumoModalProps = {
  dataIso: string;
  origens: OrigemConsumoCalendario[];
  /** Código do componente, exibido no subtítulo quando informado. */
  codigo?: string;
  onClose: () => void;
  zIndex?: number;
};

/**
 * Origem do consumo de um componente em uma data (Carrada x PD x Qtde componente).
 * Compartilhado pelo Horizonte e por Materiais do dia — mesma fonte da célula clicada.
 */
export default function CalendarioOrigemConsumoModal({
  dataIso,
  origens,
  codigo,
  onClose,
  zIndex = 160,
}: CalendarioOrigemConsumoModalProps) {
  const total = origens.reduce((s, o) => s + (Number.isFinite(o.qtdeComponente) ? o.qtdeComponente : 0), 0);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/60 p-4"
      style={{ zIndex }}
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(80vh,560px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
        role="dialog"
        aria-modal
        aria-labelledby="calendario-origem-consumo-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div className="min-w-0">
            <h3
              id="calendario-origem-consumo-titulo"
              className="text-base font-semibold text-slate-800 dark:text-slate-100"
            >
              Origem do consumo · {formatDataCurta(dataIso)}
            </h3>
            {codigo ? (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{codigo}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Fechar
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {origens.length === 0 ? (
            <p className="text-sm text-slate-500">Sem origem nesta data.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-600">
                  <th className={`${TH} text-left`}>Carrada</th>
                  <th className={`${TH} text-left`}>PD</th>
                  <th className={`${TH} text-right`}>Qtde componente</th>
                </tr>
              </thead>
              <tbody>
                {origens.map((o, i) => (
                  <tr key={`${o.carrada}-${o.pd}-${i}`}>
                    <td className={TD}>{o.carrada || '—'}</td>
                    <td className={TD}>{o.pd || '—'}</td>
                    <td className={`${TD} text-right tabular-nums`}>{fmtNum(o.qtdeComponente)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-primary-200 bg-primary-50/80 font-semibold dark:border-primary-800 dark:bg-primary-900/30">
                  <td className="px-2 py-2" colSpan={2}>
                    Total
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{fmtNum(total)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
