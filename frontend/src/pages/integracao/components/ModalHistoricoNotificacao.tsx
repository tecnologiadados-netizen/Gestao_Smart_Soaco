import { useCallback, useEffect, useState, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { useRegisterModalEscape } from '../../../contexts/ModalStackContext';
import type {
  NotificacaoExecucaoHistorico,
  NotificacaoExecucaoStatus,
} from '../../../api/integracaoSms';

type Props = {
  open: boolean;
  onClose: () => void;
  titulo: string;
  canalLabel: string;
  loadHistorico: () => Promise<NotificacaoExecucaoHistorico[]>;
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function statusLabel(status: NotificacaoExecucaoStatus): string {
  if (status === 'success') return 'Sucesso';
  if (status === 'skipped') return 'Sem disparo';
  if (status === 'failed') return 'Falha';
  if (status === 'partial') return 'Parcial';
  if (status === 'running') return 'Em execução';
  return status;
}

function statusClass(status: NotificacaoExecucaoStatus): string {
  if (status === 'success') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200';
  }
  if (status === 'skipped') {
    return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
  }
  if (status === 'failed') {
    return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200';
  }
  if (status === 'partial') {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200';
  }
  return 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200';
}

function origemLabel(origem: string): string {
  if (origem === 'cron') return 'Agendado';
  if (origem === 'catchup') return 'Catch-up';
  if (origem === 'evento') return 'Evento';
  if (origem === 'teste') return 'Teste';
  return origem;
}

export default function ModalHistoricoNotificacao({
  open,
  onClose,
  titulo,
  canalLabel,
  loadHistorico,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<NotificacaoExecucaoHistorico[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useRegisterModalEscape({
    id: 'modal-historico-notificacao',
    onClose,
    zIndex: 14000,
    enabled: open,
  });

  const reload = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await loadHistorico();
      setRows(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao carregar histórico.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [loadHistorico]);

  useEffect(() => {
    if (!open) {
      setRows([]);
      setErr(null);
      setExpandedId(null);
      return;
    }
    void reload();
  }, [open, reload]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[14000] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-historico-notif-title"
        className="relative flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-600 px-5 py-4 shrink-0">
          <div className="min-w-0">
            <h2
              id="modal-historico-notif-title"
              className="text-base font-semibold text-slate-800 dark:text-slate-100"
            >
              Histórico — {titulo}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Execuções e tentativas de {canalLabel}. Status &quot;Sem disparo&quot; indica que o
              sistema rodou, mas não havia conteúdo/destinatário para enviar.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void reload()}
              disabled={loading}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              Atualizar
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Fechar
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4">
          {err && (
            <div className="mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              {err}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-10">
              Carregando histórico...
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-10">
              Nenhuma execução registrada para este alerta.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-600">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Início</th>
                    <th className="px-3 py-2 text-left font-semibold">Origem</th>
                    <th className="px-3 py-2 text-left font-semibold">Status</th>
                    <th className="px-3 py-2 text-left font-semibold">Resumo</th>
                    <th className="px-3 py-2 text-left font-semibold">Erro</th>
                    <th className="px-3 py-2 text-left font-semibold w-28">Detalhe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {rows.map((run) => {
                    const expanded = expandedId === run.id;
                    return (
                      <Fragment key={run.id}>
                        <tr className="bg-white dark:bg-slate-800">
                          <td className="px-3 py-2 whitespace-nowrap text-slate-700 dark:text-slate-200">
                            {formatDateTime(run.iniciadoEm)}
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                            {origemLabel(run.origem)}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(run.status)}`}
                            >
                              {statusLabel(run.status)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                            {run.resumo ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 max-w-[14rem] truncate">
                            {run.erroMensagem ?? '—'}
                          </td>
                          <td className="px-3 py-2">
                            {run.tentativas.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => setExpandedId(expanded ? null : run.id)}
                                className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                              >
                                {expanded
                                  ? 'Ocultar'
                                  : `Ver (${run.tentativas.length})`}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="bg-slate-50/80 dark:bg-slate-900/30">
                            <td colSpan={6} className="px-3 py-3">
                              <div className="rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
                                <table className="min-w-full text-xs">
                                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                    <tr>
                                      <th className="px-2 py-1.5 text-left font-semibold">Destinatário</th>
                                      <th className="px-2 py-1.5 text-left font-semibold">Resultado</th>
                                      <th className="px-2 py-1.5 text-left font-semibold">Erro</th>
                                      <th className="px-2 py-1.5 text-left font-semibold">Quando</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {run.tentativas.map((t) => (
                                      <tr key={t.id}>
                                        <td className="px-2 py-1.5 font-mono text-slate-700 dark:text-slate-200">
                                          {t.destinatario}
                                        </td>
                                        <td className="px-2 py-1.5">
                                          {t.ok ? (
                                            t.dryRun ? (
                                              <span className="text-amber-700 dark:text-amber-300">
                                                Dry-run
                                              </span>
                                            ) : (
                                              <span className="text-emerald-700 dark:text-emerald-300">
                                                OK
                                              </span>
                                            )
                                          ) : (
                                            <span className="text-rose-700 dark:text-rose-300">
                                              Falha
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-2 py-1.5 text-slate-500 dark:text-slate-400">
                                          {t.erro ?? '—'}
                                        </td>
                                        <td className="px-2 py-1.5 whitespace-nowrap text-slate-500 dark:text-slate-400">
                                          {formatDateTime(t.enviadoEm)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
