import { useEffect, useState, type MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchGestaoEntradasComprador,
  type GestaoEntradasCompradorDetalhe,
  type GestaoEntradasCompradorLinha,
  type MundoCompradorGestao,
} from '../../api/gestaoEntradas';

const SITUACAO: Record<GestaoEntradasCompradorLinha['situacao'], { label: string; className: string }> = {
  ainda_divergente: {
    label: 'Ainda divergente',
    className: 'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-100',
  },
  vinculo_ajustado: {
    label: 'Vínculo ajustado',
    className: 'border-sky-400 bg-sky-50 text-sky-900 dark:border-sky-500 dark:bg-sky-950/40 dark:text-sky-100',
  },
  aceita: {
    label: 'Divergência aceita',
    className: 'border-rose-400 bg-rose-50 text-rose-800 dark:border-rose-500 dark:bg-rose-950/40 dark:text-rose-100',
  },
};

function fmtDataBr(ymd: string): string {
  const [y, m, d] = ymd.slice(0, 10).split('-');
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

function chaveCache(params: {
  dataInicio: string;
  dataFim: string;
  escopo: 'reais' | 'geral';
  mundo: MundoCompradorGestao;
  comprador: string;
}): string {
  return `${params.dataInicio}|${params.dataFim}|${params.escopo}|${params.mundo}|${params.comprador}`;
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
    if (cached) {
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

  return createPortal(
    <div className="fixed inset-0 z-[17000] flex items-center justify-center p-4 sm:p-6" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fechar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ge-comprador-titulo"
        className="relative flex h-[min(90vh,860px)] w-[min(96vw,1100px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-xl dark:border-white/10 dark:bg-[#161822]"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div>
            <h2 id="ge-comprador-titulo" className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {comprador}
            </h2>
            <p className="text-xs text-slate-500">
              {loading
                ? 'Carregando documentos…'
                : `${tituloMundo} · ${notas} ${notas === 1 ? 'nota' : 'notas'} · ${pedidos} ${pedidos === 1 ? 'pedido' : 'pedidos'}${
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
          {!loading && !erro && (detalhe?.linhas.length ?? 0) === 0 && (
            <p className="py-10 text-center text-sm text-slate-500">Nenhum documento deste comprador no período.</p>
          )}
          {(detalhe?.linhas.length ?? 0) > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-white/10">
              <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr>
                    {['Entrada', 'Pedido', 'Campos', 'Situação'].map((coluna) => (
                      <th
                        key={coluna}
                        className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100 px-3 py-2 font-medium dark:border-white/10 dark:bg-[#1c2030]"
                      >
                        {coluna}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="[&_td]:border-b [&_td]:border-slate-200 dark:[&_td]:border-white/10">
                  {detalhe?.linhas.map((linha, indice) => {
                    const selo = SITUACAO[linha.situacao];
                    const faixa = indice % 2 === 0 ? 'bg-white dark:bg-[#161822]' : 'bg-slate-100 dark:bg-[#232838]';
                    return (
                      <tr key={`${linha.idDocumento}-${linha.idPedidoCompra}`}>
                        <td className={`px-3 py-2 ${faixa}`}>
                          <p className="font-medium text-slate-800 dark:text-slate-100">
                            {linha.numeroDocumentoFiscal ?? `Documento ${linha.idDocumento}`}
                          </p>
                          <p className="text-xs text-slate-500">
                            {fmtDataBr(linha.dataEntrada)}
                            {linha.numeroNfe ? ` · NF ${linha.numeroNfe}` : ''}
                            {linha.nomeParceiro ? ` · ${linha.nomeParceiro}` : ''}
                          </p>
                        </td>
                        <td className={`px-3 py-2 text-slate-800 dark:text-slate-100 ${faixa}`}>{linha.nomePedidoCompra}</td>
                        <td className={`px-3 py-2 text-slate-700 dark:text-slate-200 ${faixa}`}>{linha.campos.join(', ')}</td>
                        <td className={`px-3 py-2 ${faixa}`}>
                          <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold ${selo.className}`}>
                            {selo.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
