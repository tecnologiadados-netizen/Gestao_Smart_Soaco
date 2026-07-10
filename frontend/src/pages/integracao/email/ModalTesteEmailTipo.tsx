import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ModalAbaBackdrop from '../../../components/ModalAbaBackdrop';
import {
  previewEmailTipo,
  testarEmailTipo,
  type EmailNotificacaoTipo,
  type UsuarioDestinatarioEmail,
} from '../../../api/integracaoEmail';

const inputClass =
  'w-full rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm';

type ModalTesteEmailTipoProps = {
  open: boolean;
  onClose: () => void;
  tipo: EmailNotificacaoTipo | null;
  usuarios: UsuarioDestinatarioEmail[];
  podeEnviar: boolean;
  emailConfigured: boolean;
};

export default function ModalTesteEmailTipo({
  open,
  onClose,
  tipo,
  usuarios,
  podeEnviar,
  emailConfigured,
}: ModalTesteEmailTipoProps) {
  const [usuarioId, setUsuarioId] = useState<number | ''>('');
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewResumo, setPreviewResumo] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const destinatarios = useMemo(() => {
    if (!tipo) return [];
    return tipo.destinatarioIds
      .map((id) => usuarios.find((u) => u.id === id))
      .filter((u): u is UsuarioDestinatarioEmail => !!u);
  }, [tipo, usuarios]);

  const destinatariosComEmail = useMemo(
    () => destinatarios.filter((u) => !!u.email?.trim()),
    [destinatarios]
  );

  const reset = useCallback(() => {
    setUsuarioId('');
    setPreviewSubject(null);
    setPreviewHtml(null);
    setPreviewResumo(null);
    setPreviewLoading(false);
    setEnviando(false);
    setErr(null);
    setOkMsg(null);
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    reset();
  }, [open, tipo?.id, reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handlePreview = async () => {
    if (!tipo) return;
    setErr(null);
    setOkMsg(null);
    setPreviewLoading(true);
    try {
      const res = await previewEmailTipo(tipo.id);
      setPreviewSubject(res.subject);
      setPreviewHtml(res.html);
      setPreviewResumo(res.resumo);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao gerar preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleEnviar = async () => {
    if (!tipo) return;
    if (!usuarioId) {
      setErr('Selecione um destinatário para teste.');
      return;
    }
    setErr(null);
    setOkMsg(null);
    setEnviando(true);
    try {
      await testarEmailTipo(tipo.id, usuarioId);
      setOkMsg('E-mail de teste enviado (alertas reais do momento, sem deduplicação).');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao enviar.');
    } finally {
      setEnviando(false);
    }
  };

  if (!open || !tipo) return null;

  return (
    <ModalAbaBackdrop onClose={onClose} className="items-start overflow-y-auto py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-teste-email-title"
        className="relative w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-xl flex flex-col max-h-[min(90vh,720px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-600 px-4 py-3">
          <div className="min-w-0">
            <h2 id="modal-teste-email-title" className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Teste manual — {tipo.label}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Envia os alertas vigentes no momento para o e-mail selecionado.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {!emailConfigured && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              E-mail não configurado —{' '}
              <Link to="/integracao/credenciais/email" className="underline">
                configurar Gmail
              </Link>
              .
            </div>
          )}

          {destinatariosComEmail.length === 0 ? (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              Nenhum destinatário com e-mail configurado para este tipo. Configure em
              &quot;Destinatários&quot; no card do tipo.
            </div>
          ) : (
            <div>
              <label htmlFor="modal-teste-email-dest" className="block text-xs font-medium text-slate-500 mb-1">
                Destinatário para teste
              </label>
              <select
                id="modal-teste-email-dest"
                className={inputClass}
                value={usuarioId}
                onChange={(e) => setUsuarioId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Selecione...</option>
                {destinatariosComEmail.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.login}
                    {u.nome ? ` — ${u.nome}` : ''} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewLoading}
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50"
            >
              {previewLoading ? 'Carregando...' : 'Ver preview do e-mail'}
            </button>
            {podeEnviar && (
              <button
                type="button"
                onClick={handleEnviar}
                disabled={enviando || !usuarioId || destinatariosComEmail.length === 0}
                className="rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white"
              >
                {enviando ? 'Enviando...' : 'Enviar e-mail de teste'}
              </button>
            )}
          </div>

          {okMsg && (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
              {okMsg}
            </div>
          )}
          {err && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              {err}
            </div>
          )}

          {previewResumo && (
            <p className="text-xs text-slate-500 dark:text-slate-400">{previewResumo}</p>
          )}

          {previewSubject != null && (
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Assunto: {previewSubject}
              </p>
              {previewHtml && (
                <iframe
                  title="Preview do e-mail"
                  srcDoc={previewHtml}
                  className="w-full min-h-[280px] rounded border border-slate-200 dark:border-slate-600 bg-white"
                  sandbox=""
                />
              )}
            </div>
          )}
        </div>
      </div>
    </ModalAbaBackdrop>
  );
}
