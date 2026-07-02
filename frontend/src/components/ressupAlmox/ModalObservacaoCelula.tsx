import { useEffect, useState } from 'react';
import ModalAbaBackdrop from '../ModalAbaBackdrop';

export type ModalObservacaoCelulaProps = {
  open: boolean;
  tituloColuna: string;
  codigo: string;
  descricao: string;
  valorInicial: string;
  somenteLeitura: boolean;
  onClose: () => void;
  onSalvar: (texto: string) => void;
};

export default function ModalObservacaoCelula({
  open,
  tituloColuna,
  codigo,
  descricao,
  valorInicial,
  somenteLeitura,
  onClose,
  onSalvar,
}: ModalObservacaoCelulaProps) {
  const [texto, setTexto] = useState(valorInicial);

  useEffect(() => {
    if (open) setTexto(valorInicial);
  }, [open, valorInicial]);

  if (!open) return null;

  const handleSalvar = () => {
    onSalvar(texto.trim());
    onClose();
  };

  return (
    <ModalAbaBackdrop onClose={onClose}>
      <div
        className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
        role="dialog"
        aria-modal
        aria-labelledby="ressup-obs-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 id="ressup-obs-titulo" className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Observação — {tituloColuna}
              </h3>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                <span className="font-medium">{codigo}</span>
                {descricao ? ` · ${descricao}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
        </div>
        <div className="px-4 py-3">
          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
            {somenteLeitura ? 'Observação registrada' : 'Texto da observação'}
          </label>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            readOnly={somenteLeitura}
            rows={5}
            placeholder={somenteLeitura ? '—' : 'Digite uma observação para esta célula…'}
            className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-80 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-600">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {somenteLeitura ? 'Fechar' : 'Cancelar'}
          </button>
          {!somenteLeitura && (
            <button
              type="button"
              onClick={handleSalvar}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
            >
              Salvar
            </button>
          )}
        </div>
      </div>
    </ModalAbaBackdrop>
  );
}
