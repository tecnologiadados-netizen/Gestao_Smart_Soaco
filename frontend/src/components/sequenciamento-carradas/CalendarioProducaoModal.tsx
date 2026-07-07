import { useMemo, useState } from 'react';
import {
  computarCalendarioProducao,
  formatDataCurta,
  formatDataExtenso,
  formatQtdeInt,
  type CarradaBaseline,
  type SimEntry,
} from './simulacaoCarradas';
import { comparePedidoAsc, SUBTOTAL_ROW_CLASS } from './sequenciamentoCarradasUtils';

type Props = {
  linhas: Record<string, unknown>[];
  sim: Map<string, SimEntry>;
  baseline: Map<string, CarradaBaseline>;
  onClose: () => void;
};

type Drill =
  | { nivel: 'pivot' }
  | { nivel: 'tipof'; setor: string; data: string }
  | { nivel: 'pedidos'; setor: string; data: string; tipoF: string };

const TH = 'px-2 py-2 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap';
const TD = 'px-2 py-1.5 text-slate-700 dark:text-slate-200';
const NUM_BTN =
  'tabular-nums text-primary-700 hover:underline dark:text-primary-300 disabled:cursor-default disabled:text-slate-400 disabled:no-underline dark:disabled:text-slate-500';

export default function CalendarioProducaoModal({ linhas, sim, baseline, onClose }: Props) {
  const dados = useMemo(() => computarCalendarioProducao(linhas, sim, baseline), [linhas, sim, baseline]);
  const [drill, setDrill] = useState<Drill>({ nivel: 'pivot' });

  const tipoFRows = useMemo(() => {
    if (drill.nivel !== 'tipof') return [];
    const map = new Map<string, number>();
    for (const d of dados.detalhes) {
      if (d.setor === drill.setor && d.data === drill.data) {
        map.set(d.tipoF, (map.get(d.tipoF) ?? 0) + d.qtde);
      }
    }
    return [...map.entries()]
      .map(([tipoF, qtde]) => ({ tipoF, qtde }))
      .sort((a, b) => b.qtde - a.qtde);
  }, [drill, dados.detalhes]);

  const pedidoRows = useMemo(() => {
    if (drill.nivel !== 'pedidos') return [];
    const map = new Map<string, number>();
    for (const d of dados.detalhes) {
      if (d.setor === drill.setor && d.data === drill.data && d.tipoF === drill.tipoF) {
        map.set(d.pd, (map.get(d.pd) ?? 0) + d.qtde);
      }
    }
    return [...map.entries()]
      .map(([pd, qtde]) => ({ pd, qtde }))
      .sort((a, b) => comparePedidoAsc(a.pd, b.pd));
  }, [drill, dados.detalhes]);

  const tipoFTotal = tipoFRows.reduce((s, r) => s + r.qtde, 0);
  const pedidoTotal = pedidoRows.reduce((s, r) => s + r.qtde, 0);

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-[95vw] flex-col rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendario-producao-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div>
            <h2 id="calendario-producao-titulo" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Calendário de produção
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Horizonte por Setor de produção × Data de produção (simulação). Clique em um número para o
              drill-down por TipoF e, em seguida, pelos pedidos.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Fechar
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-slate-200 px-4 py-2 text-xs dark:border-slate-600">
          <button
            type="button"
            onClick={() => setDrill({ nivel: 'pivot' })}
            className={`rounded px-2 py-1 font-medium ${drill.nivel === 'pivot' ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200' : 'text-primary-700 hover:bg-slate-100 dark:text-primary-300 dark:hover:bg-slate-700'}`}
          >
            Calendário
          </button>
          {drill.nivel !== 'pivot' && (
            <>
              <span className="text-slate-400">/</span>
              <button
                type="button"
                onClick={() => setDrill({ nivel: 'tipof', setor: drill.setor, data: drill.data })}
                className={`rounded px-2 py-1 font-medium ${drill.nivel === 'tipof' ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200' : 'text-primary-700 hover:bg-slate-100 dark:text-primary-300 dark:hover:bg-slate-700'}`}
              >
                {drill.setor} · {formatDataCurta(drill.data)}
              </button>
            </>
          )}
          {drill.nivel === 'pedidos' && (
            <>
              <span className="text-slate-400">/</span>
              <span className="rounded bg-primary-100 px-2 py-1 font-medium text-primary-800 dark:bg-primary-900/40 dark:text-primary-200">
                TipoF: {drill.tipoF}
              </span>
            </>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {drill.nivel === 'pivot' && (
            dados.datas.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nenhuma carrada com Data de produção preenchida na simulação. Informe a Data de produção nas
                linhas para montar o calendário.
              </p>
            ) : (
              <table className="border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
                    <th className={`${TH} sticky left-0 z-10 bg-slate-50 text-left dark:bg-slate-900/50`}>
                      Setor de produção
                    </th>
                    {dados.datas.map((data) => (
                      <th key={data} className={`${TH} text-right`} title={formatDataExtenso(data)}>
                        {formatDataExtenso(data)}
                      </th>
                    ))}
                    <th className={`${TH} text-right`}>Total Geral</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.setores.map((setor) => (
                    <tr key={setor} className="border-b border-slate-100 dark:border-slate-700">
                      <td className={`${TD} sticky left-0 z-10 bg-white font-medium dark:bg-slate-800`}>{setor}</td>
                      {dados.datas.map((data) => {
                        const v = dados.valores.get(setor)?.get(data) ?? 0;
                        return (
                          <td key={data} className={`${TD} text-right`}>
                            {v > 0 ? (
                              <button
                                type="button"
                                className={NUM_BTN}
                                onClick={() => setDrill({ nivel: 'tipof', setor, data })}
                                title="Ver detalhamento por TipoF"
                              >
                                {formatQtdeInt(v)}
                              </button>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className={`${TD} text-right font-semibold tabular-nums`}>
                        {formatQtdeInt(dados.totalPorSetor.get(setor) ?? 0)}
                      </td>
                    </tr>
                  ))}
                  <tr className={SUBTOTAL_ROW_CLASS}>
                    <td className={`${TD} sticky left-0 z-10 bg-slate-100 dark:bg-slate-700/60`}>Total Geral</td>
                    {dados.datas.map((data) => (
                      <td key={data} className={`${TD} text-right tabular-nums`}>
                        {formatQtdeInt(dados.totalPorData.get(data) ?? 0)}
                      </td>
                    ))}
                    <td className={`${TD} text-right tabular-nums`}>{formatQtdeInt(dados.totalGeral)}</td>
                  </tr>
                </tbody>
              </table>
            )
          )}

          {drill.nivel === 'tipof' && (
            <table className="w-full max-w-2xl border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
                  <th className={`${TH} text-left`}>TipoF</th>
                  <th className={`${TH} text-right`}>Qtde Pendente Real</th>
                </tr>
              </thead>
              <tbody>
                {tipoFRows.map((r) => (
                  <tr key={r.tipoF} className="border-b border-slate-100 dark:border-slate-700">
                    <td className={TD}>{r.tipoF}</td>
                    <td className={`${TD} text-right`}>
                      <button
                        type="button"
                        className={NUM_BTN}
                        onClick={() =>
                          setDrill({ nivel: 'pedidos', setor: drill.setor, data: drill.data, tipoF: r.tipoF })
                        }
                        title="Ver pedidos"
                      >
                        {formatQtdeInt(r.qtde)}
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className={SUBTOTAL_ROW_CLASS}>
                  <td className={TD}>Total</td>
                  <td className={`${TD} text-right tabular-nums`}>{formatQtdeInt(tipoFTotal)}</td>
                </tr>
              </tbody>
            </table>
          )}

          {drill.nivel === 'pedidos' && (
            <table className="w-full max-w-2xl border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
                  <th className={`${TH} text-left`}>Pedido</th>
                  <th className={`${TH} text-right`}>Qtde Pendente Real</th>
                </tr>
              </thead>
              <tbody>
                {pedidoRows.map((r) => (
                  <tr key={r.pd} className="border-b border-slate-100 dark:border-slate-700">
                    <td className={TD}>{r.pd}</td>
                    <td className={`${TD} text-right tabular-nums`}>{formatQtdeInt(r.qtde)}</td>
                  </tr>
                ))}
                <tr className={SUBTOTAL_ROW_CLASS}>
                  <td className={TD}>Total</td>
                  <td className={`${TD} text-right tabular-nums`}>{formatQtdeInt(pedidoTotal)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
