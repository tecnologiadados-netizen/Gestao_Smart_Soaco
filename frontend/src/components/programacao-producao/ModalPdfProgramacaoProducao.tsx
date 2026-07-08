import { useState } from 'react';
import type { TipoImpressaoProgramacaoProducao } from '../../utils/programacaoProducaoRoteiros';

const BTN_SECONDARY =
  'px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600';

const BTN_PRIMARY =
  'px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition disabled:opacity-50';

type ModalPdfProgramacaoProducaoProps = {
  codigoProgramacao: string;
  gerando: boolean;
  erro?: string | null;
  onClose: () => void;
  onConfirm: (tipo: TipoImpressaoProgramacaoProducao) => void;
};

const OPCOES: { value: TipoImpressaoProgramacaoProducao; label: string; descricao: string }[] = [
  {
    value: 'manual',
    label: 'Manual',
    descricao: 'Marafon, Guilhotina, Prensa, Dobradeira e Centro de dobra',
  },
  {
    value: 'perfiladeira',
    label: 'Perfiladeira',
    descricao: 'Perfiladeira 1000',
  },
];

export default function ModalPdfProgramacaoProducao({
  codigoProgramacao,
  gerando,
  erro,
  onClose,
  onConfirm,
}: ModalPdfProgramacaoProducaoProps) {
  const [tipo, setTipo] = useState<TipoImpressaoProgramacaoProducao>('manual');

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={() => !gerando && onClose()}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-600 dark:bg-slate-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pp-pdf-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="pp-pdf-title" className="text-base font-semibold text-slate-800 dark:text-slate-100">
          Gerar PDF
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Programação <span className="font-medium text-slate-800 dark:text-slate-200">{codigoProgramacao}</span>
        </p>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Selecione qual impressão deseja gerar. O PDF incluirá apenas os roteiros do tipo escolhido.
        </p>

        <fieldset className="mt-4 space-y-2" disabled={gerando}>
          <legend className="sr-only">Tipo de impressão</legend>
          {OPCOES.map((op) => (
            <label
              key={op.value}
              className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 transition ${
                tipo === op.value
                  ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-950/30'
                  : 'border-slate-200 hover:border-slate-300 dark:border-slate-600 dark:hover:border-slate-500'
              }`}
            >
              <input
                type="radio"
                name="tipo-pdf-pp"
                value={op.value}
                checked={tipo === op.value}
                onChange={() => setTipo(op.value)}
                className="mt-0.5 shrink-0"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{op.label}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{op.descricao}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {erro && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-300" role="alert">
            {erro}
          </p>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className={BTN_SECONDARY} disabled={gerando} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={gerando}
            onClick={() => onConfirm(tipo)}
          >
            {gerando ? 'Gerando…' : 'Gerar PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}
