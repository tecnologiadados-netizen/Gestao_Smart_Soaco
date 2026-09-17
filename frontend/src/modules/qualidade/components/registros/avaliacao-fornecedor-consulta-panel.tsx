import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
import { Badge } from "@qualidade/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@qualidade/components/ui/table";
import { AvaliacaoDetalheDialog } from "@qualidade/components/avaliacao-fornecedor/avaliacao-detalhe-dialog";
import {
  SgqGradeFiltroCabecalho,
  sgqTextoOuTraco,
} from "@qualidade/components/ui/sgq-grade-filtro-cabecalho";
import { SgqGradeFiltroPortal } from "@qualidade/components/ui/sgq-grade-filtro-portal";
import { ClearFiltersButton } from "@qualidade/components/ui/table-filters-toolbar";
import { useAvaliacaoFornecedorStore } from "@qualidade/lib/store/avaliacao-fornecedor-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import { NOTA_MAX } from "@qualidade/lib/avaliacao-fornecedor/criterios";
import { resolverNomeAvaliador } from "@qualidade/lib/avaliacao-fornecedor/resolver-nome-avaliador";
import { formatarData } from "@qualidade/lib/utils/dates";
import {
  getDataAvaliacao,
  type AvaliacaoFornecedor,
} from "@qualidade/types/avaliacao-fornecedor";
import { useGradeFiltrosExcel } from "@/hooks/useGradeFiltrosExcel";

const ITENS_POR_PAGINA = 50;

const COL_IDS = [
  "fornecedor",
  "data",
  "documento",
  "aprovado",
  "avaliador",
  "media",
] as const;

interface AvaliacaoFornecedorConsultaPanelProps {
  onCountChange?: (count: number) => void;
}

function nomeColunaAvaliacao(colId: string): string {
  switch (colId) {
    case "fornecedor":
      return "Fornecedor";
    case "data":
      return "Data";
    case "documento":
      return "Documento";
    case "aprovado":
      return "Aprovado";
    case "avaliador":
      return "Avaliador";
    case "media":
      return "Média";
    default:
      return colId;
  }
}

