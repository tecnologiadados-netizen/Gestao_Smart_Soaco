import { useState, useRef, useEffect } from 'react';

const MAX_SUGESTOES = 14;

interface MultiSelectFiltroProps {
  label: string;
  selected: string[];
  options: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  placeholder?: string;
  minWidth?: string;
}

export default function MultiSelectFiltro({
  label,
  selected,
  options,
  onAdd,
  onRemove,
  placeholder = 'Selecione ou digite',
  minWidth = '140px',
}: MultiSelectFiltroProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedSet = new Set(selected.map((s) => s.toLowerCase()));
  const suggestions = options
    .filter((o) => o.toLowerCase().includes(inputValue.toLowerCase()) && !selectedSet.has(o.toLowerCase()))
    .slice(0, MAX_SUGESTOES);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const el = e.target as Node;
      if (containerRef.current?.contains(el) || listRef.current?.contains(el)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const labelClass = 'text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap';
  const chipClass =
    'inline-flex items-center gap-1 rounded bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-200 px-2 py-0.5 text-xs font-medium';
  const inputInnerClass =
    'flex-1 min-w-[60px] bg-transparent border-0 py-0.5 px-0 text-sm text-slate-900 dark:text-slate-200 placeholder-slate-500 dark:placeholder-slate-400 focus:ring-0 focus:outline-none';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className={labelClass}>{label}</label>
      <div
        className="relative flex flex-wrap items-center gap-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500"
        ref={containerRef}
        style={{ minWidth }}
      >
        {selected.map((item) => (
          <span key={item} className={chipClass}>
            {item}
            <button
              type="button"
              onClick={() => onRemove(item)}
              className="rounded hover:bg-primary-200 dark:hover:bg-primary-800 p-0.5"
              aria-label={`Remover ${item}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </span>
        ))}
        <input
          type="text"
          className={inputInnerClass}
          placeholder={selected.length ? 'Adicionar…' : placeholder}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => setOpen(true)}
          autoComplete="off"
        />
        {open && (suggestions.length > 0 || inputValue.trim() !== '') && (
          <ul
            ref={listRef}
            className="absolute z-50 left-0 right-0 top-full mt-0.5 min-w-full max-h-48 overflow-y-auto rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 shadow-lg py-1"
          >
            {suggestions.length === 0 ? (
              <li className="px-2.5 py-1.5 text-xs text-slate-500 dark:text-slate-400">Nenhum resultado</li>
            ) : (
              suggestions.map((opt) => (
                <li
                  key={opt}
                  role="option"
                  className="px-2.5 py-1.5 text-sm text-slate-900 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onAdd(opt);
                    setInputValue('');
                    setOpen(false);
                  }}
                >
                  {opt}
                </li>
              )))
            }
          </ul>
        )}
      </div>
    </div>
  );
}
