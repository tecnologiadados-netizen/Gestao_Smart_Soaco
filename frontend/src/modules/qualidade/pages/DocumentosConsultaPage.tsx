import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@qualidade/components/ui/table";
import { Badge } from "@qualidade/components/ui/badge";
import { DocumentoConsultaDetalheDialog } from "@qualidade/components/documentos/documento-consulta-detalhe-dialog";
import { SgqGradeFiltroCabecalho, sgqTextoOuTraco } from "@qualidade/components/ui/sgq-grade-filtro-cabecalho";
import { SgqGradeFiltroPortal } from "@qualidade/components/ui/sgq-grade-filtro-portal";
import { SgqGradeSurface } from "@qualidade/components/ui/sgq-grade-surface";
import { useDocumentsStore } from "@qualidade/lib/store/documents-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import {
  documentStatusLabels,
  getDocumentStatusVariant,
  getDueStatusVariant,
  dueStatusLabels,
} from "@qualidade/lib/utils/status-labels";
import { formatarData } from "@qualidade/lib/utils/dates";
import {
  calcularDiasRestantesValidade,
  calcularValidadeStatus,
} from "@qualidade/lib/documents/validity";
import { formatDocumentCodigoExibicao } from "@qualidade/lib/documents/document-codigo";
import { cn } from "@qualidade/lib/utils";
import type { Document, DocumentOrigem } from "@qualidade/types/document";
import { useGradeFiltrosExcel } from "@/hooks/useGradeFiltrosExcel";

const CONSULTA_GUIAS: {
  origem: DocumentOrigem;
  label: string;
  empty: string;
  countLabel: (n: number) => string;
}[] = [
  {
    origem: "interno",
    label: "Internos",
    empty: "Nenhum documento interno encontrado.",
    countLabel: (n) => `${n} documento(s) interno(s)`,
  },
  {
    origem: "externo",
    label: "Externos",
    empty: "Nenhum documento externo encontrado.",
    countLabel: (n) => `${n} documento(s) externo(s)`,
  },
  {
    origem: "registro",
    label: "Registros",
    empty: "Nenhum registro interno encontrado.",
    countLabel: (n) => `${n} registro(s)`,
  },
];

function parseConsultaGuia(value: string | null): DocumentOrigem {
  if (value === "externo" || value === "registro" || value === "interno") {
    return value;
  }
  return "interno";
}

function textoValidade(doc: Document): string {
  if (!doc.validade?.ativa || !doc.validade.dataValidade) return "—";
  const dias = calcularDiasRestantesValidade(doc.validade.dataValidade);
  const status = calcularValidadeStatus(dias);
  const data = formatarData(doc.validade.dataValidade);
  return status ? `${dueStatusLabels[status]} · ${data}` : data;
}

export function DocumentosConsultaPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Carregando consulta...</p>
      }
    >
      <DocumentosConsultaContent />
    </Suspense>
  );
}

