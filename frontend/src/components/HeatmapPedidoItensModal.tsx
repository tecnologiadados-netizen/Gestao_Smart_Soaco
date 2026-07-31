import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TooltipDetalheRow } from '../api/pedidos';
import { formatDataCurta } from './sequenciamento-carradas/simulacaoCarradas';
import IndicadorDataPorPrevisao from './sequenciamento-carradas/IndicadorDataPorPrevisao';
import { labelPedidoMapa } from '../utils/mapaMunicipioPedido';
import { formatQtdeParaInput } from '../utils/heatmapAjusteCargaGradeUi';
import { useGradeFiltrosExcel } from '../hooks/useGradeFiltrosExcel';
import GradeFiltroCabecalhoBtn from './grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from './grade/GradeFiltroExcelPortal';
import { useRegisterModalEscape } from '../contexts/ModalStackContext';
import ModalConsultaEstoqueEmbed from './pcp/ModalConsultaEstoqueEmbed';
import GradeCelulaModalBtn from './pcp/GradeCelulaModalBtn';
import CopiarTextoBtn, { numeroPedidoLimpo } from './CopiarTextoBtn';
import { LABEL_CARRADA_EM_FORMACAO } from '../utils/rotaCarrada';

function formatarValor(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
}

function IconAjustarPrevisao() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function formatDataColuna(value: string | undefined): string {
  const iso = String(value ?? '').trim().slice(0, 10);
  if (!iso) return '—';
  return formatDataCurta(iso);
}

function formatQtde(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  return formatQtdeParaInput(n);
}

/** Formata data ISO (YYYY-MM-DD) para dd/MM/yyyy sem mudar o dia por fuso. */
function formatDataEmissao(value: string | undefined): string | null {
  const s = String(value ?? '').trim();
  if (!s) return null;
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pt-BR');
}

function itemKey(row: TooltipDetalheRow): string {
  return `${row.codigo}\0${row.rota}`;
}

function textoDataProducao(row: TooltipDetalheRow): string {
  return formatDataColuna(
    row.producaoPorPrevisao ? row.dataCalendario ?? row.previsaoAtual : row.dataProducao
  );
}

function textoPrevisao(row: TooltipDetalheRow): string {
  if (row.carradaEmFormacao) return LABEL_CARRADA_EM_FORMACAO;
  return formatDataColuna(row.previsaoAtual);
}

const COLS = ['dataProducao', 'previsao', 'codigo', 'descricao', 'qtde', 'valor'] as const;
type ColId = (typeof COLS)[number];

const COL_LABELS: Record<ColId, string> = {
  dataProducao: 'Data de produção',
  previsao: 'Previsão atual',
  codigo: 'Cód.',
  descricao: 'Descrição',
  qtde: 'Qtde',
  valor: 'Valor',
};

const COLS_NUMERICAS = new Set<string>(['qtde', 'valor']);

/** Acima do HeatmapPedidoItensModal (z 14000). */
const Z_CONSULTA_ESTOQUE = 14100;
const Z_FILTRO_EXCEL = 14050;

function getCellText(row: TooltipDetalheRow, colId: string): string {
  switch (colId) {
    case 'dataProducao':
      return textoDataProducao(row);
    case 'previsao':
      return textoPrevisao(row);
    case 'codigo':
      return row.codigo ?? '';
    case 'descricao':
      return row.produto ?? '';
    case 'qtde':
      return formatQtde(row.qtdePendenteReal ?? 0);
    case 'valor':
      return formatarValor(row.valorPendente ?? 0);
    default:
      return '';
  }
}

function valueForSort(row: TooltipDetalheRow, colId: string): string | number {
  switch (colId) {
    case 'dataProducao': {
      const iso = String(
        row.producaoPorPrevisao ? row.dataCalendario ?? row.previsaoAtual : row.dataProducao ?? ''
      )
        .trim()
        .slice(0, 10);
      return iso || '';
    }
    case 'previsao':
      return String(row.previsaoAtual ?? '').trim().slice(0, 10);
    case 'qtde':
      return row.qtdePendenteReal ?? 0;
    case 'valor':
      return row.valorPendente ?? 0;
    default:
      return getCellText(row, colId);
  }
}

