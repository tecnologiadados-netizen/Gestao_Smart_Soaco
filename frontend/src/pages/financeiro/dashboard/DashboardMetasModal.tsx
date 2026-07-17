import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DashboardMetas } from './dashboardEmpresas';

type Props = {
  aberto: boolean;
  metas: DashboardMetas;
  onClose: () => void;
  onSalvar: (metas: DashboardMetas) => void;
};

export default function DashboardMetasModal({ aberto, metas, onClose, onSalvar }: Props) {
  const [ebitda, setEbitda] = useState(String(metas.metaEbitdaPct));
  const [lucro, setLucro] = useState(String(metas.metaLucroPct));

  useEffect(() => {
    if (aberto) {
      setEbitda(String(metas.metaEbitdaPct));
      setLucro(String(metas.metaLucroPct));
    }
  }, [aberto, metas]);

  if (!aberto || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="dash-metas-titulo"
      >
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          <h2 id="dash-metas-titulo" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Metas de margem
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Usadas no cálculo do faturamento necessário (padrão 12% EBITDA / 3% Lucro).
          </p>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Meta EBITDA (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={ebitda}
              onChange={(e) => setEbitda(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Meta Lucro Líquido (%)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={lucro}
              onChange={(e) => setLucro(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm border border-slate-300 dark:border-slate-600"
          >
            Cancelar
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700"
            onClick={() => {
              const e = Number(ebitda.replace(',', '.'));
              const l = Number(lucro.replace(',', '.'));
              onSalvar({
                metaEbitdaPct: Number.isFinite(e) ? e : 12,
                metaLucroPct: Number.isFinite(l) ? l : 3,
              });
              onClose();
            }}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
