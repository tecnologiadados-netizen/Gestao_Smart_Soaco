/**
 * Disponível (tag da Comunicação PD) e previsão não confiável não podem coexistir.
 */

import { listarPedidos } from '../data/pedidosRepository.js';
import { carregarCardsComunicador } from './sycroOrderPedidoSinalizacao.js';
import {
  chavePedidoItem,
  gerenciadorRowMatchesOrderNumber,
  parseJsonArray,
  resolveRelevantRowsForCard,
} from '../utils/sycroOrderCardRows.js';

export const MSG_BLOQUEIO_MARCAR_DISPONIVEL =
  'Não é possível marcar como disponível enquanto a previsão estiver como não confiável. Atualize a previsão para o dia de hoje ou um dia seguinte, marque Previsão confiável como Sim e só então marque o pedido como disponível.';

export function mensagemBloqueioNaoConfiavel(pds: string[]): string {
  const lista = [...new Set(pds.map((p) => String(p ?? '').trim()).filter(Boolean))];
  const alvo =
    lista.length === 0
      ? 'o pedido estiver marcado como disponível'
      : lista.length === 1
        ? `o pedido ${lista[0]} estiver marcado como disponível`
        : `os pedidos ${lista.slice(0, 8).join(', ')}${lista.length > 8 ? '…' : ''} estiverem marcados como disponível`;
  return `Não é possível gravar a previsão como não confiável enquanto ${alvo}. Desmarque a tag Disponível na Comunicação PD e só então escolha Não em Previsão confiável.`;
}

export function cardTemPrevisaoNaoConfiavelNasLinhas(
  rowsDoPd: Array<Record<string, unknown>>,
  itemIdsJson: string | null | undefined,
  itemCodesJson: string | null | undefined
): boolean {
  const relevant = resolveRelevantRowsForCard(rowsDoPd, parseJsonArray(itemIdsJson), itemCodesJson);
  return relevant.some((r) => r.previsao_atual_confiavel === false);
}

/** PDs (ou o próprio id, se o PD não vier na linha) já marcados como Disponível. */
export function pdsDisponiveisEntreIds(
  ids: string[],
  rows: Array<Record<string, unknown>>
): string[] {
  const alvo = new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean));
  if (alvo.size === 0) return [];
  const alvoCanon = new Set([...alvo].map((id) => chavePedidoItem(id)).filter(Boolean));
  const pds = new Set<string>();
  for (const row of rows) {
    const id = String(row.id_pedido ?? row.idChave ?? '').trim();
    if (!id) continue;
    if (!alvo.has(id) && !alvoCanon.has(chavePedidoItem(id))) continue;
    if (String(row.Card ?? row.card ?? '') !== 'Disponível') continue;
    const pd = String(row.PD ?? row.pd ?? '').trim();
    pds.add(pd || id);
  }
  return [...pds];
}

export async function cardTemPrevisaoNaoConfiavel(order: {
  order_number: string;
  item_ids_json?: string | null;
  item_codes_json?: string | null;
}): Promise<boolean> {
  const { data } = await listarPedidos({});
  const rows = (data as Array<Record<string, unknown>>).filter((r) =>
    gerenciadorRowMatchesOrderNumber(r, order.order_number)
  );
  return cardTemPrevisaoNaoConfiavelNasLinhas(rows, order.item_ids_json, order.item_codes_json);
}

function cardCobreItem(
  card: { order_number: string; item_ids: string[] | null; item_codes: string[] | null },
  id: string,
  row: Record<string, unknown> | undefined
): boolean {
  const canon = chavePedidoItem(id);
  const itemIds = card.item_ids;
  if (row) {
    if (!gerenciadorRowMatchesOrderNumber(row, card.order_number)) return false;
    if (!itemIds || itemIds.length === 0) return true;
    if (itemIds.includes(id) || (canon && itemIds.some((item) => chavePedidoItem(item) === canon))) return true;
    const codes = card.item_codes;
    const cod = String(row.Cod ?? row.cod ?? '').trim();
    return !!(codes && cod && codes.includes(cod));
  }
  if (!itemIds || itemIds.length === 0) return false;
  return itemIds.includes(id) || (!!canon && itemIds.some((item) => chavePedidoItem(item) === canon));
}

/**
 * @param ignorarOrderNumber card que está sendo desmarcado neste mesmo salvamento.
 * Os itens dele deixam de contar como disponíveis; outro card disponível continua bloqueando.
 */
export async function mensagemSeNaoPodeGravarNaoConfiavel(
  ids: string[],
  opts?: { ignorarOrderNumber?: string | null }
): Promise<string | null> {
  const unicos = [...new Set(ids.map((id) => String(id ?? '').trim()).filter(Boolean))];
  if (unicos.length === 0) return null;

  const { data } = await listarPedidos({});
  const rows = data as Array<Record<string, unknown>>;
  const rowPorId = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const id = String(row.id_pedido ?? row.idChave ?? '').trim();
    if (!id) continue;
    if (!rowPorId.has(id)) rowPorId.set(id, row);
    const canon = chavePedidoItem(id);
    if (canon && !rowPorId.has(canon)) rowPorId.set(canon, row);
  }

  const ignorar = String(opts?.ignorarOrderNumber ?? '').trim();
  const cards = (await carregarCardsComunicador()).filter((c) => {
    if (!c.tag_disponivel) return false;
    if (ignorar && gerenciadorRowMatchesOrderNumber({ PD: c.order_number }, ignorar)) return false;
    return true;
  });

  const pds = new Set<string>();
  for (const id of unicos) {
    const row = rowPorId.get(id) ?? rowPorId.get(chavePedidoItem(id));
    for (const card of cards) {
      if (!cardCobreItem(card, id, row)) continue;
      pds.add(String(card.order_number ?? '').trim() || id);
    }
  }

  if (pds.size === 0) return null;
  return mensagemBloqueioNaoConfiavel([...pds]);
}
