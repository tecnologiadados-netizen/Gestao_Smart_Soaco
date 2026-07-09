import { useEffect, useId, useMemo, useRef, useState } from 'react';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  id?: string;
  label: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
}

function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function SearchableSelect({
  id,
  label,
  value,
  options,
  onChange,
  searchPlaceholder = 'Pesquisar...',
  emptyMessage = 'Nenhum resultado',
}: SearchableSelectProps) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return options;
    return options.filter(
      (o) => normalizeSearch(o.label).includes(q) || normalizeSearch(o.value).includes(q),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  return (
    <div className="filter-group">
      <label htmlFor={controlId}>{label}</label>
      <div ref={rootRef} className={`searchable-select${open ? ' is-open' : ''}`}>
        <button
          id={controlId}
          type="button"
          className="searchable-select-trigger"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="searchable-select-value">{selectedLabel || '—'}</span>
          <span className="searchable-select-chevron" aria-hidden="true" />
        </button>
        {open && (
          <div className="searchable-select-dropdown" role="listbox">
            <div className="searchable-select-search-wrap">
              <input
                ref={searchRef}
                type="search"
                className="searchable-select-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={`Pesquisar ${label.toLowerCase()}`}
                autoComplete="off"
              />
            </div>
            <ul className="searchable-select-list">
              {filtered.length > 0 ? (
                filtered.map((option) => (
                  <li key={option.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={option.value === value}
                      className={`searchable-select-option${option.value === value ? ' is-selected' : ''}`}
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                    >
                      {option.label}
                    </button>
                  </li>
                ))
              ) : (
                <li className="searchable-select-empty">{emptyMessage}</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
