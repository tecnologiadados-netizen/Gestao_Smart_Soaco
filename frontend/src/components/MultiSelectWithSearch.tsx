import { useState, useRef, useEffect, useMemo } from 'react';
import { criarMatcherTextoLivre } from '../utils/textoLivreBusca';

/** Separador entre valores no `value` (Gerenciador e demais telas: vírgula; Ressup Almox: pipe). */
const DEFAULT_VALUE_SEPARATOR = ',';

function parseValue(value: string, separator: string): string[] {
  if (!value?.trim()) return [];
  return value.split(separator).map((s) => s.trim()).filter(Boolean);
}

export interface MultiSelectWithSearchProps {
  label: string;
  placeholder?: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  labelClass: string;
  inputClass: string;
  minWidth?: string;
  /** Ex.: "Rotas" para "N rotas selecionadas" */
  optionLabel?: string;
  /** Display por valor interno (`value`), ex.: código — nome onde `value` é só o id numérico. */
  labelByValue?: Record<string, string>;
  /** z-index do painel dropdown (útil dentro de modais). */
  dropdownZIndex?: number;
  /** Caractere que une os itens selecionados em `value` (padrão: vírgula). */
  valueSeparator?: string;
  /** Largura máxima do painel dropdown (padrão: 100% do campo). */
  dropdownMaxWidth?: string;
  /** Altura máxima do painel dropdown (padrão: 280px). */
  dropdownMaxHeight?: string;
  /** Altura máxima da lista rolável (padrão: 220px). */
  dropdownListMaxHeight?: string;
  /** Se true, ocupa 100% da largura do pai (grades/modais). Padrão: largura mínima em barra de filtros horizontal. */
  fillContainer?: boolean;
  /** Desabilita abertura e seleção (ex.: antes de Aplicar na DFC). */
  disabled?: boolean;
  /** Se definido, exige N caracteres na busca antes de listar opções (evita renderizar listas enormes). */
  minSearchChars?: number;
  /** Busca assíncrona (typeahead) — substitui filtro local quando informado. */
  onSearchAsync?: (term: string) => Promise<string[]>;
  /** Lista ainda carregando no servidor (ex.: opções de filtro). */
  optionsLoading?: boolean;
}

