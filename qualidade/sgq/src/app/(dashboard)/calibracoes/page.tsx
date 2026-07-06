"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { CalibracoesPendenciasBoards } from "@/components/calibracoes/calibracoes-pendencias-boards";
import { useCalibrationsStore } from "@/lib/store/calibrations-store";

export default function CalibracoesPage() {
  const equipment = useCalibrationsStore((s) => s.equipment);
  const getPendingCalibrations = useCalibrationsStore(
    (s) => s.getPendingCalibrations
  );

  const internas = useMemo(
    () => getPendingCalibrations("interna"),
    [equipment, getPendingCalibrations]
  );
  const externas = useMemo(
    () => getPendingCalibrations("externa"),
    [equipment, getPendingCalibrations]
  );  const totalPendencias = internas.length + externas.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Calibrações</h1>
        <p className="text-xs text-muted-foreground">
          Pendências de calibrações
          {totalPendencias > 0
            ? ` · ${totalPendencias} equipamento(s)`
            : ""}
        </p>
      </div>

      {totalPendencias > 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="size-4 shrink-0" />
          Existem equipamentos com calibrações pendentes.
        </div>
      ) : null}

      <CalibracoesPendenciasBoards internas={internas} externas={externas} />
    </div>
  );
}
