import type {
  WhatsappNotificacaoTipo,
  WhatsappNotificacaoTipoSave,
  UsuarioDestinatario,
  FonteMensagem,
  ModoDisparo,
} from '../../../api/integracaoSms';
import SmsHorariosAgendamento from './SmsHorariosAgendamento';

const inputClass =
  'w-full rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent';

const textareaMonoClass = `${inputClass} font-mono text-xs min-h-[140px] resize-y`;

const FONTE_LABEL: Record<FonteMensagem, string> = {
  evento: 'Evento no sistema',
  sql_template: 'SQL Nomus + template',
  codigo: 'Builder em código',
};

const FONTE_BADGE: Record<FonteMensagem, string> = {
  evento: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  sql_template: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  codigo: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
};

type Props = {
  tipo: WhatsappNotificacaoTipoSave;
  idx: number;
  saved: WhatsappNotificacaoTipo | undefined;
  podeEditar: boolean;
  isExpanded: boolean;
  destIds: number[];
  usuarios: UsuarioDestinatario[];
  filtroUsuario: string;
  usuariosFiltrados: UsuarioDestinatario[];
  savingDest: number | null;
  onUpdate: (patch: Partial<WhatsappNotificacaoTipoSave>) => void;
  onToggleExpand: () => void;
  onTest: () => void;
  onToggleDest: (usuarioId: number) => void;
  onSaveDest: () => void;
  onFiltroUsuario: (value: string) => void;
};

