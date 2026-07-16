import { useMemo, useRef, type KeyboardEvent, type MutableRefObject } from 'react';
import { Calendar } from 'lucide-react';
import { formatDataCurta, hojeISO, toISODate, type CarradaDataInvalida } from './simulacaoCarradas';
import { labelPedidoMapa } from '../../utils/mapaMunicipioPedido';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import GradeFiltroCabecalhoBtn from '../grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../grade/GradeFiltroExcelPortal';
import {
  clearDatePickerAberto,
  DATE_COL_KEYS,
  focusSeqDateInput,
  onDateInputToggleBlur,
  onDateInputToggleClick,
  type DateColKey,
} from './sequenciamentoGradeUi';
import {
  agruparInvalidasPorPedido,
  chavePedidoGrupo,
  itemCampoDiverge,
  type GrupoInvalidasPorPedido,
} from './corrigirDatasSequenciamentoUtils';

const TR_ROW =
  'border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50/60 dark:hover:bg-slate-700/30';

const TR_CONCLUIDA =
  'border-b border-slate-100 dark:border-slate-700 bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/55';

const TD_MESCLADA = 'px-2 py-2 align-middle text-center text-slate-800 dark:text-slate-200';

function classeLinhaCorrigir(
  c: CarradaDataInvalida,
  divergeProducao: boolean,
  divergeEntrega: boolean
): string {
  if (c.concluida) return TR_CONCLUIDA;
  if (divergeProducao || divergeEntrega) {
    return `${TR_ROW} bg-amber-50/40 dark:bg-amber-950/20`;
  }
  return TR_ROW;
}

const DATE_INPUT_CLASS =
  'w-[8rem] rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100';

const TH_STICKY =
  'sticky top-0 z-20 border border-primary-500/40 bg-primary-600 px-2 py-2 text-left font-semibold text-white shadow-[0_1px_0_rgba(0,0,0,0.12)]';

const COLS_ITEM = ['pedido', 'cliente', 'codigo', 'descricao', 'carrada', 'dataProducao', 'dataEntrega'] as const;
const COLS_CARRADA = ['cod', 'carrada', 'dataProducao', 'dataEntrega'] as const;

const COL_LABELS: Record<string, string> = {
  pedido: 'Pedido',
  cliente: 'Cliente',
  codigo: 'Código',
  descricao: 'Descrição',
  carrada: 'Carrada',
  cod: 'Cód',
  dataProducao: 'Data de produção',
  dataEntrega: 'Data de entrega',
};

type Props = {
  invalidas: CarradaDataInvalida[];
  onEditar: (key: string, campo: 'dataProducao' | 'dataEntrega', value: string) => void;
  onContinuar: () => void;
  onClose: () => void;
};

function textoCelulaFiltro(c: CarradaDataInvalida, colId: string): string {
  switch (colId) {
    case 'pedido':
      return labelPedidoMapa(c.pedido ?? '—');
    case 'cliente':
      return c.cliente || '—';
    case 'codigo':
      return c.codigoProduto || c.cod || '—';
    case 'descricao':
      return c.descricaoProduto || '—';
    case 'carrada':
      return c.carrada;
    case 'cod':
      return c.cod;
    case 'dataProducao':
      return c.dataProducao ? formatDataCurta(c.dataProducao) : '—';
    case 'dataEntrega':
      return c.dataEntrega ? formatDataCurta(c.dataEntrega) : '—';
    default:
      return '';
  }
}

type EntryAgrupada =
  | { kind: 'grupo'; grupo: GrupoInvalidasPorPedido }
  | { kind: 'carrada'; row: CarradaDataInvalida };

function PedidoLoteDataPicker({
  titulo,
  onSelecionar,
  iconClassName = '',
}: {
  titulo: string;
  onSelecionar: (value: string) => void;
  iconClassName?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className={`rounded p-0.5 hover:bg-slate-200/80 dark:hover:bg-slate-600/50 ${iconClassName}`}
        title={titulo}
        aria-label={titulo}
        onClick={(e) => {
          e.stopPropagation();
          const input = inputRef.current;
          if (!input) return;
          input.showPicker?.();
          input.focus();
        }}
      >
        <Calendar className="h-4 w-4" aria-hidden />
      </button>
      <input
        ref={inputRef}
        type="date"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const value = e.target.value;
          if (value) onSelecionar(value);
          e.target.value = '';
        }}
      />
    </span>
  );
}

