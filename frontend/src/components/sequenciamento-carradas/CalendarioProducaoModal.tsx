import { useCallback, useMemo, useState } from 'react';
import {
  colunaCalendarioId,
  computarCalendarioProducao,
  formatDataCurta,
  formatQtdeInt,
  isFimDeSemana,
  montarEixoDatasCalendario,
  type CarradaBaseline,
  type ColunaCalendario,
  type SimEntry,
} from './simulacaoCarradas';
import {
  comparePedidoAsc,
  listarItensPedidoPorPd,
  SUBTOTAL_ROW_CLASS,
} from './sequenciamentoCarradasUtils';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import GradeFiltroCabecalhoBtn from '../grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../grade/GradeFiltroExcelPortal';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';

type Props = {
  linhas: Record<string, unknown>[];
  sim: Map<string, SimEntry>;
  baseline: Map<string, CarradaBaseline>;
  onClose: () => void;
};

type Drill =
  | { nivel: 'pivot' }
  | { nivel: 'tipof'; setor: string; data: string }
  | { nivel: 'pedidos'; setor: string; data: string; tipoF: string }
  | { nivel: 'itens'; setor: string; data: string; tipoF: string; pd: string };

type SetorRow = { setor: string };

const COL_SETOR = 'setor';
const COL_TOTAL = '__total';

const TH = 'px-2 py-2 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap';
const TD = 'px-2 py-1.5 text-slate-700 dark:text-slate-200';
const NUM_BTN =
  'tabular-nums text-primary-700 hover:underline dark:text-primary-300 disabled:cursor-default disabled:text-slate-400 disabled:no-underline dark:disabled:text-slate-500';
const WEEKEND_TD = 'bg-slate-100/80 dark:bg-slate-900/40';
const OCIOso_TD = 'bg-slate-50/60 dark:bg-slate-900/20';

function labelColuna(col: ColunaCalendario): string {
  if (col.tipo === 'data') return formatDataCurta(col.iso);
  return '…';
}

function tituloColuna(col: ColunaCalendario): string {
  if (col.tipo === 'data') {
    const label = formatDataCurta(col.iso);
    return isFimDeSemana(col.iso) ? `${label} (fim de semana)` : label;
  }
  return `Período ocioso (${formatDataCurta(col.de)} – ${formatDataCurta(col.ate)})`;
}

