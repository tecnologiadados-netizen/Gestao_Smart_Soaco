import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import type {
  DemandaCalendarioMateriais,
  EntradaPcExibicaoCalendario,
  MaterialDiaCalendario,
} from '../../api/sequenciamentoCarradas';
import {
  consultarDisponibilidadeMateriaisDia,
  obterAgPagCongelado,
  obterPcPendCongelado,
  obterScCongelado,
} from '../../api/sequenciamentoCarradas';
import { obterCotacaoDetalhe, obterScDetalhe, type CotacaoDetalhe, type ScDetalhe } from '../../api/consultaEstoque';
import type { RessupAlmoxPcPendLinha } from '../../api/compras';
import { formatDataCurta, toISODate } from './simulacaoCarradas';
import CalendarioOrigemConsumoModal from './CalendarioOrigemConsumoModal';
import GradeCelulaModalBtn from '../pcp/GradeCelulaModalBtn';
import CopiarTextoBtn from '../CopiarTextoBtn';
import ModalPcPendDetalhes from '../ressupAlmox/ModalPcPendDetalhes';
import ModalConsultaEstoqueDetalhe from '../pcp/ModalConsultaEstoqueDetalhe';
import TabelaDetalheCotacao from '../pcp/TabelaDetalheCotacao';
import TabelaDetalheSolicitacao from '../pcp/TabelaDetalheSolicitacao';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import GradeFiltroCabecalhoBtn from '../grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../grade/GradeFiltroExcelPortal';

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Fallback para respostas legadas sem `entradaPc`. */
function entradaPcDaLinha(row: MaterialDiaCalendario): EntradaPcExibicaoCalendario {
  if (row.entradaPc) return row.entradaPc;
  if (row.entradaDia > 0) {
    return { fonte: 'entrada_dia', texto: fmtNum(row.entradaDia), clicavel: true };
  }
  return { fonte: 'nenhuma', texto: fmtNum(row.entradaDia), clicavel: false };
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
  codigo: 140,
  descricao: 260,
  saldoInicio: 100,
  consumoDia: 100,
  entradaDia: 160,
  falta: 90,
};

const COL_WIDTH_MIN = 56;
const COL_WIDTH_MAX = 480;

const NUMERIC_COLS = new Set<ColId>(['saldoInicio', 'consumoDia', 'falta']);

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
  if (colId === 'entradaDia') return entradaPcDaLinha(row).texto;
  if (colId === 'falta') return fmtNum(row.falta);
  return '';
}

function valorOrdenacao(row: MaterialDiaCalendario, colId: string): string | number {
  if (colId === 'saldoInicio') return row.saldoInicio;
  if (colId === 'consumoDia') return row.consumoDia;
  if (colId === 'entradaDia') {
    const ep = entradaPcDaLinha(row);
    if (ep.fonte === 'entrada_dia') return row.entradaDia;
    if (ep.fonte === 'pc_aberta') return ep.texto;
    if (ep.fonte === 'ag_pag') return 'Pré Compra';
    if (ep.fonte === 'solicitacao') return 'Solicitação de Compra';
    return 0;
  }
  if (colId === 'falta') return row.falta;
  return textoCelula(row, colId);
}

type DetalheEntradaPc =
  | { tipo: 'pc'; linha: MaterialDiaCalendario }
  | { tipo: 'ag_pag'; linha: MaterialDiaCalendario }
  | { tipo: 'solicitacao'; linha: MaterialDiaCalendario };

export type CalendarioMateriaisDiaModalProps = {
  open: boolean;
  dataIso: string;
  demanda: DemandaCalendarioMateriais[];
  onClose: () => void;
  onAbrirItem: (codigo: string, idProduto: number, descricao: string) => void;
  cacheRef: MutableRefObject<Map<string, MaterialDiaCalendario[]>>;
  /** Snapshot da sequência: calcula com a base congelada em vez do Nomus ao vivo. */
  snapshotId?: number | null;
  /** Filtra materiais/origens ao setor da célula (bolinha da grade). */
  setor?: string | null;
};

