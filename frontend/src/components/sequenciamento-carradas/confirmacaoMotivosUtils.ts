import type { PedidoAlterado } from './simulacaoCarradas';
import { chavePedidoGrupo } from './corrigirDatasSequenciamentoUtils';

export type GrupoPedidoAlterado = {
  pedidoChave: string;
  pd: string;
  cliente: string;
  itens: PedidoAlterado[];
};

/** Agrupa linhas alteradas do mesmo PD (ordem de aparição preservada). */
export function agruparAlteradosPorPedido(itens: PedidoAlterado[]): GrupoPedidoAlterado[] {
  const map = new Map<string, PedidoAlterado[]>();
  const ordem: string[] = [];

  for (const item of itens) {
    const chave = chavePedidoGrupo(item.pd);
    let list = map.get(chave);
    if (!list) {
      list = [];
      map.set(chave, list);
      ordem.push(chave);
    }
    list.push(item);
  }

  const grupos: GrupoPedidoAlterado[] = [];
  for (const chave of ordem) {
    const grupoItens = map.get(chave)!;
    const first = grupoItens[0]!;
    grupos.push({
      pedidoChave: chave,
      pd: first.pd,
      cliente: first.cliente,
      itens: grupoItens,
    });
  }
  return grupos;
}

/** Motivo comum entre ids (vazio se divergir). */
export function motivoComumIds(ids: string[], motivoPorId: Record<string, string>): string {
  if (ids.length === 0) return '';
  const primeiro = motivoPorId[ids[0]!] ?? '';
  return ids.every((id) => (motivoPorId[id] ?? '') === primeiro) ? primeiro : '';
}

/** Observação comum entre ids (vazio se divergir). */
export function observacaoComumIds(ids: string[], observacaoPorId: Record<string, string>): string {
  if (ids.length === 0) return '';
  const primeiro = observacaoPorId[ids[0]!] ?? '';
  return ids.every((id) => (observacaoPorId[id] ?? '') === primeiro) ? primeiro : '';
}

/** Previsão confiável efetiva (ausente ou null = não escolhido). */
export function previsaoConfiavelEfetiva(
  idPedido: string,
  map: Record<string, boolean | null | undefined>
): boolean | null {
  const v = map[idPedido];
  if (v === true || v === false) return v;
  return null;
}

/**
 * Materializa no mapa do rascunho o Confiável efetivo da grade (override → snapshot)
 * para ids que ainda não têm escolha explícita. Usado ao abrir o modal Concluir.
 */
export function materializarPrevisaoConfiavelDoSnapshot(
  map: Record<string, boolean | null>,
  linhasSnapshot: Record<string, unknown>[]
): Record<string, boolean | null> {
  const next = { ...map };
  for (const row of linhasSnapshot) {
    const id = String(row.id_pedido ?? row.idChave ?? '').trim();
    if (!id) continue;
    if (next[id] === true || next[id] === false) continue;
    const snap = row.previsao_atual_confiavel;
    if (snap === true || snap === false) next[id] = snap;
  }
  return next;
}

/** True quando o usuário já escolheu Sim ou Não (não está no meio). */
export function itemPrevisaoConfiavelEscolhida(
  idPedido: string,
  map: Record<string, boolean | null | undefined>
): boolean {
  return previsaoConfiavelEfetiva(idPedido, map) !== null;
}

/**
 * Valor comum de previsão confiável entre ids.
 * `null` = divergente entre os itens, ou todos sem escolha.
 */
export function previsaoConfiavelComumIds(
  ids: string[],
  map: Record<string, boolean | null | undefined>
): boolean | null {
  if (ids.length === 0) return null;
  const primeiro = previsaoConfiavelEfetiva(ids[0]!, map);
  return ids.every((id) => previsaoConfiavelEfetiva(id, map) === primeiro) ? primeiro : null;
}

export function itemMotivoConcluido(idPedido: string, motivoPorId: Record<string, string>): boolean {
  return !!motivoPorId[idPedido]?.trim();
}

export function grupoPedidoMotivoConcluido(
  itens: PedidoAlterado[],
  motivoPorId: Record<string, string>
): boolean {
  return itens.length > 0 && itens.every((i) => itemMotivoConcluido(i.idPedido, motivoPorId));
}
