import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { DRE_MKP_VARIACOES, formatarVariacaoMkp } from './dreMkpVariacoes';
import { criarMatcherTextoLivre, PLACEHOLDER_BUSCA_TEXTO_LIVRE } from '../../../utils/textoLivreBusca';

export type DreMkpModalProps = {
  aberto: boolean;
  onClose: () => void;
  mkpAtivo: boolean;
  onMkpAtivoChange: (ativo: boolean) => void;
};

export default function DreMkpModal({ aberto, onClose, mkpAtivo, onMkpAtivoChange }: DreMkpModalProps) {
  const [busca, setBusca] = useState('');

  useEffect(() => {
    if (!aberto) setBusca('');
  }, [aberto]);

  const linhas = useMemo(() => {
    const sorted = [...DRE_MKP_VARIACOES].sort((a, b) =>
      a.grupoProduto.localeCompare(b.grupoProduto, 'pt-BR'),
    );
    const match = criarMatcherTextoLivre(busca);
    return sorted.filter((r) => match(r.grupoProduto));
  }, [busca]);

  if (!aberto || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/70 dark:bg-slate-950/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex w-full max-w-lg max-h-[min(92vh,720px)] min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dre-mkp-titulo"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div className="min-w-0 pr-2">
            <h2 id="dre-mkp-titulo" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              MKP — Markup por grupo
            </h2>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
              Variação (%) aplicada ao Faturamento Indireto Líquido (MKP) na DRE.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className="shrink-0 border-b border-slate-200 px-4 py-2 dark:border-slate-600">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm text-slate-800 dark:text-slate-100"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-[1]">
              <tr className="bg-primary-600 text-left text-white shadow-sm">
                <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide">Grupo de Produto</th>
                <th className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-right w-28">MKP</th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    Nenhum grupo encontrado.
                  </td>
                </tr>
              ) : (
                linhas.map((row) => (
                  <tr
                    key={row.grupoProduto}
                    className="border-t border-slate-100 dark:border-slate-700 odd:bg-white even:bg-slate-50/80 dark:odd:bg-slate-800/40 dark:even:bg-slate-900/30"
                  >
                    <td className="px-4 py-2 text-slate-800 dark:text-slate-200">{row.grupoProduto}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium text-slate-700 dark:text-slate-300">
                      {formatarVariacaoMkp(row.variacao)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40">
          <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={mkpAtivo}
              onChange={(e) => onMkpAtivoChange(e.target.checked)}
              className="rounded border-slate-300 text-primary-600 focus:ring-primary-600"
            />
            <span>Aplicar markup na árvore DRE</span>
          </label>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 transition shadow-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
