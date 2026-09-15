import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchAiSettings,
  saveAiSettings,
  testAiSettings,
  type AiSettingsResponse,
} from '../../api/aiSettings';

export default function AssistenteIaCredenciaisPage() {
  const [settings, setSettings] = useState<AiSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [model, setModel] = useState('gpt-4o-mini');
  const [apiKey, setApiKey] = useState('');

  const load = useCallback(async (opts?: { clearError?: boolean }) => {
    if (opts?.clearError !== false) setError(null);
    try {
      const data = await fetchAiSettings();
      setSettings(data);
      setModel(data.model || 'gpt-4o-mini');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const key = apiKey.trim();
    if (!settings?.configured && !key) {
      setError('Informe a API key OpenAI antes de salvar.');
      return;
    }
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const result = await saveAiSettings({
        model: model.trim() || 'gpt-4o-mini',
        apiKey: key || undefined,
      });
      setSettings(result.settings);
      setApiKey('');
      setOkMsg('Credencial do Amigaço salva com sucesso.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
      await load({ clearError: false });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    const key = apiKey.trim();
    if (!settings?.configured && !key) {
      setError('Informe a API key OpenAI antes de testar.');
      return;
    }
    setTesting(true);
    setError(null);
    setOkMsg(null);
    try {
      if (key) {
        const saved = await saveAiSettings({
          model: model.trim() || 'gpt-4o-mini',
          apiKey: key,
        });
        setSettings(saved.settings);
        setApiKey('');
      }
      const result = await testAiSettings();
      setSettings(result.settings);
      setOkMsg(`Teste OK${result.reply ? `: ${result.reply}` : ''}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao testar');
      await load({ clearError: false });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-sm text-slate-500 dark:text-slate-400">Carregando…</div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/integracao/credenciais"
          className="text-sm text-primary-600 hover:underline dark:text-primary-400"
        >
          ← Credenciais
        </Link>
      </div>
      <div>
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
          Assistente IA (Amigaço)
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Configure a chave da API OpenAI (ChatGPT) usada pelo FAQ inteligente no canto da tela.
          A chave fica criptografada no servidor e nunca é exibida novamente.
        </p>
      </div>

      <div
        className={`rounded-xl border px-4 py-3 text-sm ${
          settings?.configured
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
            : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
        }`}
      >
        {settings?.configured
          ? `API key configurada${settings.lastTestedAt ? ` · último teste ${new Date(settings.lastTestedAt).toLocaleString('pt-BR')}` : ''}`
          : 'API key ainda não configurada'}
        {settings?.lastError ? (
          <p className="mt-1 text-red-600 dark:text-red-300">Último erro: {settings.lastError}</p>
        ) : null}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      )}
      {okMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          {okMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/50">
        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Modelo</span>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            placeholder="gpt-4o-mini"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Padrão recomendado: gpt-4o-mini (custo/qualidade para FAQ).
          </span>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            API key OpenAI
          </span>
          <input
            type="password"
            autoComplete="new-password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            placeholder={settings?.hasApiKey ? '•••••••• (deixe em branco para manter)' : 'sk-…'}
          />
          <span className="mt-1 block text-xs text-slate-500">
            Cole a chave completa (começa com sk-). Se o navegador preencher bolinhas sozinho, apague e cole de novo.
          </span>
        </label>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          <button
            type="button"
            disabled={testing}
            onClick={() => void handleTest()}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800 disabled:opacity-60"
          >
            {testing ? 'Testando…' : 'Testar conexão'}
          </button>
        </div>
      </form>
    </div>
  );
}
