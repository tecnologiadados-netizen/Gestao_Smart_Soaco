/** Badges da coluna Status do Gerenciador de Pedidos (e modal Corrigir datas). */

export const VALOR_FATURADO_EF_KEY = 'Valor Faturado Entrega Futura + IPI do item do Pedido';

/** Mesmo padrão da coluna Status (pill com fundo suave). */
export const BADGE_GRADE_CLASS = 'inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap';

export type StatusPedidoBadgeFields = {
  statusPrazo?: string;
  card?: '' | 'Card' | 'Disponível';
  faturado?: boolean;
};

export function linhaEstaFaturada(row: Record<string, unknown>): boolean {
  const n = Number(row[VALOR_FATURADO_EF_KEY]);
  return Number.isFinite(n) && n > 0;
}

export function statusPrincipalPedido(row: Record<string, unknown>): string {
  const status = (row['Status'] ?? row['StatusPedido'] ?? row['statusPedido']) as string | undefined;
  const texto = status?.trim() || '—';
  if (texto === '—') return texto;
  return texto === 'Em dia' ? 'No prazo' : texto;
}

/** Badges exibidos na coluna Status — cada uma entra como opção no filtro Excel. */
export function statusFlagsPedido(row: Record<string, unknown>): string[] {
  const flags: string[] = [];
  const principal = statusPrincipalPedido(row);
  if (principal !== '—') flags.push(principal);
  const cardSinal = String(row.Card ?? '').trim();
  if (cardSinal === 'Card') flags.push('Card');
  if (cardSinal === 'Disponível') flags.push('Disponível');
  if (linhaEstaFaturada(row)) flags.push('Faturado');
  return flags.length > 0 ? flags : ['—'];
}

export function statusBadgeFieldsFromRow(row: Record<string, unknown>): StatusPedidoBadgeFields {
  const principal = statusPrincipalPedido(row);
  const cardRaw = String(row.Card ?? '').trim();
  const card =
    cardRaw === 'Card' || cardRaw === 'Disponível' ? (cardRaw as 'Card' | 'Disponível') : '';
  return {
    statusPrazo: principal !== '—' ? principal : undefined,
    card: card || undefined,
    faturado: linhaEstaFaturada(row) || undefined,
  };
}

export function classePillStatusPrazo(texto: string): string {
  const atrasado = texto.toLowerCase() === 'atrasado';
  return atrasado ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400';
}
