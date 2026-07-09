"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TABLE_FILTER_ALL,
  TableFilterField,
  TableFilterSearch,
  TableFiltersToolbar,
  tableFilterSelectTriggerClass,
} from "@/components/ui/table-filters-toolbar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DocumentoConsultaDetalheDialog } from "@/components/documentos/documento-consulta-detalhe-dialog";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { useTableSort } from "@/hooks/use-table-sort";
import { useDocumentsStore } from "@/lib/store/documents-store";
import { useConfigStore } from "@/lib/store/config-store";
import {
  documentStatusLabels,
  documentOrigemLabels,
  getDocumentStatusVariant,
  getDocumentOrigemVariant,
  getDueStatusVariant,
  dueStatusLabels,
} from "@/lib/utils/status-labels";
import { formatarData } from "@/lib/utils/dates";
import {
  calcularDiasRestantesValidade,
  calcularValidadeStatus,
} from "@/lib/documents/validity";
import { cn } from "@/lib/utils";
import { sortByRules } from "@/lib/utils/table-sort";
import {
  departmentFilterLabel,
  documentOrigemFilterLabel,
  documentStatusFilterLabel,
} from "@/lib/utils/select-display";
import type { DocumentOrigem, DocumentStatus } from "@/types/document";

type DocumentoSortKey =
  | "codigo"
  | "titulo"
  | "tipo"
  | "categoria"
  | "setor"
  | "revisao"
  | "status"
  | "validade"
  | "atualizado";