export function AvaliacaoFornecedorConsultaPanel({
  onCountChange,
}: AvaliacaoFornecedorConsultaPanelProps) {
  const avaliacoes = useAvaliacaoFornecedorStore((s) => s.avaliacoes);
  const users = useConfigStore((s) => s.users);

  const [pagina, setPagina] = useState(1);
  const [avaliacaoSelecionada, setAvaliacaoSelecionada] =
    useState<AvaliacaoFornecedor | null>(null);

  const getCellText = useCallback(
    (avaliacao: AvaliacaoFornecedor, columnId: string) => {
      switch (columnId) {
        case "fornecedor":
          return sgqTextoOuTraco(avaliacao.fornecedorNome);
        case "data":
          return formatarData(getDataAvaliacao(avaliacao));
        case "documento":
          return sgqTextoOuTraco(avaliacao.numeroDocumento);
        case "aprovado":
          return typeof avaliacao.fornecedorAprovado === "boolean"
            ? avaliacao.fornecedorAprovado
              ? "Sim"
              : "Não"
            : "—";
        case "avaliador":
          return sgqTextoOuTraco(
            resolverNomeAvaliador(avaliacao.avaliadorId, users)
          );
        case "media":
          return avaliacao.media.toFixed(1);
        default:
          return "";
      }
    },
    [users]
  );

  const valueForSort = useCallback(
    (avaliacao: AvaliacaoFornecedor, columnId: string) => {
      if (columnId === "data") return getDataAvaliacao(avaliacao);
      if (columnId === "media") return avaliacao.media;
      return getCellText(avaliacao, columnId);
    },
    [getCellText]
  );

  const grade = useGradeFiltrosExcel<AvaliacaoFornecedor>({
    rows: avaliacoes,
    columnIds: [...COL_IDS],
    getCellText,
    valueForSort,
    defaultSortLevels: [{ id: "data", dir: "desc" }],
    dateColumnIds: ["data"],
  });

  const filtradas = grade.rowsExibidas;
  const totalPaginas = Math.max(
    1,
    Math.ceil(filtradas.length / ITENS_POR_PAGINA)
  );
  const filtradasPagina = useMemo(() => {
    const inicio = (pagina - 1) * ITENS_POR_PAGINA;
    return filtradas.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [filtradas, pagina]);

  useEffect(() => {
    setPagina(1);
  }, [grade.columnFilters, grade.sortState, grade.sortLevels]);

  useEffect(() => {
    if (pagina > totalPaginas) {
      setPagina(totalPaginas);
    }
  }, [pagina, totalPaginas]);

  useEffect(() => {
    onCountChange?.(filtradas.length);
  }, [filtradas.length, onCountChange]);

  const indiceInicio =
    filtradas.length === 0 ? 0 : (pagina - 1) * ITENS_POR_PAGINA + 1;
  const indiceFim = Math.min(pagina * ITENS_POR_PAGINA, filtradas.length);

  return (
    <>
      {grade.temFiltrosOuOrdem ? (
        <div className="flex justify-end border-b border-border px-3 py-2">
          <ClearFiltersButton
            onClick={grade.limparFiltrosGrade}
            label="Limpar filtros da grade"
          />
        </div>
      ) : null}

      <div ref={grade.tableScrollRef} className="sgq-table-scroll-viewport">
        <Table bare>
          <TableHeader>
            <TableRow>
              {COL_IDS.map((colId) => (
                <SgqGradeFiltroCabecalho
                  key={colId}
                  label={nomeColunaAvaliacao(colId)}
                  ativo={grade.colunaComFiltroAtivo(colId)}
                  onClick={(e) => grade.abrirFiltroExcel(colId, e)}
                  align={colId === "media" ? "right" : "left"}
                  className={
                    colId === "fornecedor"
                      ? "min-w-[14rem]"
                      : colId === "data"
                        ? "min-w-[6.5rem]"
                        : colId === "documento"
                          ? "min-w-[8rem]"
                          : colId === "aprovado"
                            ? "min-w-[6.5rem]"
                            : colId === "avaliador"
                              ? "min-w-[9rem]"
                              : "min-w-[5.5rem]"
                  }
                />
              ))}
              <TableHead className="sticky top-0 z-10 min-w-[5rem] text-right">
                Ação
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={COL_IDS.length + 1}
                  className="py-10 text-center text-muted-foreground"
                >
                  {avaliacoes.length === 0
                    ? "Nenhuma avaliação encontrada."
                    : "Nenhuma avaliação com os filtros da grade. Ajuste ou limpe os filtros por coluna."}
                </TableCell>
              </TableRow>
            ) : (
              filtradasPagina.map((avaliacao) => (
                <TableRow key={avaliacao.id}>
                  <TableCell className="whitespace-normal">
                    <div className="max-w-[18rem]">
                      <p className="line-clamp-2 font-medium">
                        {avaliacao.fornecedorNome}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {formatarData(getDataAvaliacao(avaliacao))}
                  </TableCell>
                  <TableCell>{avaliacao.numeroDocumento || "—"}</TableCell>
                  <TableCell>
                    {typeof avaliacao.fornecedorAprovado === "boolean" ? (
                      <Badge
                        variant={
                          avaliacao.fornecedorAprovado
                            ? "default"
                            : "destructive"
                        }
                      >
                        {avaliacao.fornecedorAprovado ? "Sim" : "Não"}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {resolverNomeAvaliador(avaliacao.avaliadorId, users)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-primary tabular-nums">
                    {avaliacao.media.toFixed(1)}/{NOTA_MAX}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAvaliacaoSelecionada(avaliacao)}
                    >
                      <Eye className="size-4" />
                      <span className="sr-only">Ver detalhe</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {filtradas.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Exibindo {indiceInicio}–{indiceFim} de {filtradas.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagina <= 1}
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
            <span className="min-w-[5.5rem] text-center text-xs text-muted-foreground tabular-nums">
              Página {pagina} / {totalPaginas}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagina >= totalPaginas}
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            >
              Próxima
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <SgqGradeFiltroPortal
        grade={grade}
        dateColumnIds={["data"]}
        numericColumnIds={["media"]}
      />

      <AvaliacaoDetalheDialog
        avaliacao={avaliacaoSelecionada}
        open={avaliacaoSelecionada !== null}
        onOpenChange={(open) => {
          if (!open) setAvaliacaoSelecionada(null);
        }}
      />
    </>
  );
}