export default function SmsTipoCard({
  tipo: t,
  idx,
  saved,
  podeEditar,
  isExpanded,
  destIds,
  usuarios,
  filtroUsuario,
  usuariosFiltrados,
  savingDest,
  onUpdate,
  onToggleExpand,
  onTest,
  onToggleDest,
  onSaveDest,
  onFiltroUsuario,
}: Props) {
  const tipoId = saved?.id;
  const destSelecionados = destIds.length;
  const destSemTelefone = destIds.filter((id) => {
    const u = usuarios.find((x) => x.id === id);
    return u && !u.telefone?.trim();
  }).length;

  return (
    <article className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/30 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              t.ativo
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
            }`}
          >
            {t.ativo ? 'Ativo' : 'Inativo'}
          </span>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${FONTE_BADGE[t.fonteMensagem]}`}>
            {FONTE_LABEL[t.fonteMensagem]}
          </span>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
            {t.label || 'Novo tipo de mensagem'}
          </h3>
          {t.code && (
            <code className="rounded-md bg-slate-200/80 dark:bg-slate-700 px-2 py-0.5 text-xs font-mono text-slate-600 dark:text-slate-300">
              {t.code}
            </code>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {tipoId != null && (
            <>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {destSelecionados} destinatário{destSelecionados !== 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={onTest}
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600"
              >
                Testar envio
              </button>
              <button
                type="button"
                onClick={onToggleExpand}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  isExpanded
                    ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200'
                    : 'border border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20'
                }`}
              >
                {isExpanded ? 'Fechar destinatários' : 'Destinatários'}
              </button>
            </>
          )}
        </div>
      </header>

      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Código</label>
            <input
              className={inputClass}
              value={t.code}
              disabled={!!t.id && t.id > 0}
              onChange={(e) => onUpdate({ code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
              placeholder="ex.: relatorio_estoque"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Nome</label>
            <input
              className={inputClass}
              value={t.label}
              disabled={!podeEditar}
              onChange={(e) => onUpdate({ label: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Fonte da mensagem</label>
            <select
              className={inputClass}
              value={t.fonteMensagem}
              disabled={!podeEditar || t.fonteMensagem === 'codigo'}
              onChange={(e) => onUpdate({ fonteMensagem: e.target.value as FonteMensagem })}
            >
              {(Object.keys(FONTE_LABEL) as FonteMensagem[]).map((k) => (
                <option key={k} value={k}>
                  {FONTE_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Disparo</label>
            <select
              className={inputClass}
              value={t.modoDisparo}
              disabled={!podeEditar}
              onChange={(e) => {
                const modo = e.target.value as ModoDisparo;
                onUpdate({
                  modoDisparo: modo,
                  ...(modo === 'cron' && !t.cronExpressao?.trim() ? { cronExpressao: '0 18 * * *' } : {}),
                });
              }}
            >
              <option value="evento">Evento</option>
              <option value="cron">Agendado (cron)</option>
            </select>
          </div>

          <div className="md:col-span-2 xl:col-span-3">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Descrição</label>
            <input
              className={inputClass}
              value={t.descricao ?? ''}
              disabled={!podeEditar}
              onChange={(e) => onUpdate({ descricao: e.target.value })}
              placeholder="Quando esta mensagem é enviada"
            />
          </div>

          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none pb-2">
              <input
                type="checkbox"
                id={`ativo-${idx}`}
                checked={t.ativo}
                disabled={!podeEditar}
                onChange={(e) => onUpdate({ ativo: e.target.checked })}
                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Tipo ativo</span>
            </label>
          </div>

          {t.modoDisparo === 'cron' && (
            <div className="md:col-span-2 xl:col-span-4">
              <SmsHorariosAgendamento
                cronExpressao={t.cronExpressao}
                disabled={!podeEditar}
                onChange={(cronExpressao) => onUpdate({ cronExpressao })}
              />
            </div>
          )}
        </div>

        {t.fonteMensagem === 'sql_template' && (
          <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">SQL Nomus (SELECT)</label>
              <textarea
                className={textareaMonoClass}
                value={t.sqlNomus ?? ''}
                disabled={!podeEditar}
                onChange={(e) => onUpdate({ sqlNomus: e.target.value })}
                placeholder="SELECT valorTotal AS valorTotal FROM ..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Template (use {'{{nomeColuna}}'} das colunas retornadas)
              </label>
              <textarea
                className={textareaMonoClass}
                value={t.templateMensagem ?? ''}
                disabled={!podeEditar}
                onChange={(e) => onUpdate({ templateMensagem: e.target.value })}
                placeholder="Faturado hoje: {{valorTotal}}"
              />
            </div>
          </div>
        )}

        {t.fonteMensagem === 'codigo' && t.builderCode && (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Builder em código: <code className="font-mono">{t.builderCode}</code>
          </p>
        )}

        {tipoId != null && isExpanded && (
          <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-900/20 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Destinatários</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Usuários do sistema que receberão esta mensagem via WhatsApp.
                  {destSemTelefone > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 ml-1">
                      {destSemTelefone} selecionado(s) sem telefone cadastrado.
                    </span>
                  )}
                </p>
              </div>
              {podeEditar && (
                <button
                  type="button"
                  onClick={onSaveDest}
                  disabled={savingDest === tipoId}
                  className="rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white"
                >
                  {savingDest === tipoId ? 'Salvando...' : 'Salvar destinatários'}
                </button>
              )}
            </div>
            <input
              className={inputClass}
              value={filtroUsuario}
              onChange={(e) => onFiltroUsuario(e.target.value)}
              placeholder="Filtrar usuários (use % como curinga)"
            />
            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-0 divide-y sm:divide-y-0 sm:gap-px sm:bg-slate-200 dark:sm:bg-slate-600 sm:divide-x-0">
                {usuariosFiltrados.map((u) => {
                  const sel = destIds.includes(u.id);
                  const semTel = !u.telefone?.trim();
                  return (
                    <label
                      key={u.id}
                      className={`flex items-start gap-2 text-sm px-3 py-2 cursor-pointer transition-colors ${
                        sel
                          ? 'bg-primary-50 dark:bg-primary-900/25'
                          : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                        checked={sel}
                        disabled={!podeEditar}
                        onChange={() => onToggleDest(u.id)}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium text-slate-800 dark:text-slate-100 truncate">{u.login}</span>
                        {u.nome && (
                          <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{u.nome}</span>
                        )}
                        <span className={`block text-xs truncate ${semTel ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                          {u.telefone || 'Sem telefone'}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
