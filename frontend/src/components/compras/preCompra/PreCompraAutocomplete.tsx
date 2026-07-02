import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchPreCompraSugestoes,
  type CampoSugestaoPreCompra,
  type PreCompraSugestao,
} from '../../../api/preCompra';

export const LABEL_CLASS = 'block text-xs text-slate-500 dark:text-slate-400 mb-1';
export const INPUT_CLASS =
  'w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100';

interface Props {
  label: string;
  placeholder?: string;
  campo: CampoSugestaoPreCompra;
  value: string;
  onChange: (value: string) => void;
}

export default function PreCompraAutocomplete({
  label,
  placeholder,
  campo,
  value,
  onChange,
}: Props) {
  const [input, setInput] = useState(value);
  const [sugestoes, setSugestoes] = useState<PreCompraSugestao[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setInput(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadSugestoes = useCallback(
    async (term: string) => {
      setLoading(true);
      try {
        const list = await fetchPreCompraSugestoes(campo, term);
        setSugestoes(list);
        setOpen(list.length > 0);
        setActiveIdx(-1);
      } catch {
        setSugestoes([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    },
    [campo]
  );

  function handleInputChange(text: string) {
    setInput(text);
    onChange(text);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadSugestoes(text), 280);
  }

  function selectSuggestion(item: PreCompraSugestao) {
    setInput(item.valor);
    onChange(item.valor);
    setOpen(false);
    setSugestoes([]);
  }

  function handleFocus() {
    loadSugestoes(input);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || sugestoes.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, sugestoes.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      selectSuggestion(sugestoes[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <label className={LABEL_CLASS}>{label}</label>
      <div className="relative">
        <input
          type="text"
          className={INPUT_CLASS}
          placeholder={placeholder}
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        {loading && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">…</span>
        )}
        {!loading && input && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            onClick={() => {
              setInput('');
              onChange('');
              setSugestoes([]);
              setOpen(false);
            }}
            aria-label="Limpar"
          >
            ×
          </button>
        )}
      </div>
      {open && sugestoes.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
          {sugestoes.map((item, idx) => (
            <li key={`${item.valor}-${idx}`}>
              <button
                type="button"
                className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 ${
                  idx === activeIdx ? 'bg-slate-100 dark:bg-slate-700' : ''
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSuggestion(item)}
              >
                <span className="block text-slate-800 dark:text-slate-100">{item.valor}</span>
                {item.subvalor && (
                  <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                    {item.subvalor}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
