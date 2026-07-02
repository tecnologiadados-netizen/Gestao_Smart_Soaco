import type { ProgramacaoProducaoStatus } from './types';

const LABEL: Record<ProgramacaoProducaoStatus, string> = {
  em_processamento: 'Em processamento',
  processado: 'Processada',
  concluido: 'Concluída',
};

export default function ProgramacaoProducaoStatusBadge({
  status,
}: {
  status: ProgramacaoProducaoStatus;
}) {
  if (status === 'concluido') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
        ✓ {LABEL.concluido}
      </span>
    );
  }
  if (status === 'processado') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-[11px] font-medium text-blue-800 dark:bg-primary-900/40 dark:text-primary-300">
        ◎ {LABEL.processado}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
      ● {LABEL.em_processamento}
    </span>
  );
}
