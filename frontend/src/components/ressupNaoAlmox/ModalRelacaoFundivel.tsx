import { useState } from 'react';
import ResizableModalShell from '../ResizableModalShell';

const BTN_SECONDARY =
  'px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600';
const BTN_PRIMARY =
  'px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition';
const INPUT =
  'w-full rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm dark:bg-slate-900 dark:text-slate-100';

export default function ModalRelacaoFundivel({
  codSemPintura,
  codComPinturaAtual,
  readOnly,
  onClose,
  onSave,
}: {
  codSemPintura: string;
  codComPinturaAtual: string;
  readOnly: boolean;
  onClose: () => void;
  onSave: (codComPintura: string | null) => void;
}) {
  const [com, setCom] = useState(codComPinturaAtual);
  const [erro, setErro] = useState<string | null>(null);

  const handleApply = () => {
    const sem = codSemPintura.trim();
    const pint = com.trim();
    if (pint && pint === sem) {
      setErro('O código com pintura deve ser diferente do sem pintura.');
      return;
    }
    setErro(null);
    onSave(pint || null);
    onClose();
  };

  return (
    <ResizableModalShell
      title="Relação fundível"
      subtitle={`Sem pintura: ${codSemPintura}`}
      onClose={onClose}
      defaultWidth={440}
      defaultHeight={300}
      footer={
        <>
          <button type="button" className={BTN_SECONDARY} onClick={onClose}>
            {readOnly ? 'Fechar' : 'Cancelar'}
          </button>
          {!readOnly && (
            <button type="button" className={BTN_PRIMARY} onClick={handleApply}>
              Aplicar
            </button>
          )}
        </>
      }
    >
      <label className="block mb-3">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Código sem pintura</span>
        <input type="text" className={INPUT} value={codSemPintura} readOnly disabled />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Código com pintura</span>
        <input
          type="text"
          className={INPUT}
          disabled={readOnly}
          value={com}
          onChange={(e) => setCom(e.target.value)}
          placeholder="Ex.: MP 1234 P"
        />
      </label>
      {erro ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{erro}</p> : null}
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        A relação é gravada no catálogo global para análises futuras. O par desta linha fica congelado no snapshot
        atual.
      </p>
    </ResizableModalShell>
  );
}
