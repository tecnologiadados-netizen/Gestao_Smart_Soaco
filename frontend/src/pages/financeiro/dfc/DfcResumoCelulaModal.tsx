import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { X } from 'lucide-react';
import {
  fetchDfcAgendamentosDetalhe,
  type DfcAgendamentoDetalheLinha,
} from '../../../api/financeiro';
import {
  DFC_PRIORIDADES,
  DFC_PRIORIDADE_CHIP,
  DFC_PRIORIDADE_LABEL_CURTO,
  removerPrioridadeLancamento,
  salvarPrioridadeLancamento,
  type DfcPrioridade,
} from '../../../api/dfcPrioridade';
import { labelEmpresaDfc } from './dfcEmpresas';
import {
  agregarPorEmpresa,
  agregarPorFornecedor,
  agregarPorPlano,
  linhaNoPeriodosResumo,
  prioridadeEfetivaDetalhe,
  type ResumoAggItem,
} from './dfcResumoDetalhe';
import { listarIdsContasSaidasDfc } from './dfcResumoAgregacao';
import { PrioridadeSomenteLeitura } from './dfcDetalheTabelaUtils';
import { useGradeFiltrosExcel } from '../../../hooks/useGradeFiltrosExcel';
import {
  criarGetCellTextDfcDetalhe,
  criarValueForSortDfcDetalhe,
  montarColunasGradeDfcDetalhe,
  rotuloColunaGradeDfc,
} from './dfcDetalheGradeExcel';
import { DfcDetalheCabecalhoTh, DfcDetalheGradeFiltroPortal } from './DfcDetalheCabecalhoGrade';
import type { LinhaResumoDfc } from './dfcResumoAgregacao';

const nfBrl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const nfCompact = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const CHART_COLORS = ['#1E22AA', '#0d9488', '#7c3aed', '#e11d48', '#0891b2', '#db2777', '#65a30d', '#ea580c'];

function fmtDataBr(ymd: string | null | undefined): string {
  if (!ymd) return '—';
  const p = ymd.slice(0, 10);
  const [y, m, d] = p.split('-');
  if (y && m && d) return `${d}/${m}/${y}`;
  return ymd;
}

function deduplicarDetalhe(linhas: DfcAgendamentoDetalheLinha[]): DfcAgendamentoDetalheLinha[] {
  const byId = new Map<number, DfcAgendamentoDetalheLinha>();
  const semId: DfcAgendamentoDetalheLinha[] = [];
  for (const d of linhas) {
    if (d.id > 0) {
      if (!byId.has(d.id)) byId.set(d.id, d);
    } else {
      semId.push(d);
    }
  }
  return byId.size > 0 ? [...byId.values(), ...semId] : linhas;
}

export type DfcResumoCelulaContexto = {
  linha: Extract<LinhaResumoDfc, 'aPagar' | 'semPriorizacao'>;
  periodos: string[];
  rotuloPeriodo: string;
  valor: number;
  agrupado: boolean;
};

export type DfcResumoCelulaModalProps = {
  contexto: DfcResumoCelulaContexto;
  onClose: () => void;
  dataInicio: string;
  dataFim: string;
  granularidade: 'dia' | 'mes';
  idEmpresas: number[];
  contasBancarias: string[];
  prioridadesContasMap: Record<string, DfcPrioridade>;
  prioridadesLancsMap: Record<string, DfcPrioridade>;
  onPrioridadeLancAtualizada?: (
    idEmpresa: number,
    tipoRef: 'A' | 'L' | 'S',
    idRef: number,
    prioridade: DfcPrioridade | null,
  ) => void;
};

