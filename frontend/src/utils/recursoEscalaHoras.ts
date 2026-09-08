import type { RecursoEscala, RecursoEscalaExcecao } from '../components/programacao-producao/types';

function hhMmParaMinutos(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(hhmm).trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

function minutosDasFaixas(faixas: { inicio: string; fim: string }[] | undefined): number {
  let minutos = 0;
  for (const f of faixas ?? []) {
    const a = hhMmParaMinutos(f.inicio);
    const b = hhMmParaMinutos(f.fim);
    if (a == null || b == null || b <= a) continue;
    minutos += b - a;
  }
  return minutos;
}

export function excecaoVigenteNoDia(
  ymd: string,
  excecoes: RecursoEscalaExcecao[] | null | undefined
): RecursoEscalaExcecao | null {
  let found: RecursoEscalaExcecao | null = null;
  for (const ex of excecoes ?? []) {
    if (ymd >= ex.dataIni && ymd <= ex.dataFim) found = ex;
  }
  return found;
}

export function excecoesSobrepostasAoPeriodo(
  excecoes: RecursoEscalaExcecao[] | null | undefined,
  dataIni: string,
  dataFim: string
): RecursoEscalaExcecao[] {
  return (excecoes ?? []).filter((ex) => ex.dataFim >= dataIni && ex.dataIni <= dataFim);
}

/** Horas previstas de escala em um único dia (YYYY-MM-DD), já com folga/hora extra. */
export function horasEscalaNoDia(
  ymd: string,
  escala: Pick<RecursoEscala, 'diasSemana' | 'faixas' | 'excecoes'> | null | undefined
): number {
  if (!escala?.faixas?.length || !escala.diasSemana?.length) return 0;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd ?? '').trim());
  if (!m) return 0;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(dt.getTime())) return 0;

  const ex = excecaoVigenteNoDia(ymd, escala.excecoes);
  if (ex?.tipo === 'folga') return 0;
  if (ex?.tipo === 'substituir') return minutosDasFaixas(ex.faixas) / 60;
  if (!escala.diasSemana.includes(dt.getDay())) return 0;
  return minutosDasFaixas(escala.faixas) / 60;
}
