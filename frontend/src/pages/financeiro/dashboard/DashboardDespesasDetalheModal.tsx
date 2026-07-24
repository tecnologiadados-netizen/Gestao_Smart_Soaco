import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { DreDashboardPayload } from '../../../api/financeiro';
import { formatarPct, formatarReais } from './dashboardFormat';

export type DespesaFatia = DreDashboardPayload['despesasPrincipais']['fatias'][number];

type Props = {
  aberto: boolean;
  fatia: DespesaFatia | null;
  onClose: () => void;
};

export default function DashboardDespesasDetalheModal({ aberto, fatia, onClose }: Props) {
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto, onClose]);

  if (!aberto || !fatia || typeof document === 'undefined') return null;

  const detalhes = fatia.detalhes ?? [];

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="dash-desp-detalhe-titulo"
      >
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="dash-desp-detalhe-titulo"
              className="text-lg font-semibold text-slate-800 dark:text-slate-100"
            >
              {fatia.codigo} (−) {fatia.label}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              Total {formatarReais(fatia.valor)}
              {fatia.pctTotal != null ? ` · ${formatarPct(fatia.pctTotal)} do grupo de despesas` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Fechar
          </button>
        </div>

        <div className="overflow-auto p-4">
          {detalhes.length === 0 ? (
            <p className="text-sm text-slate-500">Sem detalhe mapeado para este grupo no período.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 pr-2 font-medium">Código</th>
                  <th className="py-2 pr-2 font-medium">Despesa</th>
                  <th className="py-2 pr-2 font-medium text-right">Valor</th>
                  <th className="py-2 font-medium text-right">% do grupo</th>
                </tr>
              </thead>
              <tbody>
                {detalhes.map((d) => (
                  <tr
                    key={d.pathKey}
                    className="border-b border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-100"
                  >
                    <td className="py-2 pr-2 tabular-nums text-slate-500 whitespace-nowrap">{d.codigo}</td>
                    <td className="py-2 pr-2">{d.label}</td>
                    <td className="py-2 pr-2 text-right tabular-nums text-red-700 dark:text-red-400">
                      {formatarReais(d.valor)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-slate-500">
                      {formatarPct(d.pctGrupo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
