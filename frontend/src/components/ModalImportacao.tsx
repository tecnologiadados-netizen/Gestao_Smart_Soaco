import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { ImportacaoBloqueioDetalhe } from '../utils/mensagensImportacaoPedidos';

export interface ResultadoImportacao {
  ok: number;
  erros: number;
  errosLista?: string[];
}

interface ModalImportacaoProps {
  open: boolean;
  progresso: number;
  status: 'importando' | 'sucesso' | 'erro';
  resultado: ResultadoImportacao | null;
  mensagemErro?: string;
  /** Quando a importação é bloqueada antes de processar, exibe motivo e orientações. */
  bloqueio?: ImportacaoBloqueioDetalhe | null;
  onClose: () => void;
}

function tituloErroImportacao(mensagemErro?: string, bloqueio?: ImportacaoBloqueioDetalhe | null): string {
  if (bloqueio?.titulo) return bloqueio.titulo;
  if (
    mensagemErro?.startsWith('Upload bloqueado') ||
    mensagemErro?.includes('motivo não preenchido') ||
    mensagemErro?.includes('carrada')
  ) {
    return 'Upload bloqueado';
  }
  return 'Importação finalizada com erros';
}

export default function ModalImportacao({
  open,
  progresso,
  status,
  resultado,
  mensagemErro,
  bloqueio,
  onClose,
}: ModalImportacaoProps) {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  const mostraBloqueio = status === 'erro' && bloqueio != null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/60 dark:bg-slate-950/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 overflow-y-auto">
          {status === 'importando' && (
            <>
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="relative w-12 h-12">
                  <svg className="w-12 h-12 animate-spin text-primary-600" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
                <span className="text-lg font-semibold text-slate-800 dark:text-slate-200">Importando...</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-primary-600 dark:bg-primary-500 transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, progresso))}%` }}
                />
              </div>
              <p className="mt-2 text-center text-sm font-medium text-slate-600 dark:text-slate-400">{progresso}%</p>
            </>
          )}

          {(status === 'sucesso' || status === 'erro') && (
            <>
              <div className="flex justify-center mb-4">
                {status === 'sucesso' ? (
                  <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                    <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                    <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                )}
              </div>

              <h3 className="text-center text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
                {status === 'sucesso' ? 'Importação concluída' : tituloErroImportacao(mensagemErro, bloqueio)}
              </h3>

              {mostraBloqueio && bloqueio && (
                <div className="space-y-4 text-left text-sm">
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{bloqueio.motivo}</p>

                  {bloqueio.itens && bloqueio.itens.valores.length > 0 && (
                    <div className="rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/30 px-3 py-2.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300 mb-1.5">
                        {bloqueio.itens.rotulo}
                      </p>
                      <p className="text-slate-800 dark:text-slate-100 font-medium break-words">
                        {bloqueio.itens.valores.join(', ')}
                      </p>
                    </div>
                  )}

                  {bloqueio.acoes.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                        O que fazer
                      </p>
                      <ol className="list-decimal list-inside space-y-1.5 text-slate-700 dark:text-slate-300">
                        {bloqueio.acoes.map((acao, i) => (
                          <li key={i} className="leading-snug pl-0.5">
                            {acao}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {bloqueio.itens?.rotulo.toLowerCase().includes('pedido') && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      <Link
                        to="/pedidos/sycroorder"
                        className="text-primary-600 dark:text-primary-400 font-medium hover:underline"
                        onClick={onClose}
                      >
                        Abrir Comunicação PD
                      </Link>
                      {' '}
                      para alterar a previsão no card.
                    </p>
                  )}
                </div>
              )}

              {!mostraBloqueio && mensagemErro && (
                <p className="text-center text-sm text-red-600 dark:text-red-400 mb-3 whitespace-pre-wrap">{mensagemErro}</p>
              )}

              {resultado && (
                <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50 p-3 text-sm text-slate-700 dark:text-slate-300 space-y-1 mt-4">
                  <p>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{resultado.ok}</span> pedido(s) atualizado(s).
                  </p>
                  {resultado.erros > 0 && (
                    <>
                      <p>
                        <span className="font-medium text-amber-600 dark:text-amber-400">{resultado.erros}</span> erro(s).
                      </p>
                      {resultado.errosLista && resultado.errosLista.length > 0 && (
                        <div className="mt-2 max-h-24 overflow-y-auto">
                          <p className="font-medium text-slate-600 dark:text-slate-400 text-xs mb-1">Detalhes:</p>
                          <ul className="list-disc list-inside text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                            {resultado.errosLista.slice(0, 10).map((msg, i) => (
                              <li key={i}>{msg}</li>
                            ))}
                            {resultado.errosLista.length > 10 && (
                              <li>... e mais {resultado.errosLista.length - 10} erro(s)</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {(status === 'sucesso' || status === 'erro') && (
          <div className="px-6 pb-6 pt-0 flex justify-center border-t border-slate-100 dark:border-slate-700/80 mt-auto">
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full sm:w-auto px-6 py-2.5 rounded-lg bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-800 dark:text-slate-100 text-sm font-medium"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
