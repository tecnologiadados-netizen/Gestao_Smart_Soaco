import { Fragment, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, Eye, History, RefreshCw, X } from 'lucide-react';
import { type TarefaInadimplente } from '../../../../api/crmFinanceiro';
import GradeFiltroCabecalhoBtn from '../../../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../../../components/grade/GradeFiltroExcelPortal';
import { useGradeFiltrosExcel } from '../../../../hooks/useGradeFiltrosExcel';
import { useColumnResize } from '../hooks/useColumnResize';
import { CelulaDataVencimento, textoFiltroDataVencimento } from './CelulaDataVencimento';

const COLUMN_IDS = [
  'expand',
  'cliente',
  'conta',
  'empresa',
  'negociado',
  'recebido',
  'saldo',
  'proxima',
  'status',
  'tratativas',
] as const;

type ColumnId = (typeof COLUMN_IDS)[number];

const COL_LABELS: Record<ColumnId, string> = {
  expand: '',
  cliente: 'Cliente',
  conta: 'Conta',
  empresa: 'Empresa',
  negociado: 'Valor negociado',
  recebido: 'Recebido',
  saldo: 'Saldo',
  proxima: 'Próx. parcela',
  status: 'Status ERP',
  tratativas: 'Tratativas',
};

const DEFAULT_COLUMN_WIDTHS: Record<ColumnId, number> = {
  expand: 36,
  cliente: 220,
  conta: 80,
  empresa: 140,
  negociado: 120,
  recebido: 110,
  saldo: 110,
  proxima: 118,
  status: 160,
  tratativas: 92,
};

const FLEX_WEIGHTS: Partial<Record<ColumnId, number>> = {
  cliente: 2,
  empresa: 1.2,
};

const NUMERIC_COLS = new Set<ColumnId>(['negociado', 'recebido', 'saldo', 'tratativas']);
const td = 'px-1.5 py-1 align-top';

const FILTROS_GRADE_PADRAO: Record<string, string> = {
  status: ['Em atraso', 'Atrasado - Em contato'].join('\u0001'),
};

