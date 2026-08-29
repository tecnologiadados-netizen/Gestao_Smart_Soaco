import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { DfcContribuicaoLinha, DfcEndividamentoBancarioResponse, DfcKpis } from '../../../api/financeiro';
import type { DfcPrioridade } from '../../../api/dfcPrioridade';
import DfcResumoGrade from './DfcResumoGrade.tsx';

const nf = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function fmtBrl(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return nf.format(v);
}

function fmtDataBr(ymd: string | null | undefined): string {
  if (!ymd) return '—';
  const [y, mo, d] = ymd.slice(0, 10).split('-');
  if (!y || !mo || !d) return ymd;
  return `${d}/${mo}/${y}`;
}

export type DfcDashboardModalProps = {
  aberto: boolean;
  onClose: () => void;
  dataInicio: string;
  dataFim: string;
  granularidade: 'dia' | 'mes';
  periodos: string[];
  kpis: DfcKpis;
  endividamento: DfcEndividamentoBancarioResponse;
  valoresPorConta: Record<number, Record<string, number>>;
  projecaoReceitasPorPeriodo?: Record<string, number>;
  saldosIniciaisPorPeriodo: Record<string, number>;
  saldosFinaisPorPeriodo: Record<string, number>;
  contribuicoesFiltradas: DfcContribuicaoLinha[];
  contribuicoesSemPriorizacao: DfcContribuicaoLinha[];
  prioridadesContasMap: Record<string, DfcPrioridade>;
  prioridadesLancsMap: Record<string, DfcPrioridade>;
  idEmpresas: number[];
  contasBancarias: string[];
  onPrioridadeLancAtualizada?: (
    idEmpresa: number,
    tipoRef: 'A' | 'L' | 'S',
    idRef: number,
    prioridade: DfcPrioridade | null,
  ) => void;
  filtrosResumo: {
    empresas: string;
    banco: string;
    cenarios: string;
    plano: string;
  };
};

const KPI_MINI = [
  { key: 'recebimentos' as const, label: 'Recebimentos', cor: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'pagamentos' as const, label: 'Pagamentos', cor: 'text-rose-600 dark:text-rose-400' },
  { key: 'vencidosPagar' as const, label: 'Vencido a pagar', cor: 'text-orange-600 dark:text-orange-400' },
  { key: 'aVencerPagar' as const, label: 'A vencer a pagar', cor: 'text-amber-600 dark:text-amber-400' },
];

export default function DfcDashboardModal({
  aberto,
  onClose,
  dataInicio,
  dataFim,
  granularidade,
  periodos,
  kpis,
  endividamento,
  valoresPorConta,
  projecaoReceitasPorPeriodo,
  saldosIniciaisPorPeriodo,
  saldosFinaisPorPeriodo,
  contribuicoesFiltradas,
  contribuicoesSemPriorizacao,
  prioridadesContasMap,
  prioridadesLancsMap,
  idEmpresas,
  contasBancarias,
  onPrioridadeLancAtualizada,
  filtrosResumo,
}: DfcDashboardModalProps) {
  const saldoFinalPeriodo = useMemo(() => {
    if (periodos.length === 0) return null;
    const ultimo = periodos[periodos.length - 1];
    return saldosFinaisPorPeriodo[ultimo] ?? null;
  }, [periodos, saldosFinaisPorPeriodo]);

  if (!aberto) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/70 dark:bg-slate-950/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex w-full max-w-[min(96vw,1280px)] max-h-[min(92vh,900px)] flex-col rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dfc-dashboard-titulo"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-600 px-5 py-4 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <svg className="h-5 w-5 shrink-0 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            </svg>
            <div className="min-w-0">
              <h2 id="dfc-dashboard-titulo" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Dashboard DFC
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {fmtDataBr(dataInicio)} a {fmtDataBr(dataFim)} · visão {granularidade === 'dia' ? 'diária' : 'mensal'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
            aria-label="Fechar dashboard"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {KPI_MINI.map(({ key, label, cor }) => (
              <div
                key={key}
                className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 px-3 py-2.5"
              >
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
                <p className={`text-base font-bold tabular-nums mt-1 ${cor}`}>{fmtBrl(kpis?.[key])}</p>
              </div>
            ))}
            <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 px-3 py-2.5">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Endividamento</p>
              <p className="text-base font-bold tabular-nums mt-1 text-indigo-600 dark:text-indigo-400">
                {fmtBrl(endividamento?.total)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 px-3 py-2.5">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Saldo final (último período)</p>
              <p
                className={`text-base font-bold tabular-nums mt-1 ${
                  saldoFinalPeriodo != null && saldoFinalPeriodo < 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-sky-600 dark:text-sky-400'
                }`}
              >
                {fmtBrl(saldoFinalPeriodo)}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/30 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              Filtros aplicados
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
              <p><span className="font-medium">Empresa:</span> {filtrosResumo.empresas || 'Todas'}</p>
              <p><span className="font-medium">Conta bancária:</span> {filtrosResumo.banco || 'Todas'}</p>
              <p><span className="font-medium">Cenários:</span> {filtrosResumo.cenarios || 'Todos'}</p>
              <p><span className="font-medium">Plano de contas:</span> {filtrosResumo.plano || 'Todas'}</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              Resumo — entradas e saídas agrupadas
            </h3>
            <DfcResumoGrade
              periodos={periodos}
              granularidade={granularidade}
              dataInicio={dataInicio}
              dataFim={dataFim}
              idEmpresas={idEmpresas}
              contasBancarias={contasBancarias}
              valoresPorConta={valoresPorConta}
              projecaoReceitasPorPeriodo={projecaoReceitasPorPeriodo}
              saldosIniciaisPorPeriodo={saldosIniciaisPorPeriodo}
              saldosFinaisPorPeriodo={saldosFinaisPorPeriodo}
              contribuicoesFiltradas={contribuicoesFiltradas}
              contribuicoesSemPriorizacao={contribuicoesSemPriorizacao}
              prioridadesContasMap={prioridadesContasMap}
              prioridadesLancsMap={prioridadesLancsMap}
              onPrioridadeLancAtualizada={onPrioridadeLancAtualizada}
              compacto
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