export default function CalendarioMateriaisDiaModal({
  open,
  dataIso,
  demanda,
  onClose,
  onAbrirItem,
  cacheRef,
  snapshotId,
  setor = null,
}: CalendarioMateriaisDiaModalProps) {
  const [linhas, setLinhas] = useState<MaterialDiaCalendario[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [origemLinha, setOrigemLinha] = useState<MaterialDiaCalendario | null>(null);
  const [detalheEntrada, setDetalheEntrada] = useState<DetalheEntradaPc | null>(null);
  const [detalheAgPag, setDetalheAgPag] = useState<CotacaoDetalhe[]>([]);
  const [detalheSc, setDetalheSc] = useState<ScDetalhe[]>([]);
  const [colWidths, setColWidths] = useState<Record<ColId, number>>(() => ({ ...DEFAULT_COL_WIDTHS }));
  const colResizeRef = useRef<{ colId: ColId; startX: number; startW: number } | null>(null);
  const pcCacheRef = useRef(new Map<number, RessupAlmoxPcPendLinha[]>());
  const agPagCacheRef = useRef(new Map<number, CotacaoDetalhe[]>());
  const scCacheRef = useRef(new Map<number, ScDetalhe[]>());

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
    if (detalheEntrada) {
      setDetalheEntrada(null);
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
    id: 'calendario-materiais-dia',
    onClose: handleEscape,
    zIndex: 14100,
    enabled: open,
  });

  useEffect(() => {
    if (!open || !dataIso) {
      setLinhas([]);
      setErro(null);
      setCarregando(false);
      setOrigemLinha(null);
      setDetalheEntrada(null);
      return;
    }
    // Garante data do modal PC no formato da Consulta (evita cache ISO de sessão anterior).
    pcCacheRef.current.clear();
    agPagCacheRef.current.clear();
    scCacheRef.current.clear();
    const dataNorm = toISODate(dataIso) || dataIso;
    const setorNorm = String(setor ?? '').trim();
    const cacheKey = setorNorm ? `${dataNorm}\0${setorNorm}` : dataNorm;
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setLinhas(cached);
      setErro(null);
      setCarregando(false);
      return;
    }
    let cancelled = false;
    setCarregando(true);
    setErro(null);
    void consultarDisponibilidadeMateriaisDia(demanda, dataNorm, {
      snapshotId,
      setor: setorNorm || null,
    }).then((r) => {
      if (cancelled) return;
      setCarregando(false);
      if (r.error) {
        setErro(r.error);
        setLinhas([]);
        return;
      }
      const mats = r.data?.materiais ?? [];
      cacheRef.current.set(cacheKey, mats);
      setLinhas(mats);
    });
    return () => {
      cancelled = true;
    };
  }, [open, dataIso, demanda, cacheRef, snapshotId, setor]);

  const fetchPcPend = useCallback(
    (id: number): Promise<{ data: RessupAlmoxPcPendLinha[]; error?: string }> =>
      obterPcPendCongelado(snapshotId!, id),
    [snapshotId]
  );

  const carregarAgPag = useCallback(async () => {
    if (!detalheEntrada || detalheEntrada.tipo !== 'ag_pag') return {};
    const idProduto = detalheEntrada.linha.idProduto;
    const cached = agPagCacheRef.current.get(idProduto);
    if (cached) {
      setDetalheAgPag(cached);
      return {};
    }
    const r =
      snapshotId != null
        ? await obterAgPagCongelado(snapshotId, idProduto)
        : await obterCotacaoDetalhe(idProduto);
    if (r.error) {
      setDetalheAgPag([]);
      return { error: r.error };
    }
    agPagCacheRef.current.set(idProduto, r.data);
    setDetalheAgPag(r.data);
    return {};
  }, [detalheEntrada, snapshotId]);

  const carregarSc = useCallback(async () => {
    if (!detalheEntrada || detalheEntrada.tipo !== 'solicitacao') return {};
    const idProduto = detalheEntrada.linha.idProduto;
    const cached = scCacheRef.current.get(idProduto);
    if (cached) {
      setDetalheSc(cached);
      return {};
    }
    const r =
      snapshotId != null ? await obterScCongelado(snapshotId, idProduto) : await obterScDetalhe(idProduto);
    if (r.error) {
      setDetalheSc([]);
      return { error: r.error };
    }
    scCacheRef.current.set(idProduto, r.data);
    setDetalheSc(r.data);
    return {};
  }, [detalheEntrada, snapshotId]);

  if (!open) return null;

  const setorLabel = String(setor ?? '').trim();

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
              {setorLabel ? ` · ${setorLabel}` : ''}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {setorLabel
                ? 'Materiais em falta com consumo deste setor no dia (exclui Matéria Prima). '
                : 'Somente consumo e falta > 0 no dia (exclui Matéria Prima). '}
              Clique em <strong>Consumo</strong> para ver a origem; em <strong>Entrada PC</strong> para
              PC / Pré Compra / Solicitação. Arraste a borda das colunas para ajustar a largura.
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
                    const numeric = NUMERIC_COLS.has(colId) || colId === 'entradaDia';
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
                {grade.rowsExibidas.map((r) => {
                  const ep = entradaPcDaLinha(r);
                  return (
                    <tr
                      key={r.codigo}
                      className={`border-b border-slate-100 dark:border-slate-700 ${classStatus(r.status)}`}
                    >
                      <td className={TD}>
                        <span className="inline-flex items-center gap-1">
                          <GradeCelulaModalBtn
                            onClick={() => onAbrirItem(r.codigo, r.idProduto, r.descricao)}
                            title="Ver horizonte do material"
                            align="left"
                          >
                            {r.codigo}
                          </GradeCelulaModalBtn>
                          <CopiarTextoBtn texto={r.codigo} title="Copiar código" />
                        </span>
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
                      <td className={`${TD} text-right tabular-nums`}>
                        {ep.clicavel ? (
                          <GradeCelulaModalBtn
                            onClick={() => {
                              if (ep.fonte === 'entrada_dia' || ep.fonte === 'pc_aberta') {
                                setDetalheEntrada({ tipo: 'pc', linha: r });
                              } else if (ep.fonte === 'ag_pag') {
                                setDetalheEntrada({ tipo: 'ag_pag', linha: r });
                              } else if (ep.fonte === 'solicitacao') {
                                setDetalheEntrada({ tipo: 'solicitacao', linha: r });
                              }
                            }}
                            title={
                              ep.fonte === 'ag_pag'
                                ? 'Ver Pré Compra (Ag Pag)'
                                : ep.fonte === 'solicitacao'
                                  ? 'Ver solicitações de compra'
                                  : 'Ver pedidos de compra'
                            }
                            align="right"
                          >
                            {ep.texto}
                          </GradeCelulaModalBtn>
                        ) : (
                          ep.texto
                        )}
                      </td>
                      <td className={`${TD} text-right tabular-nums font-medium`}>{fmtNum(r.falta)}</td>
                    </tr>
                  );
                })}
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
          zIndex={14150}
        />
      )}

      {detalheEntrada?.tipo === 'pc' && (
        <ModalPcPendDetalhes
          open
          idProduto={detalheEntrada.linha.idProduto}
          codigo={detalheEntrada.linha.codigo}
          descricao={detalheEntrada.linha.descricao}
          onClose={() => setDetalheEntrada(null)}
          cacheRef={pcCacheRef}
          fetchDetalhes={snapshotId != null ? fetchPcPend : undefined}
        />
      )}

      {detalheEntrada?.tipo === 'ag_pag' && (
        <ModalConsultaEstoqueDetalhe
          open
          titulo={`Ag Pag — ${detalheEntrada.linha.codigo}`}
          subtitulo={detalheEntrada.linha.descricao}
          onClose={() => setDetalheEntrada(null)}
          detailKey={`ag-pag-${detalheEntrada.linha.idProduto}`}
          onLoad={carregarAgPag}
          backdropMode="fixed"
          zIndex={14150}
        >
          {({ carregando: c, erro: e }) => {
            if (c) return <p className="py-6 text-center text-slate-500">Carregando…</p>;
            if (e) return <p className="text-red-600">{e}</p>;
            return <TabelaDetalheCotacao linhas={detalheAgPag} />;
          }}
        </ModalConsultaEstoqueDetalhe>
      )}

      {detalheEntrada?.tipo === 'solicitacao' && (
        <ModalConsultaEstoqueDetalhe
          open
          titulo={`Solicitação de compra — ${detalheEntrada.linha.codigo}`}
          subtitulo={detalheEntrada.linha.descricao}
          onClose={() => setDetalheEntrada(null)}
          detailKey={`sc-${detalheEntrada.linha.idProduto}`}
          onLoad={carregarSc}
          backdropMode="fixed"
          zIndex={14150}
        >
          {({ carregando: c, erro: e }) => {
            if (c) return <p className="py-6 text-center text-slate-500">Carregando…</p>;
            if (e) return <p className="text-red-600">{e}</p>;
            return <TabelaDetalheSolicitacao linhas={detalheSc} />;
          }}
        </ModalConsultaEstoqueDetalhe>
      )}
    </>,
    document.body
  );
}
