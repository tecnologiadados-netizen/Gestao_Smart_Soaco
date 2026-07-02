import type { SycroOrderOrder as Order } from '../../api/sycroorder';

export function formatDate(iso: string): string {
  try {
    const [y, m, d] = iso.split('-');
    if (y && m && d) return `${d}/${m}/${y}`;
    return new Date(iso).toLocaleDateString('pt-BR');
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

function earliestIsoFromPrevisaoField(previsao: string | null | undefined, fallbackIso: string): string {
  const p = previsao?.trim();
  if (!p) return fallbackIso.slice(0, 10);
  if (p.includes(' a ')) {
    const parts = p.split(' a ').map((x) => x.trim().slice(0, 10)).filter(Boolean);
    if (parts.length === 0) return fallbackIso.slice(0, 10);
    return [...parts].sort((a, b) => a.localeCompare(b))[0]!;
  }
  return p.slice(0, 10);
}

function getEffectivePrevisaoDateIso(o: Pick<Order, 'previsao_atual' | 'current_promised_date'>): string {
  return earliestIsoFromPrevisaoField(o.previsao_atual ?? null, o.current_promised_date);
}

function getDaysUntilEffectivePrevisao(o: Pick<Order, 'previsao_atual' | 'current_promised_date'>): number | null {
  const dateStr = getEffectivePrevisaoDateIso(o);
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

/** Texto do selo no card; null se fora da janela de 7 dias. */
export function entregaProximityLabel(o: Pick<Order, 'previsao_atual' | 'current_promised_date' | 'status'>): string | null {
  if (o.status === 'FINISHED') return null;
  const days = getDaysUntilEffectivePrevisao(o);
  if (days == null || days > 7) return null;
  if (days === 0) return 'Entrega HOJE';
  return `Entrega em ${days} dias`;
}

/** Previsão de entrega para a capa (sem rota). */
export function previsaoCapa(o: Order): string | null {
  const iso = getEffectivePrevisaoDateIso(o);
  return iso ? formatDate(iso) : null;
}
