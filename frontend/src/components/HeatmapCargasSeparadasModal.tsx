import { createPortal } from 'react-dom';
import type { TooltipDetalheRow } from '../api/pedidos';
import { useRegisterModalEscape } from '../contexts/ModalStackContext';
import HeatmapDetalhesPedidosTable from './HeatmapDetalhesPedidosTable';

export default function HeatmapCargasSeparadasModal({
  open,
  loading,
  erro,
  detalhes,
  onClose,
}: {
  open: boolean;
  loading: boolean;
  erro: string | null;
  detalhes: TooltipDetalheRow[];
  onClose: () => void;
}) {
  useRegisterModalEscape({ id: `heatmap-cargas-separadas`, onClose, zIndex: 14000, enabled: open });

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[14000] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
        role="dialog"
        aria-modal
        aria-labelledby="heatmap-cargas-separadas-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3
                id="heatmap-cargas-separadas-titulo"
                className="text-sm font-semibold text-slate-800 dark:text-slate-100"
              >
                Pedidos em cargas separadas (mesmo cliente e mesma cidade)
              </h3>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                Mesmas colunas do detalhe por cidade. Clique no PD para abrir os itens.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-700"
              aria-label="Fechar"
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto overscroll-contain p-4">
          {loading ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Carregando…</p>
          ) : erro ? (
            <p className="py-6 text-center text-sm text-red-600 dark:text-red-400">{erro}</p>
          ) : detalhes.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Nenhum pedido encontrado para os filtros atuais.
            </p>
          ) : (
            <HeatmapDetalhesPedidosTable titulo="Resultado" detalhesBruto={detalhes} maxAlturaPx={560} />
          )}
        </div>

        <div className="flex shrink-0 justify-end border-t border-slate-200 px-4 py-3 dark:border-slate-600">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-200"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

