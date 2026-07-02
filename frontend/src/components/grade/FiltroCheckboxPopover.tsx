import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  label: string;
  options: string[];
  /** Vazio = sem filtro (exibe todos). */
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
  /** Ordenação A→Z / Z→A da lista de opções e da grade (quando informado). */
  sortAsc?: boolean;
  onSortAsc?: () => void;
  onSortDesc?: () => void;
};

/**
 * Filtro com popover de checkboxes (mesmo padrão do filtro Excel da grade).
 */
export default function FiltroCheckboxPopover({
  label,
  options,
  selected,
  onChange,
  disabled = false,
  sortAsc = true,
  onSortAsc,
  onSortDesc,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [popoverRect, setPopoverRect] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const visiveis = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, search]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const todosVisiveisSelecionados =
    visiveis.length > 0 && visiveis.every((v) => selectedSet.has(v));

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const toggle = (value: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(value);
    else next.delete(value);
    onChange([...next]);
  };

  const ativo = selected.length > 0;

  const abrir = () => {
    if (disabled || options.length === 0) return;
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const menuW = 256;
      const margin = 8;
      const top = r.bottom + 4;
      const left = Math.max(margin, Math.min(r.left, window.innerWidth - menuW - margin));
      setPopoverRect({ top, left });
    }
    setOpen((o) => !o);
  };

  const menuMaxH = 360;
  const spaceBelow = popoverRect ? window.innerHeight - popoverRect.top - 8 : menuMaxH;
  const panelStyle = popoverRect
    ? {
        position: 'fixed' as const,
        top: popoverRect.top,
        left: popoverRect.left,
        width: 256,
        maxHeight: Math.max(160, Math.min(menuMaxH, spaceBelow)),
        overflowY: 'auto' as const,
        zIndex: 13001,
      }
    : undefined;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled || options.length === 0}
        onClick={abrir}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium shadow-sm disabled:opacity-50 ${
          ativo
            ? 'border-primary-400 bg-primary-50 text-primary-800 dark:border-primary-600 dark:bg-primary-900/30 dark:text-primary-200'
            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
        }`}
      >
        {label}
        {ativo && (
          <span className="rounded-full bg-primary-200 px-1.5 py-0.5 text-[10px] font-semibold text-primary-900 dark:bg-primary-800 dark:text-primary-100">
            {selected.length}
          </span>
        )}
        <span className="text-[10px] opacity-70" aria-hidden>
          ▾
        </span>
      </button>
      {open &&
        popoverRect &&
        createPortal(
          <div
            ref={panelRef}
            style={panelStyle}
            className="rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-600 dark:bg-slate-800"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar"
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              autoFocus
            />
            <div className="mt-2 max-h-44 overflow-auto rounded border border-slate-200 p-1 dark:border-slate-600">
              <label className="flex items-center gap-2 px-1 py-1 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={todosVisiveisSelecionados}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    const next = new Set(selected);
                    for (const v of visiveis) {
                      if (checked) next.add(v);
                      else next.delete(v);
                    }
                    onChange([...next]);
                  }}
                />
                (Selecionar tudo)
              </label>
              {visiveis.map((value) => (
                <label key={value} className="flex items-center gap-2 px-1 py-0.5 text-xs">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(value)}
                    onChange={(e) => toggle(value, e.target.checked)}
                  />
                  <span className="truncate" title={value}>
                    {value}
                  </span>
                </label>
              ))}
              {visiveis.length === 0 && (
                <p className="px-1 py-2 text-xs text-slate-500">Nenhuma opção.</p>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              {(onSortAsc || onSortDesc) && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                      sortAsc
                        ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-200'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
                    }`}
                    onClick={onSortAsc}
                  >
                    A → Z
                  </button>
                  <button
                    type="button"
                    className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                      !sortAsc
                        ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-200'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
                    }`}
                    onClick={onSortDesc}
                  >
                    Z → A
                  </button>
                </div>
              )}
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  className="text-xs text-slate-600 hover:underline dark:text-slate-400"
                  onClick={() => onChange([])}
                >
                  Limpar
                </button>
                <button
                  type="button"
                  className="rounded-md bg-primary-600 px-2 py-1 text-xs font-medium text-white hover:bg-primary-700"
                  onClick={() => setOpen(false)}
                >
                  OK
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
