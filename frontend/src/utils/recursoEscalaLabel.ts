import type { RecursoEscala, RecursoEscalaExcecao } from '../components/programacao-producao/types';

export const DIAS_SEMANA_ESCALA: { valor: number; label: string; curto: string }[] = [
  { valor: 1, label: 'Segunda', curto: 'Seg' },
  { valor: 2, label: 'Terça', curto: 'Ter' },
  { valor: 3, label: 'Quarta', curto: 'Qua' },
  { valor: 4, label: 'Quinta', curto: 'Qui' },
  { valor: 5, label: 'Sexta', curto: 'Sex' },
  { valor: 6, label: 'Sábado', curto: 'Sáb' },
  { valor: 0, label: 'Domingo', curto: 'Dom' },
];

export function formatEscalaResumo(escala: RecursoEscala | null | undefined): string {
  if (!escala?.faixas?.length || !escala.diasSemana?.length) return '—';
  const set = new Set(escala.diasSemana);
  const dias = DIAS_SEMANA_ESCALA.filter((d) => set.has(d.valor))
    .map((d) => d.curto)
    .join(', ');
  const faixas = escala.faixas.map((f) => `${f.inicio}–${f.fim}`).join(' / ');
  return `${dias} · ${faixas}`;
}

function formatYmdBrCurto(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function formatPeriodoEscalaExcecao(dataIni: string, dataFim: string): string {
  const a = formatYmdBrCurto(dataIni);
  const b = formatYmdBrCurto(dataFim);
  return a === b ? a : `${a} a ${b}`;
}

export function formatEscalaExcecaoResumo(ex: RecursoEscalaExcecao): string {
  const periodo = formatPeriodoEscalaExcecao(ex.dataIni, ex.dataFim);
  if (ex.tipo === 'folga') return `Folga · ${periodo}`;
  const faixas = (ex.faixas ?? []).map((f) => `${f.inicio}–${f.fim}`).join(' / ');
  return `${faixas || 'Horário especial'} · ${periodo}`;
}
