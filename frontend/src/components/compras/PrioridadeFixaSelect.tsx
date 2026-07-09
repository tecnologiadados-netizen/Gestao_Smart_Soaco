import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CLASSE_INPUT_BUSCA_DROPDOWN, criarPropsInputBuscaDropdown } from '../../utils/inputBuscaDropdown';

const PANEL_WIDTH = 132;
const LIST_MAX_HEIGHT = 160;
const PANEL_Z_INDEX = 13001;

type Props = {
  value: number | null;
  /** Grupos de prioridade disponíveis (1..N, como na planilha Excel). */
  opcoesGrupo: number[];
  disabled?: boolean;
  onChange: (valor: number | null) => void;
  ariaLabel?: string;
};

export default function PrioridadeFixaSelect({
  value,
  opcoesGrupo,
  disabled = false,
  onChange,
  ariaLabel = 'Prioridade fixa',
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [buscaEditavel, setBuscaEditavel] = useState(false);
  const [popoverRect, setPopoverRect] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputSearchRef = useRef<HTMLInputElement>(null);

  const propsBusca = criarPropsInputBuscaDropdown(() => setBuscaEditavel(true), {
    readOnly: !buscaEditavel,
  });

  const numeros = useMemo(() => [...opcoesGrupo], [opcoesGrupo]);

  const termoBusca = search.trim();

  const numerosFiltrados = useMemo(() => {
    if (!termoBusca) return numeros;
    return numeros.filter((n) => String(n).includes(termoBusca));
  }, [numeros, termoBusca]);

  const exibirOpcaoAutomatica =
    !termoBusca || termoBusca === '—' || 'automática'.includes(termoBusca.toLowerCase());

  useEffect(() => {
    if (!open) {
      setBuscaEditavel(false);
      return;
    }
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    const raf = window.requestAnimationFrame(() => {
      inputSearchRef.current?.focus({ preventScroll: true });
    });
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.cancelAnimationFrame(raf);
    };
  }, [open]);

  const abrir = () => {
    if (disabled || opcoesGrupo.length === 0) return;
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const margin = 8;
      const top = r.bottom + 4;
      const left = Math.max(margin, Math.min(r.left, window.innerWidth - PANEL_WIDTH - margin));
      setPopoverRect({ top, left });
      setSearch('');
      setBuscaEditavel(false);
    }
    setOpen((o) => !o);
  };

  const selecionar = (valor: number | null) => {
    onChange(valor);
    setOpen(false);
  };

  const labelValor = value != null ? String(value) : '—';

  const spaceBelow = popoverRect ? window.innerHeight - popoverRect.top - 8 : LIST_MAX_HEIGHT + 48;
  const panelMaxHeight = Math.max(LIST_MAX_HEIGHT + 48, Math.min(LIST_MAX_HEIGHT + 48, spaceBelow));

  return (
    <div className="relative inline-flex min-w-[3.5rem] justify-center">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled || opcoesGrupo.length === 0}
        onMouseDown={(e) => e.preventDefault()}
        onClick={abrir}
        className="inline-flex min-w-[3.5rem] items-center justify-between gap-1 rounded-lg border border-slate-300 bg-white px-1.5 py-1 text-center text-xs text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
      >
        <span className="flex-1 tabular-nums">{labelValor}</span>
        <span className="text-[9px] text-slate-400 shrink-0" aria-hidden>
          ▾
        </span>
      </button>

      {open &&
        popoverRect &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            aria-label={ariaLabel}
            style={{
              position: 'fixed',
              top: popoverRect.top,
              left: popoverRect.left,
              width: PANEL_WIDTH,
              maxHeight: panelMaxHeight,
              zIndex: PANEL_Z_INDEX,
            }}
            className="flex flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <form
              autoComplete="off"
              className="shrink-0 border-b border-slate-200 p-1.5 dark:border-slate-600"
              onSubmit={(e) => e.preventDefault()}
            >
              <input type="text" name="chrome-autofill-decoy" className="hidden" tabIndex={-1} aria-hidden readOnly />
              <input
                {...propsBusca}
                ref={inputSearchRef}
                name="prioridade-fixa-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Buscar nº…"
                aria-label={`${ariaLabel} — buscar número`}
                className={`${CLASSE_INPUT_BUSCA_DROPDOWN} !py-1 !text-xs`}
              />
            </form>

            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1"
              style={{ maxHeight: LIST_MAX_HEIGHT }}
            >
              {exibirOpcaoAutomatica && (
                <button
                  type="button"
                  role="option"
                  aria-selected={value == null}
                  className={`w-full rounded px-2 py-1 text-left text-xs hover:bg-slate-100 dark:hover:bg-slate-700 ${
                    value == null ? 'bg-primary-50 font-medium text-primary-800 dark:bg-primary-900/40 dark:text-primary-200' : ''
                  }`}
                  onClick={() => selecionar(null)}
                >
                  — <span className="text-slate-500 dark:text-slate-400">(automática)</span>
                </button>
              )}

              {numerosFiltrados.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="option"
                  aria-selected={value === n}
                  className={`w-full rounded px-2 py-1 text-left text-xs tabular-nums hover:bg-slate-100 dark:hover:bg-slate-700 ${
                    value === n ? 'bg-primary-50 font-medium text-primary-800 dark:bg-primary-900/40 dark:text-primary-200' : ''
                  }`}
                  onClick={() => selecionar(n)}
                >
                  {n}
                </button>
              ))}

              {!exibirOpcaoAutomatica && numerosFiltrados.length === 0 && (
                <p className="px-2 py-2 text-center text-xs text-slate-500">Nenhum número.</p>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