function renderInputsDataItem(
  c: CarradaDataInvalida,
  opts: {
    divergeProducao?: boolean;
    divergeEntrega?: boolean;
    datePickerAbertoRef: MutableRefObject<string | null>;
    onEditar: Props['onEditar'];
    handleDateKey: (e: KeyboardEvent<HTMLInputElement>, rowKey: string, colKey: DateColKey) => void;
    replicarProducaoNaEntrega: (key: string, dataProducao: string) => void;
  }
) {
  const {
    divergeProducao = false,
    divergeEntrega = false,
    datePickerAbertoRef,
    onEditar,
    handleDateKey,
    replicarProducaoNaEntrega,
  } = opts;

  return (
    <>
      <td className="px-2 py-2 align-middle">
        <input
          type="date"
          className={`${DATE_INPUT_CLASS} ${
            c.producaoPassada ? 'border-red-400 ring-1 ring-red-300' : ''
          } ${divergeProducao ? 'border-amber-400 ring-1 ring-amber-200' : ''}`}
          value={toISODate(c.dataProducao)}
          data-editinput
          data-rowkey={c.key}
          data-colkey="dataProducao"
          onChange={(e) => {
            clearDatePickerAberto(datePickerAbertoRef);
            onEditar(c.key, 'dataProducao', e.target.value);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') clearDatePickerAberto(datePickerAbertoRef);
            handleDateKey(e, c.key, 'dataProducao');
          }}
          onClick={(e) => onDateInputToggleClick(e, `${c.key}:dataProducao`, datePickerAbertoRef)}
          onBlur={() => onDateInputToggleBlur(`${c.key}:dataProducao`, datePickerAbertoRef)}
        />
      </td>
      <td className="w-8 px-1 py-2 text-center align-middle">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            replicarProducaoNaEntrega(c.key, c.dataProducao);
          }}
          disabled={!c.dataProducao}
          className="rounded px-1.5 py-0.5 text-xs font-medium text-primary-700 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-primary-300 dark:hover:bg-primary-900/30"
          title="Replicar produção na entrega"
          aria-label="Replicar produção na entrega"
        >
          →
        </button>
      </td>
      <td className="px-2 py-2 pr-4 align-middle">
        <input
          type="date"
          className={`${DATE_INPUT_CLASS} ${
            c.entregaPassada ? 'border-red-400 ring-1 ring-red-300' : ''
          } ${divergeEntrega ? 'border-amber-400 ring-1 ring-amber-200' : ''}`}
          value={toISODate(c.dataEntrega)}
          data-editinput
          data-rowkey={c.key}
          data-colkey="dataEntrega"
          onChange={(e) => {
            clearDatePickerAberto(datePickerAbertoRef);
            onEditar(c.key, 'dataEntrega', e.target.value);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') clearDatePickerAberto(datePickerAbertoRef);
            handleDateKey(e, c.key, 'dataEntrega');
          }}
          onClick={(e) => onDateInputToggleClick(e, `${c.key}:dataEntrega`, datePickerAbertoRef)}
          onBlur={() => onDateInputToggleBlur(`${c.key}:dataEntrega`, datePickerAbertoRef)}
        />
      </td>
    </>
  );
}

