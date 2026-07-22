import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSOES } from '../../config/permissoes';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import {
  getSmsTipos,
  getSmsUsuarios,
  getSmsHistorico,
  saveSmsTipos,
  saveSmsDestinatarios,
  type WhatsappNotificacaoTipo,
  type WhatsappNotificacaoTipoSave,
} from '../../api/integracaoSms';
import { fetchEmailSettings } from '../../api/emailSettings';
import { criarMatcherTextoLivre } from '../../utils/textoLivreBusca';
import SmsTipoCard from './sms/SmsTipoCard';
import ModalTesteSmsTipo from './sms/ModalTesteSmsTipo';
import ModalHistoricoNotificacao from './components/ModalHistoricoNotificacao';

function novoTipo(sortOrder: number): WhatsappNotificacaoTipoSave {
  return {
    code: '',
    label: '',
    descricao: '',
    ativo: true,
    sortOrder,
    fonteMensagem: 'sql_template',
    modoDisparo: 'cron',
    cronExpressao: '0 18 * * *',
    sqlNomus: '',
    templateMensagem: '',
    builderCode: null,
  };
}

function toSave(t: WhatsappNotificacaoTipo): WhatsappNotificacaoTipoSave {
  return {
    id: t.id,
    code: t.code,
    label: t.label,
    descricao: t.descricao,
    ativo: t.ativo,
    sortOrder: t.sortOrder,
    fonteMensagem: t.fonteMensagem,
    modoDisparo: t.modoDisparo,
    cronExpressao: t.cronExpressao,
    sqlNomus: t.sqlNomus,
    templateMensagem: t.templateMensagem,
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
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <p className={`text-sm font-medium ${ok ? 'text-emerald-800 dark:text-emerald-200' : 'text-amber-800 dark:text-amber-200'}`}>
          {detail}
        </p>
        {!ok && linkTo && linkLabel && (
          <Link to={linkTo} className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline mt-0.5 inline-block">
            {linkLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

export default function SmsIntegracaoPage() {
  const { hasPermission } = useAuth();
  const podeEditar = hasPermission(PERMISSOES.INTEGRACAO_EDITAR);

  const [loading, setLoading] = useState(true);
  const [tipos, setTipos] = useState<WhatsappNotificacaoTipo[]>([]);
  const [editTipos, setEditTipos] = useState<WhatsappNotificacaoTipoSave[]>([]);
  const [usuarios, setUsuarios] = useState<Awaited<ReturnType<typeof getSmsUsuarios>>>([]);
  const [nomusEnabled, setNomusEnabled] = useState(false);
  const [evolutionConfigured, setEvolutionConfigured] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [destEdit, setDestEdit] = useState<Record<number, number[]>>({});
  const [saving, setSaving] = useState(false);
  const [savingDest, setSavingDest] = useState<number | null>(null);
  const [testModalTipoId, setTestModalTipoId] = useState<number | null>(null);
  const [historicoTipoId, setHistoricoTipoId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const matchUsuario = useMemo(() => criarMatcherTextoLivre(filtroUsuario), [filtroUsuario]);

  const usuariosFiltrados = useMemo(
    () =>
      usuarios.filter(
        (u) =>
          matchUsuario(u.login) ||
          matchUsuario(u.nome ?? '') ||
          matchUsuario(u.telefone ?? '')
      ),
    [usuarios, matchUsuario]
  );

  const tiposAtivos = useMemo(() => editTipos.filter((t) => t.ativo).length, [editTipos]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [res, us] = await Promise.all([getSmsTipos(), getSmsUsuarios()]);
      setTipos(res.tipos);
      setEditTipos(res.tipos.map(toSave));
      setNomusEnabled(res.nomusEnabled);
      setEvolutionConfigured(res.evolutionConfigured);
      try {
        const email = await fetchEmailSettings();
        setEmailConfigured(Boolean(email.configured && !email.lastError));
      } catch {
        setEmailConfigured(false);
      }
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
      const { tipos: saved } = await saveSmsTipos(editTipos);
      setTipos(saved);
      setEditTipos(saved.map(toSave));
      const dest: Record<number, number[]> = {};
      for (const t of saved) dest[t.id] = [...t.destinatarioIds];
      setDestEdit(dest);
      setOkMsg('Catálogo salvo.');
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

  const historicoTipo = useMemo(
    () => (historicoTipoId != null ? tipos.find((t) => t.id === historicoTipoId) ?? null : null),
    [historicoTipoId, tipos]
  );

  const loadHistoricoSms = useCallback(async () => {
    if (historicoTipoId == null) return [];
    return getSmsHistorico(historicoTipoId);
  }, [historicoTipoId]);

  const handleSaveDest = async (tipoId: number) => {
    if (!podeEditar) return;
    setSavingDest(tipoId);
    setErr(null);
    setOkMsg(null);
    try {
      const { tipos: saved } = await saveSmsDestinatarios(tipoId, destEdit[tipoId] ?? []);
      setTipos(saved);
      setOkMsg('Destinatários salvos.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar destinatários.');
    } finally {
      setSavingDest(null);
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

  const updateEditTipo = (idx: number, patch: Partial<WhatsappNotificacaoTipoSave>) => {
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
            SMS – Mensagens automáticas via WhatsApp
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
            Configure tipos de mensagem, destinatários (usuários do sistema) e consultas SQL ao Nomus quando necessário.
          </p>
        </div>
        {podeEditar && (
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setEditTipos((prev) => [...prev, novoTipo((prev.length + 1) * 10)])}
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Adicionar tipo
            </button>
            <button
              type="button"
              onClick={handleSaveCatalog}
              disabled={saving}
              className="rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-5 py-2 text-sm font-semibold text-white shadow-sm"
            >
              {saving ? 'Salvando...' : 'Salvar catálogo'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatusPill
          ok={emailConfigured}
          label="E-mail"
          detail={emailConfigured ? 'Gmail configurado' : 'Não configurado'}
          linkTo="/integracao/credenciais/email"
          linkLabel="Configurar e-mail"
        />
        <StatusPill
          ok={evolutionConfigured}
          label="WhatsApp"
          detail={evolutionConfigured ? 'Instância conectada' : 'Não configurado'}
          linkTo="/whatsapp"
          linkLabel="Conectar instância"
        />
        <StatusPill
          ok={nomusEnabled}
          label="Nomus"
          detail={nomusEnabled ? 'Conexão ativa' : 'Não configurado'}
        />
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 min-w-[12rem] flex-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tipos</p>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
              {editTipos.length} cadastrado{editTipos.length !== 1 ? 's' : ''} · {tiposAtivos} ativo{tiposAtivos !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 min-w-[12rem] flex-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Usuários</p>
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
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tipos de mensagem</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {editTipos.length} {editTipos.length === 1 ? 'tipo' : 'tipos'}
          </span>
        </div>

        <div className="space-y-4">
          {editTipos.map((t, idx) => {
            const saved = tipos.find((s) => s.id === t.id);
            const tipoId = saved?.id;
            const isExpanded = expandedId === tipoId;
            const destIds = tipoId != null ? destEdit[tipoId] ?? [] : [];

            return (
              <SmsTipoCard
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
                onHistorico={() => tipoId != null && setHistoricoTipoId(tipoId)}
                onToggleDest={(usuarioId) => tipoId != null && toggleDest(tipoId, usuarioId)}
                onSaveDest={() => tipoId != null && void handleSaveDest(tipoId)}
                onFiltroUsuario={setFiltroUsuario}
              />
            );
          })}

          {editTipos.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/20 px-6 py-12 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400">Nenhum tipo de mensagem cadastrado.</p>
              {podeEditar && (
                <button
                  type="button"
                  onClick={() => setEditTipos([novoTipo(10)])}
                  className="mt-3 text-sm font-medium text-primary-600 hover:underline"
                >
                  Adicionar o primeiro tipo
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      <ModalTesteSmsTipo
        open={testModalTipoId != null}
        onClose={() => setTestModalTipoId(null)}
        tipo={testModalTipo}
        usuarios={usuarios}
        podeEnviar={podeEditar}
        evolutionConfigured={evolutionConfigured}
      />

      <ModalHistoricoNotificacao
        open={historicoTipoId != null}
        onClose={() => setHistoricoTipoId(null)}
        titulo={historicoTipo?.label ?? historicoTipo?.code ?? 'Alerta'}
        canalLabel="WhatsApp"
        loadHistorico={loadHistoricoSms}
      />
    </div>
  );
}
