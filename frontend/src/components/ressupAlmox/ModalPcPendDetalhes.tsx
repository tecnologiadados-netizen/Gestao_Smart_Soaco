import { useEffect, useState, type MutableRefObject } from 'react';
import { obterRessupAlmoxPcPendDetalhes, type RessupAlmoxPcPendLinha } from '../../api/compras';
import ModalAbaBackdrop from '../ModalAbaBackdrop';

function fmtQtde(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export type ModalPcPendDetalhesProps = {
  open: boolean;
  idProduto: number | null;
  codigo: string;
  descricao: string;
  onClose: () => void;
  /** Cache opcional (ex.: Consulta de Estoque) — reabrir modal = instantâneo até novo Filtrar. */
  cacheRef?: MutableRefObject<Map<number, RessupAlmoxPcPendLinha[]>>;
  /** Permite usar endpoint próprio (ex.: Ressup Não Almox). */
  fetchDetalhes?: (idProduto: number) => Promise<{ data: RessupAlmoxPcPendLinha[]; error?: string }>;
};

export default function ModalPcPendDetalhes({
  open,
  idProduto,
  codigo,
  descricao,
  onClose,
  cacheRef,
  fetchDetalhes,
}: ModalPcPendDetalhesProps) {
  const [linhas, setLinhas] = useState<RessupAlmoxPcPendLinha[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open || idProduto == null) {
      setLinhas([]);
      setErro(null);
      setCarregando(false);
      return;
    }
    const cached = cacheRef?.current.get(idProduto);
    if (cached) {
      setLinhas(cached);
      setErro(null);
      setCarregando(false);
      return;
    }
    let cancelled = false;
    setCarregando(true);
    setErro(null);
    const fetchFn = fetchDetalhes ?? obterRessupAlmoxPcPendDetalhes;
    void fetchFn(idProduto).then((r) => {
      if (cancelled) return;
      setCarregando(false);
      if (r.error) {
        setErro(r.error);
        setLinhas([]);
        return;
      }
      cacheRef?.current.set(idProduto, r.data);
      setLinhas(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, idProduto, cacheRef, fetchDetalhes]);

  if (!open) return null;

  const totalQtde = linhas.reduce((s, l) => s + (Number.isFinite(l.qtde) ? l.qtde : 0), 0);

  return (
    <ModalAbaBackdrop onClose={onClose}>
      <div
        className="flex max-h-[min(85vh,480px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
        role="dialog"
        aria-modal
        aria-labelledby="ressup-pc-pend-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 id="ressup-pc-pend-titulo" className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                PC Pend — {codigo}
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
          {carregando && <p className="py-6 text-center text-sm text-slate-500">Carregando...</p>}
          {!carregando && erro && <p className="py-4 text-center text-sm text-red-600 dark:text-red-300">{erro}</p>}
          {!carregando && !erro && linhas.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-500">Nenhum pedido de compra pendente.</p>
          )}
          {!carregando && !erro && linhas.length > 0 && (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-600 dark:bg-slate-900/50">
                  <th className="py-2 pr-2 font-semibold text-slate-700 dark:text-slate-200">Nº do PC</th>
                  <th className="py-2 pr-2 text-right font-semibold text-slate-700 dark:text-slate-200">Qtde</th>
                  <th className="py-2 text-right font-semibold text-slate-700 dark:text-slate-200">Data de entrega</th>
                </tr>
              </thead>
              <tbody className="text-slate-700 dark:text-slate-200">
                {linhas.map((row, i) => (
                  <tr key={`${row.pedidoCompra}-${i}`} className="border-b border-slate-100 dark:border-slate-700">
                    <td className="py-1.5 pr-2 font-mono">{row.pedidoCompra || '—'}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{fmtQtde(row.qtde)}</td>
                    <td className="py-1.5 text-right whitespace-nowrap">{row.dataEntrega ?? '—'}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-primary-200 bg-primary-50/80 font-semibold dark:border-primary-800 dark:bg-primary-900/30">
                  <td className="py-2 pr-2">Total</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{fmtQtde(totalQtde)}</td>
                  <td className="py-2" />
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
