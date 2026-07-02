import type { SycroOrderOrder as Order } from '../../api/sycroorder';
import type { CodigoPermissao } from '../../config/permissoes';
import SycroOrderKanbanCard, { type SycroOrderKanbanCardActions } from './SycroOrderKanbanCard';

type ModalFaturadoEntregueProps = {
  open: boolean;
  onClose: () => void;
  orders: Order[];
  hasPermission: (c: CodigoPermissao) => boolean;
  tagLoadingOrderId: number | null;
  cardActions: SycroOrderKanbanCardActions;
};

export default function ModalFaturadoEntregue({
  open,
  onClose,
  orders,
  hasPermission,
  tagLoadingOrderId,
  cardActions,
}: ModalFaturadoEntregueProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-faturado-title"
    >
      <div
        className="flex max-h-[min(92vh,900px)] w-full max-w-5xl min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <h2 id="modal-faturado-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Faturado/Entregue
            <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">({orders.length})</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-600 dark:hover:text-slate-200"
            aria-label="Fechar"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-app p-4">
          {orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum card faturado ou entregue.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {orders.map((o) => (
                <SycroOrderKanbanCard
                  key={o.id}
                  order={o}
                  hasPermission={hasPermission}
                  tagLoadingOrderId={tagLoadingOrderId}
                  actions={cardActions}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
