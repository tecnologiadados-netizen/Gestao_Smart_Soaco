import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from 'react-router-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Badge } from "@qualidade/components/ui/badge";
import { Button } from "@qualidade/components/ui/button";
import { AvaliacaoFornecedorConsultaPanel } from "@qualidade/components/registros/avaliacao-fornecedor-consulta-panel";
import { CodigoDocumentoCell } from "@qualidade/components/registros/codigo-documento-cell";
import {
  TABLE_FILTER_ALL,
  TableFilterField,
  TableFilterSearch,
  TableFiltersToolbar,
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
import { SortableTableHead } from "@qualidade/components/ui/sortable-table-head";
import { RegistroDetalheDialog } from "@qualidade/components/registros/registro-detalhe-dialog";
import { useTableSort } from "@qualidade/hooks/use-table-sort";
import {
  isModuloRegistroTipo,
  MODULO_REGISTRO_TIPOS,
  moduloRegistroTipoLabelsCurto,
  registroStatusLabels,
  registroTipoLabels,
} from "@qualidade/lib/registros/constants";
import { useRegistrosStore } from "@qualidade/lib/store/registros-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import { formatarData } from "@qualidade/lib/utils/dates";
import { sortByRules } from "@qualidade/lib/utils/table-sort";
import { cn } from "@qualidade/lib/utils";
import {
  getRegistroCodigoDocumento,
  getRegistroDataFechamento,
  getRegistroDataOcorrencia,
  getRegistroDetalheSecundario,
  getRegistroInfoPrincipal,
  getRegistroProduto,
  getRegistroResponsavelNome,
  type Registro,
} from "@qualidade/types/registro";
import type { RegistroStatus, RegistroTipo } from "@qualidade/types/registro";

type RegistroSortKey =
  | "codigo"
  | "dataOcorrencia"
  | "tipo"
  | "info"
  | "produto"
  | "detalhe"
  | "responsavel"
  | "status"
  | "fechamento";

function novoRegistroHref(tipoFiltro: string): string {
  if (isModuloRegistroTipo(tipoFiltro)) {
    return `/qualidade/registros?tipo=${tipoFiltro}`;
  }
  return "/qualidade/registros";
}

function registroStatusFilterLabel(value: string): string | undefined {
  if (value === TABLE_FILTER_ALL) return "Todos os status";
  return registroStatusLabels[value as RegistroStatus];
}

function textoBuscaRegistro(registro: Registro, responsavelSgq: string): string {
  const partes = [
    registro.codigoDocumento,
    getRegistroCodigoDocumento(registro),
    registro.numero,
    registro.tipo,
    registro.rnc?.codigoProduto,
    registro.rnc?.produto,
    registro.rnc?.setorOcorrencia,
    registro.rnc?.descricaoOcorrencia,
    registro.rnc?.tipoOcorrencia,
    registro.rcc?.codigoProduto,
    registro.rcc?.produto,
    registro.rcc?.nomeClienteConsumidor,
    registro.rcc?.cidade,
    registro.rcc?.reclamacao1,
    registro.rcc?.descricaoReclamacao,
    getRegistroResponsavelNome(registro),
    responsavelSgq,
  ];
  return partes.filter(Boolean).join(" ").toLowerCase();
}

export function RegistrosConsultaContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const registros = useRegistrosStore((s) => s.registros);
  const users = useConfigStore((s) => s.users);

  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState(() => {
    const tipoParam = searchParams.get("tipo");
    return isModuloRegistroTipo(tipoParam) ? tipoParam : "";
  });
  const [statusFiltro, setStatusFiltro] = useState(TABLE_FILTER_ALL);
  const [registroSelecionadoId, setRegistroSelecionadoId] = useState<
    string | null
  >(null);
  const [contagemAvaliacoes, setContagemAvaliacoes] = useState(0);
  const { sorts, toggleSort, getSortState } = useTableSort<RegistroSortKey>();

  const tipoSelecionado = isModuloRegistroTipo(tipoFiltro) ? tipoFiltro : null;
  const isAvaliacaoView = tipoSelecionado === "avaliacao-fornecedor";

  useEffect(() => {
    const tipoParam = searchParams.get("tipo");
    if (isModuloRegistroTipo(tipoParam)) {
      setTipoFiltro(tipoParam);
      return;
    }
    setTipoFiltro("");
  }, [searchParams]);

  const handleContagemAvaliacoes = useCallback((count: number) => {
    setContagemAvaliacoes(count);
  }, []);

  function atualizarTipoFiltro(value: string) {
    if (!isModuloRegistroTipo(value)) return;
    setTipoFiltro(value);
    setBusca("");
    setStatusFiltro(TABLE_FILTER_ALL);
    navigate(`/qualidade/registros/consulta?tipo=${value}`);
  }

  const filtrosRegistrosAtivos =
    busca.trim() !== "" || statusFiltro !== TABLE_FILTER_ALL;

  function limparFiltrosRegistros() {
    setBusca("");
    setStatusFiltro(TABLE_FILTER_ALL);
  }

  const filtrados = useMemo(() => {
    if (!tipoSelecionado || tipoSelecionado === "avaliacao-fornecedor") {
      return [];
    }

    const q = busca.trim().toLowerCase();
    const lista = registros.filter((registro) => {
      const responsavelSgq =
        users.find((user) => user.id === registro.responsavelId)?.nome ?? "";
      const matchBusca =
        !q || textoBuscaRegistro(registro, responsavelSgq).includes(q);
      const matchTipo = registro.tipo === tipoSelecionado;
      const matchStatus =
        statusFiltro === TABLE_FILTER_ALL || registro.status === statusFiltro;
      return matchBusca && matchTipo && matchStatus;
    });

    return sortByRules(lista, sorts, (registro, key) => {
      switch (key) {
        case "codigo":
          return getRegistroCodigoDocumento(registro);
        case "dataOcorrencia":
          return getRegistroDataOcorrencia(registro);
        case "tipo":
          return registro.tipo;
        case "info":
          return getRegistroInfoPrincipal(registro);
        case "produto":
          return getRegistroProduto(registro);
        case "detalhe":
          return getRegistroDetalheSecundario(registro);
        case "responsavel":
          return (
            getRegistroResponsavelNome(registro) ||
            users.find((u) => u.id === registro.responsavelId)?.nome ||
            ""
          );
        case "status":
          return registro.status;
        case "fechamento":
          return getRegistroDataFechamento(registro);
      }
    });
  }, [registros, busca, tipoSelecionado, statusFiltro, sorts, users]);

  const contagemExibida = !tipoSelecionado
    ? null
    : isAvaliacaoView
      ? contagemAvaliacoes
      : filtrados.length;
  const rotuloContagem = isAvaliacaoView
    ? "avaliação(ões) encontrada(s)"
    : "registro(s) encontrado(s)";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Consulta de registros
          </h1>
          <p className="text-sm text-muted-foreground">
            {contagemExibida === null
              ? "Selecione um tipo de registro para consultar."
              : `${contagemExibida} ${rotuloContagem}`}
          </p>
        </div>
        <Link to={novoRegistroHref(tipoFiltro)}>
          <Button type="button">Novo registro</Button>
        </Link>
      </div>

      <div className="sgq-table-surface overflow-hidden rounded-xl border border-border bg-card shadow-sm ring-1 ring-foreground/6">
        <div className="border-b border-border p-4">
          <TableFilterField label="Tipo" htmlFor="reg-tipo">
            <Select
              value={tipoSelecionado ?? ""}
              onValueChange={(v) => v && atualizarTipoFiltro(v)}
            >
              <SelectTrigger
                id="reg-tipo"
                className={cn(tableFilterSelectTriggerClass, "max-w-md")}
              >
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {MODULO_REGISTRO_TIPOS.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>
                    {moduloRegistroTipoLabelsCurto[tipo]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableFilterField>
        </div>

        {!tipoSelecionado ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            Escolha RNC, RCC ou Avaliação de fornecedor para exibir os
            registros.
          </div>
        ) : isAvaliacaoView ? (
          <AvaliacaoFornecedorConsultaPanel
            onCountChange={handleContagemAvaliacoes}
          />
        ) : (
          <>
            <TableFiltersToolbar
              gridClassName="sm:grid-cols-2 lg:grid-cols-3"
              onClear={limparFiltrosRegistros}
              hasActiveFilters={filtrosRegistrosAtivos}
            >
              <TableFilterField
                label="Busca"
                htmlFor="reg-busca"
                className="sm:col-span-2"
              >
                <TableFilterSearch
                  id="reg-busca"
                  placeholder="Código, produto, cliente, setor, reclamação..."
                  value={busca}
                  onChange={setBusca}
                />
              </TableFilterField>
              <TableFilterField label="Status" htmlFor="reg-status">
                <Select
                  value={statusFiltro}
                  onValueChange={(v) => v && setStatusFiltro(v)}
                >
                  <SelectTrigger
                    id="reg-status"
                    className={tableFilterSelectTriggerClass}
                  >
                    <SelectValue placeholder="Todos os status">
                      {registroStatusFilterLabel(statusFiltro) ?? null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TABLE_FILTER_ALL}>
                      Todos os status
                    </SelectItem>
                    {(Object.keys(registroStatusLabels) as RegistroStatus[]).map(
                      (status) => (
                        <SelectItem key={status} value={status}>
                          {registroStatusLabels[status]}
                        </SelectItem>
                      )
                    )}
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
                      Código do documento
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="dataOcorrencia"
                      sortState={getSortState("dataOcorrencia")}
                      onSort={toggleSort}
                    >
                      Data
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="tipo"
                      sortState={getSortState("tipo")}
                      onSort={toggleSort}
                    >
                      Tipo
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="info"
                      sortState={getSortState("info")}
                      onSort={toggleSort}
                    >
                      Cliente / Setor
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="produto"
                      sortState={getSortState("produto")}
                      onSort={toggleSort}
                    >
                      Produto
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="detalhe"
                      sortState={getSortState("detalhe")}
                      onSort={toggleSort}
                    >
                      Reclamação / Ocorrência
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="responsavel"
                      sortState={getSortState("responsavel")}
                      onSort={toggleSort}
                    >
                      Responsável
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="status"
                      sortState={getSortState("status")}
                      onSort={toggleSort}
                    >
                      Status
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey="fechamento"
                      sortState={getSortState("fechamento")}
                      onSort={toggleSort}
                    >
                      Fechamento
                    </SortableTableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map((registro) => {
                    const responsavelNome =
                      getRegistroResponsavelNome(registro) ||
                      users.find((user) => user.id === registro.responsavelId)
                        ?.nome ||
                      "—";

                    return (
                      <TableRow
                        key={registro.id}
                        className="cursor-pointer"
                        onClick={() => setRegistroSelecionadoId(registro.id)}
                      >
                        <TableCell>
                          <CodigoDocumentoCell registro={registro} />
                        </TableCell>
                        <TableCell>
                          {formatarData(getRegistroDataOcorrencia(registro))}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {registroTipoLabels[registro.tipo as RegistroTipo]}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[160px] truncate">
                          {getRegistroInfoPrincipal(registro) || "—"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {getRegistroProduto(registro) || "—"}
                        </TableCell>
                        <TableCell className="max-w-[140px] truncate">
                          {getRegistroDetalheSecundario(registro) || "—"}
                        </TableCell>
                        <TableCell>{responsavelNome}</TableCell>
                        <TableCell>
                          <Badge>{registroStatusLabels[registro.status]}</Badge>
                        </TableCell>
                        <TableCell>
                          {formatarData(getRegistroDataFechamento(registro))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtrados.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className={cn(
                          "py-10 text-center text-muted-foreground"
                        )}
                      >
                        Nenhum registro encontrado para os filtros aplicados.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      {tipoSelecionado && !isAvaliacaoView ? (
        <RegistroDetalheDialog
          registroId={registroSelecionadoId}
          open={registroSelecionadoId !== null}
          onOpenChange={(open) => {
            if (!open) setRegistroSelecionadoId(null);
          }}
        />
      ) : null}
    </div>
  );
}
