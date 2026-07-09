import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
import { Badge } from "@qualidade/components/ui/badge";
import { Input } from "@qualidade/components/ui/input";
import {
  TABLE_FILTER_ALL,
  TableFilterField,
  TableFilterSearch,
  TableFiltersToolbar,
  tableFilterInputClass,
  tableFilterSelectTriggerClass,
} from "@qualidade/components/ui/table-filters-toolbar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qualidade/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@qualidade/components/ui/table";
import { AvaliacaoDetalheDialog } from "@qualidade/components/avaliacao-fornecedor/avaliacao-detalhe-dialog";
import { SortableTableHead } from "@qualidade/components/ui/sortable-table-head";
import { useTableSort } from "@qualidade/hooks/use-table-sort";
import { useAvaliacaoFornecedorStore } from "@qualidade/lib/store/avaliacao-fornecedor-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import { NOTA_MAX } from "@qualidade/lib/avaliacao-fornecedor/criterios";
import { formatarData } from "@qualidade/lib/utils/dates";
import { sortByRules } from "@qualidade/lib/utils/table-sort";
import {
  getDataAvaliacao,
  type AvaliacaoFornecedor,
} from "@qualidade/types/avaliacao-fornecedor";

const ITENS_POR_PAGINA = 50;

const APROVADO_SIM = "sim";
const APROVADO_NAO = "nao";

type HistoricoSortKey =
  | "fornecedor"
  | "data"
  | "documento"
  | "aprovado"
  | "avaliador"
  | "media";

interface AvaliacaoFornecedorConsultaPanelProps {
  onCountChange?: (count: number) => void;
}

function dataAvaliacaoComparavel(avaliacao: AvaliacaoFornecedor): string {
  return getDataAvaliacao(avaliacao).slice(0, 10);
}

