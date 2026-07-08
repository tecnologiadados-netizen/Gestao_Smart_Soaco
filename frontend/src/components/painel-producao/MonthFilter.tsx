import { useEffect, useId, useRef, useState } from 'react';
import { formatMesShort } from '../../utils/painelProducaoFormat';
import { insertPainelProducaoMes } from '../../api/painelProducao';

const INSERT_VALUE = '__inserir_mes__';

interface MonthFilterProps {
  id?: string;
  mes: string;
  meses: string[];
  onChange: (mes: string) => void;
  onMesesChange?: (meses: string[], selectedMes: string) => void;
  allowInsert?: boolean;
  disabled?: boolean;
}

export function MonthFilter({
  id,
  mes,
  meses,
  onChange,
  onMesesChange,
  allowInsert = false,
  disabled = false,
}: MonthFilterProps) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [inserting, setInserting] = useState(false);

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
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  async function inserirNovoMes() {
    setInserting(true);
    try {
      const data = await insertPainelProducaoMes();
      const lista = data.meses ?? meses;
      onMesesChange?.(lista, data.mes);
      onChange(data.mes);
      setOpen(false);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Falha ao inserir novo mês.');
    } finally {
      setInserting(false);
    }
  }

  function selectMes(value: string) {
    if (value === INSERT_VALUE) {
      void inserirNovoMes();
      return;
    }
    onChange(value);
    setOpen(false);
  }

  return (
    <div className="filter-group filter-group-mes">
      <label htmlFor={controlId}>Mês</label>
      <div ref={rootRef} className={`searchable-select month-filter${open ? ' is-open' : ''}`}>
        <button
          id={controlId}
          type="button"
          className="searchable-select-trigger"
          onClick={() => !disabled && setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={disabled || inserting}
        >
          <span className="searchable-select-value">
            {inserting ? 'Inserindo...' : formatMesShort(mes) || '—'}
          </span>
          <span className="searchable-select-chevron" aria-hidden="true" />
        </button>
        {open && (
          <div className="searchable-select-dropdown" role="listbox">
            <ul className="searchable-select-list">
              {allowInsert && (
                <li>
                  <button
                    type="button"
                    role="option"
                    className="searchable-select-option month-filter-insert"
                    onClick={() => selectMes(INSERT_VALUE)}
                    disabled={inserting}
                  >
                    + Inserir novo mês
                  </button>
                </li>
              )}
              {meses.map((m) => (
                <li key={m}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={m === mes}
                    className={`searchable-select-option${m === mes ? ' is-selected' : ''}`}
                    onClick={() => selectMes(m)}
                  >
                    {formatMesShort(m)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
