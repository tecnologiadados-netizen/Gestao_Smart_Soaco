/**
 * Escala de trabalho de recurso (faixas no mesmo dia + dias da semana).
 * 0 = domingo … 6 = sábado (mesmo que Date#getDay).
 */

export const CAMASI_RECURSO_COD = 'R001';

export type RecursoEscalaFaixa = {
  inicio: string;
  fim: string;
};

export type RecursoEscala = {
  diasSemana: number[];
  faixas: RecursoEscalaFaixa[];
};

export const ESCALA_PERFILADEIRA_PADRAO: RecursoEscala = {
  diasSemana: [1, 2, 3, 4, 5],
  faixas: [
    { inicio: '07:00', fim: '11:30' },
    { inicio: '13:00', fim: '17:15' },
  ],
};

const MS_HORA = 1000 * 60 * 60;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Aceita HH:MM ou HH:MM:SS → HH:MM. */
export function normalizarHhMm(value: unknown): string | null {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return `${pad2(h)}:${pad2(min)}`;
}

function hhMmParaMinutos(hhmm: string): number | null {
  const n = normalizarHhMm(hhmm);
  if (!n) return null;
  const [h, min] = n.split(':').map(Number);
  return h * 60 + min;
}

export function escalaEstaVazia(escala: RecursoEscala | null | undefined): boolean {
  if (!escala) return true;
  const dias = (escala.diasSemana ?? []).filter((d) => d >= 0 && d <= 6);
  const faixas = (escala.faixas ?? []).filter((f) => normalizarHhMm(f.inicio) && normalizarHhMm(f.fim));
  return dias.length === 0 || faixas.length === 0;
}

export function normalizarEscala(raw: unknown): RecursoEscala | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Partial<RecursoEscala>;
  const diasSet = new Set<number>();
  for (const d of o.diasSemana ?? []) {
    const n = Number(d);
    if (Number.isInteger(n) && n >= 0 && n <= 6) diasSet.add(n);
  }
  const faixas: RecursoEscalaFaixa[] = [];
  for (const f of o.faixas ?? []) {
    const inicio = normalizarHhMm(f?.inicio);
    const fim = normalizarHhMm(f?.fim);
    if (!inicio || !fim) continue;
    const a = hhMmParaMinutos(inicio);
    const b = hhMmParaMinutos(fim);
    if (a == null || b == null || b <= a) {
      throw new Error(`Faixa de escala inválida (${inicio}–${fim}): o fim deve ser depois do início no mesmo dia.`);
    }
    faixas.push({ inicio, fim });
  }
  faixas.sort((x, y) => (hhMmParaMinutos(x.inicio) ?? 0) - (hhMmParaMinutos(y.inicio) ?? 0));
  const diasSemana = [...diasSet].sort((a, b) => a - b);
  const escala: RecursoEscala = { diasSemana, faixas };
  if (escalaEstaVazia(escala)) return null;
  return escala;
}

function weekdayYmd(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.getDay();
}

function janelasMsDoDia(ymd: string, escala: RecursoEscala): { startMs: number; endMs: number }[] {
  const wd = weekdayYmd(ymd);
  if (wd == null || !escala.diasSemana.includes(wd)) return [];
  const [y, mo, d] = ymd.split('-').map(Number);
  const out: { startMs: number; endMs: number }[] = [];
  for (const f of escala.faixas) {
    const ini = normalizarHhMm(f.inicio);
    const fim = normalizarHhMm(f.fim);
    if (!ini || !fim) continue;
    const [ih, im] = ini.split(':').map(Number);
    const [fh, fm] = fim.split(':').map(Number);
    const startMs = new Date(y, mo - 1, d, ih, im, 0, 0).getTime();
    const endMs = new Date(y, mo - 1, d, fh, fm, 0, 0).getTime();
    if (endMs > startMs) out.push({ startMs, endMs });
  }
  return out;
}

export type MsInterval = { startMs: number; endMs: number };

export function recortarIntervaloNasJanelas(
  startMs: number,
  endMs: number,
  janelas: MsInterval[]
): MsInterval[] {
  if (!(endMs > startMs) || janelas.length === 0) return [];
  const out: MsInterval[] = [];
  for (const w of janelas) {
    const a = Math.max(startMs, w.startMs);
    const b = Math.min(endMs, w.endMs);
    if (b > a) out.push({ startMs: a, endMs: b });
  }
  return out;
}

/** Une intervalos sobrepostos/contíguos (mesma linha do tempo). */
export function unirIntervalos(intervals: MsInterval[]): MsInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  const out: MsInterval[] = [{ ...sorted[0]! }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const last = out[out.length - 1]!;
    if (cur.startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, cur.endMs);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

export function horasDosIntervalos(intervals: MsInterval[]): number {
  let acc = 0;
  for (const iv of intervals) {
    if (iv.endMs > iv.startMs) acc += (iv.endMs - iv.startMs) / MS_HORA;
  }
  return acc;
}

export function overlapHorasComJanelas(
  startMs: number,
  endMs: number,
  janelas: MsInterval[]
): number {
  return horasDosIntervalos(recortarIntervaloNasJanelas(startMs, endMs, janelas));
}

/** Horas de um intervalo [inicio,fim] que caem nas faixas do dia (DATA). */
export function horasIntervaloNaEscala(
  ymd: string,
  startMs: number,
  endMs: number,
  escala: RecursoEscala | null | undefined
): number {
  if (!escala || escalaEstaVazia(escala) || !(endMs > startMs)) return 0;
  return overlapHorasComJanelas(startMs, endMs, janelasMsDoDia(ymd, escala));
}

/** Pedaços do intervalo que caem nas faixas da escala no dia. */
export function intervalosNaEscalaDoDia(
  ymd: string,
  startMs: number,
  endMs: number,
  escala: RecursoEscala | null | undefined
): MsInterval[] {
  if (!(endMs > startMs)) return [];
  if (!escala || escalaEstaVazia(escala)) {
    return [{ startMs, endMs }];
  }
  return recortarIntervaloNasJanelas(startMs, endMs, janelasMsDoDia(ymd, escala));
}

/** Horas previstas de escala em um único dia (YYYY-MM-DD). */
export function horasEscalaNoDia(
  ymd: string,
  escala: RecursoEscala | null | undefined
): number {
  if (!escala || escalaEstaVazia(escala)) return 0;
  return horasDosIntervalos(janelasMsDoDia(ymd, escala));
}

/** Soma das faixas em cada dia do período [dataIni, dataFim] inclusive. */
export function horasEscalaNoPeriodo(
  dataIni: string,
  dataFim: string,
  escala: RecursoEscala | null | undefined
): number {
  if (!escala || escalaEstaVazia(escala) || dataIni > dataFim) return 0;
  const ini = new Date(`${dataIni}T00:00:00`);
  const fim = new Date(`${dataFim}T00:00:00`);
  if (Number.isNaN(ini.getTime()) || Number.isNaN(fim.getTime())) return 0;
  let total = 0;
  const cur = new Date(ini.getTime());
  while (cur.getTime() <= fim.getTime()) {
    const y = cur.getFullYear();
    const mo = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    total += horasEscalaNoDia(`${y}-${mo}-${d}`, escala);
    cur.setDate(cur.getDate() + 1);
  }
  return total;
}
