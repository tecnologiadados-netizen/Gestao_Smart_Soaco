import { useCallback } from "react";
import type { OrganicoRow } from "@rh/types/api";
import type { SecullumFuncionario } from "@rh/lib/api-client";
import {
  parseAbsenteismoPorHorasExcelWithStats,
  type ParseAbsenteismoPorHorasResult,
  type ParseAbsenteismoPorHorasStats,
} from "./excel";
import type { AbsenteismoPorHorasRow } from "./types";

export function useAbsenteismoPorHorasExcel() {
  const parseFile = useCallback(
    async (file: File, organicoRows: OrganicoRow[] = [], secullumFuncionarios: SecullumFuncionario[] = []) => {
      return parseAbsenteismoPorHorasExcelWithStats(file, organicoRows, secullumFuncionarios);
    },
    [],
  );

  return { parseFile };
}

export type { AbsenteismoPorHorasRow, ParseAbsenteismoPorHorasResult, ParseAbsenteismoPorHorasStats };
