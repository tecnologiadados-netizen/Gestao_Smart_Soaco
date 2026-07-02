import { useState, useRef, useEffect, useMemo, useId } from 'react';
import { CLASSE_INPUT_BUSCA_DROPDOWN, criarPropsInputBuscaDropdown } from '../utils/inputBuscaDropdown';

export interface OptionItem {
  id: number;
  nome: string;
  descricao?: string | null;
  /** Chave única na lista quando `id` pode repetir entre tipos diferentes. */
  uniqueKey?: string;
  /** Dados extras (ex.: tipo de vínculo na finalização da coleta). */
  meta?: Record<string, unknown>;
}

export interface SingleSelectWithSearchProps {
  label: string;
  placeholder?: string;
  options: OptionItem[];
  value: OptionItem | null;
  onChange: (value: OptionItem | null) => void;
  labelClass: string;
  inputClass: string;
  minWidth?: string;
  /** Se true, limpa a seleção ao clicar no mesmo item. */
  clearable?: boolean;
  /** @deprecated Preferir onSearchAsync — busca no servidor com estado no pai. */
  onSearchChange?: (term: string) => void;
  /** @deprecated Usar com onSearchAsync interno. */
  searchLoading?: boolean;
  /** Busca assíncrona (typeahead) — opções e loading ficam no componente. */
  onSearchAsync?: (term: string) => Promise<OptionItem[]>;
  /** Mínimo de caracteres para busca no servidor (padrão: 2 quando há busca async). */
  minSearchChars?: number;
  /** Altura máxima da área da lista (ex: "180px"). */
  listMaxHeight?: string;
  /** z-index do painel dropdown (útil dentro de modais). */
  dropdownZIndex?: number;
  /** Ocupa 100% da largura do pai (grades/modais). */
  fillContainer?: boolean;
}

const SEARCH_DEBOUNCE_MS = 350;

function optionKey(opt: OptionItem): string {
  return opt.uniqueKey ?? String(opt.id);
}