function moneyBr(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatYmd(ymd: string | null | undefined): string {
  if (!ymd) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return ymd;
}

function labelStatus(s: string): string {
  if (s === 'em_contato') return 'Atrasado - Em contato';
  if (s === 'concluida') return 'Concluída';
  return 'Em atraso';
}

function cellText(row: TarefaInadimplente, col: ColumnId): string {
  const a = row.acordo;
  switch (col) {
    case 'expand':
      return '';
    case 'cliente':
      return row.clienteNome;
    case 'conta':
      return row.codigoConta;
    case 'empresa':
      return row.empresaNome?.trim() || '—';
    case 'negociado':
      return moneyBr(a?.valorNegociado ?? 0);
    case 'recebido':
      return moneyBr(a?.valorRecebido ?? 0);
    case 'saldo':
      return moneyBr(a?.saldo ?? 0);
    case 'proxima':
      return textoFiltroDataVencimento(a?.proximaParcela ?? null);
    case 'status':
      return labelStatus(row.status);
    case 'tratativas':
      return String(row.contatosCount);
    default:
      return '';
  }
}

function sortValue(row: TarefaInadimplente, col: ColumnId): string | number {
  const a = row.acordo;
  switch (col) {
    case 'negociado':
      return a?.valorNegociado ?? 0;
    case 'recebido':
      return a?.valorRecebido ?? 0;
    case 'saldo':
      return a?.saldo ?? 0;
    case 'proxima':
      return a?.proximaParcela ?? '';
    case 'tratativas':
      return row.contatosCount;
    case 'conta':
      return Number(row.codigoConta) || row.codigoConta;
    default:
      return cellText(row, col).toLowerCase();
  }
}

type Props = {
  rows: TarefaInadimplente[];
  loading: boolean;
  indicadorClientesNegociacao: { negociando: number; total: number; percentual: number };
  onRefresh: () => void;
  onOpenHistorico: (row: TarefaInadimplente) => void;
};

export default function GradeAcordosInadimplentes({
  rows,
  loading,
  indicadorClientesNegociacao,
  onRefresh,
  onOpenHistorico,
}: Props) {
  const [abertaId, setAbertaId] = useState<number | null>(null);
  const [detalheRecebimentos, setDetalheRecebimentos] = useState<TarefaInadimplente | null>(null);

  const { startResize, tableRef } = useColumnResize(COLUMN_IDS, DEFAULT_COLUMN_WIDTHS, {
    storageKey: 'crm-inadimplente-acordos-cols-v1',
    fillContainer: true,
    flexColumnWeights: FLEX_WEIGHTS,
    minWidthPx: 36,
  });

  const grade = useGradeFiltrosExcel<TarefaInadimplente>({
    rows,
    columnIds: [...COLUMN_IDS],
    getCellText: (r, c) => cellText(r, c as ColumnId),
    valueForSort: (r, c) => sortValue(r, c as ColumnId),
    defaultSortLevels: [{ id: 'proxima', dir: 'asc' }],
    defaultColumnFilters: FILTROS_GRADE_PADRAO,
    dateColumnIds: ['proxima'],
  });

  const totais = useMemo(() => {
    return grade.rowsExibidas.reduce(
      (acc, r) => {
        acc.negociado += r.acordo?.valorNegociado ?? 0;
        acc.recebido += r.acordo?.valorRecebido ?? 0;
        acc.saldo += r.acordo?.saldo ?? 0;
        return acc;
      },
      { negociado: 0, recebido: 0, saldo: 0 },
    );
  }, [grade.rowsExibidas]);

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Valor negociado</p>
          <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {moneyBr(totais.negociado)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Recebido</p>
          <p className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {moneyBr(totais.recebido)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Saldo a receber</p>
          <p className="text-sm font-semibold tabular-nums text-amber-800 dark:text-amber-300">
            {moneyBr(totais.saldo)}
          </p>
        </div>
        <div
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          title="Clientes únicos com acordo em aberto sobre o total de clientes com título em atraso (Prioridade, Prescritos e Acordos)."
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Clientes em negociação
          </p>
          <p className="text-sm font-semibold tabular-nums text-sky-700 dark:text-sky-300">
            {indicadorClientesNegociacao.percentual.toLocaleString('pt-BR', {
              maximumFractionDigits: 1,
              minimumFractionDigits: 1,
            })}
            %
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {indicadorClientesNegociacao.negociando.toLocaleString('pt-BR')} de{' '}
            {indicadorClientesNegociacao.total.toLocaleString('pt-BR')} inadimplentes
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          No Nomus/Shop9 o título continua atrasado. Os recebimentos da mesma conta abatem o acordo (principal + juros)
          automaticamente.
        </p>
        <button
          type="button"
          disabled={loading}
          onClick={() => onRefresh()}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          title="Buscar recebimentos atualizados no ERP"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar do ERP
        </button>
      </div>

      {grade.temFiltrosOuOrdem ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => grade.limparFiltrosGrade()}
            className="inline-flex h-7 items-center rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
          >
            Limpar filtros
          </button>
        </div>
      ) : null}

      <div className="table-crm-section">
        <div ref={grade.tableScrollRef} className="overflow-auto max-h-[calc(100vh-16rem)]">
          <table
            ref={tableRef}
            className="table-crm w-full border-collapse text-left text-xs leading-snug"
            style={{ tableLayout: 'fixed' }}
          >
            <colgroup>
              {COLUMN_IDS.map((id) => (
                <col key={id} style={{ width: DEFAULT_COLUMN_WIDTHS[id] }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-20">
              <tr className="bg-blue-700 text-white dark:bg-blue-900">
                {COLUMN_IDS.map((colId) => (
                  <th
                    key={colId}
                    className="relative overflow-hidden border-b border-blue-600/40 px-0 py-0 font-semibold"
                  >
                    {colId === 'expand' ? (
                      <div className="min-h-[2.25rem]" />
                    ) : (
                      <div className="flex min-h-[2.25rem] items-center justify-between gap-1 overflow-hidden px-1.5 py-1">
                        <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[10px] uppercase leading-tight tracking-wide">
                          {COL_LABELS[colId]}
                        </span>
                        <GradeFiltroCabecalhoBtn
                          ativo={grade.colunaComFiltroAtivo(colId)}
                          onClick={(e) => grade.abrirFiltroExcel(colId, e)}
                          className="mt-0.5 shrink-0"
                        />
                      </div>
                    )}
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Redimensionar coluna ${COL_LABELS[colId] || 'expandir'}`}
                      className="col-resize-handle"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        startResize(colId, event.clientX);
                      }}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={COLUMN_IDS.length} className="px-3 py-8 text-center text-slate-500">
                    Carregando...
                  </td>
                </tr>
              ) : grade.rowsExibidas.length === 0 ? (
                <tr>
                  <td colSpan={COLUMN_IDS.length} className="px-3 py-8 text-center text-slate-500">
                    Nenhum acordo nesta fila. Use a tratativa “Negociar com cliente” para trazer a conta para cá.
                  </td>
                </tr>
              ) : (
                grade.rowsExibidas.map((row, index) => {
                  const a = row.acordo;
                  const aberta = abertaId === row.id;
                  return (
                    <Fragment key={row.id}>
                      <tr
                        className={`border-t border-slate-100 dark:border-slate-800 ${
                          index % 2 === 0
                            ? 'bg-white dark:bg-slate-900'
                            : 'bg-slate-50/70 dark:bg-slate-800/40'
                        } hover:bg-sky-50/60 dark:hover:bg-slate-800/70`}
                      >
                        <td className={`${td} cell-nowrap`}>
                          <button
                            type="button"
                            title={aberta ? 'Recolher parcelas' : 'Ver parcelas e recebimentos'}
                            onClick={() => {
                              setAbertaId(aberta ? null : row.id);
                            }}
                            className="rounded p-0.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            {aberta ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                          </button>
                        </td>
                        <td className={`${td} cell-wrap font-medium text-slate-900 dark:text-slate-100`} title={row.clienteNome}>
                          {row.clienteNome}
                        </td>
                        <td className={`${td} cell-nowrap`}>{row.codigoConta}</td>
                        <td className={`${td} cell-wrap`}>{row.empresaNome ?? '—'}</td>
                        <td className={`${td} cell-nowrap tabular-nums text-right`}>{moneyBr(a?.valorNegociado ?? 0)}</td>
                        <td className={`${td} cell-nowrap tabular-nums text-right text-emerald-700 dark:text-emerald-400`}>
                          {moneyBr(a?.valorRecebido ?? 0)}
                        </td>
                        <td className={`${td} cell-nowrap tabular-nums text-right font-semibold`}>
                          {moneyBr(a?.saldo ?? 0)}
                        </td>
                        <td className={`${td} cell-wrap`}>
                          <CelulaDataVencimento value={a?.proximaParcela ?? null} />
                        </td>
                        <td className={`${td} cell-nowrap`} title={labelStatus(row.status)}>
                          {labelStatus(row.status)}
                        </td>
                        <td className={`${td} cell-nowrap`}>
                          <button
                            type="button"
                            title="Histórico de tratativas"
                            onClick={() => onOpenHistorico(row)}
                            className="inline-flex items-center gap-1 rounded-md p-1 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                          >
                            <History className="size-4" />
                            {row.contatosCount}
                          </button>
                        </td>
                      </tr>
                      {aberta && a ? (
                        <tr className="border-t border-slate-100 bg-slate-50/90 dark:border-slate-800 dark:bg-slate-950/50">
                          <td colSpan={COLUMN_IDS.length} className="px-3 py-3">
                            <div className="grid gap-3 lg:grid-cols-2">
                              <div>
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                  Parcelas do acordo
                                </p>
                                <table className="w-full border-collapse text-[11px]">
                                  <thead>
                                    <tr className="text-left text-slate-500">
                                      <th className="py-1 pr-2 font-medium">#</th>
                                      <th className="py-1 pr-2 font-medium">Tipo</th>
                                      <th className="py-1 pr-2 font-medium">Vencimento</th>
                                      <th className="py-1 pr-2 font-medium text-right">Valor</th>
                                      <th className="py-1 pr-2 font-medium text-right">Recebido</th>
                                      <th className="py-1 font-medium text-right">Saldo</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {a.parcelas.map((p) => (
                                      <tr key={`${row.id}-p-${p.n}`} className="border-t border-slate-200 dark:border-slate-800">
                                        <td className="py-1 pr-2">{p.n}</td>
                                        <td className="py-1 pr-2 capitalize">{p.tipo}</td>
                                        <td className="py-1 pr-2">{formatYmd(p.data)}</td>
                                        <td className="py-1 pr-2 text-right tabular-nums">{moneyBr(p.valor)}</td>
                                        <td className="py-1 pr-2 text-right tabular-nums">{moneyBr(p.valorRecebido)}</td>
                                        <td className="py-1 text-right tabular-nums font-medium">{moneyBr(p.saldo)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                <p className="mt-2 text-[11px] text-slate-500">
                                  Principal {moneyBr(a.valorOriginal)} · Juros {moneyBr(a.valorJuros)}
                                </p>
                              </div>
                              <div>
                                <div className="mb-1 flex items-center justify-between gap-2">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    Recebimentos no ERP
                                  </p>
                                  {a.recebimentos.length > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => setDetalheRecebimentos(row)}
                                      className="inline-flex h-6 items-center gap-1 rounded-md border border-slate-300 bg-white px-1.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                                    >
                                      <Eye className="size-3" />
                                      Ver detalhes
                                    </button>
                                  ) : null}
                                </div>
                                {a.recebimentos.length === 0 ? (
                                  <p className="mb-2 text-[11px] text-slate-500">
                                    Nenhum recebimento nesta conta ainda. Quando a cobrança baixar no Nomus/Shop9, o valor
                                    aparece aqui e abate as parcelas.
                                  </p>
                                ) : (
                                  <ul className="mb-2 space-y-1">
                                    {a.recebimentos.map((r) => (
                                      <li
                                        key={r.id}
                                        className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                                      >
                                        <span className="tabular-nums">
                                          {moneyBr(r.valor)} em {formatYmd(r.data)}
                                        </span>
                                        <span className="text-[10px] uppercase text-slate-400">
                                          {r.origem === 'shop9' ? 'Shop9' : 'Nomus'}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {a.saldo > 0.009 ? (
                                  <p className="text-[11px] text-slate-500">
                                    Saldo do acordo: {moneyBr(a.saldo)}. Teto = principal + juros configurados no Gestão.
                                  </p>
                                ) : (
                                  <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                                    Acordo quitado no Gestão. O título no ERP permanece atrasado até a baixa total lá.
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
            {!loading ? (
              <tfoot className="sticky bottom-0 z-20">
                <tr className="border-t-2 border-slate-300 bg-slate-100 font-semibold dark:border-slate-500 dark:bg-slate-800">
                  {COLUMN_IDS.map((colId) => {
                    if (colId === 'empresa') {
                      return (
                        <td key={colId} className={`${td} text-right text-slate-700 dark:text-slate-200`}>
                          Total
                        </td>
                      );
                    }
                    if (colId === 'negociado') {
                      return (
                        <td key={colId} className={`${td} cell-nowrap tabular-nums text-right`}>
                          {moneyBr(totais.negociado)}
                        </td>
                      );
                    }
                    if (colId === 'recebido') {
                      return (
                        <td key={colId} className={`${td} cell-nowrap tabular-nums text-right`}>
                          {moneyBr(totais.recebido)}
                        </td>
                      );
                    }
                    if (colId === 'saldo') {
                      return (
                        <td key={colId} className={`${td} cell-nowrap tabular-nums text-right`}>
                          {moneyBr(totais.saldo)}
                        </td>
                      );
                    }
                    return <td key={colId} className={td} />;
                  })}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>

        {grade.colunaFiltroAberta && grade.filtroAbertoRect ? (
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
            showNumericFilters={NUMERIC_COLS.has(grade.colunaFiltroAberta as ColumnId)}
            showDateRangeFilters={grade.colunaFiltroAberta === 'proxima'}
          />
        ) : null}
      </div>
      {!loading ? (
        <p className="text-[11px] leading-none text-slate-500 dark:text-slate-400">
          {grade.rowsExibidas.length.toLocaleString('pt-BR')} acordo
          {grade.rowsExibidas.length === 1 ? '' : 's'}
        </p>
      ) : null}

      {detalheRecebimentos?.acordo
        ? createPortal(
            <div
              className="fixed inset-0 z-[10120] flex items-center justify-center bg-black/55 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="recebimentos-erp-titulo"
              onClick={() => setDetalheRecebimentos(null)}
            >
              <div
                className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-slate-700">
                  <div>
                    <h2
                      id="recebimentos-erp-titulo"
                      className="text-base font-semibold text-slate-800 dark:text-slate-100"
                    >
                      Recebimentos no ERP
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                      {detalheRecebimentos.clienteNome} · Conta {detalheRecebimentos.codigoConta} (
                      {detalheRecebimentos.origem})
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetalheRecebimentos(null)}
                    className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    aria-label="Fechar"
                  >
                    <X className="size-5" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-auto p-4">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                        <th className="border-b border-slate-200 py-1.5 pr-2 font-semibold dark:border-slate-700">Cód. rec.</th>
                        <th className="border-b border-slate-200 py-1.5 pr-2 font-semibold dark:border-slate-700">Conta</th>
                        <th className="border-b border-slate-200 py-1.5 pr-2 font-semibold dark:border-slate-700">Data</th>
                        <th className="border-b border-slate-200 py-1.5 pr-2 font-semibold dark:border-slate-700 text-right">Valor</th>
                        <th className="border-b border-slate-200 py-1.5 pr-2 font-semibold dark:border-slate-700">Forma</th>
                        <th className="border-b border-slate-200 py-1.5 pr-2 font-semibold dark:border-slate-700">Banco</th>
                        <th className="border-b border-slate-200 py-1.5 font-semibold dark:border-slate-700">Observação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalheRecebimentos.acordo.recebimentos.map((r) => (
                        <tr key={r.id} className="align-top border-b border-slate-100 dark:border-slate-800">
                          <td className="py-1.5 pr-2 tabular-nums">{r.id}</td>
                          <td className="py-1.5 pr-2 tabular-nums">{r.codigoConta ?? detalheRecebimentos.codigoConta}</td>
                          <td className="py-1.5 pr-2 whitespace-nowrap">{formatYmd(r.data)}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums whitespace-nowrap">{moneyBr(r.valor)}</td>
                          <td className="py-1.5 pr-2">{r.formaPagamento || '—'}</td>
                          <td className="py-1.5 pr-2">{r.contaBancaria || '—'}</td>
                          <td className="py-1.5 whitespace-pre-wrap text-slate-600 dark:text-slate-300">
                            {r.comentarios || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
