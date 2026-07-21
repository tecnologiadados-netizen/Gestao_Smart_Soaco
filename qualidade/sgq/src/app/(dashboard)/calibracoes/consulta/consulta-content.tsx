"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  TABLE_FILTER_ALL,
  TableFilterField,
  TableFilterSearch,
  TableFiltersToolbar,
  tableFilterSelectTriggerClass,
} from "@/components/ui/table-filters-toolbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EquipamentoCalibracaoFluxoDialog } from "@/components/calibracoes/equipamento-calibracao-fluxo-dialog";
import { EquipamentoEdicaoDialog } from "@/components/calibracoes/equipamento-edicao-dialog";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { useTableSort } from "@/hooks/use-table-sort";
import { useCalibrationsStore } from "@/lib/store/calibrations-store";
import { useConfigStore } from "@/lib/store/config-store";
import { formatarData } from "@/lib/utils/dates";
import {
  dueStatusLabels,
  getDueStatusVariant,
} from "@/lib/utils/status-labels";
import {
  calibrationStatusFilterLabel,
  departmentFilterLabel,
  tipoCalibracaoFilterLabel,
  tipoCalibracaoSelectLabel,
  userFilterLabel,
} from "@/lib/utils/select-display";
import { cn } from "@/lib/utils";
import { sortByRules } from "@/lib/utils/table-sort";
import type { CalibrationType, DueStatus } from "@/types/calibration";

const calibrationTypes: CalibrationType[] = ["interna", "externa", "ambos"];
const calibrationStatuses: DueStatus[] = ["em_dia", "proximo", "vencido"];
const STATUS_FILTRO_INATIVO = "inativo";

type EquipamentoSortKey =
  | "codigo"
  | "descricao"
  | "local"
  | "tipo"
  | "proximaCalibracao"
  | "status";

