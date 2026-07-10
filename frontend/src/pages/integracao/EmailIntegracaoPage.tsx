import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSOES } from '../../config/permissoes';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import {
  getEmailTipos,
  getEmailUsuarios,
  previewEmailTipo,
  saveEmailDestinatarios,
  saveEmailTipos,
  type EmailNotificacaoTipo,
  type EmailNotificacaoTipoSave,
} from '../../api/integracaoEmail';
import { criarMatcherTextoLivre } from '../../utils/textoLivreBusca';
import EmailTipoCard from './email/EmailTipoCard';
import ModalTesteEmailTipo from './email/ModalTesteEmailTipo';
import ModalAbaBackdrop from '../../components/ModalAbaBackdrop';

function toSave(t: EmailNotificacaoTipo): EmailNotificacaoTipoSave {
  return {
    id: t.id,
    code: t.code,
    label: t.label,
    descricao: t.descricao,
    ativo: t.ativo,
    sortOrder: t.sortOrder,
    fonteMensagem: 'codigo',
    modoDisparo: 'cron',
    cronExpressao: t.cronExpressao,
    builderCode: t.builderCode,
  };
}

function StatusPill({
  ok,
  label,
  detail,
  linkTo,
  linkLabel,
}: {
  ok: boolean;
  label: string;
  detail: string;
  linkTo?: string;
  linkLabel?: string;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 min-w-[12rem] flex-1 ${
        ok
          ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-900/20'
          : 'border-amber-200 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-900/20'
      }`}
    >
      <span
        className={`h-2.5 w-2.5 shrink-0 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p
          className={`text-sm font-medium ${ok ? 'text-emerald-800 dark:text-emerald-200' : 'text-amber-800 dark:text-amber-200'}`}
        >
          {detail}
        </p>
        {linkTo && linkLabel && (
          <Link to={linkTo} className="text-xs text-primary-600 hover:underline mt-0.5 inline-block">
            {linkLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

export default function EmailIntegracaoPage() {
  const { hasPermission } = useAuth();
  const podeEditar = hasPermission(PERMISSOES.INTEGRACAO_EDITAR);

  const [loading, setLoading] = useState(true);
  const [tipos, setTipos] = useState<EmailNotificacaoTipo[]>([]);
  const [editTipos, setEditTipos] = useState<EmailNotificacaoTipoSave[]>([]);
  const [usuarios, setUsuarios] = useState<Awaited<ReturnType<typeof getEmailUsuarios>>>([]);
  const [nomusEnabled, setNomusEnabled] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [destEdit, setDestEdit] = useState<Record<number, number[]>>({});
  const [saving, setSaving] = useState(false);
  const [savingDest, setSavingDest] = useState<number | null>(null);
  const [testModalTipoId, setTestModalTipoId] = useState<number | null>(null);
  const [previewModal, setPreviewModal] = useState<{
    subject: string;
    html: string;
    resumo: string;
  } | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const matchUsuario = useMemo(() => criarMatcherTextoLivre(filtroUsuario), [filtroUsuario]);

  const usuariosFiltrados = useMemo(
    () =>
      usuarios.filter(
        (u) =>
          matchUsuario(u.login) ||
          matchUsuario(u.nome ?? '') ||
          matchUsuario(u.email ?? '')
      ),
    [usuarios, matchUsuario]
  );

  const tiposAtivos = useMemo(() => editTipos.filter((t) => t.ativo).length, [editTipos]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [res, us] = await Promise.all([getEmailTipos(), getEmailUsuarios()]);
      setTipos(res.tipos);
      setEditTipos(res.tipos.map(toSave));
      setNomusEnabled(res.nomusEnabled);
      setEmailConfigured(res.emailConfigured);
      setUsuarios(us);
      const dest: Record<number, number[]> = {};
      for (const t of res.tipos) dest[t.id] = [...t.destinatarioIds];
      setDestEdit(dest);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaveCatalog = async () => {
    if (!podeEditar) return;
    setSaving(true);
    setErr(null);
    setOkMsg(null);
    try {
      const { tipos: saved } = await saveEmailTipos(editTipos);
      setTipos(saved);
      setEditTipos(saved.map(toSave));
      const dest: Record<number, number[]> = {};
      for (const t of saved) dest[t.id] = [...t.destinatarioIds];
      setDestEdit(dest);
      setOkMsg('Configurações salvas.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const testModalTipo = useMemo(
    () => (testModalTipoId != null ? tipos.find((t) => t.id === testModalTipoId) ?? null : null),
    [testModalTipoId, tipos]
  );

  const handleSaveDest = async (tipoId: number) => {
    if (!podeEditar) return;
    setSavingDest(tipoId);
    setErr(null);
    setOkMsg(null);
    try {
      const { tipos: saved } = await saveEmailDestinatarios(tipoId, destEdit[tipoId] ?? []);
      setTipos(saved);
      setOkMsg('Destinatários salvos.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar destinatários.');
    } finally {
      setSavingDest(null);
    }
  };

  const handlePreview = async (tipoId: number) => {
    setPreviewLoadingId(tipoId);
    setErr(null);
    try {
      const res = await previewEmailTipo(tipoId);
      setPreviewModal({ subject: res.subject, html: res.html, resumo: res.resumo });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao gerar preview.');
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const toggleDest = (tipoId: number, usuarioId: number) => {
    setDestEdit((prev) => {
      const cur = prev[tipoId] ?? [];
      const has = cur.includes(usuarioId);
      return {
        ...prev,
        [tipoId]: has ? cur.filter((id) => id !== usuarioId) : [...cur, usuarioId],
      };
    });
  };

  const updateEditTipo = (idx: number, patch: Partial<EmailNotificacaoTipoSave>) => {
    setEditTipos((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };

  if (loading) {
    return (
      <>
        <CarregandoInformacoesOverlay show />
        <div className="min-h-[12rem]" />
      </>
    );
  }

  return (
    <div className="relative w-full min-w-0 space-y-5 pb-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-600 dark:text-primary-400">
            Integração
          </p>
          <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
            E-mail — Notificações automáticas
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
            Configure alertas por e-mail, horários de envio e destinatários. O alerta de crédito
            monitora clientes com pedido em aberto e contas a receber em atraso.
          </p>
        </div>
        {podeEditar && (
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSaveCatalog}
              disabled={saving}
              className="rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-5 py-2 text-sm font-semibold text-white shadow-sm"
            >
              {saving ? 'Salvando...' : 'Salvar configurações'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatusPill
          ok={emailConfigured}
          label="Gmail"
          detail={emailConfigured ? 'Credencial configurada' : 'Não configurado'}
          linkTo="/integracao/credenciais/email"
          linkLabel="Configurar credenciais"
        />
        <StatusPill
          ok={nomusEnabled}
          label="Nomus"
          detail={nomusEnabled ? 'Conexão ativa' : 'Não configurado'}
        />
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 min-w-[12rem] flex-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Tipos
            </p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
              {editTipos.length} cadastrado{editTipos.length !== 1 ? 's' : ''} · {tiposAtivos} ativo
              {tiposAtivos !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 min-w-[12rem] flex-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Usuários
            </p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
              {usuarios.length} disponíve{usuarios.length !== 1 ? 'is' : 'l'} como destinatário
            </p>
          </div>
        </div>
      </div>

      {okMsg && (
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 px-4 py-2.5 text-sm text-emerald-800 dark:text-emerald-200">
          {okMsg}
        </div>
      )}
      {err && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-200">
          {err}
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tipos de e-mail</h2>
        </div>

        <div className="space-y-4">
          {editTipos.map((t, idx) => {
            const saved = tipos.find((s) => s.id === t.id);
            const tipoId = saved?.id;
            const isExpanded = expandedId === tipoId;
            const destIds = tipoId != null ? destEdit[tipoId] ?? [] : [];

            return (
              <EmailTipoCard
                key={t.id ?? `new-${idx}`}
                tipo={t}
                idx={idx}
                saved={saved}
                podeEditar={podeEditar}
                isExpanded={isExpanded}
                destIds={destIds}
                usuarios={usuarios}
                filtroUsuario={filtroUsuario}
                usuariosFiltrados={usuariosFiltrados}
                savingDest={savingDest}
                onUpdate={(patch) => updateEditTipo(idx, patch)}
                onToggleExpand={() => setExpandedId(isExpanded ? null : tipoId ?? null)}
                onTest={() => tipoId != null && setTestModalTipoId(tipoId)}
                onPreview={() => tipoId != null && void handlePreview(tipoId)}
                onToggleDest={(usuarioId) => tipoId != null && toggleDest(tipoId, usuarioId)}
                onSaveDest={() => tipoId != null && void handleSaveDest(tipoId)}
                onFiltroUsuario={setFiltroUsuario}
              />
            );
          })}

          {editTipos.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/20 px-6 py-12 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Nenhum tipo de e-mail cadastrado. Execute a migration do banco ou reinicie o backend.
              </p>
            </div>
          )}
        </div>
      </section>

      <ModalTesteEmailTipo
        open={testModalTipoId != null}
        onClose={() => setTestModalTipoId(null)}
        tipo={testModalTipo}
        usuarios={usuarios}
        podeEnviar={podeEditar}
        emailConfigured={emailConfigured}
      />

      {previewModal && (
        <ModalAbaBackdrop onClose={() => setPreviewModal(null)} className="items-start overflow-y-auto py-6">
          <div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-xl flex flex-col max-h-[min(90vh,720px)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-600 px-4 py-3">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Preview do e-mail</h2>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {previewLoadingId != null && (
                <p className="text-sm text-slate-500">Carregando...</p>
              )}
              <p className="text-xs text-slate-500">{previewModal.resumo}</p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Assunto: {previewModal.subject}
              </p>
              <iframe
                title="Preview"
                srcDoc={previewModal.html}
                className="w-full min-h-[320px] rounded border border-slate-200 dark:border-slate-600 bg-white"
                sandbox=""
              />
            </div>
          </div>
        </ModalAbaBackdrop>
      )}
    </div>
  );
}
