import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import type { DemandaCalendarioMateriais, MaterialDiaCalendario } from '../../api/sequenciamentoCarradas';
import { consultarDisponibilidadeMateriaisDia } from '../../api/sequenciamentoCarradas';
import { formatDataCurta, toISODate } from './simulacaoCarradas';
import CalendarioOrigemConsumoModal from './CalendarioOrigemConsumoModal';
import GradeCelulaModalBtn from '../pcp/GradeCelulaModalBtn';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import GradeFiltroCabecalhoBtn from '../grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../grade/GradeFiltroExcelPortal';

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const COLS = [
  'codigo',
  'descricao',
  'saldoInicio',
  'consumoDia',
  'entradaDia',
  'falta',
] as const;

type ColId = (typeof COLS)[number];

const COL_LABELS: Record<ColId, string> = {
  codigo: 'Código',
  descricao: 'Descrição',
  saldoInicio: 'Saldo início',
  consumoDia: 'Consumo',
  entradaDia: 'Entrada PC',
  falta: 'Falta',
};

const DEFAULT_COL_WIDTHS: Record<ColId, number> = {
  codigo: 110,
  descricao: 260,
  saldoInicio: 100,
  consumoDia: 100,
  entradaDia: 100,
  falta: 90,
};

const COL_WIDTH_MIN = 56;
const COL_WIDTH_MAX = 480;

const NUMERIC_COLS = new Set<ColId>(['saldoInicio', 'consumoDia', 'entradaDia', 'falta']);

const TH = 'relative px-2 py-2 font-semibold text-slate-700 dark:text-slate-200';
const TD = 'px-2 py-1.5 border-b border-slate-100 dark:border-slate-700 align-top';

function clampColWidth(w: number): number {
  return Math.min(COL_WIDTH_MAX, Math.max(COL_WIDTH_MIN, Math.round(w)));
}

function classStatus(status: MaterialDiaCalendario['status']): string {
  if (status === 'falta') return 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200';
  if (status === 'atencao') return 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100';
  return '';
}

function textoCelula(row: MaterialDiaCalendario, colId: string): string {
  if (colId === 'codigo') return row.codigo;
  if (colId === 'descricao') return row.descricao || '';
  if (colId === 'saldoInicio') return fmtNum(row.saldoInicio);
  if (colId === 'consumoDia') return fmtNum(row.consumoDia);
  if (colId === 'entradaDia') return fmtNum(row.entradaDia);
  if (colId === 'falta') return fmtNum(row.falta);
  return '';
}

function valorOrdenacao(row: MaterialDiaCalendario, colId: string): string | number {
  if (colId === 'saldoInicio') return row.saldoInicio;
  if (colId === 'consumoDia') return row.consumoDia;
  if (colId === 'entradaDia') return row.entradaDia;
  if (colId === 'falta') return row.falta;
  return textoCelula(row, colId);
}

export type CalendarioMateriaisDiaModalProps = {
  open: boolean;
  dataIso: string;
  demanda: DemandaCalendarioMateriais[];
  onClose: () => void;
  onAbrirItem: (codigo: string, idProduto: number, descricao: string) => void;
  cacheRef: MutableRefObject<Map<string, MaterialDiaCalendario[]>>;
  /** Snapshot da sequência: calcula com a base congelada em vez do Nomus ao vivo. */
  snapshotId?: number | null;
};

