import type { SycroOrderOrder as Order } from '../../api/sycroorder';
import { PERMISSOES, type CodigoPermissao } from '../../config/permissoes';
import { LABEL_CARRADA_EM_FORMACAO } from '../../utils/rotaCarrada';
import { entregaProximityLabel, formatDate, previsaoCapa } from './sycroOrderCardUtils';

export type SycroOrderKanbanCardActions = {
  onHistorico: (o: Order) => void;
  onAtualizar: (o: Order) => void;
  onMarcarNaoLida: (o: Order) => void;
  onTagDisponivelClick: (o: Order) => void;
  acionarTagDisponivel: (o: Order, available: boolean) => void;
};

type SycroOrderKanbanCardProps = {
  order: Order;
  hasPermission: (c: CodigoPermissao) => boolean;
  tagLoadingOrderId: number | null;
  actions: SycroOrderKanbanCardActions;
};

export default function SycroOrderKanbanCard({
  order: o,
  hasPermission,
  tagLoadingOrderId,
  actions,
}: SycroOrderKanbanCardProps) {
  const entregaLabel = entregaProximityLabel(o);
  const unread = !o.read_by_me && o.status !== 'FINISHED';
  const isControlTagUser =
    hasPermission(PERMISSOES.COMUNICACAO_TAG_CONTROLAR) || hasPermission(PERMISSOES.COMUNICACAO_TOTAL);
  const canViewTag =
    hasPermission(PERMISSOES.COMUNICACAO_TAG_VISUALIZAR) ||
    hasPermission(PERMISSOES.COMUNICACAO_TOTAL) ||
    isControlTagUser;
  const tagDesejado = !!o.tag_disponivel;
  const showTag = canViewTag && (isControlTagUser || tagDesejado);
  const tagDisabled = o.status === 'FINISHED';
  const previsao = previsaoCapa(o);
  const prazoOriginal = formatDate(o.data_original ?? o.current_promised_date);

  return (
    <div className="rounded-lg border-2 border-slate-200 bg-white shadow-sm hover:border-primary-400 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-primary-500">
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-1.5">
            <span
              title={o.read_by_me ? 'Lido' : 'Não lido'}
              className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${o.read_by_me ? 'bg-emerald-500' : 'bg-amber-500'}`}
              aria-hidden
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{o.order_number}</span>
              <p className="truncate text-xs font-medium text-slate-700 dark:text-slate-300" title={o.cliente_name ?? '—'}>
                {o.cliente_name ?? '—'}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400" title={o.vendedor_name ?? '—'}>
                {o.vendedor_name ?? '—'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-start justify-end gap-1">
            {entregaLabel && o.status !== 'FINISHED' && (
              <span className="inline-flex flex-shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-900/50 dark:text-red-200">
                {entregaLabel}
              </span>
            )}
            {o.is_urgent ? (
              <>
                <span className="inline-flex flex-shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                  Urgente
                </span>
                <span className="inline-flex flex-shrink-0 text-red-600 dark:text-red-400" title="Urgente" aria-hidden>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4" />
                    <path d="M12 16h.01" />
                  </svg>
                </span>
              </>
            ) : null}
          </div>
        </div>

        {showTag && (
          <div className="mt-1.5 flex justify-end">
            {isControlTagUser && !tagDisabled ? (
              <button
                type="button"
                disabled={tagLoadingOrderId === o.id}
                onClick={() => {
                  if (o.tag_disponivel) actions.onTagDisponivelClick(o);
                  else actions.acionarTagDisponivel(o, true);
                }}
                className={`inline-flex rounded border px-2 py-1 text-xs font-medium transition ${
                  o.tag_disponivel
                    ? 'border-emerald-700 bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'border-slate-500/30 bg-slate-500/20 text-slate-300 dark:text-slate-400'
                }`}
              >
                {o.tag_disponivel ? 'DISPONÍVEL' : 'NÃO DISPONÍVEL'}
              </button>
            ) : (
              <span
                className={`inline-flex rounded border px-2 py-1 text-xs font-medium ${
                  o.tag_disponivel
                    ? 'border-emerald-700 bg-emerald-600 text-white'
                    : 'border-slate-500/30 bg-slate-500/20 text-slate-300 dark:text-slate-400'
                }`}
              >
                {o.tag_disponivel ? 'DISPONÍVEL' : 'NÃO DISPONÍVEL'}
              </span>
            )}
          </div>
        )}

        {o.aguarda_resposta_pendente && (
          <p className="mt-2 text-sm font-semibold leading-snug text-red-700 dark:text-red-400">
            🔴 AÇÃO:{' '}
            <span className="text-slate-900 dark:text-slate-100">{(o.aguarda_resposta_de_label ?? '').trim() || '—'}</span>
          </p>
        )}

        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          Prazo original: <span className="font-medium text-slate-800 dark:text-slate-200">{prazoOriginal}</span>
        </p>

        {previsao && (
          <p
            className={`mt-1 text-sm font-semibold ${
              previsao === LABEL_CARRADA_EM_FORMACAO
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-primary-700 dark:text-primary-300'
            }`}
          >
            Previsão Atual: {previsao}
          </p>
        )}

        <div className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-2 dark:border-slate-700">
          <button type="button" onClick={() => actions.onHistorico(o)} className="text-xs text-primary-600 hover:underline dark:text-primary-400">
            Histórico
          </button>
          {o.can_respond !== false ? (
            <button type="button" onClick={() => actions.onAtualizar(o)} className="text-xs text-primary-600 hover:underline dark:text-primary-400">
              Atualizar
            </button>
          ) : (
            <span className="text-xs text-slate-500 dark:text-slate-400">Apenas visualização</span>
          )}
          {o.read_by_me && o.status !== 'FINISHED' && (
            <button type="button" onClick={() => actions.onMarcarNaoLida(o)} className="text-xs text-slate-500 hover:underline dark:text-slate-400">
              Marcar como não lida
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
