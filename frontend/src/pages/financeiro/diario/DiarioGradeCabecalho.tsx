import GradeFiltroCabecalhoBtn from '../../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../../components/grade/GradeFiltroExcelPortal';
import type { useGradeFiltrosExcel } from '../../../hooks/useGradeFiltrosExcel';
import type { DiarioContaPagarLinha } from '../../../api/diarioFinanceiro';

export const DIARIO_COLUNAS_GRADE = [
  { id: 'origem', label: 'Origem' },
  { id: 'situacao', label: 'Situação' },
  { id: 'vencimento', label: 'Vencimento' },
  { id: 'baixa', label: 'Baixa' },
  { id: 'fornecedor', label: 'Fornecedor' },
  { id: 'empresa', label: 'Empresa' },
  { id: 'plano', label: 'Plano de contas' },
  { id: 'descricao', label: 'Descrição' },
  { id: 'observacao', label: 'Observações' },
  { id: 'forma', label: 'Forma pgto' },
  { id: 'conta', label: 'Conta bancária' },
  { id: 'valor', label: 'Valor', align: 'right' as const },
  { id: 'baixado', label: 'Baixado', align: 'right' as const },
  { id: 'saldo', label: 'Saldo', align: 'right' as const },
];

const NUMERICAS = new Set(['valor', 'baixado', 'saldo']);
const DATAS = new Set(['vencimento', 'baixa']);

type GradeApi = ReturnType<typeof useGradeFiltrosExcel<DiarioContaPagarLinha>>;

export function DiarioCabecalhoTh({
  colId,
  label,
  grade,
  align = 'left',
}: {
  colId: string;
  label: string;
  grade: GradeApi;
  align?: 'left' | 'right';
}) {
  return (
    <th className="px-0 py-0 font-medium whitespace-nowrap">
      <div
        className={`flex min-h-[2rem] items-center gap-1 px-1.5 py-1 ${
          align === 'right' ? 'flex-row-reverse justify-end' : 'justify-between'
        }`}
      >
        <span className={`min-w-0 ${align === 'right' ? 'text-right' : ''}`}>{label}</span>
        <GradeFiltroCabecalhoBtn
          ativo={grade.colunaComFiltroAtivo(colId)}
          onClick={(e) => grade.abrirFiltroExcel(colId, e)}
          className="shrink-0"
        />
      </div>
    </th>
  );
}

export function DiarioGradeFiltroPortal({ grade }: { grade: GradeApi }) {
  if (!grade.colunaFiltroAberta || !grade.filtroAbertoRect) return null;
  const colId = grade.colunaFiltroAberta;
  const numerica = NUMERICAS.has(colId);
  return (
    <GradeFiltroExcelPortal
      colunaAberta={colId}
      rect={grade.filtroAbertoRect}
      dropdownRef={grade.filtroDropdownRef}
      excelFilterDrafts={grade.excelFilterDrafts}
      setExcelFilterDrafts={grade.setExcelFilterDrafts}
      valoresUnicosPorColuna={grade.valoresUnicosPorColuna}
      onSortAsc={(id) => {
        grade.setSortState({ key: id, direction: 'asc' });
        grade.setSortLevels([]);
        grade.fecharFiltroExcel();
      }}
      onSortDesc={(id) => {
        grade.setSortState({ key: id, direction: 'desc' });
        grade.setSortLevels([]);
        grade.fecharFiltroExcel();
      }}
      onAplicar={grade.aplicarFiltroExcel}
      onCancelar={grade.fecharFiltroExcel}
      showNumericFilters={numerica}
      showDateRangeFilters={DATAS.has(colId)}
      sortAscLabel={numerica ? 'Menor → Maior' : undefined}
      sortDescLabel={numerica ? 'Maior → Menor' : undefined}
    />
  );
}
