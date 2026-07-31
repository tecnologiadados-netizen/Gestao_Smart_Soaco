/**
 * Casamento entre linhas do Gerenciador de Pedidos e cards da Comunicação PD.
 * Compartilhado pelo controller e pelos alertas WhatsApp da Comunicação PD.
 */

export function parseJsonArray(value: string | null | undefined): string[] | null {
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

/** Primeiro valor não vazio entre várias chaves possíveis (colunas variam na origem SQL). */
export function getFieldFromRow(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

/**
 * Cliente e vendedor são atributos do pedido (PD), não da linha selecionada no card.
 * Usar sempre todas as linhas do PD no Gerenciador — não `relevantRows` filtrado por item_ids_json,
 * pois IDs desatualizados ou incompatíveis deixavam o filtro vazio e sumiam os nomes na capa.
 */
export function pickFirstDistinctFromRows(
  rows: Array<Record<string, unknown>>,
  keys: string[]
): string | null {
  const values = rows.map((r) => getFieldFromRow(r, keys)).filter(Boolean);
  return values.length > 0 ? [...new Set(values)][0]! : null;
}

/**
 * Chave canônica pedido+item (alinhada a pedidosRepository) para casar id_pedido quando o ERP
 * altera o prefixo (ex.: troca de romaneio/carrada na chave).
 */
export function chavePedidoItem(id: string): string {
  const parts = String(id ?? '')
    .trim()
    .split('-');
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

export function rowItemIdKey(row: Record<string, unknown>): string {
  return String(row['id_pedido'] ?? row['idChave'] ?? '').trim();
}

/**
 * Linhas do Gerenciador do card: filtra por item_ids_json com fallbacks (id canônico, Cod)
 * quando a chave literal mudou após realocação de carrada no ERP.
 */
export function resolveRelevantRowsForCard(
  rows: Array<Record<string, unknown>>,
  selectedItemIds: string[] | null,
  itemCodesJson: string | null | undefined
): Array<Record<string, unknown>> {
  if (!selectedItemIds || selectedItemIds.length === 0) {
    return rows;
  }
  const byStrict = rows.filter((r) => selectedItemIds.includes(rowItemIdKey(r)));
  if (byStrict.length > 0) return byStrict;
  const selCanon = new Set(selectedItemIds.map((id) => chavePedidoItem(id)));
  const byCanon = rows.filter((r) => selCanon.has(chavePedidoItem(rowItemIdKey(r))));
  if (byCanon.length > 0) return byCanon;
  const codes = parseJsonArray(itemCodesJson);
  if (codes && codes.length > 0) {
    const set = new Set(codes.map((c) => String(c).trim()).filter(Boolean));
    const byCode = rows.filter((r) => set.has(String(r['Cod'] ?? r['cod'] ?? '').trim()));
    if (byCode.length > 0) return byCode;
  }
  return [];
}

/** "PD 47192" vs "47192" — alinhado ao filtro flexível do Gerenciador (evita lista vazia no PATCH). */
function normalizePdDigitsForCompare(pd: string): string {
  const s = String(pd ?? '').trim();
  const digits = s.replace(/\D+/g, '');
  return digits || s;
}

export function gerenciadorRowMatchesOrderNumber(
  row: Record<string, unknown>,
  orderNumber: string
): boolean {
  const rowPd = String(row['PD'] ?? row['pd'] ?? '').trim();
  const ord = String(orderNumber ?? '').trim();
  if (!rowPd || !ord) return false;
  const a = normalizePdDigitsForCompare(rowPd);
  const b = normalizePdDigitsForCompare(ord);
  return a.length > 0 && a === b;
}
