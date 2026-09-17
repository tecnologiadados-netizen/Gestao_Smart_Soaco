import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Badge } from "@qualidade/components/ui/badge";
import { Button } from "@qualidade/components/ui/button";
import { AvaliacaoFornecedorConsultaPanel } from "@qualidade/components/registros/avaliacao-fornecedor-consulta-panel";
import { CodigoDocumentoCell } from "@qualidade/components/registros/codigo-documento-cell";
import {
  TableFilterField,
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
import { TableRowActions } from "@qualidade/components/ui/table-row-actions";
import { ConfirmacaoDialog } from "@qualidade/components/ui/confirmacao-dialog";
import { RegistroDetalheDialog } from "@qualidade/components/registros/registro-detalhe-dialog";
import {
  SgqGradeFiltroCabecalho,
  sgqTextoOuTraco,
} from "@qualidade/components/ui/sgq-grade-filtro-cabecalho";
import { SgqGradeFiltroPortal } from "@qualidade/components/ui/sgq-grade-filtro-portal";
import { SgqGradeSurface } from "@qualidade/components/ui/sgq-grade-surface";
import {
  isModuloRegistroTipo,
  MODULO_REGISTRO_TIPOS,
  moduloRegistroTipoLabelsCurto,
  registroStatusLabels,
  registroTipoLabels,
} from "@qualidade/lib/registros/constants";
import { useRegistrosStore } from "@qualidade/lib/store/registros-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import { excluirQualidadeRegistro } from "@qualidade/lib/qualidadePersistence";
import { formatarData } from "@qualidade/lib/utils/dates";
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
import type { RegistroTipo } from "@qualidade/types/registro";
import { useGradeFiltrosExcel } from "@/hooks/useGradeFiltrosExcel";

const COL_IDS = [
  "codigo",
  "dataOcorrencia",
  "tipo",
  "info",
  "produto",
  "detalhe",
  "responsavel",
  "status",
  "fechamento",
] as const;

function novoRegistroHref(_tipoFiltro: string): string {
  return "/qualidade/registros";
}

function nomeColunaRegistro(colId: string): string {
  switch (colId) {
    case "codigo":
      return "Código do documento";
    case "dataOcorrencia":
      return "Data";
    case "tipo":
      return "Tipo";
    case "info":
      return "Cliente / Setor";
    case "produto":
      return "Produto";
    case "detalhe":
      return "Reclamação / Ocorrência";
    case "responsavel":
      return "Responsável";
    case "status":
      return "Status";
    case "fechamento":
      return "Fechamento";
    default:
      return colId;
  }
}

export function RegistrosConsultaContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const registros = useRegistrosStore((s) => s.registros);
  const excluirRegistroStore = useRegistrosStore((s) => s.excluirRegistro);
  const users = useConfigStore((s) => s.users);

  const [tipoFiltro, setTipoFiltro] = useState(() => {
    const tipoParam = searchParams.get("tipo");
    return isModuloRegistroTipo(tipoParam) ? tipoParam : "";
  });
  const [registroSelecionadoId, setRegistroSelecionadoId] = useState<
    string | null
  >(null);
  const [abrirEmEdicao, setAbrirEmEdicao] = useState(false);
  const [registroParaExcluir, setRegistroParaExcluir] =
    useState<Registro | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState("");
  const [contagemAvaliacoes, setContagemAvaliacoes] = useState(0);

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

  const registrosDoTipo = useMemo(() => {
    if (!tipoSelecionado || tipoSelecionado === "avaliacao-fornecedor") {
      return [];
    }
    return registros.filter((registro) => registro.tipo === tipoSelecionado);
  }, [registros, tipoSelecionado]);

  const getCellText = useCallback(
    (registro: Registro, columnId: string) => {
      switch (columnId) {
        case "codigo":
          return sgqTextoOuTraco(getRegistroCodigoDocumento(registro));
        case "dataOcorrencia":
          return formatarData(getRegistroDataOcorrencia(registro));
        case "tipo":
          return registroTipoLabels[registro.tipo as RegistroTipo] ?? registro.tipo;
        case "info":
          return sgqTextoOuTraco(getRegistroInfoPrincipal(registro));
        case "produto":
          return sgqTextoOuTraco(getRegistroProduto(registro));
        case "detalhe":
          return sgqTextoOuTraco(getRegistroDetalheSecundario(registro));
        case "responsavel":
          return sgqTextoOuTraco(
            getRegistroResponsavelNome(registro) ||
              users.find((user) => user.id === registro.responsavelId)?.nome
          );
        case "status":
          return registroStatusLabels[registro.status];
        case "fechamento":
          return formatarData(getRegistroDataFechamento(registro));
        default:
          return "";
      }
    },
    [users]
  );

  const valueForSort = useCallback(
    (registro: Registro, columnId: string) => {
      if (columnId === "dataOcorrencia") {
        return getRegistroDataOcorrencia(registro) ?? "";
      }
      if (columnId === "fechamento") {
        return getRegistroDataFechamento(registro) ?? "";
      }
      return getCellText(registro, columnId);
    },
    [getCellText]
  );

  const grade = useGradeFiltrosExcel<Registro>({
    rows: registrosDoTipo,
    columnIds: [...COL_IDS],
    getCellText,
    valueForSort,
    dateColumnIds: ["dataOcorrencia", "fechamento"],
  });

  function atualizarTipoFiltro(value: string) {
    if (!isModuloRegistroTipo(value)) return;
    grade.limparFiltrosGrade();
    setTipoFiltro(value);
    navigate(`/qualidade/registros/consulta?tipo=${value}`);
  }

  function abrirDetalhe(registro: Registro) {
    setAbrirEmEdicao(false);
    setRegistroSelecionadoId(registro.id);
  }

  function abrirEdicao(registro: Registro) {
    setAbrirEmEdicao(true);
    setRegistroSelecionadoId(registro.id);
  }

  async function confirmarExclusao() {
    if (!registroParaExcluir) return;
    const alvo = registroParaExcluir;
    setExcluindo(true);
    setErroExclusao("");
    try {
      await excluirQualidadeRegistro(alvo.id);
      excluirRegistroStore(alvo.id);
      setRegistroParaExcluir(null);
    } catch (err) {
      setErroExclusao(
        err instanceof Error
          ? err.message
          : "Falha ao excluir o registro no servidor. Tente novamente."
      );
    } finally {
      setExcluindo(false);
    }
  }

  const filtrados = grade.rowsExibidas;
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

      {erroExclusao ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive"
          role="alert"
        >
          {erroExclusao}
        </p>
      ) : null}

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
                <SelectValue placeholder="Selecione o tipo">
                  {tipoSelecionado
                    ? moduloRegistroTipoLabelsCurto[tipoSelecionado]
                    : null}
                </SelectValue>
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
            {grade.temFiltrosOuOrdem ? (
              <div className="flex justify-end border-b border-border px-3 py-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={grade.limparFiltrosGrade}
                >
                  Limpar filtros da grade
                </Button>
              </div>
            ) : null}
            <div ref={grade.tableScrollRef} className="overflow-x-auto">
              <Table bare>
                <TableHeader>
                  <TableRow>
                    {COL_IDS.map((colId) => (
                      <SgqGradeFiltroCabecalho
                        key={colId}
                        label={nomeColunaRegistro(colId)}
                        ativo={grade.colunaComFiltroAtivo(colId)}
                        onClick={(e) => grade.abrirFiltroExcel(colId, e)}
                      />
                    ))}
                    <TableHead className="sticky top-0 z-10 text-right">
                      Ações
                    </TableHead>
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
                        className="group cursor-pointer"
                        onClick={() => abrirDetalhe(registro)}
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
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <TableRowActions
                            onEdit={() => abrirEdicao(registro)}
                            onDelete={() => {
                              setErroExclusao("");
                              setRegistroParaExcluir(registro);
                            }}
                            editLabel="Editar"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtrados.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={COL_IDS.length + 1}
                        className={cn(
                          "py-10 text-center text-muted-foreground"
                        )}
                      >
                        {registrosDoTipo.length === 0
                          ? "Nenhum registro encontrado."
                          : "Nenhum registro com os filtros da grade. Ajuste ou limpe os filtros por coluna."}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
            <SgqGradeFiltroPortal
              grade={grade}
              dateColumnIds={["dataOcorrencia", "fechamento"]}
            />
          </>
        )}
      </div>

      {tipoSelecionado && !isAvaliacaoView ? (
        <RegistroDetalheDialog
          registroId={registroSelecionadoId}
          open={registroSelecionadoId !== null}
          editarAoAbrir={abrirEmEdicao}
          onOpenChange={(open) => {
            if (!open) {
              setRegistroSelecionadoId(null);
              setAbrirEmEdicao(false);
            }
          }}
        />
      ) : null}

      <ConfirmacaoDialog
        open={registroParaExcluir !== null}
        onOpenChange={(open) => {
          if (!open && !excluindo) {
            setRegistroParaExcluir(null);
            setErroExclusao("");
          }
        }}
        titulo="Excluir registro"
        mensagem={
          registroParaExcluir
            ? `Tem certeza que deseja excluir o registro ${getRegistroCodigoDocumento(
                registroParaExcluir
              )}? Esta ação não pode ser desfeita.`
            : ""
        }
        confirmarLabel="Excluir"
        variant="destructive"
        onConfirmar={() => void confirmarExclusao()}
      />
    </div>
  );
}
