import type { Dispatch, RefObject, SetStateAction } from "react";
import GradeFiltroExcelPortal from "@/components/grade/GradeFiltroExcelPortal";
import type { ExcelFilterDraft, SortDir } from "@/hooks/useGradeFiltrosExcel";

type GradeExcelPortal = {
  colunaFiltroAberta: string | null;
  filtroAbertoRect: {
    top: number;
    left: number;
    width: number;
    bottom?: number;
  } | null;
  filtroDropdownRef: RefObject<HTMLDivElement | null>;
  excelFilterDrafts: Record<string, ExcelFilterDraft>;
  setExcelFilterDrafts: Dispatch<SetStateAction<Record<string, ExcelFilterDraft>>>;
  valoresUnicosPorColuna: Record<string, string[]>;
  setSortState: (state: { key: string; direction: SortDir } | null) => void;
  setSortLevels: (levels: { id: string; dir: SortDir }[]) => void;
  fecharFiltroExcel: () => void;
  aplicarFiltroExcel: (colId: string) => void;
};

interface SgqGradeFiltroPortalProps {
  grade: GradeExcelPortal;
  dateColumnIds?: string[];
  numericColumnIds?: string[];
}

export function SgqGradeFiltroPortal({
  grade,
  dateColumnIds = [],
  numericColumnIds = [],
}: SgqGradeFiltroPortalProps) {
  if (!grade.colunaFiltroAberta || !grade.filtroAbertoRect) return null;

  const col = grade.colunaFiltroAberta;
  const numerica = numericColumnIds.includes(col);

  return (
    <GradeFiltroExcelPortal
      colunaAberta={col}
      rect={grade.filtroAbertoRect}
      dropdownRef={grade.filtroDropdownRef}
      excelFilterDrafts={grade.excelFilterDrafts}
      setExcelFilterDrafts={grade.setExcelFilterDrafts}
      valoresUnicosPorColuna={grade.valoresUnicosPorColuna}
      onSortAsc={(colId) => {
        grade.setSortState({ key: colId, direction: "asc" });
        grade.setSortLevels([]);
        grade.fecharFiltroExcel();
      }}
      onSortDesc={(colId) => {
        grade.setSortState({ key: colId, direction: "desc" });
        grade.setSortLevels([]);
        grade.fecharFiltroExcel();
      }}
      onAplicar={grade.aplicarFiltroExcel}
      onCancelar={grade.fecharFiltroExcel}
      showDateRangeFilters={dateColumnIds.includes(col)}
      showNumericFilters={numerica}
      sortAscLabel={numerica ? "Menor para maior" : undefined}
      sortDescLabel={numerica ? "Maior para menor" : undefined}
    />
  );
}
