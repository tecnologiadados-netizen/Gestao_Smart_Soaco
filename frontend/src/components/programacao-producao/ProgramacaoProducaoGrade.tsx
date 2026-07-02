import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ModalClassificarGrade from '../grade/ModalClassificarGrade';
import GradeFiltroExcelPortal from '../grade/GradeFiltroExcelPortal';
import GradeFiltroCabecalhoBtn from '../grade/GradeFiltroCabecalhoBtn';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import FiltroCheckboxPopover from '../grade/FiltroCheckboxPopover';
import {
  getPpCellText,
  getPpOrderLabels,
  getPpSortValue,
  gruposProdutoUnicos,
  isPpColNumeric,
  loadPpColunasOcultas,
  PP_CELL_WRAP_CLASS,
  PP_COL_DEFS,
  PP_SORT_DEFAULT,
  PP_STORAGE_COL_OCULTAS,
  PP_TH_LABEL_CLASS,
  ppColUsesTextWrap,
  type PpColKey,
} from '../../utils/programacaoProducaoGradeCells';
import { compareProgramacaoProducaoRows } from '../../utils/programacaoProducaoGradeSort';
import BotaoObservacaoCelula from '../ressupAlmox/BotaoObservacaoCelula';
import ModalObservacaoCelula from '../ressupAlmox/ModalObservacaoCelula';
import {
  clampColWidth,
  isLastVisibleFrozenCol,
  persistProgramacaoProducaoColWidths,
  PP_DEFAULT_COL_WIDTHS,
  readProgramacaoProducaoColWidths,
  stickyLeftFrozenCol,
} from '../../utils/programacaoProducaoGradeUi';
import type { DadosProgramacaoProducaoV1, LinhaProgramacaoProducao } from './types';
import {
  calcQtdeMpKg,
  formatNum,
  numInputDisplayBranco,
  parseNumInputBranco,
  somaEstoqueTotal,
  somaQtdeProduzir,
} from './programacaoProducaoCalculos';
import { validarBobinasAlternativasLinha } from '../../utils/programacaoProducaoBobinaAlternativa';
import type { ModalGradeTipo } from './ProgramacaoProducaoModals';
import ProgramacaoProducaoInventarioModal from './ProgramacaoProducaoInventarioModal';
import { textoResumoOpsNomus } from '../../utils/programacaoProducaoOpsNomus';

const BTN_PRIMARY =
  'px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition shrink-0';

const BTN_SECONDARY =
  'px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600';

const INPUT_CELL =
  'w-full min-w-0 rounded border border-slate-200 bg-white px-1 py-0.5 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100';

const INPUT_NUM =
  `${INPUT_CELL} appearance-textfield [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]`;

/** Mesmo padrão dos campos clicáveis (estoque, qtde produzir, etc.). */
const CELL_CLICKABLE =
  'block w-full truncate cursor-pointer text-primary-700 underline underline-offset-2 hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200';

type Props = {
  dados: DadosProgramacaoProducaoV1;
  /** Campos gerais (em processamento). */
  editarCamposGerais: boolean;
  /** Exibe coluna OP Nomus (processado / concluído). */
  exibirColunaOpNomus: boolean;
  /** Permite editar OPs (processado). */
  editarOpNomus: boolean;
  /** Concluída: abre modais dos campos clicáveis em somente leitura. */
  visualizarModais?: boolean;
  onChange: (dados: DadosProgramacaoProducaoV1) => void;
  onOpenModal: (modal: ModalGradeTipo) => void;
};

