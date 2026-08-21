import type { RecursoEscala } from '../components/programacao-producao/types';

function hhMmParaMinutos(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(hhmm).trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Horas previstas de escala em um único dia (YYYY-MM-DD). */
export function horasEscalaNoDia(
  ymd: string,
  escala: Pick<RecursoEscala, 'diasSemana' | 'faixas'> | null | undefined
): number {
  if (!escala?.faixas?.length || !escala.diasSemana?.length) return 0;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd ?? '').trim());
  if (!m) return 0;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(dt.getTime())) return 0;
  if (!escala.diasSemana.includes(dt.getDay())) return 0;

  let minutos = 0;
  for (const f of escala.faixas) {
    const a = hhMmParaMinutos(f.inicio);
    const b = hhMmParaMinutos(f.fim);
    if (a == null || b == null || b <= a) continue;
    minutos += b - a;
  }
  return minutos / 60;
}