export default function MultiSelectWithSearch({
  label,
  placeholder = 'Todos',
  options,
  value,
  onChange,
  labelClass,
  inputClass,
  minWidth = '160px',
  optionLabel = 'itens',
  labelByValue,
  dropdownZIndex = 100,
  valueSeparator = DEFAULT_VALUE_SEPARATOR,
  dropdownMaxWidth,
  dropdownMaxHeight = '280px',
  dropdownListMaxHeight = '220px',
  fillContainer = false,
  disabled = false,
  minSearchChars = 0,
  onSearchAsync,
  optionsLoading = false,
}: MultiSelectWithSearchProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [asyncOptions, setAsyncOptions] = useState<string[]>([]);
  const [asyncLoading, setAsyncLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputSearchRef = useRef<HTMLInputElement>(null);
  const selected = parseValue(value, valueSeparator);

  const displayFor = useMemo(() => {
    return (opt: string) => labelByValue?.[opt] ?? opt;
  }, [labelByValue]);

  const filteredOptions = useMemo(() => {
    if (onSearchAsync) {
      const merged = new Set([...asyncOptions, ...selected]);
      return [...merged];
    }
    if (minSearchChars > 0 && search.trim().length < minSearchChars) return [];
    if (!search.trim()) return options;
    const match = criarMatcherTextoLivre(search);
    return options.filter((o) => {
      const d = labelByValue?.[o] ?? o;
      return match(d) || match(o);
    });
  }, [options, search, labelByValue, onSearchAsync, asyncOptions, minSearchChars, selected]);

  useEffect(() => {
    if (!onSearchAsync || !open) return;
    const q = search.trim();
    if (q.length < (minSearchChars || 2)) {
      setAsyncOptions([]);
      return;
    }
    let cancelled = false;
    setAsyncLoading(true);
    const t = window.setTimeout(() => {
      void onSearchAsync(q).then((list) => {
        if (!cancelled) {
          setAsyncOptions(list);
          setAsyncLoading(false);
        }
      });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [search, open, onSearchAsync, minSearchChars]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [open]);

  useEffect(() => {
    if (open) {
      setSearch('');
      setTimeout(() => inputSearchRef.current?.focus(), 50);
    }
  }, [open]);

  const toggle = (opt: string) => {
    if (disabled) return;
    const set = new Set(selected);
    if (set.has(opt)) set.delete(opt);
    else set.add(opt);
    onChange(Array.from(set).join(valueSeparator));
  };

  const selectAll = () => {
    if (disabled) return;
    if (selected.length === filteredOptions.length) {
      const rest = selected.filter((s) => !filteredOptions.includes(s));
      onChange(rest.join(valueSeparator));
    } else {
      const merged = new Set([...selected, ...filteredOptions]);
      onChange(Array.from(merged).join(valueSeparator));
    }
  };

  const labelText =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? displayFor(selected[0])
        : `${selected.length} ${optionLabel}`;

  const panelMaxW = dropdownMaxWidth ?? '100%';

  return (
    <div
      className={
        (fillContainer ? 'relative w-full min-w-0 max-w-full' : 'relative shrink-0 max-w-full') +
        (disabled ? ' opacity-60 pointer-events-none' : '')
      }
      style={{ minWidth }}
      ref={ref}
    >
      <label className={labelClass}>{label}</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={inputClass + ' w-full max-w-full min-w-0 text-left flex items-center justify-between gap-2'}
      >
        <span className="min-w-0 flex-1 truncate">{labelText}</span>
        <span className="text-slate-400 shrink-0">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 flex w-full min-w-0 flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-700"
          style={{ zIndex: dropdownZIndex, maxWidth: panelMaxW, maxHeight: dropdownMaxHeight }}
        >
          <div className="shrink-0 border-b border-slate-200 p-2 dark:border-slate-600">
            <input
              ref={inputSearchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar..."
              className="w-full rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-sm text-slate-800 focus:border-transparent focus:ring-2 focus:ring-primary-500 dark:border-slate-500 dark:bg-slate-600 dark:text-slate-100"
            />
          </div>
          <div
            className="overflow-y-auto overflow-x-hidden py-1"
            style={{ maxHeight: dropdownListMaxHeight }}
          >
            {filteredOptions.length > 0 && (
              <label className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-600">
                <input
                  type="checkbox"
                  checked={filteredOptions.every((o) => selected.includes(o))}
                  onChange={selectAll}
                  className="rounded border-slate-400 text-primary-600 focus:ring-primary-500"
                />
                <span className="font-medium text-slate-500 dark:text-slate-400">Selecionar todos</span>
              </label>
            )}
            {(asyncLoading || optionsLoading) && (
              <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">Carregando…</p>
            )}
            {!asyncLoading && !optionsLoading && minSearchChars > 0 && !onSearchAsync && search.trim().length < minSearchChars && (
              <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                Digite pelo menos {minSearchChars} caracteres para pesquisar.
              </p>
            )}
            {!asyncLoading && !optionsLoading && onSearchAsync && search.trim().length < (minSearchChars || 2) && (
              <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                Digite pelo menos {minSearchChars || 2} caracteres para buscar no ERP.
              </p>
            )}
            {!asyncLoading && !optionsLoading && filteredOptions.length === 0 && !(minSearchChars > 0 && search.trim().length < minSearchChars) ? (
              <p className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">Nenhum resultado</p>
            ) : !asyncLoading && !optionsLoading ? (
              filteredOptions.map((opt) => {
                const texto = displayFor(opt);
                return (
                  <label
                    key={opt}
                    className="flex min-w-0 cursor-pointer items-start gap-2 px-3 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-600"
                    title={texto}
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(opt)}
                      onChange={() => toggle(opt)}
                      className="mt-0.5 shrink-0 rounded border-slate-400 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="min-w-0 flex-1 line-clamp-2 break-words leading-snug">{texto}</span>
                  </label>
                );
              })
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