export default function ProgramacaoProducaoGrade({
  dados,
  editarCamposGerais,
  exibirColunaOpNomus,
  editarOpNomus,
  visualizarModais = false,
  onChange,
  onOpenModal,
}: Props) {
  const linhas = dados.linhas;
  const columnIds = useMemo(() => PP_COL_DEFS.map((c) => c.key), []);
  const [filtroGrupos, setFiltroGrupos] = useState<string[]>([]);
  const [grupoSortAsc, setGrupoSortAsc] = useState(true);
  const opcoesGrupo = useMemo(() => gruposProdutoUnicos(linhas), [linhas]);
  const opcoesGrupoOrdenadas = useMemo(() => {
    const arr = [...opcoesGrupo];
    arr.sort((a, b) =>
      grupoSortAsc ? a.localeCompare(b, 'pt-BR') : b.localeCompare(a, 'pt-BR')
    );
    return arr;
  }, [opcoesGrupo, grupoSortAsc]);
  const linhasComFiltroGrupo = useMemo(() => {
    if (!filtroGrupos.length) return linhas;
    const set = new Set(filtroGrupos);
    return linhas.filter((l) => {
      const g = l.grupo_produto?.trim();
      return g && set.has(g);
    });
  }, [linhas, filtroGrupos]);

  const [colWidths, setColWidths] = useState(readProgramacaoProducaoColWidths);
  const [colunasOcultas, setColunasOcultas] = useState<string[]>(loadPpColunasOcultas);
  const [colunasOcultasOpen, setColunasOcultasOpen] = useState(false);
  const [modalClassificarOpen, setModalClassificarOpen] = useState(false);
  const [modalInventarioOpen, setModalInventarioOpen] = useState(false);
  const [obsModal, setObsModal] = useState<{
    linha: LinhaProgramacaoProducao;
    idComponente: number;
  } | null>(null);
  const colunasOcultasRef = useRef<HTMLDivElement>(null);
  const colResizeRef = useRef<{ colKey: PpColKey; startX: number; startW: number } | null>(null);

  const grade = useGradeFiltrosExcel({
    rows: linhasComFiltroGrupo,
    columnIds,
    getCellText: getPpCellText,
    valueForSort: getPpSortValue,
    defaultSortLevels: PP_SORT_DEFAULT,
    compareRows: (a, b, levels) =>
      compareProgramacaoProducaoRows(a, b, levels),
  });


  const aplicarOrdenacaoGrupo = useCallback(
    (asc: boolean) => {
      setGrupoSortAsc(asc);
      grade.setSortLevels([]);
      grade.setSortState({ key: 'grupo_produto', direction: asc ? 'asc' : 'desc' });
    },
    [grade]
  );

  useEffect(() => {
    try {
      sessionStorage.setItem(PP_STORAGE_COL_OCULTAS, JSON.stringify(colunasOcultas));
    } catch {
      /* */
    }
  }, [colunasOcultas]);

  useEffect(() => {
    if (!colunasOcultasOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (colunasOcultasRef.current && !colunasOcultasRef.current.contains(e.target as Node)) {
        setColunasOcultasOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [colunasOcultasOpen]);

  const chavesValidas = useMemo(() => new Set(PP_COL_DEFS.map((c) => c.key)), []);

  useEffect(() => {
    setColunasOcultas((prev) => prev.filter((k) => chavesValidas.has(k as PpColKey)));
  }, [chavesValidas]);

  const colunasVisiveisLista = useMemo(
    () =>
      PP_COL_DEFS.filter((c) => {
        if (!exibirColunaOpNomus && c.key === 'ordem_producao_nomus') return false;
        return !colunasOcultas.includes(c.key);
      }),
    [colunasOcultas, exibirColunaOpNomus]
  );

  const colunasOcultasLista = useMemo(
    () => PP_COL_DEFS.filter((c) => colunasOcultas.includes(c.key)),
    [colunasOcultas]
  );

  const larguraMinimaTabela = useMemo(
    () => colunasVisiveisLista.reduce((s, c) => s + (colWidths[c.key] ?? PP_DEFAULT_COL_WIDTHS[c.key] ?? 96), 0),
    [colunasVisiveisLista, colWidths]
  );

  const visibleColKeys = useMemo(
    () => colunasVisiveisLista.map((c) => c.key),
    [colunasVisiveisLista]
  );

  const updateLinha = useCallback(
    (idComponente: number, patch: Partial<LinhaProgramacaoProducao>) => {
      onChange({
        ...dados,
        linhas: dados.linhas.map((l) => (l.idComponente === idComponente ? { ...l, ...patch } : l)),
      });
    },
    [dados, onChange]
  );

  const ocultarColuna = (key: PpColKey) => {
    if (colunasVisiveisLista.length <= 1) return;
    grade.clearColumnFilter(key);
    grade.setSortState((prev) => (prev?.key === key ? null : prev));
    setColunasOcultas((prev) => (prev.includes(key) ? prev : [...prev, key]));
  };

  const reexibirColuna = (key: PpColKey) => {
    setColunasOcultas((prev) => prev.filter((k) => k !== key));
  };

  const reexibirTodasColunas = () => {
    setColunasOcultas([]);
    setColunasOcultasOpen(false);
  };

  const onColResizePointerDown = useCallback(
    (colKey: PpColKey, e: React.PointerEvent<HTMLSpanElement>) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      colResizeRef.current = {
        colKey,
        startX: e.clientX,
        startW: colWidths[colKey] ?? PP_DEFAULT_COL_WIDTHS[colKey] ?? 96,
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
      [d.colKey]: clampColWidth(d.startW + delta),
    }));
  }, []);

  const onColResizePointerEnd = useCallback((e: React.PointerEvent<HTMLSpanElement>) => {
    if (!colResizeRef.current) return;
    colResizeRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
    setColWidths((w) => {
      persistProgramacaoProducaoColWidths(w);
      return w;
    });
  }, []);

  const renderCell = (linha: LinhaProgramacaoProducao, col: (typeof PP_COL_DEFS)[number]) => {
    const camposReadOnly = !editarCamposGerais;
    const podeAbrirModal = editarCamposGerais || visualizarModais;
    const key = col.key;
    if (key === 'descricao_simplificada') {
      const texto = linha.descricao_simplificada?.trim() || '—';
      if (!podeAbrirModal) {
        return (
          <span className={`${PP_CELL_WRAP_CLASS}`} title={texto}>
            {texto}
          </span>
        );
      }
      const abrir = () =>
        onOpenModal({
          tipo: 'descricao_simplificada',
          linha,
          idComponente: linha.idComponente,
        });
      return (
        <span
          role="button"
          tabIndex={0}
          className={`${CELL_CLICKABLE} ${PP_CELL_WRAP_CLASS}`}
          title={visualizarModais ? texto : `${texto}\n\nDuplo clique para editar`}
          onClick={visualizarModais ? abrir : undefined}
          onDoubleClick={visualizarModais ? undefined : abrir}
          onKeyDown={(e) => {
            if (e.key === 'Enter') abrir();
          }}
        >
          {texto}
        </span>
      );
    }
    if (key === 'cod_bobina_alternativa' || key === 'descricao_bobina_alternativa') {
      const cod = linha.cod_bobina_alternativa?.trim() || '—';
      const desc = linha.descricao_bobina_alternativa?.trim() || '—';
      const texto = key === 'cod_bobina_alternativa' ? cod : desc;
      if (!podeAbrirModal) {
        return <span className={PP_CELL_WRAP_CLASS}>{texto}</span>;
      }
      const abrir = () =>
        onOpenModal({
          tipo: 'bobinas_alternativas',
          linha,
          idComponente: linha.idComponente,
        });
      return (
        <span
          role="button"
          tabIndex={0}
          className={`${CELL_CLICKABLE} ${PP_CELL_WRAP_CLASS}`}
          onClick={abrir}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') abrir();
          }}
        >
          {texto}
        </span>
      );
    }
    if (key === 'qtde_mp') {
      const kg = calcQtdeMpKg(linha);
      return (
        <span className="block w-full text-right tabular-nums">
          {formatNum(kg)}
        </span>
      );
    }
    if (key === 'sequencia') {
      if (camposReadOnly) {
        const n = linha.sequencia ?? 0;
        return n === 0 ? '—' : formatNum(n, 0);
      }
      return (
        <input
          type="number"
          className={INPUT_NUM}
          value={numInputDisplayBranco(linha.sequencia)}
          onChange={(e) => {
            const n = parseNumInputBranco(e.target.value);
            updateLinha(linha.idComponente, { sequencia: n === 0 ? null : n });
          }}
        />
      );
    }
    if (key === 'ordem_producao_nomus') {
      const resumo = textoResumoOpsNomus(linha);
      if (!editarOpNomus && !visualizarModais) {
        return (
          <span className="block w-full truncate text-xs" title={resumo}>
            {resumo}
          </span>
        );
      }
      return (
        <button
          type="button"
          className={`w-full text-left text-xs truncate ${CELL_CLICKABLE}`}
          title={
            visualizarModais
              ? resumo
              : `${resumo}\n\nClique para selecionar OPs`
          }
          onClick={() =>
            onOpenModal({ tipo: 'ops_nomus', linha, idComponente: linha.idComponente })
          }
        >
          {resumo}
        </button>
      );
    }
    if (key === 'estoque') {
      const total = somaEstoqueTotal(linha);
      if (!podeAbrirModal) {
        return <span className="block w-full text-right tabular-nums">{formatNum(total)}</span>;
      }
      return (
        <button
          type="button"
          className={`w-full text-right tabular-nums ${CELL_CLICKABLE}`}
          onClick={() =>
            onOpenModal({ tipo: 'estoque', linha, idComponente: linha.idComponente })
          }
        >
          {formatNum(total)}
        </button>
      );
    }
    if (key === 'estoque_atual_bobina') {
      if (!linha.idBobina) return formatNum(linha.estoque_atual_bobina);
      return (
        <button
          type="button"
          className={`w-full text-right tabular-nums ${CELL_CLICKABLE}`}
          onClick={() => onOpenModal({ tipo: 'estoque_bobina', linha })}
        >
          {formatNum(linha.estoque_atual_bobina)}
        </button>
      );
    }
    if (key === 'estoque_mp_alternativa') {
      const errAlt =
        linha.estoque_mp_alternativa_erro ?? validarBobinasAlternativasLinha(linha);
      if (errAlt) {
        return (
          <span
            className="block w-full text-right text-xs text-red-600 dark:text-red-400 leading-tight"
            title={errAlt}
          >
            {errAlt}
          </span>
        );
      }
      const temAlters = (linha.bobinas_alternativas?.some((b) => b.cod?.trim()) ?? false);
      if (!temAlters) {
        return <span className="block w-full text-right tabular-nums">—</span>;
      }
      return (
        <button
          type="button"
          className={`w-full text-right tabular-nums ${CELL_CLICKABLE}`}
          onClick={() => onOpenModal({ tipo: 'estoque_mp_alternativa', linha })}
        >
          {formatNum(linha.estoque_mp_alternativa)}
        </button>
      );
    }
    if (key === 'qtde_produzir') {
      const sum = somaQtdeProduzir(linha.qtde_produzir);
      const hasObs = Boolean(linha.observacao?.trim());
      if (!podeAbrirModal) {
        return <span className="block w-full text-right tabular-nums">{formatNum(sum)}</span>;
      }
      return (
        <div className="flex items-center justify-end gap-1 w-full min-w-0">
          <button
            type="button"
            className={`flex-1 min-w-0 text-right tabular-nums truncate ${CELL_CLICKABLE}`}
            onClick={() => onOpenModal({ tipo: 'qtde_produzir', linha, idComponente: linha.idComponente })}
          >
            {formatNum(sum)}
          </button>
          <BotaoObservacaoCelula
            hasObservacao={hasObs}
            bloqueado={false}
            titulo={
              visualizarModais
                ? hasObs
                  ? 'Ver observação'
                  : 'Sem observação'
                : hasObs
                  ? 'Editar observação'
                  : 'Adicionar observação'
            }
            onClick={() => setObsModal({ linha, idComponente: linha.idComponente })}
          />
        </div>
      );
    }
    const alignRight = isPpColNumeric(key);
    const wrap = ppColUsesTextWrap(key);
    return (
      <span
        className={`block w-full ${alignRight ? 'text-right tabular-nums' : ''} ${
          wrap ? PP_CELL_WRAP_CLASS : ''
        }`}
      >
        {getPpCellText(linha, key)}
      </span>
    );
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-1">
      <div className="flex flex-wrap items-center justify-between gap-1.5 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {editarCamposGerais && (
            <>
              <button
                type="button"
                onClick={() => {
                  grade.limparFiltrosGrade();
                  setFiltroGrupos([]);
                }}
                className={BTN_PRIMARY}
              >
                Limpar filtros da grade
              </button>
              <button
                type="button"
                onClick={() => setModalInventarioOpen(true)}
                className={BTN_SECONDARY}
                title="Baixar modelo ou enviar planilha de estoque em produção"
              >
                Inventário
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setModalClassificarOpen(true)}
            disabled={linhas.length === 0}
            className={BTN_SECONDARY}
            title="Definir classificação personalizada (vários níveis)"
          >
            Classificar
          </button>
          {opcoesGrupo.length > 0 && (
            <FiltroCheckboxPopover
              label="Grupo"
              options={opcoesGrupoOrdenadas}
              selected={filtroGrupos}
              onChange={setFiltroGrupos}
              disabled={linhas.length === 0}
              sortAsc={grupoSortAsc}
              onSortAsc={() => aplicarOrdenacaoGrupo(true)}
              onSortDesc={() => aplicarOrdenacaoGrupo(false)}
            />
          )}
        </div>
        {colunasOcultasLista.length > 0 && (
          <div className="relative" ref={colunasOcultasRef}>
            <button
              type="button"
              onClick={() => setColunasOcultasOpen((o) => !o)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Colunas ocultas
              <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-700 dark:bg-primary-900/40 dark:text-primary-200">
                {colunasOcultasLista.length}
              </span>
            </button>
            {colunasOcultasOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-600 dark:bg-slate-800">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2 dark:border-slate-600">
                  <p className="text-sm font-semibold">Reexibir colunas</p>
                  <button
                    type="button"
                    onClick={reexibirTodasColunas}
                    className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-300"
                  >
                    Reexibir todas
                  </button>
                </div>
                <div className="mt-2 max-h-64 overflow-auto">
                  {colunasOcultasLista.map((col) => (
                    <button
                      key={col.key}
                      type="button"
                      onClick={() => reexibirColuna(col.key)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <span className="truncate">{col.label}</span>
                      <span className="shrink-0 text-xs font-medium text-primary-600 dark:text-primary-300">
                        Reexibir
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div
          ref={grade.tableScrollRef}
          className="min-h-0 flex-1 overflow-auto overscroll-contain max-h-[calc(100vh-11rem)]"
        >
          <table
            className="w-full border-separate border-spacing-0 text-left text-sm"
            style={{ tableLayout: 'fixed', minWidth: larguraMinimaTabela }}
          >
            <colgroup>
              {colunasVisiveisLista.map((col) => (
                <col
                  key={col.key}
                  style={{ width: colWidths[col.key] ?? PP_DEFAULT_COL_WIDTHS[col.key] ?? 96 }}
                />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-primary-600 text-white">
                {colunasVisiveisLista.map((col) => {
                  const sortAtivo =
                    grade.sortState?.key === col.key ||
                    grade.sortLevels.some((l) => l.id === col.key);
                  const stickyLeft = stickyLeftFrozenCol(col.key, visibleColKeys, colWidths);
                  const lastFrozen = isLastVisibleFrozenCol(col.key, visibleColKeys);
                  return (
                    <th
                      key={col.key}
                      style={stickyLeft !== undefined ? { left: stickyLeft } : undefined}
                      className={`relative sticky top-0 border border-primary-500/40 bg-primary-600 px-1.5 py-2 align-top font-semibold shadow-[0_1px_0_rgba(0,0,0,0.08)] ${
                        stickyLeft !== undefined
                          ? `z-40 ${lastFrozen ? 'shadow-[4px_0_6px_-2px_rgba(0,0,0,0.15)]' : 'z-40'}`
                          : 'z-30'
                      }`}
                    >
                      <div className="flex min-w-0 items-start justify-between gap-1">
                        <span className={PP_TH_LABEL_CLASS} title={col.label}>
                          {col.label}
                        </span>
                        <span className="flex shrink-0 flex-col gap-0.5">
                          <GradeFiltroCabecalhoBtn
                            ativo={grade.colunaComFiltroAtivo(col.key) || sortAtivo}
                            onClick={(e) => grade.abrirFiltroExcel(col.key, e)}
                          />
                          <button
                            type="button"
                            onClick={() => ocultarColuna(col.key)}
                            disabled={colunasVisiveisLista.length <= 1}
                            className="inline-flex items-center justify-center rounded border border-white/25 px-1 py-0.5 text-white/80 hover:bg-white/15 disabled:opacity-40"
                            title="Ocultar coluna"
                            aria-label={`Ocultar coluna ${col.label}`}
                          >
                            <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 3l18 18M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58M9.88 5.08A9.77 9.77 0 0112 4c5 0 8.27 4.11 9.54 6.06a1.75 1.75 0 010 1.88 16.2 16.2 0 01-2.1 2.64M6.1 6.1a16.46 16.46 0 00-3.64 3.96 1.75 1.75 0 000 1.88C3.73 13.89 7 18 12 18a9.77 9.77 0 004.17-.94"
                              />
                            </svg>
                          </button>
                        </span>
                      </div>
                      <span
                        role="separator"
                        aria-orientation="vertical"
                        className="absolute right-0 top-0 z-20 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-sky-300/60 active:bg-sky-300"
                        onPointerDown={(e) => onColResizePointerDown(col.key, e)}
                        onPointerMove={onColResizePointerMove}
                        onPointerUp={onColResizePointerEnd}
                        onPointerCancel={onColResizePointerEnd}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-200 divide-y divide-slate-200 dark:divide-slate-600">
              {linhas.length === 0 && (
                <tr>
                  <td
                    colSpan={colunasVisiveisLista.length}
                    className="py-6 px-3 text-center text-slate-500 dark:text-slate-400 text-xs"
                  >
                    Nenhuma linha na grade.
                  </td>
                </tr>
              )}
              {linhas.length > 0 && grade.rowsExibidas.length === 0 && (
                <tr>
                  <td
                    colSpan={colunasVisiveisLista.length}
                    className="py-6 px-3 text-center text-slate-500 dark:text-slate-400 text-xs"
                  >
                    Nenhuma linha com os filtros da grade. Ajuste ou limpe os filtros por coluna.
                  </td>
                </tr>
              )}
              {grade.rowsExibidas.map((linha) => (
                <tr
                  key={linha.idComponente}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30"
                >
                  {colunasVisiveisLista.map((col) => {
                    const stickyLeft = stickyLeftFrozenCol(col.key, visibleColKeys, colWidths);
                    const lastFrozen = isLastVisibleFrozenCol(col.key, visibleColKeys);
                    return (
                      <td
                        key={col.key}
                        style={stickyLeft !== undefined ? { left: stickyLeft } : undefined}
                        className={`border border-slate-100 dark:border-slate-700 px-1.5 py-1 align-top text-xs ${
                          ppColUsesTextWrap(col.key) ? 'overflow-visible' : 'overflow-hidden'
                        } ${
                          stickyLeft !== undefined
                            ? `sticky z-20 bg-white dark:bg-slate-800 ${
                                lastFrozen ? 'shadow-[4px_0_6px_-2px_rgba(0,0,0,0.08)]' : ''
                              }`
                            : ''
                        }`}
                      >
                        {renderCell(linha, col)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
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
          onSortAsc={() => {}}
          onSortDesc={() => {}}
          deferSortUntilApply
          applyButtonLabel="Ordenar"
          onAplicar={grade.confirmarMenuExcelColuna}
          onCancelar={grade.fecharFiltroExcel}
          sortAscLabel={getPpOrderLabels(grade.colunaFiltroAberta).asc}
          sortDescLabel={getPpOrderLabels(grade.colunaFiltroAberta).desc}
          showNumericFilters={isPpColNumeric(grade.colunaFiltroAberta)}
        />
      )}

      <ModalClassificarGrade
        open={modalClassificarOpen}
        onClose={() => setModalClassificarOpen(false)}
        colunas={[
          ...PP_COL_DEFS.map((c) => ({ id: c.key, label: c.label })),
          { id: 'grupo_produto', label: 'Grupo' },
        ]}
        initialLevels={grade.sortLevels.length > 0 ? grade.sortLevels : PP_SORT_DEFAULT}
        onApply={(levels) => {
          grade.setSortLevels(levels);
          grade.setSortState(null);
        }}
        getOrderLabels={getPpOrderLabels}
      />

      {modalInventarioOpen && editarCamposGerais && (
        <ProgramacaoProducaoInventarioModal
          linhas={linhas}
          onClose={() => setModalInventarioOpen(false)}
          onApply={(linhasAtualizadas) => onChange({ ...dados, linhas: linhasAtualizadas })}
        />
      )}

      <ModalObservacaoCelula
        open={obsModal != null}
        tituloColuna="Observação"
        codigo={obsModal?.linha.cod_componente ?? ''}
        descricao={obsModal?.linha.descricao_simplificada?.trim() || obsModal?.linha.descricao_componente || ''}
        valorInicial={obsModal?.linha.observacao ?? ''}
        somenteLeitura={!editarCamposGerais || visualizarModais}
        onClose={() => setObsModal(null)}
        onSalvar={(texto) => {
          if (!obsModal) return;
          updateLinha(obsModal.idComponente, { observacao: texto || null });
        }}
      />
    </div>
  );
}
