import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet, History } from 'lucide-react';
import {
  fetchCrmInadimplenteTarefas,
  type TarefaInadimplente,
} from '../../../../api/crmFinanceiro';
import { useAuth } from '../../../../contexts/AuthContext';
import GradeFiltroCabecalhoBtn from '../../../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../../../components/grade/GradeFiltroExcelPortal';
import { useGradeFiltrosExcel } from '../../../../hooks/useGradeFiltrosExcel';
import { useColumnResize } from '../hooks/useColumnResize';
import { downloadTarefasInadimplentesPdf } from '../lib/exportTarefasInadimplentesPdf';
import { downloadTarefasInadimplentesXlsx } from '../lib/exportTarefasInadimplentesXlsx';
import { ANOS_PRESCRICAO_TITULO, isTituloPrescrito } from '../lib/titulo-prescrito';
import { CelulaDataVencimento, textoFiltroDataVencimento } from './CelulaDataVencimento';
import ModalHistoricoContatosTarefa from './ModalHistoricoContatosTarefa';
import PdfGeneratingOverlay from './PdfGeneratingOverlay';

type FilaTarefa = 'prioridade' | 'prescritos';

const COLUMN_IDS = [
  'vencimento',
  'dataBaixa',
  'pagamento',
  'origem',
  'empresa',
  'cliente',
  'conta',
  'banco',
  'valor',
  'atraso',
  'status',
  'responsavel',
  'nfPd',
  'tratativas',
] as const;

type ColumnId = (typeof COLUMN_IDS)[number];

const COL_LABELS: Record<ColumnId, string> = {
  vencimento: 'Data vencim.',
  dataBaixa: 'Data baixa',
  pagamento: 'Data recebim.',
  origem: 'Origem Sist.',
  empresa: 'Empresa',
  cliente: 'Cliente',
  conta: 'Conta',
  banco: 'Banco',
  valor: 'Valor',
  atraso: 'Atraso',
  status: 'Status',
  responsavel: 'Responsável',
  nfPd: 'NF / PD',
  tratativas: 'Tratativas',
};

const DEFAULT_COLUMN_WIDTHS: Record<ColumnId, number> = {
  vencimento: 128,
  dataBaixa: 110,
  pagamento: 110,
  origem: 84,
  empresa: 140,
  cliente: 200,
  conta: 80,
  banco: 120,
  valor: 108,
  atraso: 88,
  status: 196,
  responsavel: 140,
  nfPd: 88,
  tratativas: 100,
};

const FLEX_WEIGHTS: Partial<Record<ColumnId, number>> = {
  cliente: 2,
  empresa: 1.2,
  banco: 1,
  responsavel: 1,
};

const NUMERIC_COLS = new Set<ColumnId>(['valor', 'atraso', 'tratativas']);
const td = 'px-1.5 py-1 align-top';

/** Padrão da grade: oculta Concluída; o usuário inclui de novo no filtro da coluna Status. */
const FILTROS_GRADE_PADRAO: Record<string, string> = {
  status: ['Em atraso', 'Atrasado - Em contato'].join('\u0001'),
};

