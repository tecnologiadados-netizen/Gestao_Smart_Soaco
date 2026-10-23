import GradeFiltroCabecalhoBtn from '../../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal, { type FiltroCorCabecalho } from '../../../components/grade/GradeFiltroExcelPortal';
import type { useGradeFiltrosExcel } from '../../../hooks/useGradeFiltrosExcel';
import type { GradeColunasExcelApi } from '../../../components/grade/GradeColunasExcel';

export const DIARIO_COLUNAS_GRADE = [
  { id: 'codigo', label: 'Código' },
  { id: 'situacao', label: 'Situação' },
  { id: 'plano', label: 'Classificação' },
  { id: 'vencimento', label: 'Vencimento' },
  { id: 'reprogramado', label: 'Reprogramado' },
  { id: 'cartorio', label: 'Cartório' },
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

const NUMERICAS = new Set(['valor', 'baixado', 'saldo', 'dias', 'codigo']);
const DATAS = new Set(['vencimento', 'baixa']);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GradeApi = ReturnType<typeof useGradeFiltrosExcel<any>>;

export function DiarioCabecalhoTh({
  colId,
  label,
  grade,
  colunas,
  align = 'left',
  filtroExtraAtivo = false,
  className = '',
}: {
  colId: string;
  label: string;
  grade: GradeApi;
  colunas?: GradeColunasExcelApi;
  align?: 'left' | 'right' | 'center';
  filtroExtraAtivo?: boolean;
  className?: string;
}) {
  return (
    <th
      className={`relative px-0 py-0 align-top font-medium whitespace-normal break-words [overflow-wrap:anywhere] ${className}`.trim()}
      style={colunas?.estiloColuna(colId)}
      {...colunas?.propsArrastar(colId)}
    >
      <div
        className={`flex min-h-[2rem] items-center gap-1 px-1.5 py-1 ${
          align === 'right' ? 'flex-row-reverse justify-end' : align === 'center' ? 'justify-center' : 'justify-between'
        }`}
      >
        <span className={`min-w-0 whitespace-normal break-words [overflow-wrap:anywhere] ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : ''}`}>{label}</span>
        <GradeFiltroCabecalhoBtn
          ativo={grade.colunaComFiltroAtivo(colId) || filtroExtraAtivo}
          onClick={(e) => grade.abrirFiltroExcel(colId, e)}
          className="shrink-0"
        />
      </div>
      {colunas ? (
        <button
          type="button"
          aria-label={`Redimensionar coluna ${label}`}
          title="Arraste para redimensionar"
          draggable={false}
          onMouseDown={(evento) => colunas.iniciarRedimensionamento(colId, evento)}
          onClick={(evento) => evento.stopPropagation()}
          className="absolute inset-y-0 right-0 z-10 w-1 cursor-col-resize bg-transparent hover:bg-white/70"
        />
      ) : null}
    </th>
  );
}

export function DiarioGradeFiltroPortal({
  grade,
  filtroCor,
  onOrdenacaoTexto,
  zIndex,
}: {
  grade: GradeApi;
  filtroCor?: FiltroCorCabecalho;
  onOrdenacaoTexto?: () => void;
  zIndex?: number;
}) {
  if (!grade.colunaFiltroAberta || !grade.filtroAbertoRect) return null;
  const colId = grade.colunaFiltroAberta;
  const numerica = NUMERICAS.has(colId) || colId === 'total' || colId.startsWith('emp:');
  return (
    <GradeFiltroExcelPortal
      colunaAberta={colId}
      rect={grade.filtroAbertoRect}
      dropdownRef={grade.filtroDropdownRef}
      excelFilterDrafts={grade.excelFilterDrafts}
      setExcelFilterDrafts={grade.setExcelFilterDrafts}
      valoresUnicosPorColuna={grade.valoresUnicosPorColuna}
      zIndex={zIndex}
      filtroCor={colId === 'anotacao' ? filtroCor : undefined}
      onSortAsc={(id) => {
        onOrdenacaoTexto?.();
        grade.setSortState({ key: id, direction: 'asc' });
        grade.setSortLevels([]);
        grade.fecharFiltroExcel();
      }}
      onSortDesc={(id) => {
        onOrdenacaoTexto?.();
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
