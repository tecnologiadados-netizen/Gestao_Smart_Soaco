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
  const totalDetalhe = detalhes.reduce((s, d) => s + (d.valor || 0), 0);

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex w-full max-w-3xl max-h-[min(92vh,880px)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dash-desp-detalhe-titulo"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="min-w-0">
            <h2
              id="dash-desp-detalhe-titulo"
              className="text-lg font-semibold text-slate-800 dark:text-slate-100"
            >
              {fatia.codigo} (−) {fatia.label}
            </h2>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400 tabular-nums">
              Total {formatarReais(fatia.valor)}
              {fatia.pctTotal != null ? ` · ${formatarPct(fatia.pctTotal)} do grupo de despesas` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Fechar
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {detalhes.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              Sem detalhe mapeado para este grupo no período.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-[1]">
                <tr className="bg-primary-600 text-left text-white shadow-sm">
                  <th className="px-2 py-2 font-semibold">Código</th>
                  <th className="px-2 py-2 font-semibold">Despesa</th>
                  <th className="px-2 py-2 font-semibold text-right">Valor</th>
                  <th className="px-2 py-2 font-semibold text-right">% do grupo</th>
                </tr>
              </thead>
              <tbody>
                {detalhes.map((d) => (
                  <tr
                    key={d.pathKey}
                    className="border-t border-slate-100 odd:bg-white even:bg-slate-50/90 dark:border-slate-800 dark:odd:bg-slate-900 dark:even:bg-slate-800/40"
                  >
                    <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-slate-500">{d.codigo}</td>
                    <td className="px-2 py-1.5 text-slate-800 dark:text-slate-100">{d.label}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-red-700 dark:text-red-400">
                      {formatarReais(d.valor)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">
                      {formatarPct(d.pctGrupo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {detalhes.length > 0 ? (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-primary-700 bg-primary-600 px-4 py-2.5 text-sm text-white">
            <span className="font-medium">Total ({detalhes.length.toLocaleString('pt-BR')})</span>
            <span className="tabular-nums">{formatarReais(totalDetalhe)}</span>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