export default function HeatmapPedidoItensModal({
  open,
  linha,
  municipioLabel,
  itens,
  setorDestaque,
  onClose,
  podeReprogramar = false,
  onReprogramar,
  selecaoInicial,
}: {
  open: boolean;
  linha: TooltipDetalheRow;
  municipioLabel: string;
  itens: TooltipDetalheRow[];
  /** Quando informado, destaca linhas cujo setor de produção coincide. */
  setorDestaque?: string;
  onClose: () => void;
  /** Exibe seleção + botão Reprogramar (calendário do sequenciamento). */
  podeReprogramar?: boolean;
  /** Itens marcados (ou todos, se o usuário marcar o cabeçalho). */
  onReprogramar?: (itens: TooltipDetalheRow[]) => void;
  /** Keys (`codigo\0rota`) a restaurar ao reabrir após Cancelar/ESC do ajuste. */
  selecaoInicial?: string[];
}) {
  const [consultaCodigo, setConsultaCodigo] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());
  const masterCheckRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<string | null>(null);

  const rowsBase = useMemo(
    () =>
      [...itens].sort((a, b) =>
        (a.produto ?? '').localeCompare(b.produto ?? '', 'pt-BR', { sensitivity: 'base' })
      ),
    [itens]
  );

  const grade = useGradeFiltrosExcel({
    rows: rowsBase,
    columnIds: [...COLS],
    getCellText,
    valueForSort,
  });

  const limparGradeRef = useRef(grade.limparFiltrosGrade);
  limparGradeRef.current = grade.limparFiltrosGrade;

  const selecaoInicialKey = (selecaoInicial ?? []).join('\n');

  useEffect(() => {
    if (!open) return;
    limparGradeRef.current();
    setSelecionados(new Set(selecaoInicial ?? []));
    setConsultaCodigo(null);
    setToast(null);
    // selecaoInicialKey estabiliza o array por conteúdo
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hidratar só ao abrir/trocar PD ou keys
  }, [open, linha.pedido, selecaoInicialKey]);

  const filtrados = grade.rowsExibidas;

  const totalQtde = useMemo(
    () => filtrados.reduce((s, r) => s + (r.qtdePendenteReal ?? 0), 0),
    [filtrados]
  );
  const totalValor = useMemo(
    () => filtrados.reduce((s, r) => s + (r.valorPendente ?? 0), 0),
    [filtrados]
  );

  const keysVisiveis = useMemo(() => filtrados.map(itemKey), [filtrados]);
  const estadoMaster = useMemo(() => {
    const n = keysVisiveis.length;
    if (n === 0) return { todos: false, alguns: false };
    let marcados = 0;
    for (const k of keysVisiveis) {
      if (selecionados.has(k)) marcados++;
    }
    return { todos: marcados === n, alguns: marcados > 0 };
  }, [keysVisiveis, selecionados]);

  useEffect(() => {
    const el = masterCheckRef.current;
    if (!el) return;
    el.indeterminate = estadoMaster.alguns && !estadoMaster.todos;
  }, [estadoMaster]);

  const qtdSelecionados = selecionados.size;

  const handleEscape = useCallback(() => {
    if (consultaCodigo) {
      setConsultaCodigo(null);
      return;
    }
    if (grade.colunaFiltroAberta) {
      grade.fecharFiltroExcel();
      return;
    }
    onClose();
  }, [consultaCodigo, grade, onClose]);

  useRegisterModalEscape({
    id: `heatmap-pedido-itens`,
    onClose: handleEscape,
    zIndex: 14000,
    enabled: open,
  });

  if (!open) return null;

  const titulo = labelPedidoMapa(linha.pedido);
  const pdNum = numeroPedidoLimpo(linha.pedido);
  const dataEmissaoFmt = formatDataEmissao(linha.dataEmissao);
  const clienteLabel = String(linha.cliente ?? '').trim();
  const tipoPedidoLabel = String(linha.tipoPedido ?? '').trim();
  const meta = [linha.rota, linha.rm ? `RM ${linha.rm}` : ''].filter(Boolean).join(' · ');

  const toggleMaster = () => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (estadoMaster.todos) {
        for (const k of keysVisiveis) next.delete(k);
      } else {
        for (const k of keysVisiveis) next.add(k);
      }
      return next;
    });
  };

  const toggleItem = (key: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleReprogramar = () => {
    if (!onReprogramar) return;
    if (selecionados.size === 0) {
      setToast('Selecione ao menos um item para reprogramar.');
      setTimeout(() => setToast(null), 3000);
      return;
    }
    const escolhidos = rowsBase.filter((row) => selecionados.has(itemKey(row)));
    if (escolhidos.length === 0) return;
    onReprogramar(escolhidos);
  };

  const colSpanTotal = podeReprogramar ? 5 : 4;
  const colAbertaNumerica =
    !!grade.colunaFiltroAberta && COLS_NUMERICAS.has(grade.colunaFiltroAberta);

  const renderTh = (colId: ColId) => {
    const numeric = COLS_NUMERICAS.has(colId);
    return (
      <th
        key={colId}
        className={`sticky top-0 z-10 whitespace-nowrap border border-slate-600/80 bg-slate-700 py-2 px-2 font-semibold text-white ${
          numeric ? 'text-right' : 'text-left'
        }`}
      >
        <div className={`flex items-center gap-1 ${numeric ? 'justify-end' : 'justify-between'}`}>
          <span>{COL_LABELS[colId]}</span>
          <GradeFiltroCabecalhoBtn
            ativo={grade.colunaComFiltroAtivo(colId)}
            onClick={(e) => grade.abrirFiltroExcel(colId, e)}
          />
        </div>
      </th>
    );
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[14000] flex items-center justify-center bg-black/70 p-4"
        role="presentation"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <div
          className="flex max-h-[min(85vh,560px)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
          role="dialog"
          aria-modal
          aria-labelledby="heatmap-pedido-itens-titulo"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3
                  id="heatmap-pedido-itens-titulo"
                  className="inline-flex flex-wrap items-center gap-1 text-sm font-semibold text-slate-800 dark:text-slate-100"
                >
                  <span>{titulo}</span>
                  <CopiarTextoBtn texto={pdNum} title="Copiar número do pedido" />
                  {dataEmissaoFmt ? (
                    <span className="ml-1 font-normal text-slate-500 dark:text-slate-400">
                      · {dataEmissaoFmt}
                    </span>
                  ) : null}
                </h3>
                {clienteLabel ? (
                  <p className="mt-0.5 text-xs font-medium text-slate-700 dark:text-slate-200">
                    {clienteLabel}
                  </p>
                ) : null}
                {tipoPedidoLabel ? (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{tipoPedidoLabel}</p>
                ) : null}
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{municipioLabel}</p>
                {meta && (
                  <p
                    className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400"
                    title={meta}
                  >
                    {meta}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {Object.keys(grade.columnFilters).length > 0 ? (
                  <button
                    type="button"
                    onClick={() => grade.limparFiltrosGrade()}
                    className="rounded-lg px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Limpar filtros
                  </button>
                ) : null}
                {podeReprogramar && onReprogramar && rowsBase.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleReprogramar}
                    className="inline-flex items-center gap-1 rounded-lg border border-primary-500/60 px-2 py-1 text-[11px] font-medium text-primary-700 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-900/30"
                    title="Reprogramar datas dos itens selecionados"
                  >
                    <IconAjustarPrevisao />
                    {qtdSelecionados > 0
                      ? qtdSelecionados >= rowsBase.length
                        ? 'Reprogramar (Todos)'
                        : `Reprogramar (${qtdSelecionados})`
                      : 'Reprogramar'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-700"
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto overscroll-contain px-4 py-3">
            {setorDestaque ? (
              <p className="mb-2 text-[11px] text-slate-500 dark:text-slate-400">
                Itens do setor{' '}
                <span className="font-medium text-sky-700 dark:text-sky-300">{setorDestaque}</span>{' '}
                destacados em azul.
              </p>
            ) : null}
            {rowsBase.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                Nenhum item encontrado para este pedido.
              </p>
            ) : (
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    {podeReprogramar ? (
                      <th className="sticky top-0 z-10 w-8 border border-slate-600/80 bg-slate-700 py-2 px-1">
                        <input
                          ref={masterCheckRef}
                          type="checkbox"
                          checked={estadoMaster.todos}
                          onChange={toggleMaster}
                          className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                          title="Selecionar todos os itens visíveis"
                          aria-label="Selecionar todos os itens visíveis"
                          disabled={keysVisiveis.length === 0}
                        />
                      </th>
                    ) : null}
                    {COLS.map(renderTh)}
                  </tr>
                </thead>
                <tbody className="text-slate-700 dark:text-slate-200">
                  {filtrados.length === 0 ? (
                    <tr>
                      <td
                        colSpan={podeReprogramar ? 7 : 6}
                        className="py-6 text-center text-sm text-slate-500"
                      >
                        Nenhum item corresponde aos filtros.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {filtrados.map((row, i) => {
                        const key = itemKey(row);
                        const doSetorAnalisado =
                          !!setorDestaque &&
                          (row.setorProducao || '(vazio)') === setorDestaque;
                        return (
                          <tr
                            key={`${key}-${i}`}
                            className={`border-b border-slate-100 dark:border-slate-700 ${
                              doSetorAnalisado ? 'bg-sky-100/90 dark:bg-sky-900/45' : ''
                            }`}
                            title={
                              doSetorAnalisado
                                ? `Item do setor analisado: ${setorDestaque}`
                                : undefined
                            }
                          >
                            {podeReprogramar ? (
                              <td className="py-1.5 pr-1 pl-1">
                                <input
                                  type="checkbox"
                                  checked={selecionados.has(key)}
                                  onChange={() => toggleItem(key)}
                                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                  aria-label={`Selecionar item ${row.codigo || row.produto || ''}`}
                                />
                              </td>
                            ) : null}
                            <td className="whitespace-nowrap py-1.5 px-2 tabular-nums">
                              <span className="inline-flex items-center gap-1">
                                {textoDataProducao(row)}
                                {row.producaoPorPrevisao ? <IndicadorDataPorPrevisao /> : null}
                              </span>
                            </td>
                            <td className="whitespace-nowrap py-1.5 px-2 tabular-nums">
                              {row.carradaEmFormacao ? (
                                <span
                                  className="font-medium text-amber-700 dark:text-amber-300"
                                  title="Entrega/previsão não definida — carrada em formação"
                                >
                                  {LABEL_CARRADA_EM_FORMACAO}
                                </span>
                              ) : (
                                formatDataColuna(row.previsaoAtual)
                              )}
                            </td>
                            <td className="py-1.5 px-2 font-mono">
                              {row.codigo ? (
                                <GradeCelulaModalBtn
                                  onClick={() => setConsultaCodigo(row.codigo)}
                                  title={`Consultar estoque de ${row.codigo}`}
                                  align="left"
                                >
                                  {row.codigo}
                                </GradeCelulaModalBtn>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="max-w-[220px] py-1.5 px-2 break-words">
                              {row.produto || '—'}
                            </td>
                            <td className="py-1.5 px-2 text-right tabular-nums">
                              {formatQtde(row.qtdePendenteReal ?? 0)}
                            </td>
                            <td className="py-1.5 px-2 text-right tabular-nums">
                              {formatarValor(row.valorPendente ?? 0)}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-amber-200 bg-amber-50/80 font-semibold dark:border-amber-800 dark:bg-amber-900/30">
                        <td className="py-2 px-2" colSpan={colSpanTotal}>
                          Total
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">{formatQtde(totalQtde)}</td>
                        <td className="py-2 px-2 text-right tabular-nums">
                          {formatarValor(totalValor)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex shrink-0 justify-end border-t border-slate-200 px-4 py-3 dark:border-slate-600">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-200"
            >
              Fechar
            </button>
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
          sortAscLabel={colAbertaNumerica ? 'Menor para Maior' : undefined}
          sortDescLabel={colAbertaNumerica ? 'Maior para Menor' : undefined}
          showNumericFilters={colAbertaNumerica}
          zIndex={Z_FILTRO_EXCEL}
        />
      )}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-[14050] -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
          {toast}
        </div>
      ) : null}
      {consultaCodigo ? (
        <ModalConsultaEstoqueEmbed
          codigo={consultaCodigo}
          onClose={() => setConsultaCodigo(null)}
          zIndexBase={Z_CONSULTA_ESTOQUE}
        />
      ) : null}
    </>,
    document.body
  );
}
