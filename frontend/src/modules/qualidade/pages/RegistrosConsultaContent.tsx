import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { tiposRegistroPermitidos } from "@/utils/qualidadePermissoes";
import { Badge } from "@qualidade/components/ui/badge";
import { Button } from "@qualidade/components/ui/button";
import { AvaliacaoFornecedorConsultaPanel } from "@qualidade/components/registros/avaliacao-fornecedor-consulta-panel";
import { CodigoDocumentoCell } from "@qualidade/components/registros/codigo-documento-cell";
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
  moduloRegistroTipoLabelsCurto,
  rotuloStatusRegistro,
  type ModuloRegistroTipo,
} from "@qualidade/lib/registros/constants";
import { useRegistrosStore } from "@qualidade/lib/store/registros-store";
import { useAvaliacaoFornecedorStore } from "@qualidade/lib/store/avaliacao-fornecedor-store";
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
import { useGradeFiltrosExcel } from "@/hooks/useGradeFiltrosExcel";

const COL_IDS = [
  "codigo",
  "dataOcorrencia",
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
  const { hasPermission } = useAuth();
  const tiposPermitidos = useMemo(
    () => tiposRegistroPermitidos(hasPermission),
    [hasPermission]
  );
  const [searchParams] = useSearchParams();
  const registros = useRegistrosStore((s) => s.registros);
  const avaliacoes = useAvaliacaoFornecedorStore((s) => s.avaliacoes);
  const excluirRegistroStore = useRegistrosStore((s) => s.excluirRegistro);
  const users = useConfigStore((s) => s.users);

  const [tipoFiltro, setTipoFiltro] = useState<ModuloRegistroTipo>(() => {
    const tipoParam = searchParams.get("tipo");
    if (isModuloRegistroTipo(tipoParam) && tiposPermitidos.includes(tipoParam)) return tipoParam;
    return tiposPermitidos[0] ?? "rnc";
  });
  const [registroSelecionadoId, setRegistroSelecionadoId] = useState<
    string | null
  >(null);
  const [abrirEmEdicao, setAbrirEmEdicao] = useState(false);
  const [registroParaExcluir, setRegistroParaExcluir] =
    useState<Registro | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [erroExclusao, setErroExclusao] = useState("");
  const [contagemAvaliacoes, setContagemAvaliacoes] = useState<number | null>(
    null
  );

  const tipoSelecionado = tipoFiltro;
  const isAvaliacaoView = tipoSelecionado === "avaliacao-fornecedor";

  useEffect(() => {
    const tipoParam = searchParams.get("tipo");
    const pedido =
      isModuloRegistroTipo(tipoParam) && tiposPermitidos.includes(tipoParam)
        ? tipoParam
        : tiposPermitidos[0];
    if (pedido) setTipoFiltro(pedido);
  }, [searchParams, tiposPermitidos]);

  const handleContagemAvaliacoes = useCallback((count: number) => {
    setContagemAvaliacoes(count);
  }, []);

  const registrosDoTipo = useMemo(() => {
    if (tipoSelecionado === "avaliacao-fornecedor") return [];
    return registros.filter((registro) => registro.tipo === tipoSelecionado);
  }, [registros, tipoSelecionado]);

  const getCellText = useCallback(
    (registro: Registro, columnId: string) => {
      switch (columnId) {
        case "codigo":
          return sgqTextoOuTraco(getRegistroCodigoDocumento(registro));
        case "dataOcorrencia":
          return formatarData(getRegistroDataOcorrencia(registro));
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
          return rotuloStatusRegistro(registro);
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

  function atualizarTipoFiltro(value: ModuloRegistroTipo) {
    grade.limparFiltrosGrade();
    setTipoFiltro(value);
    navigate(`/qualidade/registros/consulta?tipo=${value}`, { replace: true });
  }

  const contagensPorTipo = useMemo(() => {
    const contagens: Record<ModuloRegistroTipo, number> = {
      rnc: 0,
      rcc: 0,
      "avaliacao-fornecedor": avaliacoes.length,
    };
    for (const registro of registros) {
      if (registro.tipo === "rnc" || registro.tipo === "rcc") {
        contagens[registro.tipo] += 1;
      }
    }
    return contagens;
  }, [avaliacoes.length, registros]);

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
  const contagemExibida = isAvaliacaoView
    ? (contagemAvaliacoes ?? avaliacoes.length)
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
            {contagemExibida} {rotuloContagem}
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

      <div
        role="tablist"
        aria-label="Tipo de registro"
        className={cn(
          "grid w-full max-w-3xl items-stretch rounded-lg bg-muted p-1",
          tiposPermitidos.length <= 1
            ? "grid-cols-1"
            : tiposPermitidos.length === 2
              ? "grid-cols-2"
              : "grid-cols-3"
        )}
      >
        {tiposPermitidos.map((tipo) => {
          const ativa = tipoSelecionado === tipo;
          return (
            <button
              key={tipo}
              type="button"
              role="tab"
              aria-selected={ativa}
              onClick={() => atualizarTipoFiltro(tipo)}
              className={cn(
                "inline-flex h-auto min-h-9 min-w-0 items-center justify-center gap-2 rounded-md px-2 py-1.5 text-center text-sm font-medium leading-tight transition-colors",
                ativa
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="whitespace-normal">
                {moduloRegistroTipoLabelsCurto[tipo]}
              </span>
              <Badge
                variant={ativa ? "default" : "secondary"}
                className="h-5 min-w-5 px-1.5 text-[11px] tabular-nums"
              >
                {contagensPorTipo[tipo]}
              </Badge>
            </button>
          );
        })}
      </div>

      <div className="sgq-table-surface overflow-hidden rounded-xl border border-border bg-card shadow-sm ring-1 ring-foreground/6">
        {isAvaliacaoView ? (
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
                          <Badge>{rotuloStatusRegistro(registro)}</Badge>
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
                          ? `Nenhum ${moduloRegistroTipoLabelsCurto[tipoSelecionado]} encontrado.`
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

      {!isAvaliacaoView ? (
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
