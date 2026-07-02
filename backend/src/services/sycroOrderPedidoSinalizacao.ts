/**
 * Sinalização "Card" / "Disponível" no Gerenciador de Pedidos conforme cards da Comunicação PD.
 */

import { prisma } from '../config/prisma.js';

export type SinalizacaoCardPedido = '' | 'Card' | 'Disponível';

type SycroCardIndex = {
  order_number: string;
  item_ids: string[] | null;
  item_codes: string[] | null;
  tag_disponivel: boolean;
};

let cacheCards: { expiresAt: number; cards: SycroCardIndex[] } | null = null;
const CACHE_TTL_MS = 30_000;

function parseJsonArray(value: string | null | undefined): string[] | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  try {
    const arr = JSON.parse(s);
    if (!Array.isArray(arr)) return null;
    return arr.map((x) => String(x ?? '').trim()).filter(Boolean);
  } catch {
    return null;
  }
}

function chavePedidoItem(id: string): string {
  const parts = String(id ?? '').trim().split('-');
  if (parts.length >= 3) {
    const pedido = parts[parts.length - 2]!.trim();
    const itemStr = parts[parts.length - 1]!.trim();
    const numItem = parseInt(itemStr, 10);
    const itemCanonico = Number.isNaN(numItem) ? itemStr : String(numItem);
    return `${pedido}-${itemCanonico}`;
  }
  if (parts.length === 2) return parts.join('-').trim();
  return String(id ?? '').trim();
}

function normalizePdDigits(pd: string): string {
  const s = String(pd ?? '').trim();
  const digits = s.replace(/\D+/g, '');
  return digits || s;
}

function pdMatches(orderNumber: string, rowPd: string): boolean {
  const a = normalizePdDigits(orderNumber);
  const b = normalizePdDigits(rowPd);
  return a.length > 0 && a === b;
}

async function loadSycroCards(): Promise<SycroCardIndex[]> {
  const now = Date.now();
  if (cacheCards && cacheCards.expiresAt > now) return cacheCards.cards;

  const orders = await prisma.sycroOrderOrder.findMany({
    select: {
      order_number: true,
      item_ids_json: true,
      item_codes_json: true,
      tag_disponivel: true,
    },
  });

  const cards: SycroCardIndex[] = orders
    .map((o) => ({
      order_number: String(o.order_number ?? '').trim(),
      item_ids: parseJsonArray(o.item_ids_json),
      item_codes: parseJsonArray(o.item_codes_json),
      tag_disponivel: o.tag_disponivel === 1,
    }))
    .filter((c) => c.order_number.length > 0);

  cacheCards = { cards, expiresAt: now + CACHE_TTL_MS };
  return cards;
}

/** Invalida cache após criar/alterar card (opcional). */
export function invalidateSycroCardSinalizacaoCache(): void {
  cacheCards = null;
}

function rowMatchesCard(row: Record<string, unknown>, card: SycroCardIndex): boolean {
  const pd = String(row['PD'] ?? row['pd'] ?? '').trim();
  if (!pdMatches(card.order_number, pd)) return false;

  const itemIds = card.item_ids;
  if (!itemIds || itemIds.length === 0) return true;

  const idPedido = String(row['id_pedido'] ?? row['idChave'] ?? '').trim();
  if (!idPedido) return false;

  if (itemIds.includes(idPedido)) return true;

  const idCanon = chavePedidoItem(idPedido);
  if (itemIds.some((id) => chavePedidoItem(id) === idCanon)) return true;

  const codes = card.item_codes;
  if (codes && codes.length > 0) {
    const cod = String(row['Cod'] ?? row['cod'] ?? '').trim();
    if (cod && codes.includes(cod)) return true;
  }

  return false;
}

function sinalizacaoFromCards(matching: SycroCardIndex[]): SinalizacaoCardPedido {
  if (matching.length === 0) return '';
  if (matching.some((c) => c.tag_disponivel)) return 'Disponível';
  return 'Card';
}

/** Preenche `Card` em cada linha do Gerenciador (vazio se não houver card). */
export async function aplicarSinalizacaoCardPedidos<T extends Record<string, unknown>>(
  rows: T[]
): Promise<(T & { Card: SinalizacaoCardPedido })[]> {
  if (rows.length === 0) return rows as (T & { Card: SinalizacaoCardPedido })[];

  const cards = await loadSycroCards();
  if (cards.length === 0) {
    return rows.map((r) => ({ ...r, Card: '' as SinalizacaoCardPedido }));
  }

  return rows.map((row) => {
    const matching = cards.filter((c) => rowMatchesCard(row, c));
    return { ...row, Card: sinalizacaoFromCards(matching) };
  });
}

/** Cards ativos no Comunicador de Pedidos (cache compartilhado com o Gerenciador). */
export async function carregarCardsComunicador(): Promise<SycroCardIndex[]> {
  return loadSycroCards();
}

/** Indica se a linha do Gerenciador está alocada em algum card do Comunicador. */
export function pedidoLinhaAlocadaComunicador(
  row: Record<string, unknown>,
  cards: SycroCardIndex[]
): boolean {
  return cards.some((c) => rowMatchesCard(row, c));
}
