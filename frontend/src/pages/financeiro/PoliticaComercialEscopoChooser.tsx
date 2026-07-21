import { createPortal } from 'react-dom';
import type { PoliticaComercialEscopo } from '../../api/painelComercial';

export type PoliticaComercialEscopoChooserProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (escopo: PoliticaComercialEscopo) => void;
};

function IconIndustria() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M2 20h20" />
      <path d="M5 20V10l5 3V10l5 3V6l4 2v12" />
      <path d="M9 20v-4h2v4" />
    </svg>
  );
}

function IconLojas() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M3 9l1-5h16l1 5" />
      <path d="M3 9v11h18V9" />
      <path d="M3 9h18" />
      <path d="M10 20v-6h4v6" />
      <path d="M7 5v4" />
      <path d="M12 5v4" />
      <path d="M17 5v4" />
    </svg>
  );
}

export default function PoliticaComercialEscopoChooser({ open, onClose, onSelect }: PoliticaComercialEscopoChooserProps) {
  if (!open) return null;

  const card =
    'group flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-slate-200 bg-white px-8 py-10 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-500 hover:shadow-lg dark:border-slate-600 dark:bg-slate-800 dark:hover:border-primary-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500';

  const body = (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="politica-escopo-titulo"
        className="relative z-[81] w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-600 dark:bg-slate-800"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="politica-escopo-titulo" className="text-lg font-bold text-slate-900 dark:text-slate-50">
              Política comercial
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Escolha o escopo para cadastrar ou editar a política usada na conformidade.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-100"
            aria-label="Fechar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button type="button" className={card} onClick={() => onSelect('industria')}>
            <span className="text-primary-600 dark:text-primary-400 transition group-hover:scale-105">
              <IconIndustria />
            </span>
            <span className="text-base font-bold text-slate-900 dark:text-slate-50">Indústria</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Pedidos Só Aço</span>
          </button>
          <button type="button" className={card} onClick={() => onSelect('lojas')}>
            <span className="text-primary-600 dark:text-primary-400 transition group-hover:scale-105">
              <IconLojas />
            </span>
            <span className="text-base font-bold text-slate-900 dark:text-slate-50">Lojas</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Pedidos Só Móveis</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