export default function SingleSelectWithSearch({
  label,
  placeholder = 'Selecione...',
  options,
  value,
  onChange,
  labelClass,
  inputClass,
  minWidth = '260px',
  clearable = true,
  onSearchChange,
  searchLoading = false,
  onSearchAsync,
  minSearchChars,
  listMaxHeight = '180px',
  dropdownZIndex = 200,
  fillContainer = false,
}: SingleSelectWithSearchProps) {
  const buscaServidor = Boolean(onSearchAsync ?? onSearchChange);
  const minCharsBusca = minSearchChars ?? (buscaServidor ? 2 : 0);
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [buscaEditavel, setBuscaEditavel] = useState(false);
  const [asyncOptions, setAsyncOptions] = useState<OptionItem[]>([]);
  const [asyncLoading, setAsyncLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputSearchRef = useRef<HTMLInputElement>(null);
  const onSearchChangeRef = useRef(onSearchChange);
  onSearchChangeRef.current = onSearchChange;
  const onSearchAsyncRef = useRef(onSearchAsync);
  onSearchAsyncRef.current = onSearchAsync;

  const propsBusca = criarPropsInputBuscaDropdown(() => setBuscaEditavel(true), {
    id: inputId,
    readOnly: !buscaEditavel,
  });

  const listOptions = useMemo(() => {
    if (onSearchAsync) {
      const merged = new Map<string, OptionItem>();
      for (const o of asyncOptions) merged.set(optionKey(o), o);
      if (value) merged.set(optionKey(value), value);
      return [...merged.values()];
    }
    if (onSearchChange) return options;
    if (!search.trim()) return options;
    const q = search.trim().toLowerCase();
    return options.filter(
      (o) =>
        (o.nome ?? '').toLowerCase().includes(q) ||
        (o.descricao ?? '').toLowerCase().includes(q)
    );
  }, [options, search, onSearchChange, onSearchAsync, asyncOptions, value]);

  const listaCarregando = onSearchAsync ? asyncLoading : searchLoading;

  useEffect(() => {
    if (!onSearchAsyncRef.current || !open) return;
    const q = search.trim();
    if (q.length < minCharsBusca) {
      setAsyncOptions([]);
      setAsyncLoading(false);
      return;
    }
    let cancelled = false;
    setAsyncLoading(true);
    const t = window.setTimeout(() => {
      void onSearchAsyncRef.current?.(q).then((list) => {
        if (!cancelled) {
          setAsyncOptions(list);
          setAsyncLoading(false);
        }
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [search, open, minCharsBusca]);

  useEffect(() => {
    if (!onSearchChangeRef.current || onSearchAsync || !open) return;
    const termo = search.trim();
    if (termo.length < minCharsBusca) return;
    const t = window.setTimeout(() => {
      onSearchChangeRef.current?.(termo);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [search, open, minCharsBusca, onSearchAsync]);

  useEffect(() => {
    if (!open) {
      setBuscaEditavel(false);
      return;
    }
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    const raf = window.requestAnimationFrame(() => {
      inputSearchRef.current?.focus({ preventScroll: true });
    });
    return () => {
      document.removeEventListener('mousedown', handler);
      window.cancelAnimationFrame(raf);
    };
  }, [open]);

  const isSameOption = (a: OptionItem | null, b: OptionItem) => {
    if (!a) return false;
    if (a.uniqueKey != null && b.uniqueKey != null) return a.uniqueKey === b.uniqueKey;
    return a.id === b.id;
  };

  const handleSelect = (opt: OptionItem) => {
    if (clearable && value && isSameOption(value, opt)) {
      onChange(null);
    } else {
      onChange(opt);
    }
    setOpen(false);
  };

  const handleToggleOpen = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setSearch('');
    setBuscaEditavel(false);
    setOpen(true);
  };

  const labelText = value ? value.nome : placeholder;
  const termoCurto = buscaServidor && search.trim().length < minCharsBusca;
  const listMaxPx = parseInt(String(listMaxHeight).replace(/px$/i, ''), 10) || 180;

  return (
    <div
      className={
        fillContainer ? 'relative w-full min-w-0 max-w-full' : 'relative shrink-0 max-w-full'
      }
      style={{ minWidth }}
      ref={ref}
    >
      <span className={labelClass}>{label}</span>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleToggleOpen}
        className={inputClass + ' w-full max-w-full min-w-0 text-left flex items-center justify-between gap-2'}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
      >
        <span className="min-w-0 flex-1 truncate">{labelText}</span>
        <span className="text-slate-400 shrink-0">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 flex w-full min-w-0 flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-700"
          style={{ zIndex: dropdownZIndex, maxHeight: listMaxPx + 52 }}
          role="listbox"
        >
          <form
            autoComplete="off"
            className="shrink-0 border-b border-slate-200 p-2 dark:border-slate-600"
            onSubmit={(e) => e.preventDefault()}
          >
            <input type="text" name="chrome-autofill-decoy" className="hidden" tabIndex={-1} aria-hidden readOnly />
            <input
              {...propsBusca}
              ref={inputSearchRef}
              name="ssws-filter-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Pesquisar..."
              aria-label={label ? `Buscar em ${label}` : 'Buscar'}
              role="combobox"
              aria-autocomplete="list"
              className={CLASSE_INPUT_BUSCA_DROPDOWN}
            />
          </form>
          <div
            className="overflow-y-auto overflow-x-hidden py-1 [overflow-anchor:none]"
            style={{ maxHeight: listMaxPx, minHeight: '2.5rem' }}
          >
            {termoCurto ? (
              <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                Digite pelo menos {minCharsBusca} caracteres para buscar.
              </p>
            ) : listaCarregando ? (
              <p className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">Carregando…</p>
            ) : listOptions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">Nenhum resultado</p>
            ) : (
              listOptions.map((opt) => (
                <button
                  key={optionKey(opt)}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(opt)}
                  className={`w-full px-3 py-1.5 text-left text-sm ${
                    value && isSameOption(value, opt)
                      ? 'bg-primary-100 font-medium text-primary-800 dark:bg-primary-900/40 dark:text-primary-200'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-600'
                  }`}
                  role="option"
                  aria-selected={value ? isSameOption(value, opt) : false}
                >
                  <span className="block truncate">{opt.nome}</span>
                  {opt.descricao && (
                    <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                      {opt.descricao}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