export function AvaliacaoFornecedorConsultaPanel({
  onCountChange,
}: AvaliacaoFornecedorConsultaPanelProps) {
  const avaliacoes = useAvaliacaoFornecedorStore((s) => s.avaliacoes);
  const users = useConfigStore((s) => s.users);

  const [busca, setBusca] = useState("");
  const [avaliadorFiltro, setAvaliadorFiltro] = useState(TABLE_FILTER_ALL);
  const [aprovadoFiltro, setAprovadoFiltro] = useState(TABLE_FILTER_ALL);
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [pagina, setPagina] = useState(1);
  const [avaliacaoSelecionada, setAvaliacaoSelecionada] =
    useState<AvaliacaoFornecedor | null>(null);
  const { sorts, toggleSort, getSortState } = useTableSort<HistoricoSortKey>([
    { key: "data", direction: "desc" },
  ]);

  const avaliadoresUnicos = useMemo(() => {
    const map = new Map<string, string>();
    for (const av of avaliacoes) {
      if (!map.has(av.avaliadorId)) {
        map.set(
          av.avaliadorId,
          users.find((u) => u.id === av.avaliadorId)?.nome ?? av.avaliadorId
        );
      }
    }
    return Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [avaliacoes, users]);

  const filtrosAtivos =
    busca.trim() !== "" ||
    avaliadorFiltro !== TABLE_FILTER_ALL ||
    aprovadoFiltro !== TABLE_FILTER_ALL ||
    periodoInicio !== "" ||
    periodoFim !== "";

  function limparFiltros() {
    setBusca("");
    setAvaliadorFiltro(TABLE_FILTER_ALL);
    setAprovadoFiltro(TABLE_FILTER_ALL);
    setPeriodoInicio("");
    setPeriodoFim("");
  }

  function getAvaliadorNome(avaliadorId: string) {
    return users.find((u) => u.id === avaliadorId)?.nome ?? "—";
  }

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = avaliacoes.filter((av) => {
      const matchBusca =
        !q ||
        av.fornecedorNome.toLowerCase().includes(q) ||
        av.fornecedorId.toLowerCase().includes(q) ||
        av.numeroDocumento?.toLowerCase().includes(q);
      const matchAvaliador =
        avaliadorFiltro === TABLE_FILTER_ALL ||
        av.avaliadorId === avaliadorFiltro;
      const matchAprovado =
        aprovadoFiltro === TABLE_FILTER_ALL ||
        (aprovadoFiltro === APROVADO_SIM && av.fornecedorAprovado === true) ||
        (aprovadoFiltro === APROVADO_NAO && av.fornecedorAprovado === false);
      const dataAv = dataAvaliacaoComparavel(av);
      const matchPeriodo =
        (!periodoInicio || (dataAv !== "" && dataAv >= periodoInicio)) &&
        (!periodoFim || (dataAv !== "" && dataAv <= periodoFim));
      return matchBusca && matchAvaliador && matchAprovado && matchPeriodo;
    });

    return sortByRules(lista, sorts, (av, key) => {
      switch (key) {
        case "fornecedor":
          return av.fornecedorNome;
        case "data":
          return getDataAvaliacao(av);
        case "documento":
          return av.numeroDocumento ?? "";
        case "aprovado":
          return av.fornecedorAprovado ?? null;
        case "avaliador":
          return getAvaliadorNome(av.avaliadorId);
        case "media":
          return av.media;
      }
    });
  }, [
    avaliacoes,
    busca,
    avaliadorFiltro,
    aprovadoFiltro,
    periodoInicio,
    periodoFim,
    sorts,
    users,
  ]);

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
  }, [busca, avaliadorFiltro, aprovadoFiltro, periodoInicio, periodoFim, sorts]);

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
      <TableFiltersToolbar
        gridClassName="sm:grid-cols-2 lg:grid-cols-4"
        onClear={limparFiltros}
        hasActiveFilters={filtrosAtivos}
      >
        <TableFilterField
          label="Busca"
          htmlFor="av-hist-busca"
          className="sm:col-span-2"
        >
          <TableFilterSearch
            id="av-hist-busca"
            placeholder="Fornecedor, código ou documento..."
            value={busca}
            onChange={setBusca}
          />
        </TableFilterField>
        <TableFilterField label="Avaliador" htmlFor="av-hist-avaliador">
          <Select
            value={avaliadorFiltro}
            onValueChange={(v) => v && setAvaliadorFiltro(v)}
          >
            <SelectTrigger
              id="av-hist-avaliador"
              className={tableFilterSelectTriggerClass}
            >
              <SelectValue placeholder="Todos">
                {avaliadorFiltro === TABLE_FILTER_ALL
                  ? null
                  : avaliadoresUnicos.find((a) => a.id === avaliadorFiltro)
                      ?.nome}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TABLE_FILTER_ALL}>Todos</SelectItem>
              {avaliadoresUnicos.map((avaliador) => (
                <SelectItem key={avaliador.id} value={avaliador.id}>
                  {avaliador.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableFilterField>
        <TableFilterField label="Aprovado" htmlFor="av-hist-aprovado">
          <Select
            value={aprovadoFiltro}
            onValueChange={(v) => v && setAprovadoFiltro(v)}
          >
            <SelectTrigger
              id="av-hist-aprovado"
              className={tableFilterSelectTriggerClass}
            >
              <SelectValue placeholder="Todos">
                {aprovadoFiltro === TABLE_FILTER_ALL
                  ? null
                  : aprovadoFiltro === APROVADO_SIM
                    ? "Sim"
                    : "Não"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TABLE_FILTER_ALL}>Todos</SelectItem>
              <SelectItem value={APROVADO_SIM}>Sim</SelectItem>
              <SelectItem value={APROVADO_NAO}>Não</SelectItem>
            </SelectContent>
          </Select>
        </TableFilterField>
        <TableFilterField label="Período" className="sm:col-span-2">
          <div className="grid grid-cols-2 gap-2">
            <Input
              id="av-hist-periodo-inicio"
              type="date"
              aria-label="Data inicial"
              className={tableFilterInputClass}
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
            />
            <Input
              id="av-hist-periodo-fim"
              type="date"
              aria-label="Data final"
              className={tableFilterInputClass}
              value={periodoFim}
              onChange={(e) => setPeriodoFim(e.target.value)}
            />
          </div>
        </TableFilterField>
      </TableFiltersToolbar>

      <div className="sgq-table-scroll-viewport border-t border-border">
        <Table bare>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                sortKey="fornecedor"
                sortState={getSortState("fornecedor")}
                onSort={toggleSort}
                className="min-w-[14rem]"
              >
                Fornecedor
              </SortableTableHead>
              <SortableTableHead
                sortKey="data"
                sortState={getSortState("data")}
                onSort={toggleSort}
                className="min-w-[6.5rem]"
              >
                Data
              </SortableTableHead>
              <SortableTableHead
                sortKey="documento"
                sortState={getSortState("documento")}
                onSort={toggleSort}
                className="min-w-[8rem]"
              >
                Documento
              </SortableTableHead>
              <SortableTableHead
                sortKey="aprovado"
                sortState={getSortState("aprovado")}
                onSort={toggleSort}
                className="min-w-[6.5rem]"
              >
                Aprovado
              </SortableTableHead>
              <SortableTableHead
                sortKey="avaliador"
                sortState={getSortState("avaliador")}
                onSort={toggleSort}
                className="min-w-[9rem]"
              >
                Avaliador
              </SortableTableHead>
              <SortableTableHead
                sortKey="media"
                sortState={getSortState("media")}
                onSort={toggleSort}
                align="right"
                className="min-w-[5.5rem]"
              >
                Média
              </SortableTableHead>
              <TableHead className="min-w-[5rem] text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-muted-foreground"
                >
                  Nenhuma avaliação encontrada.
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
                    {getAvaliadorNome(avaliacao.avaliadorId)}
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
