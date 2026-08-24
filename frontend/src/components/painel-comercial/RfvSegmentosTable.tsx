import type { RfvSegmentoAgg } from '../../api/rfvClientes';
import { formatMoeda, formatNumero } from './painelComercialUtils';
import { segmentoUi } from './rfvSegmentos';
import { isSegmentoSelecionado, type RfvSelecao } from './rfvSelecao';

export default function RfvSegmentosTable({
  segmentos,
  selecao,
  loading,
  onSelectSegmento,
}: {
  segmentos: RfvSegmentoAgg[];
  selecao: RfvSelecao;
  loading?: boolean;
  onSelectSegmento: (segmentoId: string) => void;
}) {
  if (loading) {
    return (
      <div className="card-panel min-h-[320px] animate-pulse p-4">
        <div className="h-full rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    );
  }

  const visiveis = segmentos.filter((s) => s.clientes > 0);
  const maxValor = Math.max(...visiveis.map((s) => s.valor), 1);

  return (
    <div className="card-panel flex h-full min-h-[320px] w-full min-w-0 flex-1 flex-col p-4 lg:p-5">
      <h3 className="mb-3 text-sm font-semibold text-soaco-navy dark:text-soaco-white">Segmentação</h3>
      <div className="min-h-0 w-full flex-1 overflow-y-auto">
        <table className="w-full table-fixed text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <th className="w-[48%] pb-2 pr-3">Segmentação</th>
              <th className="w-[28%] pb-2 pr-3 text-right">Fat. período</th>
              <th className="w-[24%] pb-2 text-right">Qtd</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((s) => {
              const ui = segmentoUi(s.id);
              const ativo = isSegmentoSelecionado(selecao, s.id);
              const pctBar = (s.valor / maxValor) * 100;
              return (
                <tr
                  key={s.id}
                  className={`cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60 ${ativo ? 'bg-amber-50/80 dark:bg-amber-950/30' : ''}`}
                  onClick={() => onSelectSegmento(s.id)}
                >
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: ui?.cor ?? '#64748B' }} />
                      <span className="font-medium text-slate-800 dark:text-slate-100">{s.label}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-primary-500/70" style={{ width: `${Math.max(pctBar, s.valor > 0 ? 2 : 0)}%` }} />
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-right text-sm font-medium tabular-nums text-slate-700 dark:text-slate-200">
                    {formatMoeda(s.valor, true)}
                  </td>
                  <td className="py-2.5 text-right text-sm tabular-nums text-slate-600 dark:text-slate-300">
                    {formatNumero(s.clientes)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!visiveis.length && <p className="py-8 text-center text-slate-500">Sem segmentos no período.</p>}
      </div>
      {!selecao && visiveis.length > 0 && (
        <p className="mt-3 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-[11px] text-slate-600 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
          Selecione a segmentação que deseja detalhar
        </p>
      )}
    </div>
  );
}
