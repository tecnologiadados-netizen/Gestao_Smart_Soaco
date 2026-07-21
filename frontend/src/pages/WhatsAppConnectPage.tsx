import { useState, useEffect, useCallback } from 'react';
import { getEvolutionConnect, saveEvolutionConfig, logoutEvolution, type EvolutionConnectResponse } from '../api/evolution';

const REFRESH_MS = 15000;

export default function WhatsAppConnectPage() {
  const [data, setData] = useState<EvolutionConnectResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [number, setNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);

  const fetchConnect = useCallback(async () => {
    setError(null);
    try {
      const result = await getEvolutionConnect();
      setData(result);
      if (result.error) setError(result.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao conectar com a Evolution API');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnect();
  }, [fetchConnect]);

  useEffect(() => {
    if (data?.error || data?.connected || data?.configured === false) return;
    if (!data?.qrCodeBase64) return;
    const t = setInterval(fetchConnect, REFRESH_MS);
    return () => clearInterval(t);
  }, [data?.error, data?.connected, data?.configured, data?.qrCodeBase64, fetchConnect]);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto flex flex-col items-center justify-center py-12">
        <p className="text-slate-600 dark:text-slate-400">Carregando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto flex flex-col items-center py-12">
        <p className="text-red-600 dark:text-red-400 mb-2 text-center">{error}</p>
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 text-center">
          Se o WhatsApp foi desconectado ou o token expirou, clique em &quot;Reconectar&quot; para exibir o QR code novamente.
        </p>
        <button
          type="button"
          onClick={() => { setLoading(true); setError(null); fetchConnect(); }}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          Reconectar
        </button>
      </div>
    );
  }

  if (!data?.configured) {
    return (
      <div className="max-w-lg mx-auto py-12">
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-6">
          <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-2">Evolution API não configurada</h2>
          <p className="text-amber-700 dark:text-amber-300 text-sm">
            Configure <code className="bg-amber-200/50 dark:bg-amber-800/50 px-1 rounded">EVOLUTION_API_URL</code> e{' '}
            <code className="bg-amber-200/50 dark:bg-amber-800/50 px-1 rounded">EVOLUTION_API_KEY</code> no .env do backend.
            Guia: <code className="bg-amber-200/50 dark:bg-amber-800/50 px-1 rounded">docs/WHATSAPP-EVOLUTION-GESTAO.md</code>.
          </p>
        </div>
      </div>
    );
  }

  if (data.connected) {
    const envOk = data.instanceConfiguredInEnv === true;
    const showNumberForm = !envOk && data.instance;
    return (
      <div className="max-w-lg mx-auto py-12">
        <div className={`rounded-xl border p-6 text-center ${
          envOk
            ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
            : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
        }`}>
          <div className="text-4xl mb-3">{envOk ? '✅' : '⚠️'}</div>
          <h2 className={`text-lg font-semibold ${envOk ? 'text-green-800 dark:text-green-200' : 'text-amber-800 dark:text-amber-200'}`}>
            {envOk ? 'WhatsApp conectado' : 'Conectado – defina o número para envio'}
          </h2>
          <p className={`text-sm mt-1 ${envOk ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
            Instância: <strong>{data.instance}</strong>
          </p>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-2">{data.message}</p>

          {showNumberForm && (
            <div className="mt-4 p-4 bg-white dark:bg-slate-800/50 rounded-lg text-left">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Número do WhatsApp (com DDD, ex: 5586995887672)</p>
              <input
                type="text"
                value={number || data.storedNumber || ''}
                onChange={(e) => { setNumber(e.target.value); setSaveError(null); }}
                placeholder="5586995887672"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-800 dark:text-slate-200"
              />
              {saveError && <p className="text-red-600 dark:text-red-400 text-xs mt-1">{saveError}</p>}
              <button
                type="button"
                disabled={saving || !(number || data.storedNumber || '').trim()}
                onClick={async () => {
                  const num = (number || data.storedNumber || '').trim().replace(/\D/g, '');
                  if (!num || !data.instance) return;
                  setSaving(true);
                  setSaveError(null);
                  try {
                    await saveEvolutionConfig(data.instance, num);
                    setNumber('');
                    await fetchConnect();
                  } catch (e) {
                    setSaveError(e instanceof Error ? e.message : 'Erro ao salvar');
                  } finally {
                    setSaving(false);
                  }
                }}
                className="mt-2 w-full rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white"
              >
                {saving ? 'Salvando...' : 'Salvar e habilitar envio'}
              </button>
            </div>
          )}

          {data.envHint && !showNumberForm && (
            <p className="text-amber-700 dark:text-amber-300 text-xs mt-4 p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-left">
              📌 {data.envHint}
            </p>
          )}

          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-600">
            <p className="text-slate-600 dark:text-slate-400 text-xs mb-2">Desconectar este WhatsApp da Evolution API (será necessário escanear o QR code novamente)</p>
            {disconnectError && <p className="text-red-600 dark:text-red-400 text-xs mb-2">{disconnectError}</p>}
            <button
              type="button"
              disabled={disconnecting}
              onClick={async () => {
                setDisconnectError(null);
                setDisconnecting(true);
                try {
                  await logoutEvolution();
                  await fetchConnect();
                } catch (e) {
                  setDisconnectError(e instanceof Error ? e.message : 'Erro ao desconectar');
                } finally {
                  setDisconnecting(false);
                }
              }}
              className="w-full rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50"
            >
              {disconnecting ? 'Desconectando...' : 'Desconectar da API'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-8">
      <div className="card-panel p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">Conectar WhatsApp</h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
          Escaneie o QR code no WhatsApp: Configurações → Aparelhos conectados → Conectar um aparelho.
        </p>
        {data.instance && (
          <p className="text-slate-500 dark:text-slate-500 text-xs mb-3">
            Instância: <strong>{data.instance}</strong>
          </p>
        )}
        {data.qrCodeBase64 && (
          <div className="flex justify-center bg-white p-4 rounded-lg border border-slate-200 dark:border-slate-600">
            <img
              src={`data:image/png;base64,${data.qrCodeBase64}`}
              alt="QR Code para conectar WhatsApp"
              className="w-64 h-64 object-contain"
            />
          </div>
        )}
        {data.pairingCode && (
          <p className="text-center text-slate-600 dark:text-slate-400 text-sm mt-3">
            Código de pareamento: <strong className="font-mono">{data.pairingCode}</strong>
          </p>
        )}
        {data.envHint && (
          <p className="text-amber-700 dark:text-amber-300 text-xs mt-3 p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            📌 {data.envHint}
          </p>
        )}
        <p className="text-slate-500 dark:text-slate-500 text-xs text-center mt-4">
          O QR code é atualizado automaticamente a cada 15 s até você conectar.
        </p>
        <div className="mt-4 flex justify-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => { setLoading(true); fetchConnect(); }}
            className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition"
          >
            Atualizar QR code
          </button>
          <button
            type="button"
            onClick={() => { setLoading(true); setError(null); fetchConnect(); }}
            className="px-4 py-2 text-sm bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-800 dark:text-slate-200 rounded-lg transition"
          >
            Reconectar
          </button>
        </div>
      </div>
    </div>
  );
}
