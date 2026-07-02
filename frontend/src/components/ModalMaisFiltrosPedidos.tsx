import FiltroPedidos, { type FiltrosPedidosState } from './FiltroPedidos';

interface ModalMaisFiltrosPedidosProps {
  open: boolean;
  onClose: () => void;
  filtros: FiltrosPedidosState;
  onChange: (f: FiltrosPedidosState) => void;
  onAplicar: () => void;
  onLimpar?: () => void;
}

export default function ModalMaisFiltrosPedidos({
  open,
  onClose,
  filtros,
  onChange,
  onAplicar,
  onLimpar,
}: ModalMaisFiltrosPedidosProps) {
  if (!open) return null;

  const handleAplicar = () => {
    onAplicar();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-[min(8vh,4rem)] pb-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-mais-filtros-title"
    >
      <div
        className="my-auto w-full max-w-6xl min-w-0 overflow-visible rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <h2 id="modal-mais-filtros-title" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Mais filtros
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
        <div className="overflow-visible px-4 pb-10 pt-3">
          <FiltroPedidos
            variant="modal"
            filtros={filtros}
            onChange={onChange}
            onAplicar={handleAplicar}
            onLimpar={onLimpar}
          />
        </div>
      </div>
    </div>
  );
}
