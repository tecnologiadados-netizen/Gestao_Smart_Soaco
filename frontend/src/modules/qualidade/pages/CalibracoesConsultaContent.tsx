import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@qualidade/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@qualidade/components/ui/table";
import { Badge } from "@qualidade/components/ui/badge";
import { EquipamentoCalibracaoFluxoDialog } from "@qualidade/components/calibracoes/equipamento-calibracao-fluxo-dialog";
import { EquipamentoEdicaoDialog } from "@qualidade/components/calibracoes/equipamento-edicao-dialog";
import {
  SgqGradeFiltroCabecalho,
  sgqTextoOuTraco,
} from "@qualidade/components/ui/sgq-grade-filtro-cabecalho";
import { SgqGradeFiltroPortal } from "@qualidade/components/ui/sgq-grade-filtro-portal";
import { SgqGradeSurface } from "@qualidade/components/ui/sgq-grade-surface";
import { useCalibrationsStore } from "@qualidade/lib/store/calibrations-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import { formatarData } from "@qualidade/lib/utils/dates";
import {
  dueStatusLabels,
  getDueStatusVariant,
} from "@qualidade/lib/utils/status-labels";
import { tipoCalibracaoSelectLabel } from "@qualidade/lib/utils/select-display";
import { cn } from "@qualidade/lib/utils";
import type { EquipmentWithDue } from "@qualidade/types/calibration";
import { useGradeFiltrosExcel } from "@/hooks/useGradeFiltrosExcel";

const COL_IDS = [
  "codigo",
  "descricao",
  "setor",
  "responsavel",
  "tipo",
  "proximaCalibracao",
  "status",
] as const;

