import GradeFiltroCabecalhoBtn from '../../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../../components/grade/GradeFiltroExcelPortal';
import type { useGradeFiltrosExcel } from '../../../hooks/useGradeFiltrosExcel';
import type { DiarioContaPagarLinha } from '../../../api/diarioFinanceiro';

export const DIARIO_COLUNAS_GRADE = [
  { id: 'codigo', label: 'Código' },
  { id: 'situacao', label: 'Situação' },
  { id: 'plano', label: 'Classificação' },
  { id: 'vencimento', label: 'Vencimento' },
  { id: 'empresa', label: 'Empresa' },
  { id: 'conta', label: 'Conta' },
  { id: 'forma', label: 'Forma de pagamento' },
  { id: 'fornecedor', label: 'Pessoa' },
  { id: 'descricao', label: 'Descrição' },
  { id: 'observacao', label: 'Comentários' },
  { id: 'anotacao', label: 'Observação' },
  { id: 'pc', label: 'Pedido de compra' },
  { id: 'saldo', label: 'Saldo a pagar', align: 'right' as const },
  { id: 'nfe', label: 'NF' },
  { id: 'prioridade', label: 'Prioridade' },
  { id: 'itens', label: 'Itens', align: 'center' as const },
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
  align?: 'left' | 'right' | 'center';
}) {
  return (
    <th className="px-0 py-0 font-medium whitespace-nowrap">
      <div
        className={`flex min-h-[2rem] items-center gap-1 px-1.5 py-1 ${
          align === 'right' ? 'flex-row-reverse justify-end' : align === 'center' ? 'justify-center' : 'justify-between'
        }`}
      >
        <span className={`min-w-0 ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : ''}`}>{label}</span>
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
