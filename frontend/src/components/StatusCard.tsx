import { useState, useEffect, useCallback } from 'react';
import { getStatus, sincronizar, formatarDataHora, type StatusResponse } from '../api/status';

interface StatusCardProps {
  /** Chamado após sincronização concluída com sucesso (para refresh da grade). */
  onSincronizado?: () => void;
}

export default function StatusCard({ onSincronizado }: StatusCardProps) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await getStatus();
      setStatus(s);
    } catch {
      setStatus({ lastUpload: null, lastSyncErp: null, nomusOk: false, nomusError: 'API inacessível' });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSincronizar = async () => {
    setSyncError(null);
    setSyncing(true);
    try {
      await sincronizar();
      await load();
      onSincronizado?.();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Erro ao sincronizar');
      await load();
    } finally {
      setSyncing(false);
    }
  };

  if (!status) return null;

  return (
    <aside className="space-y-3 shrink-0" aria-label="Último upload e sincronização">
      <div className="card-panel">
        <p className="card-kpi-label mb-1">Conexão com API / ERP</p>
        <p className="text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
          {status.nomusOk === true ? (
            <span className="text-green-600 dark:text-green-400">Conectado</span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400" title={status.nomusError ?? undefined}>
              {status.nomusError ?? 'Indisponível'}
            </span>
          )}
        </p>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-3 mb-1">Último upload</p>
        <p className="text-sm text-slate-800 dark:text-slate-200">{formatarDataHora(status.lastUpload)}</p>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-3 mb-1">Última sincronização com ERP</p>
        <p className="text-sm text-slate-800 dark:text-slate-200">{formatarDataHora(status.lastSyncErp)}</p>
      </div>
      <button
        type="button"
        onClick={handleSincronizar}
        disabled={syncing}
        className="w-full rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-70 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium text-white transition flex items-center justify-center gap-2"
      >
        {syncing ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Integração ao Nomus...
          </>
        ) : (
          'Sincronizar'
        )}
      </button>
      {syncError && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2" title={syncError}>
          {syncError.length > 50 ? `${syncError.slice(0, 50)}…` : syncError}
        </p>
      )}
    </aside>
  );
}
