import { useEffect, useState, type MutableRefObject } from 'react';
import {
  obterRessupEmpenhoPorPedido,
  type RessupEmpenhoPedidoResultado,
} from '../../api/compras';
import ModalAbaBackdrop from '../ModalAbaBackdrop';
import EmpenhoLiquidoPainel from './EmpenhoLiquidoPainel';

export type ModalEmpenhoRessupProps = {
  open: boolean;
  idProduto: number | null;
  codigo: string;
  descricao: string;
  /** Estoque atual da grade — base do saldo projetado no modal. */
  saldoAtual: number;
  considerarRequisicoes: boolean;
  onClose: () => void;
  /** Cache opcional — reabrir o modal é instantâneo até novo Filtrar. */
  cacheRef?: MutableRefObject<Map<string, RessupEmpenhoPedidoResultado>>;
  /** Ressup Não Almox: abatimento PA por explosão BOM. */
  modoNaoAlmox?: boolean;
};

/**
 * Detalhe analítico do empenho das telas de Ressup, POR PEDIDO de venda, com a MESMA regra
 * da grade: o estoque de produto acabado (PA) cobre as datas de produção mais próximas primeiro, então
 * a soma do empenho líquido por pedido é igual à coluna "Qtde Empenhada".
 */
export default function ModalEmpenhoRessup({
  open,
  idProduto,
  codigo,
  descricao,
  saldoAtual,
  considerarRequisicoes,
  onClose,
  cacheRef,
  modoNaoAlmox = false,
}: ModalEmpenhoRessupProps) {
  const [detalhe, setDetalhe] = useState<RessupEmpenhoPedidoResultado | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open || idProduto == null) {
      setDetalhe(null);
      setErro(null);
      setCarregando(false);
      return;
    }
    const cacheKey = `${idProduto}-${considerarRequisicoes ? '1' : '0'}-${modoNaoAlmox ? 'na' : 'alm'}`;
    const cached = cacheRef?.current.get(cacheKey);
    if (cached) {
      setDetalhe(cached);
      setErro(null);
      setCarregando(false);
      return;
    }
    let cancelled = false;
    setCarregando(true);
    setErro(null);
    void obterRessupEmpenhoPorPedido(idProduto, considerarRequisicoes, modoNaoAlmox).then((r) => {
      if (cancelled) return;
      setCarregando(false);
      if (r.error) {
        setErro(r.error);
        setDetalhe(null);
        return;
      }
      if (r.data) cacheRef?.current.set(cacheKey, r.data);
      setDetalhe(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, idProduto, considerarRequisicoes, cacheRef, modoNaoAlmox]);

  if (!open) return null;

  return (
    <ModalAbaBackdrop onClose={onClose} className="items-start overflow-y-auto py-4">
      <div
        className="my-auto flex max-h-[min(88vh,680px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
        role="dialog"
        aria-modal
        aria-labelledby="ressup-empenho-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 id="ressup-empenho-titulo" className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Empenho por pedido — {codigo}
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

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden overscroll-contain px-4 py-3">
          {carregando && <p className="py-6 text-center text-sm text-slate-500">Carregando...</p>}
          {!carregando && erro && <p className="py-4 text-center text-sm text-red-600 dark:text-red-300">{erro}</p>}
          {!carregando && !erro && detalhe && (
            <EmpenhoLiquidoPainel
              detalhe={detalhe}
              saldoAtual={saldoAtual}
              rotuloTotal="Empenho líquido"
              mostrarCards
              layoutSticky
            />
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
