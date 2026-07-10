import type { Pedido } from '../../api/pedidos';

const KEYS_VALOR = ['Saldo a Faturar Real', 'Valor Pendente Real', 'Valor Pendente'];

export function formatMoedaDash(valor: number, compact = false): string {
  if (!Number.isFinite(valor)) return '—';
  if (compact && Math.abs(valor) >= 1_000_000) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(valor);
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
}

export function formatNumero(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n);
}

export function getValorPendentePedido(p: Pedido): number {
  for (const k of KEYS_VALOR) {
    const v = p[k];
    if (v == null) continue;
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isNaN(n)) return Math.max(0, n);
  }
  return 0;
}

export function getCampoPedido(p: Pedido, keys: string[]): string {
  for (const k of keys) {
    const v = p[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '—';
}

export function getTipoFPedido(p: Pedido): string {
  return getCampoPedido(p, ['TipoF', 'tipoF', 'tipo_f']);
}

export function formatDataPrevisao(value: string | undefined): string {
  const s = String(value ?? '').trim();
  if (!s) return '—';
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR');
}

export function getTodayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Dias até a previsão original de entrega (previsao_entrega). */
export function getLeadTimeDiasPedido(p: Pedido): number | null {
  const raw = p.previsao_entrega;
  if (raw == null || String(raw).trim() === '') return null;
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - hoje.getTime()) / (24 * 60 * 60 * 1000));
}

export function formatLeadTimeDias(dias: number | null): string {
  if (dias === null || !Number.isFinite(dias)) return '—';
  const abs = Math.abs(dias);
  const unidade = abs === 1 ? 'dia' : 'dias';
  return `${dias} ${unidade}`;
}
