import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSOES } from '../../config/permissoes';
import { fetchEmailSettings, type EmailSettingsResponse } from '../../api/emailSettings';
import { getEvolutionConnect, type EvolutionConnectResponse } from '../../api/evolution';

function CredencialCard({
  title,
  description,
  ok,
  detail,
  to,
  linkLabel,
}: {
  title: string;
  description: string;
  ok: boolean;
  detail: string;
  to: string;
  linkLabel: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span
          className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
          <p
            className={`text-sm font-medium mt-2 ${ok ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}
          >
            {detail}
          </p>
        </div>
      </div>
      <Link
        to={to}
        className="inline-flex self-start rounded-lg bg-primary-600 hover:bg-primary-700 px-4 py-2 text-sm font-medium text-white"
      >
        {linkLabel}
      </Link>
    </div>
  );
}

export default function CredenciaisPage() {
  const { hasPermission, isMaster } = useAuth();
  const podeEmail = isMaster || hasPermission(PERMISSOES.SISTEMA_EMAIL) || hasPermission(PERMISSOES.USUARIOS_GERENCIAR);
  const podeWhatsapp = isMaster || hasPermission(PERMISSOES.SISTEMA_WHATSAPP) || hasPermission(PERMISSOES.USUARIOS_GERENCIAR);

  const [emailSettings, setEmailSettings] = useState<EmailSettingsResponse | null>(null);
  const [whatsapp, setWhatsapp] = useState<EvolutionConnectResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tasks: Promise<void>[] = [];
        if (podeEmail) {
          tasks.push(
            fetchEmailSettings()
              .then((d) => {
                if (!cancelled) setEmailSettings(d);
              })
              .catch(() => {
                if (!cancelled) setEmailSettings(null);
              })
          );
        }
        if (podeWhatsapp) {
          tasks.push(
            getEvolutionConnect()
              .then((d) => {
                if (!cancelled) setWhatsapp(d);
              })
              .catch(() => {
                if (!cancelled) setWhatsapp(null);
              })
          );
        }
        await Promise.all(tasks);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [podeEmail, podeWhatsapp]);

  const emailOk = Boolean(emailSettings?.configured && !emailSettings.lastError);
  const whatsappOk = Boolean(whatsapp?.connected && whatsapp?.instanceConfiguredInEnv !== false);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Integração
        </p>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Credenciais</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Configure os canais de envio automático (e-mail e WhatsApp).
        </p>
      </div>

      {loading ? (
        <p className="text-slate-600 dark:text-slate-400 text-sm">Carregando status...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {podeEmail && (
            <CredencialCard
              title="E-mail (Gmail)"
              description="Notificações automáticas do SGQ: validade de documentos, prazos, calibração e verificação."
              ok={emailOk}
              detail={
                !emailSettings?.configured
                  ? 'Não configurado'
                  : emailSettings.lastError
                    ? 'Erro na credencial'
                    : 'Credencial ativa'
              }
              to="/integracao/credenciais/email"
              linkLabel="Configurar e-mail"
            />
          )}
          {podeWhatsapp && (
            <CredencialCard
              title="WhatsApp"
              description="Mensagens automáticas via Evolution API (SMS, faturamento, pedidos vencidos)."
              ok={whatsappOk}
              detail={
                !whatsapp?.configured
                  ? 'API não configurada no .env'
                  : whatsapp.connected
                    ? 'Instância conectada'
                    : 'Aguardando conexão'
              }
              to="/whatsapp"
              linkLabel="Configurar WhatsApp"
            />
          )}
        </div>
      )}

      {!podeEmail && !podeWhatsapp && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-200">
          Sem permissão para gerenciar credenciais de e-mail ou WhatsApp.
        </div>
      )}
    </div>
  );
}
