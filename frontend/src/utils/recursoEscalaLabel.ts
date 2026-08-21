import type { RecursoEscala } from '../components/programacao-producao/types';

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
