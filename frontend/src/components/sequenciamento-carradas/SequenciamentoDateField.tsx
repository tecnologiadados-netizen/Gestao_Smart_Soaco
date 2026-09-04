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

function isoFromParts(year: number, month: number, day: number): string | null {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return dateToIso(d);
}

/** Aceita dd/mm/aaaa, d/m/aaaa, ISO yyyy-mm-dd ou 8 dígitos ddmmaaaa. */
export function parseDataDigitadaToIso(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return isoFromParts(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const br = t.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (br) return isoFromParts(Number(br[3]), Number(br[2]), Number(br[1]));
  const digits = t.replace(/\D/g, '');
  if (digits.length === 8) {
    return isoFromParts(Number(digits.slice(4, 8)), Number(digits.slice(2, 4)), Number(digits.slice(0, 2)));
  }
  return null;
}

function maskBrDate(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function displayFromIso(iso: string): string {
  return iso ? formatDataCurta(iso) : '';
}

type Props = {
  value?: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
  className?: string;
  /** Chave estável para foco na grade (data-rowkey / data-colkey). */
  rowKey?: string;
  colKey?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLElement>) => void;
  /** Exibe placeholder quando vazio (default: dd/mm/aaaa). */
  placeholder?: string;
  /** Largura total (modais). */
  fullWidth?: boolean;
  /** Botão só com ícone (ex.: aplicar data em lote). */
  iconOnly?: boolean;
  iconTitle?: string;
  /**
   * Classe z-index do popover (portal). Em modais com overlay alto (ex. calendário z-14200)
   * use algo acima, senão o calendário abre “atrás” e parece que o campo não responde.
   */
  popoverZClass?: string;
  /**
   * Data mínima selecionável (YYYY-MM-DD, local).
   * Dias anteriores ficam desabilitados no calendário e são ignorados no onChange.
   */
  minDate?: string;
};

/**
 * Campo de data: digitação dd/mm/aaaa + calendário (react-day-picker).
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
  popoverZClass = 'z-[200]',
  minDate,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const focusedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(() => isoToDate(value) ?? new Date());
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [texto, setTexto] = useState(() => displayFromIso(value));

  const selected = isoToDate(value);
  const minDateObj = minDate ? isoToDate(minDate) : undefined;

  useEffect(() => {
    if (focusedRef.current) return;
    setTexto(displayFromIso(value));
  }, [value]);

  const syncMonthFromValue = useCallback(() => {
    setMonth(isoToDate(value) ?? new Date());
  }, [value]);

  const updatePos = useCallback(() => {
    const el = wrapRef.current ?? triggerRef.current;
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

  const aplicarIso = useCallback(
    (iso: string) => {
      if (minDate && iso < minDate) return false;
      if (iso !== value) onChange(iso);
      setTexto(formatDataCurta(iso));
      setMonth(isoToDate(iso) ?? new Date());
      return true;
    },
    [minDate, onChange, value]
  );

  const commitTexto = useCallback(
    (raw: string, revertIfInvalid: boolean) => {
      const iso = parseDataDigitadaToIso(raw);
      if (!iso) {
        if (revertIfInvalid) setTexto(displayFromIso(value));
        return false;
      }
      const ok = aplicarIso(iso);
      if (!ok && revertIfInvalid) setTexto(displayFromIso(value));
      return ok;
    },
    [aplicarIso, value]
  );

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      fechar();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        fechar();
        (inputRef.current ?? triggerRef.current)?.focus();
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

  const title = iconTitle ?? (value ? `Data ${displayFromIso(value)}` : 'Selecionar data');

  const navBtnClass =
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700';

  const calendarPopover =
    open &&
    pos &&
    createPortal(
      <div
        ref={popoverRef}
        role="dialog"
        aria-label="Calendário"
        className={`fixed ${popoverZClass} rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-600 dark:bg-slate-800`}
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
          disabled={minDateObj ? { before: minDateObj } : undefined}
          onSelect={(d) => {
            if (!d) return;
            const iso = dateToIso(d);
            if (!aplicarIso(iso)) return;
            fechar();
            (inputRef.current ?? triggerRef.current)?.focus();
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
            disabled:
              '[&>button]:pointer-events-none [&>button]:opacity-40 [&>button]:cursor-not-allowed',
          }}
        />
      </div>,
      document.body
    );

  if (iconOnly) {
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          data-rowkey={rowKey}
          data-colkey={colKey}
          data-seq-datefield
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={title}
          title={title}
          className={`rounded p-0.5 text-slate-600 hover:bg-slate-200/80 dark:text-slate-300 dark:hover:bg-slate-600/50 disabled:opacity-40 ${className}`}
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
            onKeyDown?.(e);
          }}
        >
          <Calendar className="h-4 w-4" aria-hidden />
        </button>
        {calendarPopover}
      </>
    );
  }

  return (
    <>
      <div
        ref={wrapRef}
        className={`relative ${fullWidth ? 'w-full' : 'w-full min-w-[7.5rem]'}`}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={texto}
          data-editinput
          data-rowkey={rowKey}
          data-colkey={colKey}
          data-seq-datefield
          aria-label={title}
          title={title}
          className={`w-full rounded border border-slate-300 bg-white py-1.5 pl-2 pr-8 text-left text-sm tabular-nums text-slate-900 placeholder:text-slate-400 hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-primary-500 ${className}`}
          onClick={(e) => e.stopPropagation()}
          onFocus={() => {
            focusedRef.current = true;
          }}
          onBlur={() => {
            focusedRef.current = false;
            commitTexto(texto, true);
          }}
          onChange={(e) => {
            const raw = e.target.value;
            const pastedIso = parseDataDigitadaToIso(raw);
            if (pastedIso && /^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
              aplicarIso(pastedIso);
              return;
            }
            const masked = maskBrDate(raw);
            setTexto(masked);
            if (masked.replace(/\D/g, '').length === 8) {
              commitTexto(masked, false);
            }
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape' && open) {
              fechar();
              return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              commitTexto(texto, true);
            }
            onKeyDown?.(e);
          }}
        />
        <button
          ref={triggerRef}
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Abrir calendário"
          title="Abrir calendário"
          className="absolute right-0.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            if (open) fechar();
            else abrir();
          }}
        >
          <Calendar className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      {calendarPopover}
    </>
  );
}
