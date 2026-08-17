import { isFeriadoReconhecido } from '../lib/feriados-nacionais';
import {
  formatDate,
  formatWeekday,
  shouldHighlightVencimentoDayLabel,
} from '../lib/formatters';

/** Data de vencimento no padrão CRM: dia da semana + legenda laranja em sáb/dom/feriado. */
export function CelulaDataVencimento({ value }: { value: string | null | undefined }) {
  const weekday = formatWeekday(value);
  const feriado = isFeriadoReconhecido(value);
  const highlight = shouldHighlightVencimentoDayLabel(value);

  return (
    <>
      <span className="block whitespace-nowrap">{formatDate(value)}</span>
      {weekday ? (
        <span
          className={`block text-[11px] capitalize leading-tight ${
            highlight ? 'font-semibold text-orange-500' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {weekday}
        </span>
      ) : null}
      {feriado ? (
        <span className="block text-[11px] font-semibold leading-tight text-orange-500">Feriado</span>
      ) : null}
    </>
  );
}

export function textoFiltroDataVencimento(value: string | null | undefined): string {
  if (!value) return '—';
  const partes = [formatDate(value), formatWeekday(value)];
  if (isFeriadoReconhecido(value)) partes.push('Feriado');
  return partes.filter(Boolean).join(' ');
}
