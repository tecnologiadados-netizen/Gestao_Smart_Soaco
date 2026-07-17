import type { DreDashboardPayload } from '../../../api/financeiro';
import { formatarPct, formatarReais } from './dashboardFormat';

type Props = { analise: DreDashboardPayload['analise'] };

export default function DashboardAnaliseMetas({ analise }: Props) {
  return (
    <div className="card-panel p-4">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">
        Ponto de equilíbrio e faturamento-meta
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{analise.premissas.descricao}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <p className="text-xs text-slate-500 uppercase font-medium">Ponto de equilíbrio</p>
          <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {analise.pontoEquilibrio == null
              ? '—'
              : formatarReais(analise.pontoEquilibrio)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <p className="text-xs text-slate-500 uppercase font-medium">
            Fat. p/ EBITDA {formatarPct(analise.metaEbitdaPct)}
          </p>
          <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {analise.faturamentoMetaEbitda == null
              ? 'Inviável com premissas atuais'
              : formatarReais(analise.faturamentoMetaEbitda)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <p className="text-xs text-slate-500 uppercase font-medium">
            Fat. p/ Lucro {formatarPct(analise.metaLucroPct)}
          </p>
          <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {analise.faturamentoMetaLucro == null
              ? 'Inviável com premissas atuais'
              : formatarReais(analise.faturamentoMetaLucro)}
          </p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-600 dark:text-slate-300">
        <div>
          <dt className="text-slate-400">CPV %</dt>
          <dd className="font-medium tabular-nums">{formatarPct(analise.premissas.cpvPct)}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Custos fixos</dt>
          <dd className="font-medium tabular-nums">{formatarReais(analise.premissas.custosFixos)}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Margem contrib.</dt>
          <dd className="font-medium tabular-nums">{formatarPct(analise.premissas.margemContribuicaoPct)}</dd>
        </div>
      </dl>
    </div>
  );
}