function MiniBarChart({ titulo, dados }: { titulo: string; dados: ResumoAggItem[] }) {
  const chartData = dados.map((d) => ({
    name: d.label.length > 28 ? `${d.label.slice(0, 26)}…` : d.label,
    fullName: d.label,
    valor: d.valor,
  }));

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/60 p-3 min-h-[220px]">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
        {titulo}
      </h4>
      {chartData.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">Sem dados neste recorte.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 28)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-slate-200 dark:stroke-slate-600" />
            <XAxis
              type="number"
              tickFormatter={(v) => nfCompact.format(v)}
              tick={{ fontSize: 10 }}
              className="text-slate-500"
            />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} className="text-slate-600" />
            <Tooltip
              formatter={(v: number) => nfBrl.format(v)}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
              contentStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function DfcResumoCelulaModal({
  contexto,
  onClose,
  dataInicio,
  dataFim,
  granularidade,
  idEmpresas,
  contasBancarias,
  prioridadesContasMap,
  prioridadesLancsMap,
  onPrioridadeLancAtualizada,
}: DfcResumoCelulaModalProps) {
  const [aba, setAba] = useState<'graficos' | 'lancamentos'>('graficos');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | undefined>();
  const [linhasBrutas, setLinhasBrutas] = useState<DfcAgendamentoDetalheLinha[]>([]);
  const [truncado, setTruncado] = useState(false);
  const [salvandoChave, setSalvandoChave] = useState<string | null>(null);
  const [mapsLocais, setMapsLocais] = useState({
    contas: prioridadesContasMap,
    lancs: prioridadesLancsMap,
  });
  const abortRef = useRef<AbortController | null>(null);
  const loadId = useRef(0);

  const idsSaidas = useMemo(() => listarIdsContasSaidasDfc(), []);
  const idsKey = idsSaidas.join(',');
  const empresasKey = idEmpresas.join(',');
  const contasKey = contasBancarias.join(',');

  useEffect(() => {
    setMapsLocais({ contas: prioridadesContasMap, lancs: prioridadesLancsMap });
  }, [prioridadesContasMap, prioridadesLancsMap]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    loadId.current += 1;
    const myId = loadId.current;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setErro(undefined);
    setLinhasBrutas([]);

    void fetchDfcAgendamentosDetalhe({
      dataInicio,
      dataFim,
      granularidade,
      ids: idsSaidas,
      idEmpresas,
      contasBancarias,
      signal: ac.signal,
    })
      .then((r) => {
        if (myId !== loadId.current) return;
        setLoading(false);
        setLinhasBrutas(deduplicarDetalhe(r.detalhes));
        setTruncado(Boolean(r.truncado));
        setErro(r.erro);
      })
      .catch((e: unknown) => {
        if (myId !== loadId.current) return;
        if (e instanceof Error && e.name === 'AbortError') return;
        setLoading(false);
        setErro(e instanceof Error ? e.message : String(e));
      });

    return () => {
      ac.abort();
      loadId.current += 1;
    };
  }, [dataInicio, dataFim, granularidade, idsKey, empresasKey, contasKey, idsSaidas]);

  const linhasFiltradas = useMemo(() => {
    const { linha, periodos } = contexto;
    return linhasBrutas.filter((row) => {
      if (!linhaNoPeriodosResumo(row, periodos, granularidade)) return false;
      const eff = prioridadeEfetivaDetalhe(row, mapsLocais.contas, mapsLocais.lancs);
      if (linha === 'semPriorizacao') return eff == null;
      return eff != null;
    });
  }, [linhasBrutas, contexto, granularidade, mapsLocais]);

  const aggEmpresa = useMemo(() => agregarPorEmpresa(linhasFiltradas), [linhasFiltradas]);
  const aggPlano = useMemo(() => agregarPorPlano(linhasFiltradas), [linhasFiltradas]);
  const aggFornecedor = useMemo(() => agregarPorFornecedor(linhasFiltradas), [linhasFiltradas]);

  const prioridadeRow = useCallback(
    (row: DfcAgendamentoDetalheLinha) => {
      const override = mapsLocais.lancs[`${row.idEmpresa}#${row.tipoRef}#${row.id}`] ?? null;
      const eff = prioridadeEfetivaDetalhe(row, mapsLocais.contas, mapsLocais.lancs);
      const prioConta =
        row.idContaFinanceiro != null
          ? mapsLocais.contas[`${row.idEmpresa}#${row.idContaFinanceiro}`] ?? null
          : null;
      return { override, eff, prioConta };
    },
    [mapsLocais],
  );

  const prioridadeEfetivaValor = useCallback(
    (row: DfcAgendamentoDetalheLinha) => prioridadeRow(row).eff,
    [prioridadeRow],
  );

  const colunasGrade = useMemo(
    () =>
      montarColunasGradeDfcDetalhe({
        incluirDescricao: false,
        incluirPlano: true,
        incluirDataBaixa: false,
        incluirPrioridade: true,
      }),
    [],
  );

  const getCellText = useCallback(
    (row: DfcAgendamentoDetalheLinha, colId: string) =>
      criarGetCellTextDfcDetalhe(prioridadeEfetivaValor)(row, colId),
    [prioridadeEfetivaValor],
  );

  const valueForSort = useCallback(
    (row: DfcAgendamentoDetalheLinha, colId: string) =>
      criarValueForSortDfcDetalhe(prioridadeEfetivaValor)(row, colId),
    [prioridadeEfetivaValor],
  );

  const grade = useGradeFiltrosExcel({
    rows: linhasFiltradas,
    columnIds: colunasGrade,
    getCellText,
    valueForSort,
    defaultSortLevels: [{ id: 'valor', dir: 'desc' }],
    dateColumnIds: ['dataVencimento'],
  });

  useEffect(() => {
    grade.limparFiltrosGrade();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetar ao trocar célula/período
  }, [contexto.linha, contexto.periodos.join('|'), contexto.valor]);

  const linhasExibidas = grade.rowsExibidas;

  const totalExibido = useMemo(
    () => linhasExibidas.reduce((s, r) => s + r.valorBaixado, 0),
    [linhasExibidas],
  );

  const alterarPrioridade = useCallback(
    async (row: DfcAgendamentoDetalheLinha, novo: DfcPrioridade | null) => {
      const chave = `${row.idEmpresa}#${row.tipoRef}#${row.id}`;
      setSalvandoChave(chave);
      const snapshot = mapsLocais.lancs;
      const patch = (prior: DfcPrioridade | null) => {
        setMapsLocais((prev) => {
          const nextLancs = { ...prev.lancs };
          if (prior == null) delete nextLancs[chave];
          else nextLancs[chave] = prior;
          return { ...prev, lancs: nextLancs };
        });
      };

      patch(novo);
      try {
        if (novo == null) {
          const r = await removerPrioridadeLancamento(row.idEmpresa, row.tipoRef, row.id);
          if (!r.ok) {
            setMapsLocais((prev) => ({ ...prev, lancs: snapshot }));
            setErro(r.erro ?? 'Falha ao remover prioridade.');
            return;
          }
        } else {
          const r = await salvarPrioridadeLancamento({
            idEmpresa: row.idEmpresa,
            tipoRef: row.tipoRef,
            idRef: row.id,
            idContaFinanceiro: row.idContaFinanceiro ?? undefined,
            prioridade: novo,
          });
          if (!r.ok) {
            setMapsLocais((prev) => ({ ...prev, lancs: snapshot }));
            setErro(r.erro ?? 'Falha ao salvar prioridade.');
            return;
          }
        }
        onPrioridadeLancAtualizada?.(row.idEmpresa, row.tipoRef, row.id, novo);
      } finally {
        setSalvandoChave(null);
      }
    },
    [mapsLocais.lancs, onPrioridadeLancAtualizada],
  );

  const tituloLinha =
    contexto.linha === 'aPagar' ? 'A pagar' : 'Sem priorização';
  const permitePriorizar = contexto.linha === 'semPriorizacao';

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dfc-resumo-celula-titulo"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[min(92vh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div>
            <h2 id="dfc-resumo-celula-titulo" className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {tituloLinha} — {contexto.rotuloPeriodo}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Total: <span className="font-semibold text-rose-700 dark:text-rose-400">{nfBrl.format(totalExibido || Math.abs(contexto.valor))}</span>
              {linhasFiltradas.length > 0
                ? ` · ${linhasExibidas.length.toLocaleString('pt-BR')} de ${linhasFiltradas.length.toLocaleString('pt-BR')} lançamentos`
                : null}
              {contexto.agrupado ? ' · período agrupado' : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex shrink-0 gap-1 border-b border-slate-200 px-4 dark:border-slate-700">
          {(['graficos', 'lancamentos'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setAba(t)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
                aba === t
                  ? 'border-primary-600 text-primary-700 dark:text-primary-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              {t === 'graficos' ? 'Gráficos do dia' : 'Lançamentos'}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {loading ? (
            <div className="py-16 text-center text-sm text-slate-500 animate-pulse">Carregando detalhes…</div>
          ) : erro ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              {erro}
            </div>
          ) : aba === 'graficos' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <MiniBarChart titulo="Por empresa" dados={aggEmpresa} />
              <MiniBarChart titulo="Por plano de contas" dados={aggPlano} />
              <MiniBarChart titulo="Por fornecedor" dados={aggFornecedor} />
            </div>
          ) : (
            <>
              {truncado ? (
                <p className="mb-3 text-xs text-amber-700 dark:text-amber-300">
                  Resultado truncado — refine o período ou filtros para ver todos os lançamentos.
                </p>
              ) : null}
              {permitePriorizar ? (
                <p className="mb-3 text-xs text-slate-600 dark:text-slate-400">
                  Defina a prioridade de pagamento abaixo. Os valores passam a compor a linha «A pagar» após salvar.
                </p>
              ) : null}
              {grade.temFiltrosOuOrdem ? (
                <div className="mb-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => grade.limparFiltrosGrade()}
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  >
                    Limpar filtros da grade
                  </button>
                </div>
              ) : null}
              {linhasFiltradas.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">Nenhum lançamento neste recorte.</p>
              ) : (
                <div ref={grade.tableScrollRef} className="relative overflow-auto rounded-lg border border-slate-200 dark:border-slate-600">
                  <table className="w-full min-w-max border-collapse text-sm">
                    <thead className="sticky top-0 z-[1] bg-primary-600 text-white">
                      <tr>
                        {colunasGrade.map((colId) => (
                          <DfcDetalheCabecalhoTh
                            key={colId}
                            colId={colId}
                            label={rotuloColunaGradeDfc(colId)}
                            grade={grade}
                            align={colId === 'valor' ? 'right' : 'left'}
                          />
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {linhasExibidas.length === 0 ? (
                        <tr>
                          <td colSpan={colunasGrade.length} className="px-4 py-8 text-center text-sm text-slate-500">
                            Nenhum lançamento corresponde aos filtros.
                          </td>
                        </tr>
                      ) : (
                        linhasExibidas.map((row, idx) => {
                        const { override, eff, prioConta } = prioridadeRow(row);
                        const exibir = override ?? eff;
                        const chave = `${row.idEmpresa}#${row.tipoRef}#${row.id}`;
                        const salvando = salvandoChave === chave;
                        return (
                          <tr
                            key={`${row.tipoRef}-${row.id}-${idx}`}
                            className="border-t border-slate-100 odd:bg-white even:bg-slate-50/80 dark:border-slate-700 dark:odd:bg-slate-800/30 dark:even:bg-slate-800/50"
                          >
                            <td className="px-2 py-1.5 tabular-nums">{row.id}</td>
                            <td className="px-2 py-1.5">{row.empresa?.trim() || labelEmpresaDfc(row.idEmpresa)}</td>
                            <td className="px-2 py-1.5 max-w-[14rem] truncate" title={row.planoContas ?? undefined}>
                              {row.planoContas ?? '—'}
                            </td>
                            <td className="px-2 py-1.5 max-w-[12rem] truncate" title={row.nome ?? undefined}>
                              {row.nome ?? '—'}
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap">{fmtDataBr(row.dataVencimento)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums font-medium">{nfBrl.format(row.valorBaixado)}</td>
                            <td className="px-2 py-1.5 min-w-[10rem]">
                              {permitePriorizar ? (
                                <select
                                  value={override ?? ''}
                                  disabled={salvando}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    void alterarPrioridade(row, v === '' ? null : (Number(v) as DfcPrioridade));
                                  }}
                                  className={`w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-xs ${
                                    exibir != null ? `${DFC_PRIORIDADE_CHIP[exibir]} font-semibold` : ''
                                  }`}
                                >
                                  <option value="">
                                    {override == null && prioConta != null
                                      ? `${prioConta} — ${DFC_PRIORIDADE_LABEL_CURTO[prioConta]} (plano)`
                                      : '— Sem prioridade —'}
                                  </option>
                                  {DFC_PRIORIDADES.filter(
                                    (p) => override != null || prioConta == null || p !== prioConta,
                                  ).map((p) => (
                                    <option key={p} value={p}>
                                      {p} — {DFC_PRIORIDADE_LABEL_CURTO[p]}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <PrioridadeSomenteLeitura prioridade={exibir} />
                              )}
                            </td>
                          </tr>
                        );
                      })
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 dark:bg-slate-700 font-semibold">
                        <td colSpan={colunasGrade.length - 2} className="px-2 py-2 text-right text-xs uppercase">
                          Total{grade.temFiltrosOuOrdem ? ' (filtrado)' : ''}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{nfBrl.format(totalExibido)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                  <DfcDetalheGradeFiltroPortal grade={grade} zIndex={10150} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