function DocumentosConsultaContent() {
  const documents = useDocumentsStore((s) => s.documents);
  const syncValidadeAlertas = useDocumentsStore((s) => s.syncValidadeAlertas);
  const departments = useConfigStore((s) => s.departments);
  const documentTypes = useConfigStore((s) => s.documentTypes);
  const [searchParams, setSearchParams] = useSearchParams();

  const guia = parseConsultaGuia(searchParams.get("guia"));
  const guiaMeta =
    CONSULTA_GUIAS.find((g) => g.origem === guia) ?? CONSULTA_GUIAS[0];

  const [documentoSelecionadoId, setDocumentoSelecionadoId] = useState<
    string | null
  >(null);

  const mostrarValidade = guia !== "registro";
  const mostrarCategoria = guia === "interno";

  const columnIds = useMemo(() => {
    const cols = ["codigo", "titulo"];
    if (mostrarCategoria) cols.push("categoria");
    cols.push("setor", "status");
    if (mostrarValidade) cols.push("validade");
    cols.push("atualizado");
    return cols;
  }, [mostrarCategoria, mostrarValidade]);

  const docsDaGuia = useMemo(
    () => documents.filter((doc) => doc.origem === guia),
    [documents, guia]
  );

  const getCellText = useCallback(
    (doc: Document, columnId: string) => {
      switch (columnId) {
        case "codigo":
          return formatDocumentCodigoExibicao(doc.codigo, doc.versaoAtual);
        case "titulo":
          return sgqTextoOuTraco(doc.titulo);
        case "categoria":
          return (
            documentTypes.find((t) => t.id === doc.tipoId)?.sigla ?? "—"
          );
        case "setor":
          return departments.find((d) => d.id === doc.setorId)?.nome ?? "—";
        case "status":
          return documentStatusLabels[doc.status];
        case "validade":
          return textoValidade(doc);
        case "atualizado":
          return formatarData(doc.updatedAt);
        default:
          return "";
      }
    },
    [departments, documentTypes]
  );

  const valueForSort = useCallback(
    (doc: Document, columnId: string) => {
      if (columnId === "validade") return doc.validade?.dataValidade ?? "";
      if (columnId === "atualizado") return doc.updatedAt;
      return getCellText(doc, columnId);
    },
    [getCellText]
  );

  const grade = useGradeFiltrosExcel<Document>({
    rows: docsDaGuia,
    columnIds,
    getCellText,
    valueForSort,
    dateColumnIds: mostrarValidade ? ["validade", "atualizado"] : ["atualizado"],
  });

  function setGuia(origem: DocumentOrigem) {
    grade.limparFiltrosGrade();
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("guia", origem);
        return next;
      },
      { replace: true }
    );
  }

  useEffect(() => {
    syncValidadeAlertas();
  }, [syncValidadeAlertas]);

  const contagensPorOrigem = useMemo(() => {
    const counts: Record<DocumentOrigem, number> = {
      interno: 0,
      externo: 0,
      registro: 0,
    };
    for (const doc of documents) {
      counts[doc.origem] += 1;
    }
    return counts;
  }, [documents]);

  const filtrados = grade.rowsExibidas;
  const colSpan = columnIds.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Consulta de documentos
        </h1>
        <p className="text-sm text-muted-foreground">
          {guiaMeta.countLabel(filtrados.length)} encontrado(s)
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Tipo de documento"
        className="grid h-11 w-full max-w-xl grid-cols-3 rounded-lg bg-muted p-1"
      >
        {CONSULTA_GUIAS.map((item) => {
          const ativa = guia === item.origem;
          return (
            <button
              key={item.origem}
              type="button"
              role="tab"
              aria-selected={ativa}
              onClick={() => setGuia(item.origem)}
              className={cn(
                "inline-flex h-full items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
                ativa
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
              <Badge
                variant={ativa ? "default" : "secondary"}
                className="h-5 min-w-5 px-1.5 text-[11px] tabular-nums"
              >
                {contagensPorOrigem[item.origem]}
              </Badge>
            </button>
          );
        })}
      </div>

      <SgqGradeSurface
        scrollRef={grade.tableScrollRef}
        temFiltros={grade.temFiltrosOuOrdem}
        onLimparFiltros={grade.limparFiltrosGrade}
      >
        <Table bare>
          <TableHeader>
            <TableRow>
              <SgqGradeFiltroCabecalho
                label="Código"
                ativo={grade.colunaComFiltroAtivo("codigo")}
                onClick={(e) => grade.abrirFiltroExcel("codigo", e)}
              />
              <SgqGradeFiltroCabecalho
                label="Título"
                ativo={grade.colunaComFiltroAtivo("titulo")}
                onClick={(e) => grade.abrirFiltroExcel("titulo", e)}
              />
              {mostrarCategoria ? (
                <SgqGradeFiltroCabecalho
                  label="Categoria"
                  ativo={grade.colunaComFiltroAtivo("categoria")}
                  onClick={(e) => grade.abrirFiltroExcel("categoria", e)}
                />
              ) : null}
              <SgqGradeFiltroCabecalho
                label="Setor"
                ativo={grade.colunaComFiltroAtivo("setor")}
                onClick={(e) => grade.abrirFiltroExcel("setor", e)}
              />
              <SgqGradeFiltroCabecalho
                label="Status"
                ativo={grade.colunaComFiltroAtivo("status")}
                onClick={(e) => grade.abrirFiltroExcel("status", e)}
              />
              {mostrarValidade ? (
                <SgqGradeFiltroCabecalho
                  label="Validade"
                  ativo={grade.colunaComFiltroAtivo("validade")}
                  onClick={(e) => grade.abrirFiltroExcel("validade", e)}
                />
              ) : null}
              <SgqGradeFiltroCabecalho
                label="Atualizado"
                ativo={grade.colunaComFiltroAtivo("atualizado")}
                onClick={(e) => grade.abrirFiltroExcel("atualizado", e)}
              />
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
                      {formatDocumentCodigoExibicao(
                        doc.codigo,
                        doc.versaoAtual
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{doc.titulo}</TableCell>
                  {mostrarCategoria ? (
                    <TableCell>{tipo?.sigla ?? "—"}</TableCell>
                  ) : null}
                  <TableCell>{setor?.nome ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={getDocumentStatusVariant(doc.status)}>
                      {documentStatusLabels[doc.status]}
                    </Badge>
                  </TableCell>
                  {mostrarValidade ? (
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
                  ) : null}
                  <TableCell>{formatarData(doc.updatedAt)}</TableCell>
                </TableRow>
              );
            })}
            {filtrados.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={colSpan}
                  className={cn("py-10 text-center text-muted-foreground")}
                >
                  {docsDaGuia.length === 0
                    ? guiaMeta.empty
                    : "Nenhum documento com os filtros da grade. Ajuste ou limpe os filtros por coluna."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </SgqGradeSurface>

      <SgqGradeFiltroPortal
        grade={grade}
        dateColumnIds={
          mostrarValidade ? ["validade", "atualizado"] : ["atualizado"]
        }
      />

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
