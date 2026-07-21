import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker } from 'react-day-picker';
import { ptBR } from 'react-day-picker/locale';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDataCurta } from './simulacaoCarradas';

function isoToDate(iso: string): Date | undefined {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function dateToIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function formatCaptionMonth(d: Date): string {
  const raw = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

type Props = {
  value?: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
  className?: string;
  /** Chave estável para foco na grade (data-rowkey / data-colkey). */
  rowKey?: string;
  colKey?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  /** Exibe placeholder quando vazio (default: dd/mm/aaaa). */
  placeholder?: string;
  /** Largura total (modais). */
  fullWidth?: boolean;
  /** Botão só com ícone (ex.: aplicar data em lote). */
  iconOnly?: boolean;
  iconTitle?: string;
};

/**
 * Date picker próprio do sequenciamento (react-day-picker).
 * Navegação de mês é custom (fora do DayPicker) — no v9 o nav padrão
 * fica sob o caption e os botões < > deixam de receber clique.
 */
export default function SequenciamentoDateField({
  value = '',
  onChange,
  disabled = false,
  className = '',
  rowKey,
  colKey,
  onKeyDown,
  placeholder = 'dd/mm/aaaa',
  fullWidth = false,
  iconOnly = false,
  iconTitle,
}: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(() => isoToDate(value) ?? new Date());
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const selected = isoToDate(value);

  const syncMonthFromValue = useCallback(() => {
    setMonth(isoToDate(value) ?? new Date());
  }, [value]);

  const updatePos = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const popW = 288;
    let left = r.left;
    if (left + popW > window.innerWidth - 8) left = Math.max(8, window.innerWidth - popW - 8);
    let top = r.bottom + 4;
    if (top + 340 > window.innerHeight && r.top > 340) top = r.top - 4 - 320;
    setPos({ top, left });
  }, []);

  const abrir = useCallback(() => {
    if (disabled) return;
    syncMonthFromValue();
    updatePos();
    setOpen(true);
  }, [disabled, syncMonthFromValue, updatePos]);

  const fechar = useCallback(() => {
    setOpen(false);
    setPos(null);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      fechar();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        fechar();
        triggerRef.current?.focus();
      }
    };
    const onResize = () => fechar();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, fechar]);

  const label = value ? formatDataCurta(value) : placeholder;
  const title = iconTitle ?? (value ? `Data ${label}` : 'Selecionar data');

  const navBtnClass =
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700';

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        data-editinput={!iconOnly ? true : undefined}
        data-rowkey={rowKey}
        data-colkey={colKey}
        data-seq-datefield
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={title}
        title={title}
        className={
          iconOnly
            ? `rounded p-0.5 text-slate-600 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:bg-slate-600/50 disabled:opacity-40 ${className}`
            : `${
                fullWidth ? 'w-full' : 'w-full min-w-[7.5rem]'
              } rounded border border-slate-300 bg-white px-2 py-1.5 text-left text-sm tabular-nums text-slate-900 hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-primary-500 ${
                !value ? 'text-slate-400 dark:text-slate-500' : ''
              } ${className}`
        }
        onClick={(e) => {
          e.stopPropagation();
          if (open) fechar();
          else abrir();
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape' && open) {
            fechar();
            return;
          }
          if (e.key === ' ') {
            e.preventDefault();
            if (open) fechar();
            else abrir();
            return;
          }
          if (e.key === 'Enter' && open) {
            e.preventDefault();
            fechar();
            return;
          }
          onKeyDown?.(e);
        }}
      >
        {iconOnly ? <Calendar className="h-4 w-4" aria-hidden /> : label}
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Calendário"
            className="fixed z-[200] rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-600 dark:bg-slate-800"
            style={{ top: pos.top, left: pos.left }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between gap-1 px-0.5">
              <button
                type="button"
                className={navBtnClass}
                aria-label="Mês anterior"
                onClick={(e) => {
                  e.stopPropagation();
                  setMonth((m) => addMonths(m, -1));
                }}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <span className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-slate-800 dark:text-slate-100">
                {formatCaptionMonth(month)}
              </span>
              <button
                type="button"
                className={navBtnClass}
                aria-label="Próximo mês"
                onClick={(e) => {
                  e.stopPropagation();
                  setMonth((m) => addMonths(m, 1));
                }}
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <DayPicker
              mode="single"
              locale={ptBR}
              month={month}
              onMonthChange={setMonth}
              hideNavigation
              selected={selected}
              onSelect={(d) => {
                if (!d) return;
                onChange(dateToIso(d));
                fechar();
                triggerRef.current?.focus();
              }}
              classNames={{
                root: 'text-sm',
                months: 'flex flex-col',
                month: 'space-y-2',
                month_caption: 'hidden',
                caption_label: 'hidden',
                nav: 'hidden',
                button_previous: 'hidden',
                button_next: 'hidden',
                weekdays: 'flex',
                weekday: 'w-8 text-[0.7rem] font-medium text-slate-500 dark:text-slate-400',
                week: 'flex mt-0.5',
                day: 'w-8 h-8 p-0 text-center text-sm',
                day_button:
                  'h-8 w-8 rounded hover:bg-primary-50 dark:hover:bg-primary-900/40 focus:outline-none focus:ring-2 focus:ring-primary-500',
                selected:
                  '[&>button]:bg-primary-600 [&>button]:text-white [&>button]:hover:bg-primary-700',
                today: '[&>button]:font-bold [&>button]:text-primary-700 dark:[&>button]:text-primary-300',
                outside: '[&>button]:text-slate-300 dark:[&>button]:text-slate-600',
                disabled: '[&>button]:opacity-40',
              }}
            />
          </div>,
          document.body
        )}
    </>
  );
}
