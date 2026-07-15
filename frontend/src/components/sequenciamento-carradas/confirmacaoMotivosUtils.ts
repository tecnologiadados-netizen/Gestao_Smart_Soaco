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

export function itemMotivoConcluido(idPedido: string, motivoPorId: Record<string, string>): boolean {
  return !!motivoPorId[idPedido]?.trim();
}

export function grupoPedidoMotivoConcluido(
  itens: PedidoAlterado[],
  motivoPorId: Record<string, string>
): boolean {
  return itens.length > 0 && itens.every((i) => itemMotivoConcluido(i.idPedido, motivoPorId));
}
