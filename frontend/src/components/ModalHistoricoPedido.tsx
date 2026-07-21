import { useCallback, useEffect, useMemo, useState } from 'react';
import type { HistoricoItem, Pedido } from '../api/pedidos';
import { obterHistorico } from '../api/pedidos';

function getField(row: Pedido, keys: string[]): string {
  for (const k of keys) {
    const v = row[k as keyof Pedido];
    if (v != null && String(v).length > 0) return String(v);
  }
  return '';
}

function formatDate(value: string | Date): string {
  if (value == null) return '-';
  const s = typeof value === 'string' ? value : value.toISOString?.() ?? '';
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('pt-BR');
}

function formatPrevisaoAlteracao(item: HistoricoItem): string {
  const nova = formatDate(item.previsao_nova ?? '');
  const anterior = item.previsao_anterior ? formatDate(item.previsao_anterior) : null;
  if (anterior && anterior !== nova && nova !== '-') {
    return `Nova previsão: de ${anterior} para ${nova}`;
  }
  return `Nova previsão: ${nova}`;
}

export interface ModalHistoricoPedidoProps {
  pedido: Pedido | null;
  open: boolean;
  onClose: () => void;
}

export default function ModalHistoricoPedido({ pedido, open, onClose }: ModalHistoricoPedidoProps) {
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [historicoError, setHistoricoError] = useState<string | null>(null);

  const idPedido = pedido?.id_pedido?.trim() ?? '';

  useEffect(() => {
    if (!open || !idPedido) {
      setHistorico([]);
      setHistoricoError(null);
      setLoadingHistorico(false);
      return;
    }

    let cancelled = false;
    setHistoricoError(null);
    setLoadingHistorico(true);
    obterHistorico(idPedido)
      .then((data) => {
        if (!cancelled) setHistorico(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setHistoricoError(e instanceof Error ? e.message : 'Erro ao carregar histórico.');
          setHistorico([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingHistorico(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, idPedido]);

  const historicoOrdenado = useMemo(() => {
    return [...historico].sort((a, b) => {
      const ta = new Date(a.data_ajuste).getTime();
      const tb = new Date(b.data_ajuste).getTime();
      if (tb !== ta) return tb - ta;
      return (b.id ?? 0) - (a.id ?? 0);
    });
  }, [historico]);

  const fechar = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      onClick={fechar}
      onKeyDown={(e) => e.key === 'Escape' && fechar()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-historico-title"
    >
      <div
        className="w-full max-w-lg max-h-[80vh] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-600 p-4">
          <h2 id="modal-historico-title" className="text-slate-800 dark:text-slate-100">
            <span className="block text-lg font-semibold">Histórico de alterações</span>
            {pedido ? (() => {
              const pd = getField(pedido, ['PD']);
              const cod = getField(pedido, ['Cod']);
              const prazoOriginal = getField(pedido, ['Data de entrega', 'dataParametro']);
              const cliente =
                getField(pedido, ['Cliente', 'cliente']) ||
                (pedido.cliente && String(pedido.cliente).trim()) ||
                '';
              const parts = [];
              if (pd) parts.push(`Pedido: ${pd}`);
              if (cod) parts.push(`Código: ${cod}`);
              if (prazoOriginal) parts.push(`Prazo original: ${formatDate(prazoOriginal)}`);
              if (cliente) parts.push(`Cliente: ${cliente}`);
              if (!parts.length) return <span className="text-sm font-normal">{idPedido}</span>;
              return (
                <span className="block text-sm font-normal mt-0.5 space-y-0.5">
                  {parts.map((p, i) => (
                    <span key={i} className="block">{p}</span>
                  ))}
                </span>
              );
            })() : <span className="text-sm font-normal">{idPedido}</span>}
          </h2>
          <button
            type="button"
            onClick={fechar}
            className="rounded p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-700 dark:hover:text-slate-200"
            aria-label="Fechar"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loadingHistorico && (
            <p className="text-slate-500 dark:text-slate-400 text-center py-4">Carregando...</p>
          )}
          {historicoError && (
            <p className="text-amber-400 text-center py-4">{historicoError}</p>
          )}
          {!loadingHistorico && !historicoError && historico.length === 0 && (
            <p className="text-slate-500 dark:text-slate-400 text-center py-4">Nenhuma alteração registrada.</p>
          )}
          {!loadingHistorico && historicoOrdenado.length > 0 && (
            <ul className="space-y-3">
              {historicoOrdenado.map((item) => {
                const naoConfiavel = item.previsao_confiavel === false;
                const isTagDisponivel = item.tipo_evento === 'tag_disponivel';
                const isComentarioSycro = item.tipo_evento === 'comentario_sycro';
                const isRegraCarrada = item.tipo_evento === 'regra_carrada';
                const tagDisponivel = item.tag_disponivel === true;
                return (
                  <li
                    key={item.id}
                    className={`rounded-lg border-2 p-3 text-sm ${
                      isComentarioSycro
                        ? 'border-primary-400 dark:border-primary-500 bg-primary-50/40 dark:bg-primary-950/20'
                        : isRegraCarrada
                        ? 'border-amber-400 dark:border-amber-500 bg-amber-50/50 dark:bg-amber-950/20'
                        : isTagDisponivel
                        ? tagDisponivel
                          ? 'border-emerald-400 dark:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20'
                          : 'border-slate-300 dark:border-slate-500 bg-slate-50 dark:bg-slate-800/50'
                        : naoConfiavel
                        ? 'border-red-500 dark:border-red-400 bg-red-50/50 dark:bg-red-950/20'
                        : 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50'
                    }`}
                  >
                    <div className="flex justify-between gap-2 text-slate-600 dark:text-slate-300">
                      <span>{formatDateTime(item.data_ajuste)}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        {isComentarioSycro && (
                          <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-800 dark:text-primary-200 border border-primary-500 dark:border-primary-400">
                            Comunicação Interna
                          </span>
                        )}
                        {isRegraCarrada && (
                          <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200 border border-amber-500 dark:border-amber-400">
                            Regra automática
                          </span>
                        )}
                        {isTagDisponivel && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide border ${
                              tagDisponivel
                                ? 'text-emerald-800 dark:text-emerald-200 border-emerald-500 dark:border-emerald-400'
                                : 'text-slate-600 dark:text-slate-300 border-slate-400 dark:border-slate-500'
                            }`}
                          >
                            {tagDisponivel ? 'Disponível' : 'Não disponível'}
                          </span>
                        )}
                        {!isTagDisponivel && !isComentarioSycro && !isRegraCarrada && naoConfiavel && (
                          <span
                            className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:text-red-300 border border-red-500 dark:border-red-400"
                            title="Esta alteração não entra no histórico da Comunicação Interna"
                          >
                            Não confiável
                          </span>
                        )}
                        <span className="text-slate-500 dark:text-slate-400">{item.usuario}</span>
                      </span>
                    </div>
                    {isComentarioSycro ? (
                      <div className="mt-1 text-slate-700 dark:text-slate-200 leading-relaxed">{item.observacao}</div>
                    ) : isTagDisponivel ? (
                      <div className="mt-1 text-slate-700 dark:text-slate-200">
                        <strong>{item.motivo}</strong>
                      </div>
                    ) : (
                      <div className="mt-1 text-slate-700 dark:text-slate-200">
                        <strong>{formatPrevisaoAlteracao(item)}</strong>
                      </div>
                    )}
                    {!isTagDisponivel && !isComentarioSycro && item.motivo && (
                      <div className="mt-1 text-slate-500 dark:text-slate-400">Motivo: {item.motivo}</div>
                    )}
                    {!isComentarioSycro && item.observacao && (
                      <div className="mt-1 text-slate-500 dark:text-slate-400">Observação: {item.observacao}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