export default function CalibracoesConsultaPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("eq");

  const getEquipmentById = useCalibrationsStore((s) => s.getEquipmentById);
  const departments = useConfigStore((s) => s.departments);
  const users = useConfigStore((s) => s.users);

  const equipment = useCalibrationsStore((s) => s.equipment);
  const getEquipmentWithDue = useCalibrationsStore((s) => s.getAllEquipmentWithDue);
  const equipmentComPrazo = useMemo(
    () => getEquipmentWithDue(),
    [equipment, getEquipmentWithDue]
  );
  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState(TABLE_FILTER_ALL);
  const [statusFiltro, setStatusFiltro] = useState(TABLE_FILTER_ALL);
  const [setorFiltro, setSetorFiltro] = useState(TABLE_FILTER_ALL);
  const [responsavelFiltro, setResponsavelFiltro] = useState(TABLE_FILTER_ALL);
  const [equipamentoSelecionadoId, setEquipamentoSelecionadoId] = useState<
    string | null
  >(null);
  const [calibracaoFluxoId, setCalibracaoFluxoId] = useState<string | null>(
    null
  );
  const highlightAutoOpenHandled = useRef(false);
  const { sorts, toggleSort, getSortState } = useTableSort<EquipamentoSortKey>();

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
      router.replace(pathname, { scroll: false });
    }
  }

  const filtrosAtivos =
    busca.trim() !== "" ||
    tipoFiltro !== TABLE_FILTER_ALL ||
    statusFiltro !== TABLE_FILTER_ALL ||
    setorFiltro !== TABLE_FILTER_ALL ||
    responsavelFiltro !== TABLE_FILTER_ALL;

  function limparFiltros() {
    setBusca("");
    setTipoFiltro(TABLE_FILTER_ALL);
    setStatusFiltro(TABLE_FILTER_ALL);
    setSetorFiltro(TABLE_FILTER_ALL);
    setResponsavelFiltro(TABLE_FILTER_ALL);
  }

  const filtrados = useMemo(() => {
    const lista = equipmentComPrazo.filter((eq) => {
      const q = busca.trim().toLowerCase();
      const matchBusca =
        !q ||
        eq.codigo.toLowerCase().includes(q) ||
        eq.descricao.toLowerCase().includes(q) ||
        eq.local.toLowerCase().includes(q);
      const matchTipo =
        tipoFiltro === TABLE_FILTER_ALL || eq.tipoCalibracao === tipoFiltro;
      const matchStatus =
        statusFiltro === TABLE_FILTER_ALL ||
        (statusFiltro === STATUS_FILTRO_INATIVO
          ? !eq.ativo
          : eq.ativo && eq.statusCalibracao === statusFiltro);
      const matchSetor =
        setorFiltro === TABLE_FILTER_ALL || eq.setorId === setorFiltro;
      const matchResponsavel =
        responsavelFiltro === TABLE_FILTER_ALL ||
        eq.responsavelId === responsavelFiltro;
      return matchBusca && matchTipo && matchStatus && matchSetor && matchResponsavel;
    });

    return sortByRules(lista, sorts, (eq, key) => {
      switch (key) {
        case "codigo":
          return eq.codigo;
        case "descricao":
          return eq.descricao;
        case "local":
          return eq.local;
        case "tipo":
          return eq.tipoCalibracao;
        case "proximaCalibracao":
          return eq.proximaCalibracao;
        case "status":
          return eq.ativo ? eq.statusCalibracao : STATUS_FILTRO_INATIVO;
      }
    });
  }, [
    equipmentComPrazo,
    busca,
    tipoFiltro,
    statusFiltro,
    setorFiltro,
    responsavelFiltro,
    sorts,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Consulta de equipamentos</h1>
        <p className="text-sm text-muted-foreground">
          {filtrados.length} equipamento(s) encontrado(s)
        </p>
      </div>

      <div className="sgq-table-surface overflow-hidden rounded-xl border border-border bg-card shadow-sm ring-1 ring-foreground/6">
        <TableFiltersToolbar
          gridClassName="sm:grid-cols-2 lg:grid-cols-6"
          onClear={limparFiltros}
          hasActiveFilters={filtrosAtivos}
        >
          <TableFilterField label="Busca" htmlFor="equip-busca" className="sm:col-span-2">
            <TableFilterSearch
              id="equip-busca"
              placeholder="Código, descrição ou local..."
              value={busca}
              onChange={setBusca}
            />
          </TableFilterField>
          <TableFilterField label="Tipo calibração" htmlFor="equip-tipo">
            <Select value={tipoFiltro} onValueChange={(v) => v && setTipoFiltro(v)}>
              <SelectTrigger id="equip-tipo" className={tableFilterSelectTriggerClass}>
                <SelectValue placeholder="Todos os tipos">
                  {tipoCalibracaoFilterLabel(tipoFiltro) ?? null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TABLE_FILTER_ALL}>Todos os tipos</SelectItem>
                {calibrationTypes.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>
                    {tipoCalibracaoSelectLabel(tipo)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableFilterField>
          <TableFilterField label="Status" htmlFor="equip-status">
            <Select value={statusFiltro} onValueChange={(v) => v && setStatusFiltro(v)}>
              <SelectTrigger id="equip-status" className={tableFilterSelectTriggerClass}>
                <SelectValue placeholder="Todos os status">
                  {calibrationStatusFilterLabel(statusFiltro) ?? null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TABLE_FILTER_ALL}>Todos os status</SelectItem>
                {calibrationStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {dueStatusLabels[status]}
                  </SelectItem>
                ))}
                <SelectItem value={STATUS_FILTRO_INATIVO}>Inativo</SelectItem>
              </SelectContent>
            </Select>
          </TableFilterField>
          <TableFilterField label="Setor" htmlFor="equip-setor">
            <Select value={setorFiltro} onValueChange={(v) => v && setSetorFiltro(v)}>
              <SelectTrigger id="equip-setor" className={tableFilterSelectTriggerClass}>
                <SelectValue placeholder="Todos os setores">
                  {departmentFilterLabel(departments, setorFiltro) ?? null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TABLE_FILTER_ALL}>Todos os setores</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableFilterField>
          <TableFilterField label="Responsável" htmlFor="equip-responsavel">
            <Select
              value={responsavelFiltro}
              onValueChange={(v) => v && setResponsavelFiltro(v)}
            >
              <SelectTrigger
                id="equip-responsavel"
                className={tableFilterSelectTriggerClass}
              >
                <SelectValue placeholder="Todos os responsáveis">
                  {userFilterLabel(users, responsavelFiltro) ?? null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TABLE_FILTER_ALL}>
                  Todos os responsáveis
                </SelectItem>
                {users
                  .filter((u) => u.ativo)
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </TableFilterField>
        </TableFiltersToolbar>

        <div className="overflow-x-auto">
          <Table bare>
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  sortKey="codigo"
                  sortState={getSortState("codigo")}
                  onSort={toggleSort}
                >
                  Código
                </SortableTableHead>
                <SortableTableHead
                  sortKey="descricao"
                  sortState={getSortState("descricao")}
                  onSort={toggleSort}
                >
                  Descrição
                </SortableTableHead>
                <SortableTableHead
                  sortKey="local"
                  sortState={getSortState("local")}
                  onSort={toggleSort}
                >
                  Local
                </SortableTableHead>
                <SortableTableHead
                  sortKey="tipo"
                  sortState={getSortState("tipo")}
                  onSort={toggleSort}
                >
                  Tipo
                </SortableTableHead>
                <SortableTableHead
                  sortKey="proximaCalibracao"
                  sortState={getSortState("proximaCalibracao")}
                  onSort={toggleSort}
                >
                  Próx. calibração
                </SortableTableHead>
                <SortableTableHead
                  sortKey="status"
                  sortState={getSortState("status")}
                  onSort={toggleSort}
                >
                  Status
                </SortableTableHead>
                <TableHead>Ações</TableHead>
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
                  <TableCell className="text-sm text-muted-foreground">
                    {eq.local}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {eq.tipoCalibracao}
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
                    colSpan={7}
                    className={cn("py-10 text-center text-muted-foreground")}
                  >
                    Nenhum equipamento encontrado.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>

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
