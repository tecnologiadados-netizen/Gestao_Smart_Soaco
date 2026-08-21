export function formatHmsCurto(hms: string | null | undefined): string {
  if (!hms) return '—';
  const m = String(hms).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return hms;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

export function formatHoras(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(v)} h`;
}

/**
 * Formato compacto didático a partir de horas decimais.
 * Ex.: 8.75 → "08h e 45min" | 2 → "02h" | 0.5 → "30min" | 0 → "00h"
 */
export function formatHorasDidatico(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const minutosTotal = Math.round(v * 60);
  if (minutosTotal <= 0) return '00h';
  if (minutosTotal < 60) return `${String(minutosTotal).padStart(2, '0')}min`;
  const horas = Math.floor(minutosTotal / 60);
  const minutos = minutosTotal % 60;
  const parteHoras = `${String(horas).padStart(2, '0')}h`;
  if (minutos === 0) return parteHoras;
  return `${parteHoras} e ${String(minutos).padStart(2, '0')}min`;
}

function pluralPt(n: number, singular: string, plural: string): string {
  return n === 1 ? `${n} ${singular}` : `${n} ${plural}`;
}

/** Ex.: "12 minutos" | "2 horas e 38 minutos" | "1 hora". */
export function formatDuracaoDidatica(minutosTotal: number | null | undefined): string {
  if (minutosTotal == null || !Number.isFinite(minutosTotal)) return '—';
  const m = Math.round(minutosTotal);
  if (m <= 0) return 'menos de 1 minuto';
  if (m < 60) return pluralPt(m, 'minuto', 'minutos');
  const horas = Math.floor(m / 60);
  const minutos = m % 60;
  const parteHoras = pluralPt(horas, 'hora', 'horas');
  if (minutos === 0) return parteHoras;
  return `${parteHoras} e ${pluralPt(minutos, 'minuto', 'minutos')}`;
}

export function formatYmdBr(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd ?? '').trim());
  if (!m) return ymd || '—';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

const DIAS_SEMANA_ABREV = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];

/** Ex.: "qua. 19/08/2026" */
export function formatYmdBrComSemana(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd ?? '').trim());
  if (!m) return formatYmdBr(ymd);
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const dia = DIAS_SEMANA_ABREV[dt.getDay()] ?? '';
  return `${dia} ${m[3]}/${m[2]}/${m[1]}`;
}

export function hojeYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function mesesAtrasYmd(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Primeiro dia do mês corrente. */
export function inicioMesAtualYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
