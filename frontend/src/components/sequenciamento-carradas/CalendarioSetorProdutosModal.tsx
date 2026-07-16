import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  formatQtdeInt,
  listarProdutosSetorCalendario,
  type CarradaBaseline,
  type ProdutoSetorCalendarioRow,
  type SimEntry,
} from './simulacaoCarradas';
import { SUBTOTAL_ROW_CLASS } from './sequenciamentoCarradasUtils';
import { useGradeFiltrosExcel } from '../../hooks/useGradeFiltrosExcel';
import GradeFiltroCabecalhoBtn from '../grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../grade/GradeFiltroExcelPortal';
import { useRegisterModalEscape } from '../../contexts/ModalStackContext';
import ModalConsultaEstoqueEmbed from '../pcp/ModalConsultaEstoqueEmbed';
import GradeCelulaModalBtn from '../pcp/GradeCelulaModalBtn';

const COLS = ['codigo', 'descricao', 'qtdePendente'] as const;

const COL_LABELS: Record<(typeof COLS)[number], string> = {
  codigo: 'Código',
  descricao: 'Descrição',
  qtdePendente: 'Qtde Pendente Real',
};

const TH =
  'sticky top-0 z-20 border border-primary-500/40 bg-primary-600 px-2 py-2 font-semibold text-white shadow-[0_1px_0_rgba(0,0,0,0.12)]';
const TD = 'px-2 py-1.5 text-slate-700 dark:text-slate-200';

type Props = {
  setor: string;
  linhas: Record<string, unknown>[];
  sim: Map<string, SimEntry>;
  baseline: Map<string, CarradaBaseline>;
  dataInserirRomaneio: string;
  onClose: () => void;
};

function textoCelula(row: ProdutoSetorCalendarioRow, colId: string): string {
  if (colId === 'codigo') return row.codigo;
  if (colId === 'descricao') return row.descricao;
  if (colId === 'qtdePendente') return formatQtdeInt(row.qtdePendente);
  return '';
}

function valorOrdenacao(row: ProdutoSetorCalendarioRow, colId: string): string | number {
  if (colId === 'qtdePendente') return row.qtdePendente;
  return textoCelula(row, colId);
}

export default function CalendarioSetorProdutosModal({
  setor,
  linhas,
  sim,
  baseline,
  dataInserirRomaneio,
  onClose,
}: Props) {
  const [consultaCodigo, setConsultaCodigo] = useState<string | null>(null);

  const produtos = useMemo(
    () => listarProdutosSetorCalendario(linhas, setor, sim, baseline, dataInserirRomaneio),
    [linhas, setor, sim, baseline, dataInserirRomaneio]
  );

  const grade = useGradeFiltrosExcel<ProdutoSetorCalendarioRow>({
    rows: produtos,
    columnIds: [...COLS],
    getCellText: textoCelula,
    valueForSort: valorOrdenacao,
    defaultSortLevels: [],
  });

  const subtotal = useMemo(
    () => grade.rowsExibidas.reduce((s, r) => s + r.qtdePendente, 0),
    [grade.rowsExibidas]
  );

  const handleEscape = () => {
    if (consultaCodigo) return;
    if (grade.colunaFiltroAberta) {
      grade.fecharFiltroExcel();
      return;
    }
    onClose();
  };

  useRegisterModalEscape({ id: 'calendario-setor-produtos', onClose: handleEscape, zIndex: 131 });

  return createPortal(
    <div
      className="fixed inset-0 z-[131] flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(85vh,640px)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-800"
        role="dialog"
        aria-modal
        aria-labelledby="calendario-setor-produtos-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div className="min-w-0">
            <h2
              id="calendario-setor-produtos-titulo"
              className="text-lg font-semibold text-slate-800 dark:text-slate-100"
            >
              Setor de produção — {setor}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Códigos e quantidades pendentes que compõem o setor no calendário.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-700"
            aria-label="Fechar"
          >
            ×
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

        <div ref={grade.tableScrollRef} className="min-h-0 flex-1 overflow-auto">
          {produtos.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Nenhum produto com quantidade pendente neste setor.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {COLS.map((colId) => {
                    const numeric = colId === 'qtdePendente';
                    return (
                      <th
                        key={colId}
                        className={`${TH} ${numeric ? 'pr-4 text-right' : colId === 'codigo' ? 'pl-4 text-left' : 'text-left'}`}
                      >
                        <div
                          className={`flex items-center gap-1 ${numeric ? 'justify-end' : 'justify-between'}`}
                        >
                          <span>{COL_LABELS[colId]}</span>
                          <GradeFiltroCabecalhoBtn
                            ativo={grade.colunaComFiltroAtivo(colId)}
                            onClick={(e) => grade.abrirFiltroExcel(colId, e)}
                          />
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {grade.rowsExibidas.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-slate-500 dark:text-slate-400">
                      Nenhum produto corresponde aos filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  <>
                    {grade.rowsExibidas.map((r) => (
                      <tr key={r.codigo} className="border-b border-slate-100 dark:border-slate-700">
                        <td className={`${TD} pl-4 font-mono`}>
                          {r.codigo ? (
                            <GradeCelulaModalBtn
                              onClick={() => setConsultaCodigo(r.codigo)}
                              title={`Consultar estoque de ${r.codigo}`}
                              align="left"
                            >
                              {r.codigo}
                            </GradeCelulaModalBtn>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className={TD}>{r.descricao || '—'}</td>
                        <td className={`${TD} pr-4 text-right tabular-nums`}>
                          {formatQtdeInt(r.qtdePendente)}
                        </td>
                      </tr>
                    ))}
                    <tr className={SUBTOTAL_ROW_CLASS}>
                      <td className={`${TD} pl-4`} colSpan={2}>
                        Total
                      </td>
                      <td className={`${TD} pr-4 text-right tabular-nums`}>{formatQtdeInt(subtotal)}</td>
                    </tr>
                  </>
                )}
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
            sortAscLabel={grade.colunaFiltroAberta === 'qtdePendente' ? 'Menor para Maior' : undefined}
            sortDescLabel={grade.colunaFiltroAberta === 'qtdePendente' ? 'Maior para Menor' : undefined}
            showNumericFilters={grade.colunaFiltroAberta === 'qtdePendente'}
          />
        )}

        <div className="flex shrink-0 justify-end border-t border-slate-200 px-4 py-3 dark:border-slate-600">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Fechar
          </button>
        </div>
      </div>
      {consultaCodigo ? (
        <ModalConsultaEstoqueEmbed codigo={consultaCodigo} onClose={() => setConsultaCodigo(null)} />
      ) : null}
    </div>,
    document.body
  );
}