export default function DocumentosConsultaPage() {
  const documents = useDocumentsStore((s) => s.documents);
  const syncValidadeAlertas = useDocumentsStore((s) => s.syncValidadeAlertas);
  const departments = useConfigStore((s) => s.departments);
  const documentTypes = useConfigStore((s) => s.documentTypes);

  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState(TABLE_FILTER_ALL);
  const [statusFiltro, setStatusFiltro] = useState(TABLE_FILTER_ALL);
  const [setorFiltro, setSetorFiltro] = useState(TABLE_FILTER_ALL);
  const [documentoSelecionadoId, setDocumentoSelecionadoId] = useState<
    string | null
  >(null);
  const { sorts, toggleSort, getSortState } = useTableSort<DocumentoSortKey>();

  const filtrosAtivos =
    busca.trim() !== "" ||
    tipoFiltro !== TABLE_FILTER_ALL ||
    statusFiltro !== TABLE_FILTER_ALL ||
    setorFiltro !== TABLE_FILTER_ALL;

  function limparFiltros() {
    setBusca("");
    setTipoFiltro(TABLE_FILTER_ALL);
    setStatusFiltro(TABLE_FILTER_ALL);
    setSetorFiltro(TABLE_FILTER_ALL);
  }

  useEffect(() => {
    syncValidadeAlertas();
  }, [syncValidadeAlertas]);

  const filtrados = useMemo(() => {
    const lista = documents.filter((doc) => {
      const matchBusca =
        !busca ||
        doc.codigo.toLowerCase().includes(busca.toLowerCase()) ||
        doc.titulo.toLowerCase().includes(busca.toLowerCase());
      const matchStatus =
        statusFiltro === TABLE_FILTER_ALL || doc.status === statusFiltro;
      const matchTipo =
        tipoFiltro === TABLE_FILTER_ALL || doc.origem === tipoFiltro;
      const matchSetor =
        setorFiltro === TABLE_FILTER_ALL || doc.setorId === setorFiltro;
      return matchBusca && matchStatus && matchTipo && matchSetor;
    });

    return sortByRules(lista, sorts, (doc, key) => {
      const tipo = documentTypes.find((t) => t.id === doc.tipoId);
      const setor = departments.find((d) => d.id === doc.setorId);

      switch (key) {
        case "codigo":
          return doc.codigo;
        case "titulo":
          return doc.titulo;
        case "tipo":
          return documentOrigemLabels[doc.origem];
        case "categoria":
          return tipo?.sigla ?? "";
        case "setor":
          return setor?.sigla ?? "";
        case "revisao":
          return doc.versaoAtual;
        case "status":
          return documentStatusLabels[doc.status];
        case "validade":
          return doc.validade?.ativa ? doc.validade.dataValidade : "";
        case "atualizado":
          return doc.updatedAt;
      }
    });
  }, [
    documents,
    busca,
    statusFiltro,
    tipoFiltro,
    setorFiltro,
    sorts,
    documentTypes,
    departments,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Consulta de documentos
        </h1>
        <p className="text-sm text-muted-foreground">
          {filtrados.length} documento(s) encontrado(s)
        </p>
      </div>

      <div className="sgq-table-surface overflow-hidden rounded-xl border border-border bg-card shadow-sm ring-1 ring-foreground/6">
        <TableFiltersToolbar
          gridClassName="sm:grid-cols-2 lg:grid-cols-5"
          onClear={limparFiltros}
          hasActiveFilters={filtrosAtivos}
        >
          <TableFilterField
            label="Busca"
            htmlFor="consulta-busca"
            className="sm:col-span-2"
          >
            <TableFilterSearch
              id="consulta-busca"
              placeholder="Código ou título..."
              value={busca}
              onChange={setBusca}
            />
          </TableFilterField>
          <TableFilterField label="Tipo" htmlFor="consulta-tipo">
            <Select value={tipoFiltro} onValueChange={(v) => v && setTipoFiltro(v)}>
              <SelectTrigger id="consulta-tipo" className={tableFilterSelectTriggerClass}>
                <SelectValue placeholder="Todos os tipos">
                  {documentOrigemFilterLabel(tipoFiltro) ?? null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TABLE_FILTER_ALL}>Todos os tipos</SelectItem>
                {(Object.keys(documentOrigemLabels) as DocumentOrigem[]).map(
                  (origem) => (
                    <SelectItem key={origem} value={origem}>
                      {documentOrigemLabels[origem]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </TableFilterField>
          <TableFilterField label="Status" htmlFor="consulta-status">
            <Select value={statusFiltro} onValueChange={(v) => v && setStatusFiltro(v)}>
              <SelectTrigger id="consulta-status" className={tableFilterSelectTriggerClass}>
                <SelectValue placeholder="Todos os status">
                  {documentStatusFilterLabel(statusFiltro) ?? null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TABLE_FILTER_ALL}>Todos os status</SelectItem>
                {(Object.keys(documentStatusLabels) as DocumentStatus[]).map(
                  (s) => (
                    <SelectItem key={s} value={s}>
                      {documentStatusLabels[s]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </TableFilterField>
          <TableFilterField label="Setor" htmlFor="consulta-setor">
            <Select value={setorFiltro} onValueChange={(v) => v && setSetorFiltro(v)}>
              <SelectTrigger id="consulta-setor" className={tableFilterSelectTriggerClass}>
                <SelectValue placeholder="Todos os setores">
                  {departmentFilterLabel(departments, setorFiltro) ?? null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TABLE_FILTER_ALL}>Todos os setores</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.sigla} — {d.nome}
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
                sortKey="titulo"
                sortState={getSortState("titulo")}
                onSort={toggleSort}
              >
                Título
              </SortableTableHead>
              <SortableTableHead
                sortKey="tipo"
                sortState={getSortState("tipo")}
                onSort={toggleSort}
              >
                Tipo
              </SortableTableHead>
              <SortableTableHead
                sortKey="categoria"
                sortState={getSortState("categoria")}
                onSort={toggleSort}
              >
                Categoria
              </SortableTableHead>
              <SortableTableHead
                sortKey="setor"
                sortState={getSortState("setor")}
                onSort={toggleSort}
              >
                Setor
              </SortableTableHead>
              <SortableTableHead
                sortKey="revisao"
                sortState={getSortState("revisao")}
                onSort={toggleSort}
              >
                Revisão
              </SortableTableHead>
              <SortableTableHead
                sortKey="status"
                sortState={getSortState("status")}
                onSort={toggleSort}
              >
                Status
              </SortableTableHead>
              <SortableTableHead
                sortKey="validade"
                sortState={getSortState("validade")}
                onSort={toggleSort}
              >
                Validade
              </SortableTableHead>
              <SortableTableHead
                sortKey="atualizado"
                sortState={getSortState("atualizado")}
                onSort={toggleSort}
              >
                Atualizado
              </SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((doc) => {
              const tipo = documentTypes.find((t) => t.id === doc.tipoId);
              const setor = departments.find((d) => d.id === doc.setorId);
              const diasValidade = doc.validade?.ativa
                ? calcularDiasRestantesValidade(doc.validade.dataValidade)
                : null;
              const statusValidade = calcularValidadeStatus(diasValidade);
              return (
                <TableRow
                  key={doc.id}
                  className="cursor-pointer"
                  onClick={() => setDocumentoSelecionadoId(doc.id)}
                >
                  <TableCell>
                    <span className="font-medium text-primary">
                      {doc.codigo}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{doc.titulo}</TableCell>
                  <TableCell>
                    <Badge variant={getDocumentOrigemVariant(doc.origem)}>
                      {documentOrigemLabels[doc.origem]}
                    </Badge>
                  </TableCell>
                  <TableCell>{tipo?.sigla ?? "—"}</TableCell>
                  <TableCell>{setor?.sigla ?? "—"}</TableCell>
                  <TableCell>{doc.versaoAtual}</TableCell>
                  <TableCell>
                    <Badge variant={getDocumentStatusVariant(doc.status)}>
                      {documentStatusLabels[doc.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {doc.validade?.ativa && doc.validade.dataValidade ? (
                      <div className="space-y-1">
                        <Badge
                          variant={
                            statusValidade
                              ? getDueStatusVariant(statusValidade)
                              : "secondary"
                          }
                        >
                          {statusValidade
                            ? dueStatusLabels[statusValidade]
                            : "—"}
                        </Badge>
                        <p className="text-xs text-muted-foreground">
                          {formatarData(doc.validade.dataValidade)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{formatarData(doc.updatedAt)}</TableCell>
                </TableRow>
              );
            })}
            {filtrados.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className={cn("py-10 text-center text-muted-foreground")}
                >
                  Nenhum documento encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          </Table>
        </div>
      </div>

      <DocumentoConsultaDetalheDialog
        documentId={documentoSelecionadoId}
        open={documentoSelecionadoId !== null}
        onOpenChange={(open) => {
          if (!open) setDocumentoSelecionadoId(null);
        }}
      />
    </div>
  );
}
