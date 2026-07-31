import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import {
  anexarCrmPendenciaPdfAssinado,
  baixarCrmPendenciaPdfAssinado,
  confirmarCrmPendenciaLiberacao,
  removerCrmPendenciaPdfAssinado,
  salvarCrmPendenciaAcao,
  type AcaoPendenciaCredito,
  type PendenciaCreditoItem,
  type SituacaoFilaPendencia,
} from '../../../../api/crmFinanceiro';

const ACOES: { value: AcaoPendenciaCredito; label: string; hint: string }[] = [
  {
    value: 'PAUSADO',
    label: 'Pausar pedido',
    hint: 'No Nomus: status “Aguardando liberação”',
  },
  {
    value: 'CANCELADO',
    label: 'Cancelar pedido',
    hint: 'No Nomus: Cancelado ou Atendido',
  },
  {
    value: 'REALOCAR_MATERIAL',
    label: 'Realocar material',
    hint: 'Depois: “Aguardando liberação” no Nomus',
  },
  {
    value: 'SEGUIR_PRODUCAO',
    label: 'Seguir produção',
    hint: 'Não exige mudança de status no Nomus',
  },
];

function formatarBRL(val: number | null | undefined): string {
  if (val == null) return '—';
  return val.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function nomusOkParaAcao(
  acao: AcaoPendenciaCredito,
  statusNomus: number | null | undefined,
): boolean {
  if (acao === 'SEGUIR_PRODUCAO') return true;
  if (statusNomus == null) return false;
  if (acao === 'PAUSADO' || acao === 'REALOCAR_MATERIAL') return statusNomus === 1;
  if (acao === 'CANCELADO') return statusNomus === 6 || statusNomus >= 4;
  return false;
}

type Props = {
  item: PendenciaCreditoItem;
  situacaoFila: SituacaoFilaPendencia;
  onClose: () => void;
  onSaved: (pendencia: PendenciaCreditoItem, mensagem: string, titulo: string) => void;
};

export function ModalTratarPendenciaCredito({
  item: itemInicial,
  situacaoFila,
  onClose,
  onSaved,
}: Props) {
  const [item, setItem] = useState(itemInicial);
  const [acao, setAcao] = useState<AcaoPendenciaCredito | ''>(
    (itemInicial.acao as AcaoPendenciaCredito) || '',
  );
  const [observacao, setObservacao] = useState(itemInicial.observacao ?? '');
  const [salvando, setSalvando] = useState(false);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [avisoLocal, setAvisoLocal] = useState<string | null>(null);

  useEffect(() => {
    setItem(itemInicial);
    setAcao((itemInicial.acao as AcaoPendenciaCredito) || '');
    setObservacao(itemInicial.observacao ?? '');
    setAvisoLocal(null);
  }, [itemInicial]);

  const mostrarAviso = (msg: string) => {
    setAvisoLocal(msg);
  };

  const checklist = useMemo(() => {
    if (situacaoFila === 'REGULARIZADOS') {
      return [
        {
          ok: true,
          label: 'Cliente regularizado — confirme a liberação no Nomus e depois aqui',
        },
      ];
    }
    if (!acao) {
      return [{ ok: false, label: 'Escolha uma ação' }];
    }
    const items: { ok: boolean; label: string }[] = [];
    const nomusOk = nomusOkParaAcao(acao, item.statusNomus);
    if (acao !== 'SEGUIR_PRODUCAO') {
      items.push({
        ok: nomusOk,
        label: nomusOk
          ? `Status Nomus ok (${item.statusNomusLabel ?? '—'})`
          : `Ajuste o status no Nomus (atual: ${item.statusNomusLabel ?? '—'})`,
      });
    } else {
      items.push({ ok: true, label: 'Seguir produção — Nomus não precisa mudar' });
    }
    items.push({
      ok: item.temPdfAssinado,
      label: item.temPdfAssinado
        ? `PDF: ${item.pdfAssinadoNome ?? 'anexado'}`
        : 'Anexe o PDF assinado pelo gestor (obrigatório no rascunho)',
    });
    return items;
  }, [acao, item, situacaoFila]);

  const podeConfirmar =
    situacaoFila === 'INADIMPLENTES' &&
    acao !== '' &&
    (acao === 'SEGUIR_PRODUCAO' || nomusOkParaAcao(acao, item.statusNomus)) &&
    item.temPdfAssinado;

  /** Visível enquanto ainda não dá para confirmar; PDF é validado no clique. */
  const mostrarSalvarRascunho =
    situacaoFila === 'INADIMPLENTES' && !podeConfirmar;

  const handleAnexarPdf = async (file: File | null) => {
    if (!file) return;
    setPdfUploading(true);
    setAvisoLocal(null);
    try {
      const pendencia = await anexarCrmPendenciaPdfAssinado(item.id, file);
      setItem(pendencia);
    } catch (e) {
      mostrarAviso(e instanceof Error ? e.message : 'Falha ao anexar PDF');
    } finally {
      setPdfUploading(false);
    }
  };

  const handleRemoverPdf = async () => {
    setPdfUploading(true);
    setAvisoLocal(null);
    try {
      const pendencia = await removerCrmPendenciaPdfAssinado(item.id);
      setItem(pendencia);
    } catch (e) {
      mostrarAviso(e instanceof Error ? e.message : 'Falha ao remover PDF');
    } finally {
      setPdfUploading(false);
    }
  };

  const handleSalvar = async (modo: 'rascunho' | 'confirmar') => {
    if (!acao) {
      mostrarAviso('Selecione uma ação.');
      return;
    }
    if (!item.temPdfAssinado) {
      mostrarAviso(
        modo === 'confirmar'
          ? 'Anexe o PDF assinado pelo gestor antes de confirmar a ação.'
          : 'Anexe o PDF assinado pelo gestor antes de salvar o rascunho.',
      );
      return;
    }
    setSalvando(true);
    setAvisoLocal(null);
    try {
      const result = await salvarCrmPendenciaAcao(item.id, {
        acao,
        observacao,
        updatedAt: item.updatedAt ?? null,
      });
      const titulo = result.emailEnviado
        ? 'Confirmado — e-mail enviado'
        : result.aguardandoConfirmacaoNomus
          ? 'Rascunho salvo (histórico registrado)'
          : result.pendencia.encerrada
            ? 'Pedido finalizado'
            : 'Ação registrada';
      onSaved(
        result.pendencia,
        result.mensagem || result.instrucaoNomus || 'Ação salva.',
        titulo,
      );
    } catch (e) {
      mostrarAviso(e instanceof Error ? e.message : 'Falha ao salvar ação');
    } finally {
      setSalvando(false);
    }
  };

  const handleLiberacao = async () => {
    setSalvando(true);
    setAvisoLocal(null);
    try {
      const result = await confirmarCrmPendenciaLiberacao(item.id);
      onSaved(
        result.pendencia,
        result.mensagem || result.instrucaoNomus || 'Liberação processada.',
        'Liberação confirmada',
      );
    } catch (e) {
      mostrarAviso(e instanceof Error ? e.message : 'Falha ao confirmar liberação');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      {createPortal(
        <div
          className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tratar-pendencia-titulo"
          onClick={onClose}
        >
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <h2
              id="tratar-pendencia-titulo"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              Tratar pendência
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {item.clienteNome} · {item.numeroPedidoExibicao}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <section className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
              <div className="text-[10px] font-semibold uppercase text-slate-500">Status Nomus</div>
              <div className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                {item.statusNomusLabel ?? '—'}
              </div>
              {item.aguardandoConfirmacaoNomus && (
                <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-px text-[10px] font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  Rascunho · Nomus
                </span>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
              <div className="text-[10px] font-semibold uppercase text-slate-500">Atraso</div>
              <div className="mt-0.5 font-medium tabular-nums text-slate-900 dark:text-slate-100">
                {formatarBRL(item.totalAtraso)}
              </div>
              <div className="text-[10px] text-slate-500">
                {item.qtdTitulosAtraso ?? 0} tít.
                {item.maiorAtrasoDias != null ? ` · ${item.maiorAtrasoDias}d` : ''}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
              <div className="text-[10px] font-semibold uppercase text-slate-500">Pedido</div>
              <div className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                {item.numeroPedidoExibicao}
              </div>
              {item.valorPedido != null && (
                <div className="text-[10px] tabular-nums text-slate-500">
                  {formatarBRL(item.valorPedido)}
                </div>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
              <div className="text-[10px] font-semibold uppercase text-slate-500">Fila</div>
              <div className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                {item.situacaoFilaLabel}
              </div>
            </div>
          </section>

          {situacaoFila === 'REGULARIZADOS' ? (
            <section className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
              Cliente regularizado. Libere o pedido no Nomus e confirme aqui para finalizar.
              {item.acaoLabel ? (
                <div className="mt-1 text-xs opacity-80">Ação anterior: {item.acaoLabel}</div>
              ) : null}
            </section>
          ) : situacaoFila === 'FINALIZADOS' ? (
            <section className="text-sm text-slate-600 dark:text-slate-300">
              <p>
                <span className="font-medium">Ação:</span> {item.acaoLabel ?? '—'}
              </p>
              <p className="mt-1">
                <span className="font-medium">Obs.:</span> {item.observacao?.trim() || '—'}
              </p>
              {item.motivoArquivo ? (
                <p className="mt-1 text-amber-700 dark:text-amber-400">
                  Arquivado: {item.motivoArquivo === 'FORA_CARENCIA' ? 'fora da carência' : 'fora do alerta'}
                </p>
              ) : null}
            </section>
          ) : (
            <>
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  1. Escolha a ação
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ACOES.map((a) => {
                    const ativo = acao === a.value;
                    return (
                      <button
                        key={a.value}
                        type="button"
                        onClick={() => setAcao(a.value)}
                        className={`rounded-lg border px-3 py-2.5 text-left transition ${
                          ativo
                            ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/30 dark:border-blue-500 dark:bg-blue-950/40'
                            : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                        }`}
                      >
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {a.label}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {a.hint}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  2. Observação
                </h3>
                <textarea
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  rows={3}
                  placeholder="Detalhes da decisão…"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  3. PDF assinado
                </h3>
                {item.temPdfAssinado ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => void baixarCrmPendenciaPdfAssinado(item.id)}
                      className="font-medium text-blue-700 hover:underline dark:text-blue-400"
                    >
                      {item.pdfAssinadoNome ?? 'Baixar PDF'}
                    </button>
                    {!item.emailAcaoEnviado && (
                      <button
                        type="button"
                        disabled={pdfUploading}
                        onClick={() => void handleRemoverPdf()}
                        className="text-xs text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                ) : (
                  <label className="inline-flex cursor-pointer items-center rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50 dark:border-slate-600 dark:text-emerald-300 dark:hover:bg-emerald-950/30">
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      className="sr-only"
                      disabled={pdfUploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        e.target.value = '';
                        void handleAnexarPdf(file);
                      }}
                    />
                    {pdfUploading ? 'Enviando…' : 'Anexar PDF assinado'}
                  </label>
                )}
              </section>

              <section className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/40">
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Checklist
                </h3>
                <ul className="space-y-1">
                  {checklist.map((c) => (
                    <li
                      key={c.label}
                      className={`flex items-start gap-2 text-xs ${
                        c.ok
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      <span aria-hidden>{c.ok ? '✓' : '○'}</span>
                      <span>{c.label}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-3 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Fechar
          </button>
          {situacaoFila === 'REGULARIZADOS' ? (
            <button
              type="button"
              disabled={salvando}
              onClick={() => void handleLiberacao()}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {salvando ? 'Confirmando…' : 'Confirmar liberação'}
            </button>
          ) : situacaoFila === 'INADIMPLENTES' ? (
            <>
              {mostrarSalvarRascunho && (
                <button
                  type="button"
                  disabled={salvando}
                  onClick={() => void handleSalvar('rascunho')}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  {salvando ? 'Salvando…' : 'Salvar rascunho'}
                </button>
              )}
              <button
                type="button"
                disabled={salvando || !podeConfirmar}
                title={
                  !podeConfirmar
                    ? 'Complete o checklist (Nomus + PDF) para confirmar'
                    : undefined
                }
                onClick={() => void handleSalvar('confirmar')}
                className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {salvando ? 'Confirmando…' : 'Confirmar ação'}
              </button>
            </>
          ) : null}
        </div>
      </div>
        </div>,
        document.body,
      )}
      {avisoLocal &&
        createPortal(
          <div
            className="fixed inset-0 z-[10080] flex items-center justify-center bg-black/40 p-4"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="aviso-tratar-pendencia"
            onClick={() => setAvisoLocal(null)}
          >
            <div
              className="w-full max-w-md rounded-xl border border-amber-300 bg-white p-5 shadow-2xl dark:border-amber-700 dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                id="aviso-tratar-pendencia"
                className="text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                Atenção
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {avisoLocal}
              </p>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setAvisoLocal(null)}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
