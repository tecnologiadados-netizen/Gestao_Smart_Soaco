import { useEffect, useRef, useState } from 'react';
import { CORES_PADRAO_EXCEL, CORES_TEMA_EXCEL } from './coresObservacaoDiario';

export function DiarioPaletaCorExcel({
  disabled,
  onEscolher,
}: {
  disabled?: boolean;
  onEscolher: (cor: string | null) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const caixaRef = useRef<HTMLDivElement>(null);
  const maisCoresRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (evento: MouseEvent) => {
      if (!caixaRef.current?.contains(evento.target as Node)) setAberto(false);
    };
    window.addEventListener('mousedown', fechar);
    return () => window.removeEventListener('mousedown', fechar);
  }, [aberto]);

  const escolher = (cor: string | null) => {
    setAberto(false);
    onEscolher(cor);
  };

  return (
    <div className="relative" ref={caixaRef}>
      <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Aplicar cor nos selecionados
      </span>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        onClick={() => setAberto((v) => !v)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
      >
        <span className="h-3.5 w-3.5 rounded-sm border border-slate-300 bg-gradient-to-br from-red-500 via-yellow-300 to-blue-600" aria-hidden />
        Cores
      </button>
      {aberto ? (
        <div
          role="dialog"
          aria-label="Paleta de cores"
          className="absolute left-0 z-40 mt-1 w-[232px] rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-600 dark:bg-slate-800"
        >
          <p className="px-1 pb-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200">Cores do tema</p>
          <div className="grid grid-cols-10 gap-0.5">
            {CORES_TEMA_EXCEL.flat().map((cor, indice) => (
              <button
                key={`tema-${indice}`}
                type="button"
                title={cor}
                aria-label={cor}
                onClick={() => escolher(cor)}
                className="h-4 w-4 rounded-sm border border-black/10"
                style={{ backgroundColor: cor }}
              />
            ))}
          </div>
          <p className="px-1 pb-1 pt-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200">Cores padrão</p>
          <div className="grid grid-cols-10 gap-0.5">
            {CORES_PADRAO_EXCEL.map((cor) => (
              <button
                key={cor}
                type="button"
                title={cor}
                aria-label={cor}
                onClick={() => escolher(cor)}
                className="h-4 w-4 rounded-sm border border-black/10"
                style={{ backgroundColor: cor }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => escolher(null)}
            className="mt-2 flex w-full items-center gap-2 rounded px-1 py-1 text-left text-[11px] text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <span className="h-3.5 w-3.5 rounded-sm border border-slate-300 bg-white" aria-hidden />
            Sem preenchimento
          </button>
          <button
            type="button"
            onClick={() => maisCoresRef.current?.click()}
            className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-[11px] text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Mais cores…
          </button>
        </div>
      ) : null}
      <input
        ref={maisCoresRef}
        type="color"
        className="sr-only"
        tabIndex={-1}
        aria-label="Mais cores"
        onChange={(e) => escolher(e.target.value)}
      />
    </div>
  );
}
