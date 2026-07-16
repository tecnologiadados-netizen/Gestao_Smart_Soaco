/** Converte entre horários do dia (HH:MM), dias da semana e expressões cron (node-cron). */

/** 0=domingo … 6=sábado (padrão node-cron). */
export const DIAS_SEMANA_CRON = [
  { valor: 0, label: 'Dom', labelCompleto: 'Domingo' },
  { valor: 1, label: 'Seg', labelCompleto: 'Segunda' },
  { valor: 2, label: 'Ter', labelCompleto: 'Terça' },
  { valor: 3, label: 'Qua', labelCompleto: 'Quarta' },
  { valor: 4, label: 'Qui', labelCompleto: 'Quinta' },
  { valor: 5, label: 'Sex', labelCompleto: 'Sexta' },
  { valor: 6, label: 'Sáb', labelCompleto: 'Sábado' },
] as const;

export type PeriodicidadePreset = 'todos' | 'uteis' | 'personalizado';

const CRON_AGENDAMENTO_RE =
  /^(\d{1,2})\s+([\d,\-]+|\d{1,2})\s+\*\s+\*\s+(\*|[\d,\-]+)$/;

const DIAS_TODOS = [0, 1, 2, 3, 4, 5, 6];
const DIAS_UTEIS = [1, 2, 3, 4, 5];

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