export default function ModalCorrigirDatasSequenciamento({
  invalidas,
  onEditar,
  onContinuar,
  onClose,
}: Props) {
  const hoje = hojeISO();
  const aindaInvalidas = invalidas.some((c) => !c.concluida);
  const qtdConcluidas = invalidas.filter((c) => c.concluida).length;
  const temPrevisaoVencida = invalidas.some((c) => c.previsaoPassada);
  const temItensPedido = invalidas.some((c) => c.idPedido);
  const datePickerAbertoRef = useRef<string | null>(null);

  const columnIds = useMemo(
    () => (temItensPedido ? [...COLS_ITEM] : [...COLS_CARRADA]),
    [temItensPedido]
  );

  const grade = useGradeFiltrosExcel<CarradaDataInvalida>({
    rows: invalidas,
    columnIds,
    getCellText: textoCelulaFiltro,
    valueForSort: textoCelulaFiltro,
    defaultSortLevels: [],
  });

  const linhasExibidas = grade.rowsExibidas;

  const entriesAgrupadas = useMemo((): EntryAgrupada[] | null => {
    if (!temItensPedido) return null;
    const gruposMap = new Map<string, GrupoInvalidasPorPedido>();
    for (const g of agruparInvalidasPorPedido(linhasExibidas.filter((r) => r.idPedido))) {
      gruposMap.set(g.pedidoChave, g);
    }
    const seen = new Set<string>();
    const entries: EntryAgrupada[] = [];
    for (const row of linhasExibidas) {
      if (row.idPedido) {
        const chave = chavePedidoGrupo(row.pedido);
        if (!seen.has(chave)) {
          seen.add(chave);
          const grupo = gruposMap.get(chave);
          if (grupo) entries.push({ kind: 'grupo', grupo });
        }
      } else {
        entries.push({ kind: 'carrada', row });
      }
    }
    return entries;
  }, [temItensPedido, linhasExibidas]);

  const dateFocusKeys = useMemo(() => linhasExibidas.map((c) => c.key), [linhasExibidas]);

  const editarPedido = (
    grupo: GrupoInvalidasPorPedido,
    campo: 'dataProducao' | 'dataEntrega',
    value: string
  ) => {
    for (const item of grupo.itens) onEditar(item.key, campo, value);
  };

  const replicarProducaoNaEntrega = (key: string, dataProducao: string) => {
    if (!dataProducao) return;
    onEditar(key, 'dataEntrega', dataProducao);
  };

  const replicarProducaoNaEntregaTodas = () => {
    for (const c of invalidas) {
      if (c.dataProducao) onEditar(c.key, 'dataEntrega', c.dataProducao);
    }
  };

  const handleEscape = () => {
    if (grade.colunaFiltroAberta) {
      grade.fecharFiltroExcel();
      return;
    }
    onClose();
  };

  useRegisterModalEscape({ id: 'seq-corrigir-datas', onClose: handleEscape, zIndex: 140 });

  const handleDateKey = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowKey: string,
    colKey: DateColKey
  ) => {
    if (e.key !== 'Tab' && e.key !== 'Enter') return;
    if (e.key === 'Tab') {
      e.preventDefault();
      const colIdx = DATE_COL_KEYS.indexOf(colKey);
      const nextColIdx = e.shiftKey ? colIdx - 1 : colIdx + 1;
      if (nextColIdx >= 0 && nextColIdx < DATE_COL_KEYS.length) {
        focusSeqDateInput(rowKey, DATE_COL_KEYS[nextColIdx]!);
      }
      return;
    }
    e.preventDefault();
    const keys = dateFocusKeys;
    const rowIdx = keys.indexOf(rowKey);
    const targetIdx = e.shiftKey ? rowIdx - 1 : rowIdx + 1;
    if (targetIdx < 0 || targetIdx >= keys.length) return;
    focusSeqDateInput(keys[targetIdx]!, colKey);
  };

  const renderTh = (colId: string, extraClass = '') => (
    <th key={colId} className={`${TH_STICKY} ${extraClass}`}>
      <div className="flex items-center justify-between gap-1">
        <span>{COL_LABELS[colId] ?? colId}</span>
        <GradeFiltroCabecalhoBtn
          ativo={grade.colunaComFiltroAtivo(colId)}
          onClick={(e) => grade.abrirFiltroExcel(colId, e)}
        />
      </div>
    </th>
  );

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
        role="dialog"
        aria-modal="true"
        aria-labelledby="corrigir-datas-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <h2 id="corrigir-datas-titulo" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Corrigir datas antes de concluir
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {temPrevisaoVencida ? (
              <>
                Há {temItensPedido ? 'itens' : 'carradas'} com previsão de entrega anterior a hoje (
                {formatDataCurta(hoje)}). Antes de registrar os motivos, ajuste as datas de produção e entrega
                abaixo para refletir o planejamento atual.
                {qtdConcluidas > 0 ? (
                  <> Itens já corrigidos permanecem na lista com fundo verde.</>
                ) : null}
              </>
            ) : (
              <>
                Há {temItensPedido ? 'itens' : 'carradas'} com data de produção ou entrega anterior a hoje (
                {formatDataCurta(hoje)}). Ajuste as datas abaixo para continuar.
                {qtdConcluidas > 0 ? (
                  <> Itens já corrigidos permanecem na lista com fundo verde.</>
                ) : null}
              </>
            )}
          </p>
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

        <div ref={grade.tableScrollRef} className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr>
                {temItensPedido ? (
                  <>
                    {renderTh('pedido', 'pl-4')}
                    {renderTh('cliente')}
                    {renderTh('codigo')}
                    {renderTh('descricao')}
                    {renderTh('carrada')}
                  </>
                ) : (
                  <>
                    {renderTh('cod', 'pl-4')}
                    {renderTh('carrada')}
                  </>
                )}
                {renderTh('dataProducao')}
                <th className={`${TH_STICKY} w-8 px-1 text-center`}>
                  <button
                    type="button"
                    onClick={replicarProducaoNaEntregaTodas}
                    className="mx-auto block rounded px-1.5 py-0.5 text-xs font-medium text-white hover:bg-primary-500/50"
                    title="Replicar data de produção para entrega em todas as linhas"
                    aria-label="Replicar data de produção para entrega em todas as linhas"
                  >
                    →
                  </button>
                </th>
                {renderTh('dataEntrega', 'pr-4')}
              </tr>
            </thead>
            <tbody>
              {linhasExibidas.length === 0 ? (
                <tr>
                  <td
                    colSpan={temItensPedido ? 8 : 5}
                    className="py-6 text-center text-sm text-slate-500 dark:text-slate-400"
                  >
                    Nenhum item corresponde aos filtros aplicados.
                  </td>
                </tr>
              ) : entriesAgrupadas ? (
                entriesAgrupadas.flatMap((entry) => {
                  if (entry.kind === 'carrada') {
                    const c = entry.row;
                    return [
                      <tr key={c.key} className={classeLinhaCorrigir(c, false, false)}>
                        <td className="py-2 pl-4 pr-2 text-slate-400">—</td>
                        <td className="px-2 py-2 text-slate-400">—</td>
                        <td className="px-2 py-2 font-mono text-slate-800 dark:text-slate-200">{c.cod}</td>
                        <td className="px-2 py-2 text-slate-400">—</td>
                        <td className="max-w-[160px] px-2 py-2 text-slate-800 dark:text-slate-200">
                          <div className="truncate" title={c.carrada}>
                            {c.carrada}
                          </div>
                          {c.previsaoPassada && c.previsaoAtual ? (
                            <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">
                              Previsão: {formatDataCurta(c.previsaoAtual)} (vencida)
                            </p>
                          ) : null}
                        </td>
                        {renderInputsDataItem(c, {
                          datePickerAbertoRef,
                          onEditar,
                          handleDateKey,
                          replicarProducaoNaEntrega,
                        })}
                      </tr>,
                    ];
                  }

                  const { grupo } = entry;
                  const rowSpan = grupo.itens.length;
                  const previsaoGrupo = grupo.itens.find((i) => i.previsaoPassada && i.previsaoAtual);
                  const grupoTodoConcluido = grupo.itens.every((i) => i.concluida);

                  return grupo.itens.map((c, itemIdx) => {
                    const isFirst = itemIdx === 0;
                    const divergeProducao = !c.concluida && itemCampoDiverge(c, grupo.itens, 'dataProducao');
                    const divergeEntrega = !c.concluida && itemCampoDiverge(c, grupo.itens, 'dataEntrega');

                    return (
                      <tr key={c.key} className={classeLinhaCorrigir(c, divergeProducao, divergeEntrega)}>
                        {isFirst ? (
                          <td rowSpan={rowSpan} className={`${TD_MESCLADA} pl-4 pr-2 font-mono`}>
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              <div className="flex items-center justify-center gap-1.5">
                                <span>{labelPedidoMapa(grupo.pedido)}</span>
                                <span className="inline-flex items-center gap-0.5">
                                  <PedidoLoteDataPicker
                                    titulo="Definir data de produção para todos os itens do pedido"
                                    iconClassName="text-sky-600 dark:text-sky-400"
                                    onSelecionar={(value) => editarPedido(grupo, 'dataProducao', value)}
                                  />
                                  <PedidoLoteDataPicker
                                    titulo="Definir data de entrega para todos os itens do pedido"
                                    iconClassName="text-emerald-600 dark:text-emerald-400"
                                    onSelecionar={(value) => editarPedido(grupo, 'dataEntrega', value)}
                                  />
                                </span>
                              </div>
                              {grupoTodoConcluido ? (
                                <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                                  Concluído
                                </span>
                              ) : null}
                            </div>
                          </td>
                        ) : null}
                        {isFirst ? (
                          <td
                            rowSpan={rowSpan}
                            className={`${TD_MESCLADA} max-w-[140px]`}
                            title={grupo.cliente}
                          >
                            <span className="block truncate">{grupo.cliente || '—'}</span>
                          </td>
                        ) : null}
                        <td className="px-2 py-2 align-middle font-mono text-slate-800 dark:text-slate-200">
                          <span>{c.codigoProduto || '—'}</span>
                          {c.concluida ? (
                            <span className="ml-1.5 inline-block rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                              Concluído
                            </span>
                          ) : null}
                        </td>
                        <td
                          className="max-w-[200px] px-2 py-2 align-middle text-slate-800 dark:text-slate-200"
                          title={c.descricaoProduto}
                        >
                          <div className="line-clamp-2">{c.descricaoProduto || '—'}</div>
                        </td>
                        {isFirst ? (
                          <td rowSpan={rowSpan} className={`${TD_MESCLADA} max-w-[160px]`}>
                            <div className="truncate" title={grupo.carrada}>
                              {grupo.carrada}
                            </div>
                            {previsaoGrupo?.previsaoAtual ? (
                              <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">
                                Previsão: {formatDataCurta(previsaoGrupo.previsaoAtual)} (vencida)
                              </p>
                            ) : null}
                          </td>
                        ) : null}
                        {renderInputsDataItem(c, {
                          divergeProducao,
                          divergeEntrega,
                          datePickerAbertoRef,
                          onEditar,
                          handleDateKey,
                          replicarProducaoNaEntrega,
                        })}
                      </tr>
                    );
                  });
                })
              ) : (
                linhasExibidas.map((c) => {
                  const isItem = !!c.idPedido;
                  return (
                    <tr key={c.key} className={classeLinhaCorrigir(c, false, false)}>
                      {temItensPedido ? (
                        isItem ? (
                          <>
                            <td className="py-2 pl-4 pr-2 font-mono text-slate-800 dark:text-slate-200">
                              {labelPedidoMapa(c.pedido ?? '—')}
                            </td>
                            <td
                              className="max-w-[140px] truncate px-2 py-2 text-slate-800 dark:text-slate-200"
                              title={c.cliente}
                            >
                              {c.cliente || '—'}
                            </td>
                            <td className="px-2 py-2 font-mono text-slate-800 dark:text-slate-200">
                              {c.codigoProduto || '—'}
                            </td>
                            <td
                              className="max-w-[200px] px-2 py-2 text-slate-800 dark:text-slate-200"
                              title={c.descricaoProduto}
                            >
                              <div className="line-clamp-2">{c.descricaoProduto || '—'}</div>
                            </td>
                            <td className="max-w-[160px] px-2 py-2 text-slate-800 dark:text-slate-200">
                              <div className="truncate" title={c.carrada}>
                                {c.carrada}
                              </div>
                              {c.previsaoPassada && c.previsaoAtual ? (
                                <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">
                                  Previsão: {formatDataCurta(c.previsaoAtual)} (vencida)
                                </p>
                              ) : null}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-2 pl-4 pr-2 text-slate-400">—</td>
                            <td className="px-2 py-2 text-slate-400">—</td>
                            <td className="px-2 py-2 font-mono text-slate-800 dark:text-slate-200">{c.cod}</td>
                            <td className="px-2 py-2 text-slate-400">—</td>
                            <td className="max-w-[160px] px-2 py-2 text-slate-800 dark:text-slate-200">
                              <div className="truncate" title={c.carrada}>
                                {c.carrada}
                              </div>
                              {c.previsaoPassada && c.previsaoAtual ? (
                                <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">
                                  Previsão: {formatDataCurta(c.previsaoAtual)} (vencida)
                                </p>
                              ) : null}
                            </td>
                          </>
                        )
                      ) : (
                        <>
                          <td className="py-2 pl-4 pr-2 font-mono text-slate-800 dark:text-slate-200">{c.cod}</td>
                          <td className="max-w-[200px] px-2 py-2 text-slate-800 dark:text-slate-200">
                            <div className="truncate" title={c.carrada}>
                              {c.carrada}
                            </div>
                            {c.previsaoPassada && c.previsaoAtual ? (
                              <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">
                                Previsão atual: {formatDataCurta(c.previsaoAtual)} (vencida)
                              </p>
                            ) : null}
                          </td>
                        </>
                      )}
                      {renderInputsDataItem(c, {
                        datePickerAbertoRef,
                        onEditar,
                        handleDateKey,
                        replicarProducaoNaEntrega,
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
          />
        )}

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-600">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onContinuar}
            disabled={aindaInvalidas}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {aindaInvalidas ? 'Corrija todas as datas' : 'Continuar para motivos'}
          </button>
        </div>
      </div>
    </div>
  );
}
