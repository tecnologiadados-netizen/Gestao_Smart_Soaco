import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import type {
  ComponenteRecurso1000Calendario,
  DemandaCalendarioMateriais,
  EstoqueEmProcessoCalendarioPp,
  ProgramacaoFonteRecurso1000,
} from '../../api/sequenciamentoCarradas';
import { consultarRecurso1000Dia } from '../../api/sequenciamentoCarradas';
import { formatDataCurta, toISODate } from './simulacaoCarradas';
import GradeCelulaModalBtn from '../pcp/GradeCelulaModalBtn';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import GradeFiltroCabecalhoBtn from '../grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../grade/GradeFiltroExcelPortal';
import CalendarioOrigemConsumoModal from './CalendarioOrigemConsumoModal';

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const COLS = [
  'codigo',
  'descSimp',
  'metodoRessuprimento',
  'estoque',
  'consumo',
  'falta',
] as const;
type ColId = (typeof COLS)[number];
const NUMERIC_COLS = new Set<ColId>(['estoque', 'consumo', 'falta']);

const COL_LABELS: Record<ColId, string> = {
  codigo: 'Código',
  descSimp: 'Descrição',
  metodoRessuprimento: 'Ressuprimento',
  estoque: 'Estoque',
  consumo: 'Consumo',
  falta: 'Falta',
};

const DEFAULT_COL_WIDTHS: Record<ColId, number> = {
  codigo: 120,
  descSimp: 260,
  metodoRessuprimento: 130,
  estoque: 90,
  consumo: 90,
  falta: 90,
};

const COL_WIDTH_MIN = 56;
const COL_WIDTH_MAX = 480;
const TH = 'relative px-2 py-2 font-semibold text-slate-700 dark:text-slate-200';
const TD = 'px-2 py-1.5 border-b border-slate-100 dark:border-slate-700 align-top';
const ESTOQUE_VAZIO: EstoqueEmProcessoCalendarioPp = {
  perfiladeira: 0,
  corteDobra: 0,
  solda: 0,
  pintura: 0,
  montagem: 0,
};

function clampColWidth(w: number): number {
  return Math.min(COL_WIDTH_MAX, Math.max(COL_WIDTH_MIN, Math.round(w)));
}

function estoqueColuna(row: ComponenteRecurso1000Calendario): number {
  const e = row.estoque;
  if (typeof e?.estoqueInicioDia === 'number') return e.estoqueInicioDia;
  return e?.estoqueTotal ?? 0;
}

function textoCelula(row: ComponenteRecurso1000Calendario, colId: string): string {
  if (colId === 'codigo') return row.codigo ?? '';
  if (colId === 'descSimp') return row.descSimp || row.descricao || '';
  if (colId === 'metodoRessuprimento') return row.metodoRessuprimento || 'Não informado';
  if (colId === 'estoque') return fmtNum(estoqueColuna(row));
  if (colId === 'consumo') return fmtNum(row.consumoDia ?? 0);
  if (colId === 'falta') return fmtNum(row.falta ?? 0);
  return '';
}

function valorOrdenacao(row: ComponenteRecurso1000Calendario, colId: string): string | number {
  if (colId === 'estoque') return estoqueColuna(row);
  if (colId === 'consumo') return row.consumoDia ?? 0;
  if (colId === 'falta') return row.falta ?? 0;
  return textoCelula(row, colId);
}

function formatFonte(p: ProgramacaoFonteRecurso1000 | null): string {
  if (!p) return 'Nenhuma programação Recurso 1000 encontrada — estoque em produção vazio.';
  const d = new Date(p.updatedAt);
  const quando = Number.isNaN(d.getTime()) ? p.updatedAt : d.toLocaleString('pt-BR');
  return `Estoque importado de ${p.name} (atualizado em ${quando}). Somente leitura.`;
}