export default function CalendarioMateriaisDiaModal({
  open,
  dataIso,
  demanda,
  onClose,
  onAbrirItem,
  cacheRef,
  snapshotId,
}: CalendarioMateriaisDiaModalProps) {
  const [linhas, setLinhas] = useState<MaterialDiaCalendario[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [origemLinha, setOrigemLinha] = useState<MaterialDiaCalendario | null>(null);
  const [colWidths, setColWidths] = useState<Record<ColId, number>>(() => ({ ...DEFAULT_COL_WIDTHS }));
  const colResizeRef = useRef<{ colId: ColId; startX: number; startW: number } | null>(null);

  const grade = useGradeFiltrosExcel<MaterialDiaCalendario>({
    rows: linhas,
    columnIds: [...COLS],
    getCellText: textoCelula,
    valueForSort: valorOrdenacao,
    defaultSortLevels: [{ id: 'descricao', dir: 'asc' }],
  });

  const tableWidth = useMemo(
    () => COLS.reduce((s, id) => s + (colWidths[id] ?? DEFAULT_COL_WIDTHS[id]), 0),
    [colWidths]
  );

  const onColResizePointerDown = useCallback(
    (colId: ColId, e: React.PointerEvent<HTMLSpanElement>) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      colResizeRef.current = {
        colId,
        startX: e.clientX,
        startW: colWidths[colId] ?? DEFAULT_COL_WIDTHS[colId],
      };
    },
    [colWidths]
  );

  const onColResizePointerMove = useCallback((e: React.PointerEvent<HTMLSpanElement>) => {
    const d = colResizeRef.current;
    if (!d) return;
    const delta = e.clientX - d.startX;
    setColWidths((prev) => ({
      ...prev,
      [d.colId]: clampColWidth(d.startW + delta),
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
    id: 'calendario-materiais-dia',
    onClose: handleEscape,
    zIndex: 140,
    enabled: open,
  });

  useEffect(() => {
    if (!open || !dataIso) {
      setLinhas([]);
      setErro(null);
      setCarregando(false);
      setOrigemLinha(null);
      return;
    }
    const dataNorm = toISODate(dataIso) || dataIso;
    const cached = cacheRef.current.get(dataNorm);
    if (cached) {
      setLinhas(cached);
      setErro(null);
      setCarregando(false);
      return;
    }
    let cancelled = false;
    setCarregando(true);
    setErro(null);
    void consultarDisponibilidadeMateriaisDia(demanda, dataNorm, { snapshotId }).then((r) => {
      if (cancelled) return;
      setCarregando(false);
      if (r.error) {
        setErro(r.error);
        setLinhas([]);
        return;
      }
      const mats = r.data?.materiais ?? [];
      cacheRef.current.set(dataNorm, mats);
      setLinhas(mats);
    });
    return () => {
      cancelled = true;
    };
  }, [open, dataIso, demanda, cacheRef, snapshotId]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[140] flex items-center justify-center bg-black/60 p-4"
        role="presentation"
        onClick={onClose}
      >
      <div
        className="flex max-h-[min(88vh,640px)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
        role="dialog"
        aria-modal
        aria-labelledby="calendario-materiais-dia-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div>
            <h2
              id="calendario-materiais-dia-titulo"
              className="text-lg font-semibold text-slate-800 dark:text-slate-100"
            >
              Materiais do dia · {formatDataCurta(dataIso)}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Somente consumo e falta &gt; 0 no dia (exclui Matéria Prima). Clique em{' '}
              <strong>Consumo</strong> para ver a origem. Arraste a borda das colunas para ajustar a
              largura.
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
            <p className="text-sm text-slate-500 dark:text-slate-400">Carregando materiais…</p>
          )}
          {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}
          {!carregando && !erro && linhas.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Nenhum material com consumo e falta neste dia (almox secundário, sem Matéria Prima).
            </p>
          )}
          {!carregando && !erro && linhas.length > 0 && (
            <table
              className="border-collapse text-sm"
              style={{ tableLayout: 'fixed', width: tableWidth }}
            >
              <colgroup>
                {COLS.map((colId) => (
                  <col
                    key={colId}
                    style={{ width: colWidths[colId] ?? DEFAULT_COL_WIDTHS[colId] }}
                  />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/50">
                  {COLS.map((colId) => {
                    const numeric = NUMERIC_COLS.has(colId);
                    return (
                      <th
                        key={colId}
                        className={`${TH} ${numeric ? 'text-right' : 'text-left'}`}
                        style={{ width: colWidths[colId] ?? DEFAULT_COL_WIDTHS[colId] }}
                      >
                        <div
                          className={`flex items-center gap-1 pr-2 ${numeric ? 'justify-end' : 'justify-between'}`}
                        >
                          <span className="whitespace-nowrap">{COL_LABELS[colId]}</span>
                          <GradeFiltroCabecalhoBtn
                            ativo={grade.colunaComFiltroAtivo(colId)}
                            onClick={(e) => grade.abrirFiltroExcel(colId, e)}
                          />
                        </div>
                        <span
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={`Redimensionar coluna ${COL_LABELS[colId]}`}
                          className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-primary-400/50"
                          onPointerDown={(e) => onColResizePointerDown(colId, e)}
                          onPointerMove={onColResizePointerMove}
                          onPointerUp={onColResizePointerEnd}
                          onPointerCancel={onColResizePointerEnd}
                        />
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {grade.rowsExibidas.map((r) => (
                  <tr
                    key={r.codigo}
                    className={`border-b border-slate-100 dark:border-slate-700 ${classStatus(r.status)}`}
                  >
                    <td className={TD}>
                      <GradeCelulaModalBtn
                        onClick={() => onAbrirItem(r.codigo, r.idProduto, r.descricao)}
                        title="Ver horizonte do material"
                        align="left"
                      >
                        {r.codigo}
                      </GradeCelulaModalBtn>
                    </td>
                    <td className={`${TD} whitespace-normal break-words`}>
                      {r.descricao || '—'}
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>{fmtNum(r.saldoInicio)}</td>
                    <td className={`${TD} text-right tabular-nums`}>
                      {r.consumoDia > 0 ? (
                        <GradeCelulaModalBtn
                          onClick={() => setOrigemLinha(r)}
                          title="Ver origem do consumo"
                          align="right"
                        >
                          {fmtNum(r.consumoDia)}
                        </GradeCelulaModalBtn>
                      ) : (
                        fmtNum(r.consumoDia)
                      )}
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>{fmtNum(r.entradaDia)}</td>
                    <td className={`${TD} text-right tabular-nums font-medium`}>{fmtNum(r.falta)}</td>
                  </tr>
                ))}
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
            sortAscLabel={NUMERIC_COLS.has(grade.colunaFiltroAberta as ColId)
              ? 'Menor para Maior'
              : undefined}
            sortDescLabel={NUMERIC_COLS.has(grade.colunaFiltroAberta as ColId)
              ? 'Maior para Menor'
              : undefined}
            showNumericFilters={NUMERIC_COLS.has(grade.colunaFiltroAberta as ColId)}
          />
        )}
      </div>
      </div>

      {origemLinha && (
        <CalendarioOrigemConsumoModal
          dataIso={toISODate(dataIso) || dataIso}
          origens={origemLinha.origens ?? []}
          codigo={origemLinha.codigo}
          onClose={() => setOrigemLinha(null)}
          zIndex={145}
        />
      )}
    </>
  );
}
