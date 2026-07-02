/** Converte entre horários do dia (HH:MM) e expressões cron diárias (node-cron). */

const CRON_DIARIO_RE = /^(\d{1,2})\s+([\d,]+)\s+\*\s+\*\s+\*$/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function horarioValido(h: number, m: number): boolean {
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function formatarHorario(h: number, m: number): string {
  return `${pad2(h)}:${pad2(m)}`;
}

function parseHorarioTexto(texto: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(texto.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!horarioValido(h, min)) return null;
  return { h, m: min };
}

function parseCronDiario(expr: string): string[] | null {
  const m = CRON_DIARIO_RE.exec(expr.trim());
  if (!m) return null;
  const min = Number(m[1]);
  if (!Number.isInteger(min) || min < 0 || min > 59) return null;
  const horas = m[2]!
    .split(',')
    .map((h) => Number(h.trim()))
    .filter((h) => Number.isInteger(h) && h >= 0 && h <= 23);
  if (horas.length === 0) return null;
  return [...new Set(horas.map((h) => formatarHorario(h, min)))].sort();
}

/** Extrai horários HH:MM a partir de uma ou mais expressões cron diárias (separadas por |). */
export function cronExpressaoParaHorarios(expr: string | null | undefined): string[] {
  const raw = expr?.trim();
  if (!raw) return ['18:00'];

  const partes = raw.split('|').map((p) => p.trim()).filter(Boolean);
  const horarios = new Set<string>();

  for (const parte of partes) {
    const parsed = parseCronDiario(parte);
    if (parsed) {
      for (const h of parsed) horarios.add(h);
      continue;
    }
    return [];
  }

  const lista = [...horarios].sort();
  return lista.length > 0 ? lista : ['18:00'];
}

/** Indica se a expressão cron pode ser editada pelos seletores de horário. */
export function cronExpressaoEditavelPorHorarios(expr: string | null | undefined): boolean {
  const raw = expr?.trim();
  if (!raw) return true;
  const partes = raw.split('|').map((p) => p.trim()).filter(Boolean);
  if (partes.length === 0) return true;
  return partes.every((p) => parseCronDiario(p) != null);
}

/** Monta expressão cron a partir de horários HH:MM (suporta vários horários no dia). */
export function horariosParaCronExpressao(horarios: string[]): string {
  const mapa = new Map<number, number[]>();

  for (const texto of horarios) {
    const parsed = parseHorarioTexto(texto);
    if (!parsed) continue;
    const lista = mapa.get(parsed.m) ?? [];
    lista.push(parsed.h);
    mapa.set(parsed.m, lista);
  }

  if (mapa.size === 0) return '0 18 * * *';

  const crons = [...mapa.entries()]
    .sort(([mA], [mB]) => mA - mB)
    .map(([min, horas]) => {
      const hs = [...new Set(horas)].sort((a, b) => a - b).join(',');
      return `${min} ${hs} * * *`;
    });

  return crons.join('|');
}

/** Descrição legível dos horários (ex.: "08:00, 12:00 e 18:00"). */
export function descreverHorariosAgendamento(horarios: string[]): string {
  const lista = horarios.filter((h) => parseHorarioTexto(h)).sort();
  if (lista.length === 0) return 'nenhum horário';
  if (lista.length === 1) return lista[0]!;
  if (lista.length === 2) return `${lista[0]} e ${lista[1]}`;
  return `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}`;
}
