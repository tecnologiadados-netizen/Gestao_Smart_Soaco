import type { Response } from 'express';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_VALID = ['Ativo', 'Férias', 'Afastado', 'Desligado'] as const;

export function s(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

export function parseIsoDate(v: string | null | undefined): Date | null {
  if (v == null || s(v) === '') return null;
  const raw = s(v);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00.000Z`);
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    const dt = new Date(year, month - 1, day);
    if (!isNaN(dt.getTime())) return dt;
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

export function formatIsoDate(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

export function normalizeOrganicoStatus(status: string): (typeof STATUS_VALID)[number] {
  const t = s(status);
  if ((STATUS_VALID as readonly string[]).includes(t)) return t as (typeof STATUS_VALID)[number];
  return 'Ativo';
}

export function isValidUuid(id: string): boolean {
  return UUID_RE.test(id);
}

export function monthBounds(ym: string): { start: Date; end: Date } | null {
  const m = ym.trim().match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const start = new Date(`${m[1]}-${m[2]}-01T12:00:00.000Z`);
  const last = new Date(y, mo, 0);
  const end = new Date(
    `${m[1]}-${m[2]}-${String(last.getDate()).padStart(2, '0')}T23:59:59.999Z`,
  );
  return { start, end };
}

export function parseValuesJson(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((v) => (v != null ? String(v) : ''));
  } catch {
    return [];
  }
}

export function toNullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function sendError(res: Response, message: string, status = 500): void {
  res.status(status).json({ error: message });
}

export function notImplemented(res: Response, feature: string): void {
  res.status(501).json({ error: `TODO: ${feature} ainda não implementado no backend Gestor.` });
}
