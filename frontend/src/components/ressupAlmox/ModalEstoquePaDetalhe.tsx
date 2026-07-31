import type { RessupEstoquePaLinha } from '../../api/compras';
import ModalAbaBackdrop from '../ModalAbaBackdrop';

function fmtQtde(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export type ModalEstoquePaDetalheProps = {
  open: boolean;
  codigo: string;
  descricao: string;
  linhas: RessupEstoquePaLinha[];
  onClose: () => void;
};

/**
 * Detalhe analítico do card "Estoque em PA": PAs com estoque × BOM do componente.
 * Dados já vêm na resposta do empenho (sem fetch extra).
 */
export default function ModalEstoquePaDetalhe({
  open,
  codigo,
  descricao,
  linhas,
  onClose,
}: ModalEstoquePaDetalheProps) {
  if (!open) return null;

  const totalComp = linhas.reduce(
    (s, l) => s + (Number.isFinite(l.qtdeComponente) ? l.qtdeComponente : 0),
    0
  );

  return (
    <ModalAbaBackdrop onClose={onClose} zIndexClass="z-[15000]">
      <div
        className="flex max-h-[min(85vh,520px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
        role="dialog"
        aria-modal
        aria-labelledby="estoque-pa-detalhe-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3
                id="estoque-pa-detalhe-titulo"
                className="text-sm font-semibold text-slate-800 dark:text-slate-100"
              >
                Estoque em PA — {codigo}
              </h3>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 line-clamp-2" title={descricao}>
                {descricao}
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
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain px-4 py-3">
          {linhas.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              Nenhum produto acabado com estoque para este componente.
            </p>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-600 dark:bg-slate-900/50">
                  <th className="py-2 pr-2 font-semibold text-slate-700 dark:text-slate-200">Cód</th>
                  <th className="py-2 pr-2 font-semibold text-slate-700 dark:text-slate-200">Descrição</th>
                  <th className="py-2 pr-2 text-right font-semibold text-slate-700 dark:text-slate-200">
                    Qtde PA
                  </th>
                  <th className="py-2 text-right font-semibold text-slate-700 dark:text-slate-200">
                    Qtde Componente
                  </th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-200">
                {linhas.map((row, i) => (
                  <tr key={`${row.codigo}-${i}`} className="border-b border-slate-100 dark:border-slate-700">
                    <td className="py-1.5 pr-2 font-mono whitespace-nowrap">{row.codigo || '—'}</td>
                    <td className="py-1.5 pr-2">
                      <span className="line-clamp-2" title={row.descricao}>
                        {row.descricao || '—'}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{fmtQtde(row.qtdePa)}</td>
                    <td className="py-1.5 text-right tabular-nums">{fmtQtde(row.qtdeComponente)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-primary-200 bg-primary-50/80 font-semibold dark:border-primary-800 dark:bg-primary-900/30">
                  <td className="py-2 pr-2" colSpan={3}>
                    Total
                  </td>
                  <td className="py-2 text-right tabular-nums">{fmtQtde(totalComp)}</td>
                </tr>
              </tbody>
            </table>
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
    </ModalAbaBackdrop>
  );
}
