import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchEmailSettings, saveEmailSettings, sendTestEmail, type EmailSettingsResponse } from '../../api/emailSettings';

const OAUTH_HELP = [
  'Habilite a Gmail API no Google Cloud Console.',
  'Crie credenciais OAuth tipo Aplicativo da Web.',
  'Adicione o redirect: https://developers.google.com/oauthplayground',
  'No OAuth Playground: escopo https://mail.google.com/, access type Offline.',
  'O from_email deve ser a mesma conta autorizada no Playground.',
];

export default function EmailCredenciaisPage() {
  const [settings, setSettings] = useState<EmailSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState<{
    to: string;
    at: string;
    from: string;
  } | null>(null);

  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [testTo, setTestTo] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchEmailSettings();
      setSettings(data);
      setFromEmail(data.fromEmail);
      setFromName(data.fromName);
      setClientId(data.clientId);
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
    setSaving(true);
    setError(null);
    setOkMsg(null);
    setTestSuccess(null);
    try {
      const result = await saveEmailSettings({
        fromEmail: fromEmail.trim(),
        fromName: fromName.trim(),
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim() || undefined,
        refreshToken: refreshToken.trim() || undefined,
      });
      setSettings(result.settings);
      setClientSecret('');
      setRefreshToken('');
      setOkMsg('Credencial salva com sucesso.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    const dest = testTo.trim();
    if (!dest) {
      setError('Informe o e-mail de teste antes de enviar.');
      return;
    }
    if (!settings?.configured) {
      setError('Salve a credencial (Client Secret e Refresh Token) antes de testar o envio.');
      return;
    }
    setTesting(true);
    setError(null);
    setOkMsg(null);
    setTestSuccess(null);
    try {
      const result = await sendTestEmail(dest);
      setSettings(result.settings);
      const at = result.sentAt ?? result.settings.lastTestedAt ?? new Date().toISOString();
      const from = result.from ?? result.settings.fromEmail ?? fromEmail;
      setTestSuccess({ to: result.to ?? dest, at, from });
      setOkMsg(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar teste');
      await load();
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center text-slate-600 dark:text-slate-400">
        Carregando credencial de e-mail...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Integração · Credenciais
        </p>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">E-mail (Gmail API)</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Credencial OAuth para envio automático de notificações do SGQ (validade, prazos, calibração).
        </p>
      </div>

      {settings?.configured && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            settings.lastError
              ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200'
          }`}
        >
          {settings.lastError ? (
            <>
              <strong>Último erro:</strong> {settings.lastError}
              {settings.credentialBlockSummary && (
                <p className="mt-1 text-xs opacity-90">{settings.credentialBlockSummary}</p>
              )}
            </>
          ) : (
            <>
              Credencial configurada
              {settings.lastTestedAt && (
                <span className="ml-2 text-xs opacity-80">
                  · último teste OK em {new Date(settings.lastTestedAt).toLocaleString('pt-BR')}
                </span>
              )}
            </>
          )}
        </div>
      )}

      {testSuccess && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/25 px-5 py-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none" aria-hidden>
              ✓
            </span>
            <div className="min-w-0">
              <p className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
                E-mail de teste enviado com sucesso
              </p>
              <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
                Destinatário: <strong>{testSuccess.to}</strong>
              </p>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                Remetente: <strong>{testSuccess.from}</strong>
              </p>
              <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                Enviado em {new Date(testSuccess.at).toLocaleString('pt-BR')} · Confira a caixa de entrada e o spam.
              </p>
            </div>
          </div>
        </div>
      )}

      {okMsg && !testSuccess && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 px-4 py-2.5 text-sm text-emerald-800 dark:text-emerald-200">
          {okMsg}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-4 py-2.5 text-sm text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-mail remetente</label>
          <input
            type="email"
            required
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-800 dark:text-slate-200"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome remetente</label>
          <input
            type="text"
            required
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-800 dark:text-slate-200"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Client ID (Google OAuth)</label>
          <input
            type="text"
            required
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-800 dark:text-slate-200 font-mono text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Client Secret</label>
          <input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder={settings?.hasClientSecret ? 'Já configurado. Preencha apenas para substituir.' : 'Obrigatório na primeira configuração'}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-800 dark:text-slate-200"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Refresh Token</label>
          <input
            type="password"
            value={refreshToken}
            onChange={(e) => setRefreshToken(e.target.value)}
            placeholder={settings?.hasRefreshToken ? 'Já configurado. Preencha apenas para substituir.' : 'Obrigatório na primeira configuração'}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-800 dark:text-slate-200"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-mail de teste</label>
          <input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="destino@empresa.com.br"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-slate-800 dark:text-slate-200"
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Usa a credencial já salva no banco — não é necessário salvar de novo para testar.
          </p>
          {testSuccess && testSuccess.to === testTo.trim() && (
            <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              Último envio para este endereço confirmado pelo sistema.
            </p>
          )}
        </div>

        <div className="rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-600 p-4 text-xs text-slate-600 dark:text-slate-400 space-y-1">
          <p className="font-semibold text-slate-700 dark:text-slate-300">Ajuda OAuth Gmail</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {OAUTH_HELP.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="pt-2">
            No servidor: <code className="bg-slate-200/60 dark:bg-slate-700 px-1 rounded">EMAIL_SETTINGS_ENCRYPTION_KEY</code> (criptografia)
            e <code className="bg-slate-200/60 dark:bg-slate-700 px-1 rounded">APP_BASE_URL</code> (links nos e-mails, ex. https://gsmartsoaco.com.br).
          </p>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || testing}
            className="rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-5 py-2 text-sm font-semibold text-white"
          >
            {saving ? 'Salvando...' : 'Salvar credencial'}
          </button>
          <button
            type="button"
            disabled={testing || saving}
            title={
              settings?.configured
                ? 'Envia e-mail de teste com a credencial salva'
                : 'Salve a credencial antes de enviar o teste'
            }
            onClick={() => void handleSendTest()}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-5 py-2 text-sm font-semibold text-white"
          >
            {testing ? 'Enviando...' : 'Enviar e-mail de teste'}
          </button>
          <Link
            to="/integracao/credenciais"
            className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Voltar
          </Link>
        </div>
        {!settings?.configured && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Para testar o envio, salve a credencial uma vez (com Client Secret e Refresh Token). Depois use
            &quot;Enviar e-mail de teste&quot; quantas vezes quiser.
          </p>
        )}
      </form>
    </div>
  );
}
