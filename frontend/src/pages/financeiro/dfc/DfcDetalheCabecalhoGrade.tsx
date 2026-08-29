import GradeFiltroCabecalhoBtn from '../../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../../components/grade/GradeFiltroExcelPortal';
import type { useGradeFiltrosExcel } from '../../../hooks/useGradeFiltrosExcel';
import type { DfcAgendamentoDetalheLinha } from '../../../api/financeiro';
import {
  DFC_DETALHE_DATAS,
  DFC_DETALHE_NUMERIC,
  type DfcDetalheColId,
} from './dfcDetalheGradeExcel';

type GradeApi = ReturnType<typeof useGradeFiltrosExcel<DfcAgendamentoDetalheLinha>>;

type DfcDetalheCabecalhoThProps = {
  colId: DfcDetalheColId;
  label: string;
  grade: GradeApi;
  align?: 'left' | 'right';
  className?: string;
};

export function DfcDetalheCabecalhoTh({
  colId,
  label,
  grade,
  align = 'left',
  className = '',
}: DfcDetalheCabecalhoThProps) {
  return (
    <th className={`px-0 py-0 font-semibold ${className}`}>
      <div
        className={`flex min-h-[2.25rem] items-center gap-1 px-1.5 py-1 ${
          align === 'right' ? 'flex-row-reverse justify-end' : 'justify-between'
        }`}
      >
        <span
          className={`min-w-0 flex-1 text-xs leading-tight ${align === 'right' ? 'text-right' : ''}`}
          title={label}
        >
          {label}
        </span>
        <GradeFiltroCabecalhoBtn
          ativo={grade.colunaComFiltroAtivo(colId)}
          onClick={(e) => grade.abrirFiltroExcel(colId, e)}
          className="shrink-0"
        />
      </div>
    </th>
  );
}

type DfcDetalheGradeFiltroPortalProps = {
  grade: GradeApi;
  zIndex?: number;
};

export function DfcDetalheGradeFiltroPortal({ grade, zIndex = 10100 }: DfcDetalheGradeFiltroPortalProps) {
  if (!grade.colunaFiltroAberta || !grade.filtroAbertoRect) return null;
  const colId = grade.colunaFiltroAberta as DfcDetalheColId;
  return (
    <GradeFiltroExcelPortal
      colunaAberta={grade.colunaFiltroAberta}
      rect={grade.filtroAbertoRect}
      dropdownRef={grade.filtroDropdownRef}
      excelFilterDrafts={grade.excelFilterDrafts}
      setExcelFilterDrafts={grade.setExcelFilterDrafts}
      valoresUnicosPorColuna={grade.valoresUnicosPorColuna}
      zIndex={zIndex}
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
      showNumericFilters={DFC_DETALHE_NUMERIC.has(colId)}
      showDateRangeFilters={DFC_DETALHE_DATAS.has(colId)}
      sortAscLabel={DFC_DETALHE_NUMERIC.has(colId) ? 'Menor → Maior' : undefined}
      sortDescLabel={DFC_DETALHE_NUMERIC.has(colId) ? 'Maior → Menor' : undefined}
    />
  );
}
