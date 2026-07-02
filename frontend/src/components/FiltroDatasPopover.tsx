import { useState, useRef, useEffect } from 'react';
import type { FiltrosPedidosState } from './FiltroPedidos';

function CalendarIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

interface FiltroDatasPopoverProps {
  filtros: Pick<
    FiltrosPedidosState,
    | 'data_emissao_ini'
    | 'data_emissao_fim'
    | 'data_entrega_ini'
    | 'data_entrega_fim'
    | 'data_previsao_anterior_ini'
    | 'data_previsao_anterior_fim'
    | 'data_previsao_ini'
    | 'data_previsao_fim'
  >;
  onChange: (updates: Partial<FiltrosPedidosState>) => void;
}

const inputClass =
  'rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-600 focus:border-transparent w-full min-w-0';
const labelClass = 'block text-xs text-slate-500 dark:text-slate-400 mb-1.5';

function BlocoDatas({
  titulo,
  dataIni,
  dataFim,
  onDataIniChange,
  onDataFimChange,
}: {
  titulo: string;
  dataIni: string;
  dataFim: string;
  onDataIniChange: (v: string) => void;
  onDataFimChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2 mb-2.5">
        <CalendarIcon />
        {titulo}
      </p>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <label className={labelClass}>Início</label>
          <input
            type="date"
            value={dataIni}
            onChange={(e) => onDataIniChange(e.target.value)}
            className={inputClass}
            placeholder=""
          />
        </div>
        <span className="text-slate-400 dark:text-slate-500 text-sm pt-5">→</span>
        <div className="flex-1 min-w-0">
          <label className={labelClass}>Fim</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => onDataFimChange(e.target.value)}
            className={inputClass}
            placeholder=""
          />
        </div>
      </div>
    </div>
  );
}

export default function FiltroDatasPopover({ filtros, onChange }: FiltroDatasPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const f = filtros;
  const temAlgumaData =
    f.data_emissao_ini ||
    f.data_emissao_fim ||
    f.data_entrega_ini ||
    f.data_entrega_fim ||
    f.data_previsao_anterior_ini ||
    f.data_previsao_anterior_fim ||
    f.data_previsao_ini ||
    f.data_previsao_fim;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition border ${
          temAlgumaData
            ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
            : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50'
        }`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <CalendarIcon />
        Filtrar por datas
        {temAlgumaData && (
          <span className="w-2 h-2 rounded-full bg-primary-500 shrink-0" aria-hidden />
        )}
      </button>
      {open && (
        <div
          className="filtro-datas-popover absolute top-full left-0 mt-1 z-50 w-[340px] min-w-[320px] rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg p-5"
          role="dialog"
          aria-label="Filtros de data"
        >
          <div className="space-y-5">
            <BlocoDatas
              titulo="Emissão"
              dataIni={f.data_emissao_ini}
              dataFim={f.data_emissao_fim}
              onDataIniChange={(v) => onChange({ data_emissao_ini: v })}
              onDataFimChange={(v) => onChange({ data_emissao_fim: v })}
            />
            <hr className="border-slate-200 dark:border-slate-600" />
            <BlocoDatas
              titulo="Data original"
              dataIni={f.data_entrega_ini}
              dataFim={f.data_entrega_fim}
              onDataIniChange={(v) => onChange({ data_entrega_ini: v })}
              onDataFimChange={(v) => onChange({ data_entrega_fim: v })}
            />
            <hr className="border-slate-200 dark:border-slate-600" />
            <BlocoDatas
              titulo="Previsão anterior"
              dataIni={f.data_previsao_anterior_ini}
              dataFim={f.data_previsao_anterior_fim}
              onDataIniChange={(v) => onChange({ data_previsao_anterior_ini: v })}
              onDataFimChange={(v) => onChange({ data_previsao_anterior_fim: v })}
            />
            <hr className="border-slate-200 dark:border-slate-600" />
            <BlocoDatas
              titulo="Previsão atual"
              dataIni={f.data_previsao_ini}
              dataFim={f.data_previsao_fim}
              onDataIniChange={(v) => onChange({ data_previsao_ini: v })}
              onDataFimChange={(v) => onChange({ data_previsao_fim: v })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
