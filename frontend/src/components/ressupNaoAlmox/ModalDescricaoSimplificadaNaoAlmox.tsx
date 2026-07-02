import { useState } from 'react';
import ResizableModalShell from '../ResizableModalShell';

const BTN_SECONDARY =
  'px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600';
const BTN_PRIMARY =
  'px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition';
const INPUT =
  'w-full rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm dark:bg-slate-900 dark:text-slate-100';

export default function ModalDescricaoSimplificadaNaoAlmox({
  codigo,
  descricao,
  valorAtual,
  readOnly,
  onClose,
  onSave,
}: {
  codigo: string;
  descricao: string;
  valorAtual: string;
  readOnly: boolean;
  onClose: () => void;
  onSave: (texto: string) => void;
}) {
  const [texto, setTexto] = useState(valorAtual);

  return (
    <ResizableModalShell
      title="Desc Simpl"
      subtitle={[codigo, descricao].filter(Boolean).join(' — ')}
      onClose={onClose}
      defaultWidth={480}
      defaultHeight={280}
      footer={
        <>
          <button type="button" className={BTN_SECONDARY} onClick={onClose}>
            {readOnly ? 'Fechar' : 'Cancelar'}
          </button>
          {!readOnly && (
            <button type="button" className={BTN_PRIMARY} onClick={() => onSave(texto.trim())}>
              Aplicar
            </button>
          )}
        </>
      }
    >
      <label className="block">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Descrição simplificada</span>
        <input
          type="text"
          className={INPUT}
          disabled={readOnly}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={200}
        />
      </label>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Alterações são salvas no catálogo global e aplicadas às análises futuras. Esta análise mantém o valor gravado no
        snapshot.
      </p>
    </ResizableModalShell>
  );
}