export function CalibracoesConsultaContent() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("eq");

  const getEquipmentById = useCalibrationsStore((s) => s.getEquipmentById);
  const departments = useConfigStore((s) => s.departments);
  const users = useConfigStore((s) => s.users);

  const equipment = useCalibrationsStore((s) => s.equipment);
  const getEquipmentWithDue = useCalibrationsStore(
    (s) => s.getAllEquipmentWithDue
  );
  const equipmentComPrazo = useMemo(
    () => getEquipmentWithDue(),
    [equipment, getEquipmentWithDue]
  );
  const [equipamentoSelecionadoId, setEquipamentoSelecionadoId] = useState<
    string | null
  >(null);
  const [calibracaoFluxoId, setCalibracaoFluxoId] = useState<string | null>(
    null
  );
  const highlightAutoOpenHandled = useRef(false);

  useEffect(() => {
    if (!highlightId || highlightAutoOpenHandled.current) return;
    if (!getEquipmentById(highlightId)) return;

    setEquipamentoSelecionadoId(highlightId);
    highlightAutoOpenHandled.current = true;
  }, [highlightId, getEquipmentById]);

  function fecharEquipamentoDialog() {
    highlightAutoOpenHandled.current = true;
    setEquipamentoSelecionadoId(null);

    if (highlightId) {
      navigate(pathname, { replace: true });
    }
  }

  const getCellText = useCallback(
    (eq: EquipmentWithDue, columnId: string) => {
      switch (columnId) {
        case "codigo":
          return sgqTextoOuTraco(eq.codigo);
        case "descricao":
          return sgqTextoOuTraco(eq.descricao);
        case "setor":
          return departments.find((d) => d.id === eq.setorId)?.nome ?? "—";
        case "responsavel":
          return users.find((u) => u.id === eq.responsavelId)?.nome ?? "—";
        case "tipo":
          return tipoCalibracaoSelectLabel(eq.tipoCalibracao) ?? eq.tipoCalibracao;
        case "proximaCalibracao":
          return formatarData(eq.proximaCalibracao);
        case "status":
          return eq.ativo ? dueStatusLabels[eq.statusCalibracao] : "Inativo";
        default:
          return "";
      }
    },
    [departments, users]
  );

  const valueForSort = useCallback(
    (eq: EquipmentWithDue, columnId: string) => {
      if (columnId === "proximaCalibracao") return eq.proximaCalibracao ?? "";
      return getCellText(eq, columnId);
    },
    [getCellText]
  );

  const grade = useGradeFiltrosExcel<EquipmentWithDue>({
    rows: equipmentComPrazo,
    columnIds: [...COL_IDS],
    getCellText,
    valueForSort,
    dateColumnIds: ["proximaCalibracao"],
  });

  const filtrados = grade.rowsExibidas;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Consulta de equipamentos
        </h1>
        <p className="text-sm text-muted-foreground">
          {filtrados.length} equipamento(s) encontrado(s)
        </p>
      </div>

      <SgqGradeSurface
        scrollRef={grade.tableScrollRef}
        temFiltros={grade.temFiltrosOuOrdem}
        onLimparFiltros={grade.limparFiltrosGrade}
      >
        <Table bare>
          <TableHeader>
            <TableRow>
              {COL_IDS.map((colId) => (
                <SgqGradeFiltroCabecalho
                  key={colId}
                  label={
                    colId === "codigo"
                      ? "Código"
                        : colId === "descricao"
                        ? "Descrição"
                        : colId === "setor"
                            ? "Setor"
                            : colId === "responsavel"
                              ? "Calibração"
                              : colId === "tipo"
                                ? "Tipo"
                                : colId === "proximaCalibracao"
                                  ? "Próx. calibração"
                                  : "Status"
                  }
                  ativo={grade.colunaComFiltroAtivo(colId)}
                  onClick={(e) => grade.abrirFiltroExcel(colId, e)}
                />
              ))}
              <TableHead className="sticky top-0 z-10">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((eq) => (
              <TableRow
                key={eq.id}
                className={cn(
                  "cursor-pointer",
                  eq.id === highlightId && "bg-primary/5",
                  !eq.ativo && "opacity-45"
                )}
                onClick={() => setEquipamentoSelecionadoId(eq.id)}
              >
                <TableCell>
                  <span
                    className={cn(
                      "font-medium",
                      eq.ativo ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {eq.codigo}
                  </span>
                </TableCell>
                <TableCell
                  className={cn(
                    "max-w-xs truncate",
                    !eq.ativo && "text-muted-foreground"
                  )}
                >
                  {eq.descricao}
                </TableCell>
                <TableCell>
                  {departments.find((d) => d.id === eq.setorId)?.nome ?? "—"}
                </TableCell>
                <TableCell>
                  {users.find((u) => u.id === eq.responsavelId)?.nome ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {tipoCalibracaoSelectLabel(eq.tipoCalibracao) ??
                      eq.tipoCalibracao}
                  </Badge>
                </TableCell>
                <TableCell>{formatarData(eq.proximaCalibracao)}</TableCell>
                <TableCell>
                  {eq.ativo ? (
                    <Badge variant={getDueStatusVariant(eq.statusCalibracao)}>
                      {dueStatusLabels[eq.statusCalibracao]}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Inativo</Badge>
                  )}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!eq.ativo || eq.statusCalibracao === "em_dia"}
                    title={
                      !eq.ativo
                        ? "Equipamento inativo"
                        : eq.statusCalibracao === "em_dia"
                          ? "Calibração em dia — disponível quando próximo do vencimento"
                          : undefined
                    }
                    onClick={() => setCalibracaoFluxoId(eq.id)}
                  >
                    Calibrar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtrados.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={COL_IDS.length + 1}
                  className={cn("py-10 text-center text-muted-foreground")}
                >
                  {equipmentComPrazo.length === 0
                    ? "Nenhum equipamento encontrado."
                    : "Nenhum equipamento com os filtros da grade. Ajuste ou limpe os filtros por coluna."}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </SgqGradeSurface>

      <SgqGradeFiltroPortal
        grade={grade}
        dateColumnIds={["proximaCalibracao"]}
      />

      <EquipamentoEdicaoDialog
        equipmentId={equipamentoSelecionadoId}
        open={equipamentoSelecionadoId !== null}
        onOpenChange={(open) => {
          if (!open) fecharEquipamentoDialog();
        }}
      />

      <EquipamentoCalibracaoFluxoDialog
        equipmentId={calibracaoFluxoId}
        open={calibracaoFluxoId !== null}
        onOpenChange={(open) => {
          if (!open) setCalibracaoFluxoId(null);
        }}
      />
    </div>
  );
}