function ModalEstoqueSomenteLeitura({
  linha,
  onClose,
}: {
  linha: ComponenteRecurso1000Calendario;
  onClose: () => void;
}) {
  const ep = linha.estoque?.estoqueEmProcesso ?? ESTOQUE_VAZIO;
  const fields: { key: keyof EstoqueEmProcessoCalendarioPp; label: string }[] = [
    { key: 'perfiladeira', label: 'Perfiladeira' },
    { key: 'corteDobra', label: 'Corte e Dobra' },
    { key: 'solda', label: 'Solda' },
    { key: 'pintura', label: 'Pintura' },
    { key: 'montagem', label: 'Montagem' },
  ];
  const subtitle = [linha.codigo, linha.descSimp?.trim() || linha.descricao].filter(Boolean).join(' — ');

  return createPortal(
    <div
      className="fixed inset-0 z-[14200] flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(88vh,560px)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
        role="dialog"
        aria-modal
        aria-labelledby="calendario-pp-estoque-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <h2 id="calendario-pp-estoque-titulo" className="text-base font-semibold text-slate-800 dark:text-slate-100">
            Estoque
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900/40">
            <div className="flex justify-between gap-2">
              <span className="text-slate-600 dark:text-slate-400">Estoque em PA (Nomus)</span>
              <span className="font-medium tabular-nums">{fmtNum(linha.estoque?.estoquePaNomus ?? 0)}</span>
            </div>
            <div className="mt-1 flex justify-between gap-2">
              <span className="text-slate-600 dark:text-slate-400">Estoque em produção</span>
              <span className="font-medium tabular-nums">{fmtNum(linha.estoque?.estoqueProducao ?? 0)}</span>
            </div>
            <div className="mt-1 flex justify-between gap-2">
              <span className="text-slate-600 dark:text-slate-400">Total na programação</span>
              <span className="font-medium tabular-nums">{fmtNum(linha.estoque?.estoqueTotal ?? 0)}</span>
            </div>
            <div className="mt-1 flex justify-between gap-2">
              <span className="text-slate-600 dark:text-slate-400">Consumido em dias anteriores</span>
              <span className="font-medium tabular-nums">{fmtNum(linha.estoque?.consumidoAntes ?? 0)}</span>
            </div>
            <div className="mt-2 flex justify-between gap-2 border-t border-slate-200 pt-2 font-semibold dark:border-slate-600">
              <span>Saldo no início deste dia</span>
              <span className="tabular-nums">{fmtNum(estoqueColuna(linha))}</span>
            </div>
          </div>
          <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
            Estoque em produção
          </h3>
          <div className="flex flex-col gap-3">
            {fields.map(({ key, label }) => (
              <div key={key}>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</span>
                <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm tabular-nums text-slate-800 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-100">
                  {ep[key] ? fmtNum(ep[key]) : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end border-t border-slate-200 px-4 py-3 dark:border-slate-600">
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export type Recurso1000DiaCacheEntry = {
  componentes: ComponenteRecurso1000Calendario[];
  programacao: ProgramacaoFonteRecurso1000 | null;
};

export type CalendarioRecurso1000DiaModalProps = {
  open: boolean;
  dataIso: string;
  demanda: DemandaCalendarioMateriais[];
  onClose: () => void;
  cacheRef: MutableRefObject<Map<string, Recurso1000DiaCacheEntry>>;
  setor?: string | null;
  metodosRessup?: string[];
};

export default function CalendarioRecurso1000DiaModal({
  open,
  dataIso,
  demanda,
  onClose,
  cacheRef,
  setor = null,
  metodosRessup,
}: CalendarioRecurso1000DiaModalProps) {
  const [linhas, setLinhas] = useState<ComponenteRecurso1000Calendario[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [fonte, setFonte] = useState<ProgramacaoFonteRecurso1000 | null>(null);
  const [estoqueLinha, setEstoqueLinha] = useState<ComponenteRecurso1000Calendario | null>(null);
  const [origemLinha, setOrigemLinha] = useState<ComponenteRecurso1000Calendario | null>(null);
  const [colWidths, setColWidths] = useState<Record<ColId, number>>(() => ({ ...DEFAULT_COL_WIDTHS }));
  const colResizeRef = useRef<{ colId: ColId; startX: number; startW: number } | null>(null);

  const grade = useGradeFiltrosExcel<ComponenteRecurso1000Calendario>({
    rows: linhas,
    columnIds: [...COLS],
    getCellText: textoCelula,
    valueForSort: valorOrdenacao,
    defaultSortLevels: [{ id: 'codigo', dir: 'asc' }],
  });

  const tableWidth = useMemo(
    () => COLS.reduce((s, id) => s + (colWidths[id] ?? DEFAULT_COL_WIDTHS[id]), 0),
    [colWidths]
  );

  const onColResizePointerDown = useCallback((colId: ColId, e: React.PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    colResizeRef.current = {
      colId,
      startX: e.clientX,
      startW: colWidths[colId] ?? DEFAULT_COL_WIDTHS[colId],
    };
  }, [colWidths]);

  const onColResizePointerMove = useCallback((e: React.PointerEvent<HTMLSpanElement>) => {
    const d = colResizeRef.current;
    if (!d) return;
    setColWidths((prev) => ({
      ...prev,
      [d.colId]: clampColWidth(d.startW + (e.clientX - d.startX)),
    }));
  }, []);

  const onColResizePointerEnd = useCallback((e: React.PointerEvent<HTMLSpanElement>) => {
    if (!colResizeRef.current) return;
    colResizeRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const handleEscape = () => {
    if (estoqueLinha) {
      setEstoqueLinha(null);
      return;
    }
    if (origemLinha) {
      setOrigemLinha(null);
      return;
    }
    if (grade.colunaFiltroAberta) {
      grade.fecharFiltroExcel();
      return;
    }
    onClose();
  };

  useRegisterModalEscape({
    id: 'calendario-recurso-1000-dia',
    onClose: handleEscape,
    zIndex: 14100,
    enabled: open,
  });

  useRegisterModalEscape({
    id: 'calendario-recurso-1000-origem',
    onClose: () => setOrigemLinha(null),
    zIndex: 14180,
    enabled: open && !!origemLinha,
  });

  useRegisterModalEscape({
    id: 'calendario-recurso-1000-estoque',
    onClose: () => setEstoqueLinha(null),
    zIndex: 14200,
    enabled: open && !!estoqueLinha,
  });

  useEffect(() => {
    if (!open || !dataIso) {
      setLinhas([]);
      setErro(null);
      setCarregando(false);
      setEstoqueLinha(null);
      setOrigemLinha(null);
      setFonte(null);
      return;
    }
    const dataNorm = toISODate(dataIso) || dataIso;
    const setorNorm = String(setor ?? '').trim();
    const metodoKey = (metodosRessup ?? []).join(',');
    const cacheKey = `${setorNorm ? `${dataNorm}\0${setorNorm}` : dataNorm}\0m:${metodoKey}\0v2acum`;
    const cached = cacheRef.current.get(cacheKey);
    const cacheOk =
      Array.isArray(cached?.componentes) &&
      cached.componentes.every(
        (c) =>
          typeof c.consumoDia === 'number' &&
          Array.isArray(c.origens) &&
          typeof c.estoque?.estoqueInicioDia === 'number'
      );
    if (cacheOk && cached) {
      setLinhas(cached.componentes);
      setFonte(cached.programacao ?? null);
      setErro(null);
      setCarregando(false);
      return;
    }
    let cancelled = false;
    setCarregando(true);
    setErro(null);
    void consultarRecurso1000Dia(demanda, dataNorm, {
      setor: setorNorm || null,
      metodosRessup,
    })
      .then((r) => {
        if (cancelled) return;
        setCarregando(false);
        if (r.error) {
          setErro(r.error);
          setLinhas([]);
          return;
        }
        const comps = r.data?.componentes ?? [];
        const programacao = r.data?.programacao ?? null;
        cacheRef.current.set(cacheKey, { componentes: comps, programacao });
        setLinhas(comps);
        setFonte(programacao);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCarregando(false);
        setErro(err instanceof Error ? err.message : 'Falha ao carregar componentes Recurso 1000.');
        setLinhas([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, dataIso, demanda, setor, cacheRef, metodosRessup]);

  const setorLabel = String(setor ?? '').trim();

  if (!open) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[14100] flex items-center justify-center bg-black/60 p-4"
        role="presentation"
        onClick={onClose}
      >
        <div
          className="flex max-h-[min(88vh,640px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
          role="dialog"
          aria-modal
          aria-labelledby="calendario-recurso-1000-dia-titulo"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
            <div>
              <h2
                id="calendario-recurso-1000-dia-titulo"
                className="text-lg font-semibold text-slate-800 dark:text-slate-100"
              >
                Recurso 1000 · {formatDataCurta(dataIso)}
                {setorLabel ? ` · ${setorLabel}` : ''}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Componentes da Perfiladeira 1000 na BOM dos produtos desta célula. Consumo e Falta
                acumulam a demanda não coberta dos dias anteriores (mesmo poço de estoque). Clique em{' '}
                <strong>Consumo</strong> para as origens (carrada × PD, inclusive dias anteriores) e em{' '}
                <strong>Estoque</strong> para PA Nomus e inventário importado.
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

          {grade.temFiltrosOuOrdem && (
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
            {carregando && (
              <p className="text-sm text-slate-500 dark:text-slate-400">Carregando componentes Recurso 1000…</p>
            )}
            {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
            {!carregando && !erro && (linhas?.length ?? 0) === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Nenhum componente da Perfiladeira 1000 na BOM deste recorte.
              </p>
            )}
            {!carregando && !erro && (linhas?.length ?? 0) > 0 && (
              <table className="border-collapse text-sm" style={{ tableLayout: 'fixed', width: tableWidth }}>
                <colgroup>
                  {COLS.map((colId) => (
                    <col key={colId} style={{ width: colWidths[colId] ?? DEFAULT_COL_WIDTHS[colId] }} />
                  ))}
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
                    {COLS.map((colId) => (
                      <th
                        key={colId}
                        className={`${TH} overflow-hidden ${NUMERIC_COLS.has(colId) ? 'text-right' : 'text-left'}`}
                      >
                        <div
                          className={`flex min-w-0 items-center gap-1 ${NUMERIC_COLS.has(colId) ? 'justify-end' : ''}`}
                        >
                          <span className="min-w-0 leading-tight">{COL_LABELS[colId]}</span>
                          <GradeFiltroCabecalhoBtn
                            ativo={grade.colunaComFiltroAtivo(colId)}
                            onClick={(e) => grade.abrirFiltroExcel(colId, e)}
                          />
                          <span
                            className="ml-auto inline-block h-4 w-1 cursor-col-resize rounded bg-slate-300 dark:bg-slate-600"
                            onPointerDown={(e) => onColResizePointerDown(colId, e)}
                            onPointerMove={onColResizePointerMove}
                            onPointerUp={onColResizePointerEnd}
                          />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(grade.rowsExibidas ?? []).map((row) => {
                    const consumo = row.consumoDia ?? 0;
                    const falta = row.falta ?? 0;
                    return (
                    <tr
                      key={row.idComponente}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-900/40 ${
                        falta > 0 ? 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200' : ''
                      }`}
                    >
                      {COLS.map((colId) => {
                        if (colId === 'estoque') {
                          return (
                            <td key={colId} className={`${TD} text-right tabular-nums`}>
                              <GradeCelulaModalBtn
                                align="right"
                                onClick={() => setEstoqueLinha(row)}
                                title="Ver saldo no início do dia e origem na Recurso 1000"
                              >
                                {fmtNum(estoqueColuna(row))}
                              </GradeCelulaModalBtn>
                            </td>
                          );
                        }
                        if (colId === 'consumo') {
                          return (
                            <td key={colId} className={`${TD} text-right tabular-nums`}>
                              {consumo > 0 ? (
                                <GradeCelulaModalBtn
                                  align="right"
                                  onClick={() => setOrigemLinha(row)}
                                  title="Ver origem do consumo"
                                >
                                  {fmtNum(consumo)}
                                </GradeCelulaModalBtn>
                              ) : (
                                fmtNum(consumo)
                              )}
                            </td>
                          );
                        }
                        if (colId === 'falta') {
                          return (
                            <td key={colId} className={`${TD} text-right tabular-nums font-medium`}>
                              {fmtNum(falta)}
                            </td>
                          );
                        }
                        const extra = colId === 'codigo' ? 'font-medium tabular-nums' : '';
                        return (
                          <td key={colId} className={`${TD} ${extra}`}>
                            {textoCelula(row, colId) || '—'}
                          </td>
                        );
                      })}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
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
          sortAscLabel={NUMERIC_COLS.has(grade.colunaFiltroAberta as ColId) ? 'Menor para Maior' : undefined}
          sortDescLabel={NUMERIC_COLS.has(grade.colunaFiltroAberta as ColId) ? 'Maior para Menor' : undefined}
          showNumericFilters={NUMERIC_COLS.has(grade.colunaFiltroAberta as ColId)}
          zIndex={14150}
        />
      )}
      {origemLinha && (
        <CalendarioOrigemConsumoModal
          dataIso={toISODate(dataIso) || dataIso}
          origens={origemLinha.origens ?? []}
          codigo={origemLinha.codigo}
          onClose={() => setOrigemLinha(null)}
          zIndex={14180}
        />
      )}
      {estoqueLinha && (
        <ModalEstoqueSomenteLeitura linha={estoqueLinha} onClose={() => setEstoqueLinha(null)} />
      )}
    </>,
    document.body
  );
}