function arraysDiasIguais(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

/** Converte lista de dias (0–6) para campo day-of-week do cron. */
export function diasSemanaParaCampoCron(diasSemana: number[]): string {
  const sorted = [...new Set(diasSemana.filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b);
  if (sorted.length === 0 || sorted.length === 7) return '*';

  const ranges: string[] = [];
  let start = sorted[0]!;
  let prev = sorted[0]!;

  for (let i = 1; i <= sorted.length; i++) {
    const cur = sorted[i];
    if (cur === prev + 1) {
      prev = cur!;
      continue;
    }
    ranges.push(start === prev ? String(start) : `${start}-${prev}`);
    if (cur != null) {
      start = cur;
      prev = cur;
    }
  }

  return ranges.join(',');
}

/** Interpreta campo day-of-week do cron (ex.: *, 1-5, 1,3,5). */
export function cronCampoParaDiasSemana(campo: string): number[] {
  const raw = campo.trim();
  if (!raw || raw === '*') return [...DIAS_TODOS];

  const dias = new Set<number>();
  for (const token of raw.split(',')) {
    const part = token.trim();
    if (!part) continue;
    const range = /^(\d)-(\d)$/.exec(part);
    if (range) {
      const ini = Number(range[1]);
      const fim = Number(range[2]);
      if (ini <= fim) {
        for (let d = ini; d <= fim; d++) {
          if (d >= 0 && d <= 6) dias.add(d);
        }
      }
      continue;
    }
    const n = Number(part);
    if (Number.isInteger(n) && n >= 0 && n <= 6) dias.add(n);
  }

  const lista = [...dias].sort((a, b) => a - b);
  return lista.length > 0 ? lista : [...DIAS_TODOS];
}

function parseCronParte(
  expr: string
): { horarios: string[]; diasSemana: number[] } | null {
  const m = CRON_AGENDAMENTO_RE.exec(expr.trim());
  if (!m) return null;

  const min = Number(m[1]);
  if (!Number.isInteger(min) || min < 0 || min > 59) return null;

  const hourPart = m[2]!;
  const horas = hourPart.includes(',')
    ? hourPart
        .split(',')
        .map((h) => Number(h.trim()))
        .filter((h) => Number.isInteger(h) && h >= 0 && h <= 23)
    : [Number(hourPart)];

  if (horas.some((h) => Number.isNaN(h))) return null;
  if (horas.length === 0) return null;

  const diasSemana = cronCampoParaDiasSemana(m[3]!);
  return {
    horarios: horas.map((h) => formatarHorario(h, min)),
    diasSemana,
  };
}

export type AgendamentoCron = {
  horarios: string[];
  diasSemana: number[];
};

export function cronExpressaoParaAgendamento(
  expr: string | null | undefined
): AgendamentoCron {
  const raw = expr?.trim();
  if (!raw) return { horarios: ['18:00'], diasSemana: [...DIAS_TODOS] };

  const partes = raw.split('|').map((p) => p.trim()).filter(Boolean);
  const horarios: string[] = [];
  let diasSemana: number[] = [...DIAS_TODOS];

  for (let i = 0; i < partes.length; i++) {
    const parsed = parseCronParte(partes[i]!);
    if (!parsed) return { horarios: [], diasSemana: [...DIAS_TODOS] };
    horarios.push(...parsed.horarios);
    if (i === 0) diasSemana = parsed.diasSemana;
    else if (!arraysDiasIguais(diasSemana, parsed.diasSemana)) {
      return { horarios: [], diasSemana: [...DIAS_TODOS] };
    }
  }

  return {
    horarios: horarios.length > 0 ? horarios : ['18:00'],
    diasSemana,
  };
}

/** @deprecated Use cronExpressaoParaAgendamento */
export function cronExpressaoParaHorarios(expr: string | null | undefined): string[] {
  return cronExpressaoParaAgendamento(expr).horarios;
}

export function cronExpressaoEditavelPorHorarios(expr: string | null | undefined): boolean {
  const raw = expr?.trim();
  if (!raw) return true;
  const partes = raw.split('|').map((p) => p.trim()).filter(Boolean);
  if (partes.length === 0) return true;
  return partes.every((p) => parseCronParte(p) != null);
}

export function agendamentoParaCronExpressao(
  horarios: string[],
  diasSemana: number[] = DIAS_TODOS
): string {
  const dow = diasSemanaParaCampoCron(diasSemana);
  const partes: string[] = [];

  for (const texto of horarios) {
    const parsed = parseHorarioTexto(texto);
    if (!parsed) continue;
    partes.push(`${parsed.m} ${parsed.h} * * ${dow}`);
  }

  if (partes.length === 0) return `0 18 * * ${dow}`;
  return partes.join('|');
}

/** @deprecated Use agendamentoParaCronExpressao */
export function horariosParaCronExpressao(horarios: string[]): string {
  return agendamentoParaCronExpressao(horarios, DIAS_TODOS);
}

export function inferirPeriodicidadePreset(diasSemana: number[]): PeriodicidadePreset {
  if (arraysDiasIguais(diasSemana, DIAS_TODOS)) return 'todos';
  if (arraysDiasIguais(diasSemana, DIAS_UTEIS)) return 'uteis';
  return 'personalizado';
}

export function descreverHorariosAgendamento(horarios: string[]): string {
  const lista = horarios.filter((h) => parseHorarioTexto(h)).sort();
  if (lista.length === 0) return 'nenhum horário';
  if (lista.length === 1) return lista[0]!;
  if (lista.length === 2) return `${lista[0]} e ${lista[1]}`;
  return `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}`;
}

export function descreverPeriodicidade(diasSemana: number[]): string {
  const preset = inferirPeriodicidadePreset(diasSemana);
  if (preset === 'todos') return 'todos os dias';
  if (preset === 'uteis') return 'segunda a sexta';

  const labels = [...diasSemana]
    .sort((a, b) => a - b)
    .map((d) => DIAS_SEMANA_CRON.find((x) => x.valor === d)?.labelCompleto ?? String(d));

  if (labels.length === 0) return 'nenhum dia';
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]} e ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} e ${labels[labels.length - 1]}`;
}

export function proximoHorarioSugerido(horarios: string[]): string {
  const existentes = new Set(horarios.map((h) => h.trim()));
  for (let h = 6; h <= 22; h++) {
    const candidato = formatarHorario(h, 0);
    if (!existentes.has(candidato)) return candidato;
  }
  for (let h = 0; h <= 23; h++) {
    for (const m of [0, 30]) {
      const candidato = formatarHorario(h, m);
      if (!existentes.has(candidato)) return candidato;
    }
  }
  return '12:00';
}

export function diasSemanaDoPreset(preset: PeriodicidadePreset): number[] {
  if (preset === 'uteis') return [...DIAS_UTEIS];
  if (preset === 'todos') return [...DIAS_TODOS];
  return [...DIAS_UTEIS];
}
