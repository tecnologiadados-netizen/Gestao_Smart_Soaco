import { useMemo } from 'react';
import ResizableModalShell from '../ResizableModalShell';
import type { LinhaProgramacaoProducao } from './types';
import { mensagemInconsistenciaLinha } from '../../utils/programacaoProducaoValidacoes';

const BTN_SECONDARY =
  'px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600';

const BTN_PRIMARY =
  'px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition disabled:opacity-50';

type Props = {
  linhas: LinhaProgramacaoProducao[];
  onVoltar: () => void;
  onProcessarMesmoAssim: () => void;
  processando?: boolean;
};

export default function ConfirmProcessarInconsistenteModal({
  linhas,
  onVoltar,
  onProcessarMesmoAssim,
  processando = false,
}: Props) {
  const alturaModal = useMemo(() => {
    const base = 200;
    const porLinha = 22;
    const max = Math.min(window.innerHeight * 0.85, 560);
    return Math.min(max, Math.max(240, base + linhas.length * porLinha));
  }, [linhas.length]);

  return (
    <ResizableModalShell
      onClose={onVoltar}
      defaultWidth={500}
      defaultHeight={alturaModal}
      minHeight={220}
      maxHeight={560}
      ariaLabelledBy="pp-processar-incons-title"
    >
      <div className="flex flex-col gap-3 p-4">
        <div>
          <h2
            id="pp-processar-incons-title"
            className="text-base font-semibold text-slate-800 dark:text-slate-100"
          >
            Inconsistências na programação
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Há componentes com <strong>sequência</strong> e <strong>qtde a produzir</strong>{' '}
            desalinhadas (apenas uma das duas foi informada). Deseja voltar para corrigir ou
            processar mesmo assim?
          </p>
        </div>
        <ul className="max-h-[min(50vh,280px)] overflow-y-auto text-sm text-slate-700 dark:text-slate-200 space-y-1 list-disc pl-5 pr-1">
          {linhas.map((l) => (
            <li key={l.idComponente}>{mensagemInconsistenciaLinha(l)}</li>
          ))}
        </ul>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end pt-1">
          <button type="button" className={BTN_SECONDARY} disabled={processando} onClick={onVoltar}>
            Voltar
          </button>
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={processando}
            onClick={onProcessarMesmoAssim}
          >
            Processar mesmo assim
          </button>
        </div>
      </div>
    </ResizableModalShell>
  );
}