export default function CalendarioProducaoModal({ linhas, sim, baseline, onClose }: Props) {
  const dados = useMemo(() => computarCalendarioProducao(linhas, sim, baseline), [linhas, sim, baseline]);
  const [drill, setDrill] = useState<Drill>({ nivel: 'pivot' });

  const colunas = useMemo(() => montarEixoDatasCalendario(dados.totalPorData), [dados.totalPorData]);

  const setorRows = useMemo<SetorRow[]>(() => dados.setores.map((setor) => ({ setor })), [dados.setores]);

  const colIds = useMemo(
    () => [COL_SETOR, ...colunas.map(colunaCalendarioId), COL_TOTAL],
    [colunas]
  );

  const valorCelula = useCallback(
    (setor: string, data: string): number => dados.valores.get(setor)?.get(data) ?? 0,
    [dados.valores]
  );

  const getCellText = useCallback(
    (row: SetorRow, colId: string): string => {
      if (colId === COL_SETOR) return row.setor;
      if (colId === COL_TOTAL) return formatQtdeInt(dados.totalPorSetor.get(row.setor) ?? 0);
      const col = colunas.find((c) => colunaCalendarioId(c) === colId);
      if (!col || col.tipo === 'ocioso') return '—';
      return formatQtdeInt(valorCelula(row.setor, col.iso));
    },
    [colunas, dados.totalPorSetor, valorCelula]
  );

  const valueForSort = useCallback(
    (row: SetorRow, colId: string): string | number => {
      if (colId === COL_SETOR) return row.setor;
      if (colId === COL_TOTAL) return dados.totalPorSetor.get(row.setor) ?? 0;
      const col = colunas.find((c) => colunaCalendarioId(c) === colId);
      if (!col || col.tipo === 'ocioso') return -1;
      return valorCelula(row.setor, col.iso);
    },
    [colunas, dados.totalPorSetor, valorCelula]
  );

  const grade = useGradeFiltrosExcel<SetorRow>({
    rows: setorRows,
    columnIds: colIds,
    getCellText,
    valueForSort,
    defaultSortLevels: [],
  });

  const totais = useMemo(() => {
    const porColId = new Map<string, number>();
    let geral = 0;
    for (const row of grade.rowsExibidas) {
      for (const col of colunas) {
        if (col.tipo === 'ocioso') continue;
        const colId = colunaCalendarioId(col);
        const v = valorCelula(row.setor, col.iso);
        if (v !== 0) porColId.set(colId, (porColId.get(colId) ?? 0) + v);
        geral += v;
      }
    }
    return { porColId, geral };
  }, [grade.rowsExibidas, colunas, valorCelula]);

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
    if (drill.nivel !== 'pedidos' && drill.nivel !== 'itens') return [];
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

  const itensRows = useMemo(() => {
    if (drill.nivel !== 'itens') return [];
    return listarItensPedidoPorPd(linhas, drill.pd);
  }, [drill, linhas]);

  const tipoFTotal = tipoFRows.reduce((s, r) => s + r.qtde, 0);
  const pedidoTotal = pedidoRows.reduce((s, r) => s + r.qtde, 0);
  const itensTotal = itensRows.reduce((s, r) => s + r.qtdePendenteReal, 0);

  const voltarNivel = useCallback(() => {
    setDrill((cur) => {
      if (cur.nivel === 'itens') {
        return { nivel: 'pedidos', setor: cur.setor, data: cur.data, tipoF: cur.tipoF };
      }
      if (cur.nivel === 'pedidos') return { nivel: 'tipof', setor: cur.setor, data: cur.data };
      if (cur.nivel === 'tipof') return { nivel: 'pivot' };
      return cur;
    });
  }, []);

  const emDrill = drill.nivel !== 'pivot';

  const handleEscape = useCallback(() => {
    if (grade.colunaFiltroAberta) {
      grade.fecharFiltroExcel();
      return;
    }
    if (drill.nivel !== 'pivot') {
      voltarNivel();
      return;
    }
    onClose();
  }, [grade, drill.nivel, voltarNivel, onClose]);

  useRegisterModalEscape({ id: 'seq-carradas-calendario', onClose: handleEscape, zIndex: 130 });

  const renderTh = (colId: string) => {
    const isSetor = colId === COL_SETOR;
    const isTotal = colId === COL_TOTAL;
    const col = colunas.find((c) => colunaCalendarioId(c) === colId);
    const weekend = col?.tipo === 'data' && isFimDeSemana(col.iso);
    const ocioso = col?.tipo === 'ocioso';
    const label = isSetor ? 'Setor de produção' : isTotal ? 'Total Geral' : col ? labelColuna(col) : colId;
    const title = isSetor || isTotal ? label : col ? tituloColuna(col) : label;
    return (
      <th
        key={colId}
        className={`sticky top-0 z-20 border border-primary-500/40 px-2 py-2 align-middle font-semibold text-white shadow-[0_1px_0_rgba(0,0,0,0.08)] ${
          weekend ? 'bg-primary-800' : ocioso ? 'bg-primary-700' : 'bg-primary-600'
        } ${isSetor ? 'left-0 z-30 text-left' : 'text-right'}`}
        title={title}
      >
        <div className={`flex items-center gap-1 ${isSetor ? 'justify-between' : 'justify-end'}`}>
          <span className="whitespace-nowrap text-[11px] leading-tight sm:text-xs">{label}</span>
          {!ocioso && (
            <GradeFiltroCabecalhoBtn
              ativo={grade.colunaComFiltroAtivo(colId)}
              onClick={(e) => grade.abrirFiltroExcel(colId, e)}
            />
          )}
        </div>
      </th>
    );
  };

  const renderCelulaData = (setor: string, col: ColunaCalendario) => {
    const colId = colunaCalendarioId(col);
    if (col.tipo === 'ocioso') {
      return (
        <td key={colId} className={`${TD} text-center ${OCIOso_TD}`} title={tituloColuna(col)}>
          <span className="text-slate-300 dark:text-slate-600">—</span>
        </td>
      );
    }
    const v = valorCelula(setor, col.iso);
    const weekend = isFimDeSemana(col.iso);
    return (
      <td key={colId} className={`${TD} text-right ${weekend ? WEEKEND_TD : ''}`}>
        {v > 0 ? (
          <button
            type="button"
            className={NUM_BTN}
            onClick={() => setDrill({ nivel: 'tipof', setor, data: col.iso })}
            title="Ver detalhamento por TipoF"
          >
            {formatQtdeInt(v)}
          </button>
        ) : (
          <span className="text-slate-300 dark:text-slate-600">—</span>
        )}
      </td>
    );
  };

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
          <h2 id="calendario-producao-titulo" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Calendário de produção
          </h2>
          <div className="flex items-center gap-2">
            {emDrill && (
              <button
                type="button"
                onClick={voltarNivel}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                ← Voltar
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Fechar
            </button>
          </div>
        </div>

        {emDrill && (
          <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-slate-200 px-4 py-2 text-xs dark:border-slate-600">
            <button
              type="button"
              onClick={() => setDrill({ nivel: 'pivot' })}
              className="rounded px-2 py-1 font-medium text-primary-700 hover:bg-slate-100 dark:text-primary-300 dark:hover:bg-slate-700"
            >
              Calendário
            </button>
            <span className="text-slate-400">/</span>
            <button
              type="button"
              onClick={() => setDrill({ nivel: 'tipof', setor: drill.setor, data: drill.data })}
              className={`rounded px-2 py-1 font-medium ${drill.nivel === 'tipof' ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200' : 'text-primary-700 hover:bg-slate-100 dark:text-primary-300 dark:hover:bg-slate-700'}`}
            >
              {drill.setor} · {formatDataCurta(drill.data)}
            </button>
            {(drill.nivel === 'pedidos' || drill.nivel === 'itens') && (
              <>
                <span className="text-slate-400">/</span>
                <button
                  type="button"
                  onClick={() =>
                    setDrill({ nivel: 'pedidos', setor: drill.setor, data: drill.data, tipoF: drill.tipoF })
                  }
                  className={`rounded px-2 py-1 font-medium ${drill.nivel === 'pedidos' ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200' : 'text-primary-700 hover:bg-slate-100 dark:text-primary-300 dark:hover:bg-slate-700'}`}
                >
                  TipoF: {drill.tipoF}
                </button>
              </>
            )}
            {drill.nivel === 'itens' && (
              <>
                <span className="text-slate-400">/</span>
                <span className="rounded bg-primary-100 px-2 py-1 font-medium text-primary-800 dark:bg-primary-900/40 dark:text-primary-200">
                  {drill.pd} · Itens
                </span>
              </>
            )}
          </div>
        )}

        {drill.nivel === 'pivot' && grade.temFiltrosOuOrdem && (
          <div className="flex shrink-0 items-center justify-end border-b border-slate-200 px-4 py-1.5 dark:border-slate-600">
            <button
              type="button"
              onClick={grade.limparFiltrosGrade}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Limpar filtros/ordem
            </button>
          </div>
        )}

        <div ref={grade.tableScrollRef} className="min-h-0 flex-1 overflow-auto p-4">
          {drill.nivel === 'pivot' &&
            (colunas.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nenhuma carrada com Data de produção preenchida na simulação. Informe a Data de produção nas linhas
                para montar o calendário.
              </p>
            ) : (
              <table className="border-collapse text-sm">
                <thead>
                  <tr>{colIds.map((colId) => renderTh(colId))}</tr>
                </thead>
                <tbody>
                  {grade.rowsExibidas.map(({ setor }) => (
                    <tr key={setor} className="border-b border-slate-100 dark:border-slate-700">
                      <td className={`${TD} sticky left-0 z-10 bg-white font-medium dark:bg-slate-800`}>{setor}</td>
                      {colunas.map((col) => renderCelulaData(setor, col))}
                      <td className={`${TD} text-right font-semibold tabular-nums`}>
                        {formatQtdeInt(dados.totalPorSetor.get(setor) ?? 0)}
                      </td>
                    </tr>
                  ))}
                  <tr className={SUBTOTAL_ROW_CLASS}>
                    <td className={`${TD} sticky left-0 z-10 bg-slate-100 dark:bg-slate-700/60`}>Total Geral</td>
                    {colunas.map((col) => {
                      const colId = colunaCalendarioId(col);
                      if (col.tipo === 'ocioso') {
                        return (
                          <td key={colId} className={`${TD} text-center ${OCIOso_TD}`}>
                            —
                          </td>
                        );
                      }
                      return (
                        <td
                          key={colId}
                          className={`${TD} text-right tabular-nums ${isFimDeSemana(col.iso) ? WEEKEND_TD : ''}`}
                        >
                          {formatQtdeInt(totais.porColId.get(colId) ?? 0)}
                        </td>
                      );
                    })}
                    <td className={`${TD} text-right tabular-nums`}>{formatQtdeInt(totais.geral)}</td>
                  </tr>
                </tbody>
              </table>
            ))}

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
                    <td className={`${TD} text-right`}>
                      <button
                        type="button"
                        className={NUM_BTN}
                        onClick={() =>
                          setDrill({
                            nivel: 'itens',
                            setor: drill.setor,
                            data: drill.data,
                            tipoF: drill.tipoF,
                            pd: r.pd,
                          })
                        }
                        title="Ver todos os itens do pedido"
                      >
                        {formatQtdeInt(r.qtde)}
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className={SUBTOTAL_ROW_CLASS}>
                  <td className={TD}>Total</td>
                  <td className={`${TD} text-right tabular-nums`}>{formatQtdeInt(pedidoTotal)}</td>
                </tr>
              </tbody>
            </table>
          )}

          {drill.nivel === 'itens' && (
            <table className="w-full max-w-3xl border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
                  <th className={`${TH} text-left`}>Código</th>
                  <th className={`${TH} text-left`}>Descrição</th>
                  <th className={`${TH} text-right`}>Qtde Pendente Real</th>
                </tr>
              </thead>
              <tbody>
                {itensRows.map((r, i) => (
                  <tr key={`${r.codigo}-${i}`} className="border-b border-slate-100 dark:border-slate-700">
                    <td className={TD}>{r.codigo}</td>
                    <td className={TD}>{r.descricao}</td>
                    <td className={`${TD} text-right tabular-nums`}>{formatQtdeInt(r.qtdePendenteReal)}</td>
                  </tr>
                ))}
                <tr className={SUBTOTAL_ROW_CLASS}>
                  <td className={TD} colSpan={2}>
                    Total
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>{formatQtdeInt(itensTotal)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {grade.colunaFiltroAberta && grade.filtroAbertoRect && (
          <GradeFiltroExcelPortal
            colunaAberta={grade.colunaFiltroAberta}
            rect={grade.filtroAbertoRect}
            dropdownRef={grade.filtroDropdownRef}
            excelFilterDrafts={grade.excelFilterDrafts}
            setExcelFilterDrafts={grade.setExcelFilterDrafts}
            valoresUnicosPorColuna={grade.valoresUnicosPorColuna}
            onSortAsc={(colId) => {
              grade.setSortState({ key: colId, direction: 'asc' });
              grade.setSortLevels([]);
              grade.fecharFiltroExcel();
            }}
            onSortDesc={(colId) => {
              grade.setSortState({ key: colId, direction: 'desc' });
              grade.setSortLevels([]);
              grade.fecharFiltroExcel();
            }}
            onAplicar={grade.aplicarFiltroExcel}
            onCancelar={grade.fecharFiltroExcel}
            sortAscLabel={grade.colunaFiltroAberta !== COL_SETOR ? 'Menor para Maior' : undefined}
            sortDescLabel={grade.colunaFiltroAberta !== COL_SETOR ? 'Maior para Menor' : undefined}
            showNumericFilters={grade.colunaFiltroAberta !== COL_SETOR}
          />
        )}
      </div>
    </div>
  );
}
