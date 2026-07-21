import type { SycroOrderOrder as Order } from '../../api/sycroorder';
import { LABEL_CARRADA_EM_FORMACAO } from '../../utils/rotaCarrada';

export function formatDate(iso: string): string {
  try {
    const s = String(iso ?? '').trim();
    if (!s) return '—';
    if (s === LABEL_CARRADA_EM_FORMACAO) return s;
    const [y, m, d] = s.split('-');
    if (y && m && d) return `${d}/${m}/${y}`;
    return new Date(s).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function isPrevisaoEmFormacao(
  o: Pick<Order, 'previsao_atual' | 'carrada_em_formacao'>
): boolean {
  if (o.carrada_em_formacao) return true;
  return (o.previsao_atual ?? '').trim() === LABEL_CARRADA_EM_FORMACAO;
}

function earliestIsoFromPrevisaoField(previsao: string | null | undefined, fallbackIso: string): string {
  const p = previsao?.trim();
  if (!p || p === LABEL_CARRADA_EM_FORMACAO) return fallbackIso.slice(0, 10);
  if (p.includes(' a ')) {
    const parts = p.split(' a ').map((x) => x.trim().slice(0, 10)).filter(Boolean);
    if (parts.length === 0) return fallbackIso.slice(0, 10);
    return [...parts].sort((a, b) => a.localeCompare(b))[0]!;
  }
  // Só aceita ISO YYYY-MM-DD (evita interpretar rótulos como data)
  if (!/^\d{4}-\d{2}-\d{2}/.test(p)) return fallbackIso.slice(0, 10);
  return p.slice(0, 10);
}

function getEffectivePrevisaoDateIso(
  o: Pick<Order, 'previsao_atual' | 'current_promised_date' | 'carrada_em_formacao'>
): string {
  if (isPrevisaoEmFormacao(o)) return '';
  const ger = earliestIsoFromPrevisaoField(o.previsao_atual ?? null, '');
  const card = (o.current_promised_date ?? '').trim().slice(0, 10);
  if (!ger) return card;
  if (!card) return ger;
  // Card com data posterior: ajuste do card ainda não refletiu no Gerenciador (override de rota, etc.).
  if (card.localeCompare(ger) > 0) return card;
  return ger;
}

function getDaysUntilEffectivePrevisao(
  o: Pick<Order, 'previsao_atual' | 'current_promised_date' | 'carrada_em_formacao'>
): number | null {
  const dateStr = getEffectivePrevisaoDateIso(o);
  if (!dateStr) return null;
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const target = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diff = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (diff < 0) return null;
    return diff;
  } catch {
    return null;
  }
}

export { getDaysUntilEffectivePrevisao };

/** Texto do selo no card; null se fora da janela de 7 dias. */
export function entregaProximityLabel(
  o: Pick<Order, 'previsao_atual' | 'current_promised_date' | 'status' | 'carrada_em_formacao'>
): string | null {
  if (o.status === 'FINISHED') return null;
  if (isPrevisaoEmFormacao(o)) return null;
  const days = getDaysUntilEffectivePrevisao(o);
  if (days == null || days > 7) return null;
  if (days === 0) return 'Entrega HOJE';
  return `Entrega em ${days} dias`;
}

/** Previsão de entrega para a capa (sem rota). */
export function previsaoCapa(o: Order): string | null {
  if (isPrevisaoEmFormacao(o)) return LABEL_CARRADA_EM_FORMACAO;
  const iso = getEffectivePrevisaoDateIso(o);
  return iso ? formatDate(iso) : null;
}
