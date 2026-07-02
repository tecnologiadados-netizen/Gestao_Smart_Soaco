import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ModalAbaBackdrop from '../../../components/ModalAbaBackdrop';
import {
  previewSmsTipo,
  testarSmsTipo,
  type WhatsappNotificacaoTipo,
  type UsuarioDestinatario,
  type FonteMensagem,
} from '../../../api/integracaoSms';

const inputClass =
  'w-full rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm';

type ModalTesteSmsTipoProps = {
  open: boolean;
  onClose: () => void;
  tipo: WhatsappNotificacaoTipo | null;
  usuarios: UsuarioDestinatario[];
  podeEnviar: boolean;
  evolutionConfigured: boolean;
};

function mensagemTesteEvento(label: string): string {
  return `[Teste] Mensagem automática: ${label}`;
}

export default function ModalTesteSmsTipo({
  open,
  onClose,
  tipo,
  usuarios,
  podeEnviar,
  evolutionConfigured,
}: ModalTesteSmsTipoProps) {
  const [usuarioId, setUsuarioId] = useState<number | ''>('');
  const [preview, setPreview] = useState<string | null>(null);
  const [previewCols, setPreviewCols] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const destinatarios = useMemo(() => {
    if (!tipo) return [];
    return tipo.destinatarioIds
      .map((id) => usuarios.find((u) => u.id === id))
      .filter((u): u is UsuarioDestinatario => !!u);
  }, [tipo, usuarios]);

  const destinatariosComTelefone = useMemo(
    () => destinatarios.filter((u) => !!u.telefone?.trim()),
    [destinatarios]
  );

  const podePreview = tipo?.fonteMensagem === 'sql_template' || tipo?.fonteMensagem === 'codigo';

  const reset = useCallback(() => {
    setUsuarioId('');
    setPreview(null);
    setPreviewCols([]);
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
    if (tipo.fonteMensagem === 'evento') {
      setPreview(mensagemTesteEvento(tipo.label));
      setPreviewCols([]);
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await previewSmsTipo(tipo.id);
      setPreview(res.mensagem);
      setPreviewCols(res.colunas);
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
      await testarSmsTipo(tipo.id, usuarioId);
      setOkMsg('Mensagem de teste enviada.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao enviar.');
    } finally {
      setEnviando(false);
    }
  };

  if (!open || !tipo) return null;

  const fonteLabel: Record<FonteMensagem, string> = {
    evento: 'Evento no sistema',
    sql_template: 'SQL Nomus + template',
    codigo: 'Builder em código',
  };

  return (
    <ModalAbaBackdrop onClose={onClose} className="items-start overflow-y-auto py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-teste-sms-title"
        className="relative w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-xl flex flex-col max-h-[min(90vh,720px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-600 px-4 py-3">
          <div className="min-w-0">
            <h2 id="modal-teste-sms-title" className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Teste manual — {tipo.label}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {fonteLabel[tipo.fonteMensagem]}
              {tipo.fonteMensagem === 'evento' && ' (mensagem gerada no disparo real)'}
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
          {!evolutionConfigured && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              WhatsApp não configurado —{' '}
              <Link to="/whatsapp" className="underline">
                conectar instância
              </Link>
              .
            </div>
          )}

          {destinatariosComTelefone.length === 0 ? (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              Nenhum destinatário com telefone configurado para este tipo. Configure em &quot;Configurar
              destinatários&quot; no card do tipo.
            </div>
          ) : (
            <div>
              <label htmlFor="modal-teste-sms-dest" className="block text-xs font-medium text-slate-500 mb-1">
                Destinatário para teste
              </label>
              <select
                id="modal-teste-sms-dest"
                className={inputClass}
                value={usuarioId}
                onChange={(e) => setUsuarioId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Selecione...</option>
                {destinatariosComTelefone.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.login}
                    {u.nome ? ` — ${u.nome}` : ''} ({u.telefone})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewLoading || (tipo.fonteMensagem !== 'evento' && !podePreview)}
              className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50"
            >
              {previewLoading ? 'Carregando...' : 'Ver preview da mensagem'}
            </button>
            {podeEnviar && (
              <button
                type="button"
                onClick={handleEnviar}
                disabled={enviando || !usuarioId || destinatariosComTelefone.length === 0}
                className="rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 px-4 py-2 text-sm font-medium text-white"
              >
                {enviando ? 'Enviando...' : 'Enviar mensagem de teste'}
              </button>
            )}
          </div>

          {tipo.fonteMensagem === 'evento' && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No disparo real, a mensagem é montada pelo evento do sistema. O teste envia um texto de exemplo.
            </p>
          )}

          {okMsg && (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
              {okMsg}
            </div>
          )}
          {err && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-2 text-sm text-amber-800 dark:text-amber-200 space-y-2">
              <p>{err}</p>
              {/whatsapp|evolution|desconectad/i.test(err) && (
                <p>
                  <Link to="/whatsapp" className="underline font-medium text-primary-700 dark:text-primary-300">
                    Abrir configuração do WhatsApp
                  </Link>
                </p>
              )}
            </div>
          )}

          {preview != null && (
            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 p-3">
              {previewCols.length > 0 && (
                <p className="text-xs text-slate-500 mb-1">Colunas: {previewCols.join(', ')}</p>
              )}
              <pre className="whitespace-pre-wrap text-sm font-sans text-slate-800 dark:text-slate-100">{preview}</pre>
            </div>
          )}
        </div>
      </div>
    </ModalAbaBackdrop>
  );
}
