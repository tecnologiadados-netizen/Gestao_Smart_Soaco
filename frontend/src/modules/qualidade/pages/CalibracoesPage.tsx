import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { CalibracoesPendenciasBoards } from "@qualidade/components/calibracoes/calibracoes-pendencias-boards";
import { Button } from "@qualidade/components/ui/button";
import { useCalibrationsStore } from "@qualidade/lib/store/calibrations-store";
import type { DueStatus, EquipmentWithDue } from "@qualidade/types/calibration";

type FiltroVencimento = "ambas" | "vencidas" | "proximas";

const FILTRO_OPCOES: { value: FiltroVencimento; label: string }[] = [
  { value: "ambas", label: "Ambas" },
  { value: "vencidas", label: "Vencidas" },
  { value: "proximas", label: "Próximas" },
];

function statusPassaFiltro(
  status: DueStatus,
  filtro: FiltroVencimento
): boolean {
  if (filtro === "vencidas") return status === "vencido";
  if (filtro === "proximas") return status === "proximo";
  return status === "vencido" || status === "proximo";
}

/** Vencidas (vermelho) antes das próximas (amarelo); depois pela data. */
function ordenarPorVencimento(items: EquipmentWithDue[]): EquipmentWithDue[] {
  return [...items].sort((a, b) => {
    const rank = (s: DueStatus) =>
      s === "vencido" ? 0 : s === "proximo" ? 1 : 2;
    const byStatus = rank(a.statusCalibracao) - rank(b.statusCalibracao);
    if (byStatus !== 0) return byStatus;
    return (a.proximaCalibracao ?? "").localeCompare(
      b.proximaCalibracao ?? ""
    );
  });
}

export function CalibracoesPage() {
  const equipment = useCalibrationsStore((s) => s.equipment);
  const getPendingCalibrations = useCalibrationsStore(
    (s) => s.getPendingCalibrations
  );
  const [filtroVencimento, setFiltroVencimento] =
    useState<FiltroVencimento>("ambas");

  const internas = useMemo(
    () =>
      ordenarPorVencimento(
        getPendingCalibrations("interna").filter((e) =>
          statusPassaFiltro(e.statusCalibracao, filtroVencimento)
        )
      ),
    [equipment, getPendingCalibrations, filtroVencimento]
  );
  const externas = useMemo(
    () =>
      ordenarPorVencimento(
        getPendingCalibrations("externa").filter((e) =>
          statusPassaFiltro(e.statusCalibracao, filtroVencimento)
        )
      ),
    [equipment, getPendingCalibrations, filtroVencimento]
  );

  const totalPendencias = internas.length + externas.length;
  const totalGeral = useMemo(() => {
    const i = getPendingCalibrations("interna").length;
    const e = getPendingCalibrations("externa").length;
    return i + e;
  }, [equipment, getPendingCalibrations]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Calibrações</h1>
          <p className="text-xs text-muted-foreground">
            Pendências de calibrações
            {totalPendencias > 0
              ? ` · ${totalPendencias} equipamento(s)`
              : filtroVencimento !== "ambas" && totalGeral > 0
                ? " · nenhum neste filtro"
                : ""}
          </p>
        </div>
        <div
          className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/30 p-1"
          role="group"
          aria-label="Filtrar por vencimento"
        >
          {FILTRO_OPCOES.map((opcao) => (
            <Button
              key={opcao.value}
              type="button"
              size="sm"
              variant={filtroVencimento === opcao.value ? "default" : "ghost"}
              className="h-8 px-3 text-xs"
              onClick={() => setFiltroVencimento(opcao.value)}
            >
              {opcao.label}
            </Button>
          ))}
        </div>
      </div>

      {totalGeral > 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="size-4 shrink-0" />
          Existem equipamentos com calibrações pendentes.
        </div>
      ) : null}

      <CalibracoesPendenciasBoards internas={internas} externas={externas} />
    </div>
  );
}