function moneyBr(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatYmd(ymd: string | null): string {
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
  switch (col) {
    case 'vencimento':
      return textoFiltroDataVencimento(row.vencimento);
    case 'dataBaixa':
      return formatYmd(row.dataBaixa);
    case 'pagamento':
      return textoFiltroDataVencimento(row.pagamento);
    case 'origem':
      return row.origem.toUpperCase();
    case 'empresa':
      return row.empresaNome?.trim() || '—';
    case 'cliente':
      return row.clienteNome;
    case 'conta':
      return row.codigoConta;
    case 'banco':
      return row.banco?.trim() || '—';
    case 'valor':
      return moneyBr(row.valor);
    case 'atraso':
      return `${row.diasAtraso}d`;
    case 'status':
      return labelStatus(row.status);
    case 'responsavel':
      return row.responsavelNome?.trim() || row.responsavelLogin?.trim() || '—';
    case 'nfPd':
      return row.nfPd?.trim() || '—';
    case 'tratativas':
      return String(row.contatosCount);
    default:
      return '';
  }
}

function sortValue(row: TarefaInadimplente, col: ColumnId): string | number {
  switch (col) {
    case 'vencimento':
      return row.vencimento ?? '';
    case 'dataBaixa':
      return row.dataBaixa ?? '';
    case 'pagamento':
      return row.pagamento ?? '';
    case 'valor':
      return row.valor;
    case 'atraso':
      return row.diasAtraso;
    case 'tratativas':
      return row.contatosCount;
    case 'conta':
      return Number(row.codigoConta) || row.codigoConta;
    default:
      return cellText(row, col).toLowerCase();
  }
}

export default function TarefasInadimplentesPanel() {
  const { nome, login } = useAuth();
  const [rows, setRows] = useState<TarefaInadimplente[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [fila, setFila] = useState<FilaTarefa>('prioridade');
  const [tarefaHist, setTarefaHist] = useState<TarefaInadimplente | null>(null);
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const [exportandoXlsx, setExportandoXlsx] = useState(false);

  const { startResize, tableRef } = useColumnResize(COLUMN_IDS, DEFAULT_COLUMN_WIDTHS, {
    storageKey: 'crm-inadimplente-tarefas-cols-v6',
    fillContainer: true,
    flexColumnWeights: FLEX_WEIGHTS,
    minWidthPx: 72,
  });

  const nPrioridade = useMemo(
    () => rows.filter((r) => r.status !== 'concluida' && !isTituloPrescrito(r.vencimento)).length,
    [rows],
  );
  const nPrescritos = useMemo(
    () => rows.filter((r) => r.status !== 'concluida' && isTituloPrescrito(r.vencimento)).length,
    [rows],
  );

  const rowsFila = useMemo(
    () =>
      rows.filter((r) =>
        fila === 'prescritos' ? isTituloPrescrito(r.vencimento) : !isTituloPrescrito(r.vencimento),
      ),
    [rows, fila],
  );

  const grade = useGradeFiltrosExcel<TarefaInadimplente>({
    rows: rowsFila,
    columnIds: [...COLUMN_IDS],
    getCellText: (r, c) => cellText(r, c as ColumnId),
    valueForSort: (r, c) => sortValue(r, c as ColumnId),
    defaultSortLevels: [{ id: 'vencimento', dir: 'asc' }],
    defaultColumnFilters: FILTROS_GRADE_PADRAO,
    dateColumnIds: ['vencimento', 'dataBaixa', 'pagamento'],
  });

  const somaValor = useMemo(
    () => grade.rowsExibidas.reduce((acc, r) => acc + (Number.isFinite(r.valor) ? r.valor : 0), 0),
    [grade.rowsExibidas],
  );

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const result = await fetchCrmInadimplenteTarefas({
        status: 'todas',
        sync: true,
      });
      setRows(result.data);
      if (result.sync?.erros.length) setErro(result.sync.erros.join(' · '));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar tarefas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const tituloFilaExport = fila === 'prescritos' ? 'Prescritos' : 'Prioridade';

  const exportarPdf = useCallback(async () => {
    setErro('');
    setExportandoPdf(true);
    try {
      await downloadTarefasInadimplentesPdf({
        linhas: grade.rowsExibidas,
        tituloFila: tituloFilaExport,
        responsavel: nome?.trim() || login || '—',
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar o PDF.');
    } finally {
      setExportandoPdf(false);
    }
  }, [grade.rowsExibidas, login, nome, tituloFilaExport]);

  const exportarXlsx = useCallback(async () => {
    setErro('');
    setExportandoXlsx(true);
    try {
      await downloadTarefasInadimplentesXlsx({
        linhas: grade.rowsExibidas,
        tituloFila: tituloFilaExport,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar o Excel.');
    } finally {
      setExportandoXlsx(false);
    }
  }, [grade.rowsExibidas, tituloFilaExport]);

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800/80">
          <button
            type="button"
            onClick={() => {
              setFila('prioridade');
              grade.limparFiltrosGrade();
            }}
            className={`rounded-md px-3 py-1 text-sm font-semibold ${
              fila === 'prioridade'
                ? 'bg-blue-700 text-white shadow'
                : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            Prioridade
            {!loading ? ` (${nPrioridade.toLocaleString('pt-BR')})` : ''}
          </button>
          <button
            type="button"
            title={`Vencimento há ${ANOS_PRESCRICAO_TITULO} anos ou mais — não negativar; tratativas continuam disponíveis.`}
            onClick={() => {
              setFila('prescritos');
              grade.limparFiltrosGrade();
            }}
            className={`rounded-md px-3 py-1 text-sm font-semibold ${
              fila === 'prescritos'
                ? 'bg-blue-700 text-white shadow'
                : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            Prescritos
            {!loading ? ` (${nPrescritos.toLocaleString('pt-BR')})` : ''}
          </button>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            disabled={loading || exportandoPdf || exportandoXlsx || grade.rowsExibidas.length === 0}
            onClick={() => void exportarPdf()}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            title="Exportar a grade visível em PDF"
          >
            <FileDown className="size-3.5" />
            {exportandoPdf ? 'Gerando PDF…' : 'Exportar PDF'}
          </button>
          <button
            type="button"
            disabled={loading || exportandoPdf || exportandoXlsx || grade.rowsExibidas.length === 0}
            onClick={() => void exportarXlsx()}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            title="Exportar a grade visível em Excel"
          >
            <FileSpreadsheet className="size-3.5" />
            {exportandoXlsx ? 'Exportando…' : 'Exportar Excel'}
          </button>
          {grade.temFiltrosOuOrdem ? (
            <button
              type="button"
              onClick={() => grade.limparFiltrosGrade()}
              className="inline-flex h-7 shrink-0 items-center rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
              title="Limpar filtros e ordenação da grade"
            >
              Limpar filtros
            </button>
          ) : null}
        </div>
      </div>

      {erro ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-900">{erro}</p>
      ) : null}

      <div className="table-crm-section">
        <div ref={grade.tableScrollRef} className="overflow-auto max-h-[calc(100vh-12rem)]">
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
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Redimensionar coluna ${COL_LABELS[colId]}`}
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
                    {fila === 'prescritos'
                      ? 'Nenhum título prescrito nesta fila.'
                      : 'Nenhuma tarefa em prioridade. Atualize a página (F5) para buscar títulos vencidos no Nomus e no Shop9.'}
                  </td>
                </tr>
              ) : (
                grade.rowsExibidas.map((row, index) => (
                  <tr
                    key={row.id}
                    className={`border-t border-slate-100 dark:border-slate-800 ${
                      index % 2 === 0
                        ? 'bg-white dark:bg-slate-900'
                        : 'bg-slate-50/70 dark:bg-slate-800/40'
                    } hover:bg-sky-50/60 dark:hover:bg-slate-800/70`}
                  >
                    <td className={`${td} cell-wrap`}>
                      <CelulaDataVencimento value={row.vencimento} />
                    </td>
                    <td className={`${td} cell-nowrap`}>{formatYmd(row.dataBaixa)}</td>
                    <td className={`${td} cell-wrap`}>
                      <CelulaDataVencimento value={row.pagamento} />
                    </td>
                    <td className={`${td} cell-nowrap uppercase`}>{row.origem}</td>
                    <td className={`${td} cell-wrap`}>{row.empresaNome ?? '—'}</td>
                    <td
                      className={`${td} cell-wrap font-medium text-slate-900 dark:text-slate-100`}
                      title={row.clienteNome}
                    >
                      {row.clienteNome}
                    </td>
                    <td className={`${td} cell-nowrap`}>{row.codigoConta}</td>
                    <td className={`${td} cell-wrap`}>{row.banco ?? '—'}</td>
                    <td className={`${td} cell-nowrap tabular-nums text-right`}>{moneyBr(row.valor)}</td>
                    <td className={`${td} cell-nowrap`}>{row.diasAtraso}d</td>
                    <td className={`${td} cell-nowrap`} title={labelStatus(row.status)}>
                      {labelStatus(row.status)}
                    </td>
                    <td className={`${td} cell-wrap`}>
                      {row.responsavelNome || row.responsavelLogin || '—'}
                    </td>
                    <td className={`${td} cell-nowrap`}>{row.nfPd ?? '—'}</td>
                    <td className={`${td} cell-nowrap`}>
                      <button
                        type="button"
                        title="Histórico de tratativas"
                        onClick={() => setTarefaHist(row)}
                        className="inline-flex items-center gap-1 rounded-md p-1 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                      >
                        <History className="size-4" />
                        {row.contatosCount}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading ? (
              <tfoot className="sticky bottom-0 z-20">
                <tr className="border-t-2 border-slate-300 bg-slate-100 font-semibold dark:border-slate-500 dark:bg-slate-800">
                  {COLUMN_IDS.map((colId) => {
                    if (colId === 'banco') {
                      return (
                        <td key={colId} className={`${td} text-right text-slate-700 dark:text-slate-200`}>
                          Total
                        </td>
                      );
                    }
                    if (colId === 'valor') {
                      return (
                        <td
                          key={colId}
                          className={`${td} cell-nowrap tabular-nums text-right text-slate-900 dark:text-slate-100`}
                        >
                          {moneyBr(somaValor)}
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
            showDateRangeFilters={
              grade.colunaFiltroAberta === 'vencimento' ||
              grade.colunaFiltroAberta === 'dataBaixa' ||
              grade.colunaFiltroAberta === 'pagamento'
            }
          />
        ) : null}
      </div>

      {!loading ? (
        <p className="text-[11px] leading-none text-slate-500 dark:text-slate-400">
          {grade.rowsExibidas.length.toLocaleString('pt-BR')} linha
          {grade.rowsExibidas.length === 1 ? '' : 's'}
        </p>
      ) : null}

      <ModalHistoricoContatosTarefa
        tarefa={tarefaHist}
        open={tarefaHist != null}
        onClose={() => setTarefaHist(null)}
        onChanged={() => void carregar()}
      />
      <PdfGeneratingOverlay
        show={exportandoPdf || exportandoXlsx}
        mensagem={
          exportandoXlsx && !exportandoPdf
            ? 'Gerando planilha Excel…'
            : 'Gerando relatório em PDF…'
        }
        subtitulo="Tarefas de inadimplentes"
      />
    </section>
  );
}
