import { useEffect, useState, type MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchGestaoEntradasComprador,
  type GestaoEntradasCompradorDetalhe,
  type MundoCompradorGestao,
} from '../../api/gestaoEntradas';
import { TabelaDivergencias } from './GestaoEntradasDiaModal';

function chaveCache(params: {
  dataInicio: string;
  dataFim: string;
  escopo: 'reais' | 'geral';
  mundo: MundoCompradorGestao;
  comprador: string;
}): string {
  return `${params.dataInicio}|${params.dataFim}|${params.escopo}|${params.mundo}|${params.comprador}|detalhe`;
}

export default function GestaoEntradasCompradorModal({
  mundo,
  comprador,
  dataInicio,
  dataFim,
  escopo,
  cacheRef,
  onClose,
}: {
  mundo: MundoCompradorGestao;
  comprador: string;
  dataInicio: string;
  dataFim: string;
  escopo: 'reais' | 'geral';
  cacheRef: MutableRefObject<Map<string, GestaoEntradasCompradorDetalhe>>;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<GestaoEntradasCompradorDetalhe | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const chave = chaveCache({ dataInicio, dataFim, escopo, mundo, comprador });
    const cached = cacheRef.current.get(chave);
    if (cached?.notas) {
      setDetalhe(cached);
      setErro(null);
      setLoading(false);
      return;
    }
    let ativo = true;
    setLoading(true);
    setErro(null);
    void fetchGestaoEntradasComprador({ dataInicio, dataFim, escopo, mundo, comprador }).then((r) => {
      if (!ativo) return;
      if (r.erro || !r.data) {
        setErro(r.erro ?? 'Falha ao carregar o comprador.');
        setDetalhe(null);
      } else {
        cacheRef.current.set(chave, r.data);
        setDetalhe(r.data);
      }
      setLoading(false);
    });
    return () => {
      ativo = false;
    };
  }, [cacheRef, comprador, dataFim, dataInicio, escopo, mundo]);

  const tituloMundo = mundo === 'apontada' ? 'Divergência apontada no vínculo' : 'NF aceita com divergência';
  const leitura = escopo === 'reais' ? 'visão real' : 'visão geral';
  const notas = detalhe?.documentos ?? 0;
  const pedidos = detalhe?.pedidos ?? 0;
  const qtde = (detalhe?.notas ?? []).reduce((total, nota) => total + nota.divergencias.length, 0);

  return createPortal(
    <div className="fixed inset-0 z-[17000] flex items-center justify-center p-4 sm:p-6" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fechar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ge-comprador-titulo"
        className="relative flex h-[min(90vh,860px)] w-[min(96vw,1480px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-xl dark:border-white/10 dark:bg-[#161822]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div>
            <h2 id="ge-comprador-titulo" className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {comprador}
            </h2>
            <p className="text-xs text-slate-500">
              {loading
                ? 'Carregando divergências…'
                : `${tituloMundo} · ${qtde} ${qtde === 1 ? 'divergência' : 'divergências'} · ${notas} ${notas === 1 ? 'nota' : 'notas'} · ${pedidos} ${pedidos === 1 ? 'pedido' : 'pedidos'}${
                    mundo === 'apontada' && detalhe
                      ? ` · ${detalhe.ajustados} ${detalhe.ajustados === 1 ? 'ajustada' : 'ajustadas'}`
                      : ''
                  } · ${leitura}`}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={onClose}
          >
            Fechar
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {erro && (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
              {erro}
            </p>
          )}
          {loading && <p className="py-10 text-center text-sm text-slate-500">Carregando…</p>}
          {!loading && !erro && qtde === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">Nenhuma divergência deste comprador no período.</p>
          )}
          {qtde > 0 && detalhe ? <TabelaDivergencias notas={detalhe.notas} /> : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
