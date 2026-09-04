import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { CircleHelp, FileSpreadsheet, Filter, RefreshCw, X } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@qualidade/components/ui/card";
import { Button } from "@qualidade/components/ui/button";
import { Badge } from "@qualidade/components/ui/badge";
import { Input } from "@qualidade/components/ui/input";
import { Label } from "@qualidade/components/ui/label";
import { MultiSelectSearch } from "@qualidade/components/ui/multi-select-search";
import { useLoading } from "@qualidade/components/providers/loading-provider";
import { fetchRncPainelClient } from "@qualidade/lib/registros/fetch-rnc-painel-client";
import { downloadRncPainelXlsx } from "@qualidade/lib/registros/export-rnc-painel-xlsx";
import { formatarData } from "@qualidade/lib/utils/dates";
import { cn } from "@qualidade/lib/utils";
import CopiarTextoBtn from "@/components/CopiarTextoBtn";
import GradeFiltroCabecalhoBtn from "@/components/grade/GradeFiltroCabecalhoBtn";
import GradeFiltroExcelPortal from "@/components/grade/GradeFiltroExcelPortal";
import { useGradeFiltrosExcel } from "@/hooks/useGradeFiltrosExcel";
import type {
  RncPainelIndicadores,
  RncPainelItem,
} from "@qualidade/types/rnc-painel";

const COLUNAS = [
  { id: "id", label: "ID" },
  { id: "codigoDocumento", label: "Código" },
  { id: "dataOcorrencia", label: "Data da ocorrência" },
  { id: "prazoExecucao", label: "Prazo", hint: "Prazo de execução" },
  { id: "responsavel", label: "Responsável", hint: "Responsável pela Ação Imediata" },
  { id: "situacaoPrazo", label: "Situação do prazo" },
] as const;

type ColId = (typeof COLUNAS)[number]["id"];
const COL_IDS = COLUNAS.map((c) => c.id);
const DATE_COLS: ColId[] = ["dataOcorrencia", "prazoExecucao"];
const DATE_COLS_SET = new Set<string>(DATE_COLS);

const INITIAL_ROWS = 50;
const SCROLL_BATCH = 25;

const INDICADORES_VAZIOS: RncPainelIndicadores = {
  total: 0,
  noPrazo: 0,
  vencidas: 0,
  semPrazo: 0,
  responsaveis: 0,
};

type KpiFiltro = "todos" | "no_prazo" | "vencidas";

type RncLinha = RncPainelItem & {
  situacaoPrazo: "no_prazo" | "vencida" | "sem_prazo";
  situacaoPrazoLabel: string;
};

type FiltrosPainel = {
  dataOcorrenciaDe: string;
  dataOcorrenciaAte: string;
  prazoDe: string;
  prazoAte: string;
  responsaveis: string[];
};

const FILTROS_VAZIOS: FiltrosPainel = {
  dataOcorrenciaDe: "",
  dataOcorrenciaAte: "",
  prazoDe: "",
  prazoAte: "",
  responsaveis: [],
};

function formatarDataPainel(iso: string | null): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return formatarData(iso);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function hojeIsoLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function prazoStatus(prazo: string | null): RncLinha["situacaoPrazo"] {
  if (!prazo) return "sem_prazo";
  return prazo >= hojeIsoLocal() ? "no_prazo" : "vencida";
}

function situacaoLabel(s: RncLinha["situacaoPrazo"]): string {
  if (s === "vencida") return "Atrasada";
  if (s === "no_prazo") return "Em andamento";
  return "Concluída";
}

function getCellText(row: RncLinha, colId: string): string {
  switch (colId as ColId) {
    case "id":
      return String(row.id);
    case "codigoDocumento":
      return row.codigoDocumento || "—";
    case "dataOcorrencia":
      return formatarDataPainel(row.dataOcorrencia);
    case "prazoExecucao":
      return formatarDataPainel(row.prazoExecucao);
    case "responsavel":
      return row.responsavel?.trim() || "—";
    case "situacaoPrazo":
      return row.situacaoPrazoLabel;
    default:
      return "";
  }
}

function valueForSort(row: RncLinha, colId: string): string | number {
  if (colId === "id") return row.id;
  if (colId === "dataOcorrencia") return row.dataOcorrencia ?? "";
  if (colId === "prazoExecucao") return row.prazoExecucao ?? "";
  return getCellText(row, colId);
}

function passaFiltroData(iso: string | null, de: string, ate: string): boolean {
  if (!de && !ate) return true;
  if (!iso) return false;
  if (de && iso < de) return false;
  if (ate && iso > ate) return false;
  return true;
}

function filtrosAtivosCount(f: FiltrosPainel): number {
  let n = 0;
  if (f.dataOcorrenciaDe || f.dataOcorrenciaAte) n += 1;
  if (f.prazoDe || f.prazoAte) n += 1;
  if (f.responsaveis.length > 0) n += 1;
  return n;
}

export function RncPage() {
  const { withLoading } = useLoading();
  const [itens, setItens] = useState<RncPainelItem[]>([]);
  const [indicadores, setIndicadores] = useState<RncPainelIndicadores>(INDICADORES_VAZIOS);
  const [source, setSource] = useState<"erp" | "indisponivel" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [kpiFiltro, setKpiFiltro] = useState<KpiFiltro>("todos");
  const [filtros, setFiltros] = useState<FiltrosPainel>(FILTROS_VAZIOS);
  const [filtrosDraft, setFiltrosDraft] = useState<FiltrosPainel>(FILTROS_VAZIOS);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_ROWS);
  const [exportando, setExportando] = useState(false);
  const [erroExport, setErroExport] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const filtrosWrapRef = useRef<HTMLDivElement>(null);

  const linhas = useMemo<RncLinha[]>(
    () =>
      itens.map((item) => {
        const situacao = prazoStatus(item.prazoExecucao);
        return {
          ...item,
          situacaoPrazo: situacao,
          situacaoPrazoLabel: situacaoLabel(situacao),
        };
      }),
    [itens]
  );

  const opcoesResponsavel = useMemo(() => {
    const set = new Set<string>();
    for (const row of linhas) {
      const nome = row.responsavel?.trim();
      if (nome) set.add(nome);
    }
    return [...set]
      .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }))
      .map((nome) => ({ value: nome, label: nome }));
  }, [linhas]);

  const linhasFiltradas = useMemo(() => {
    return linhas.filter((row) => {
      if (kpiFiltro === "no_prazo" && row.situacaoPrazo !== "no_prazo") return false;
      if (kpiFiltro === "vencidas" && row.situacaoPrazo !== "vencida") return false;
      if (
        !passaFiltroData(
          row.dataOcorrencia,
          filtros.dataOcorrenciaDe,
          filtros.dataOcorrenciaAte
        )
      ) {
        return false;
      }
      if (!passaFiltroData(row.prazoExecucao, filtros.prazoDe, filtros.prazoAte)) {
        return false;
      }
      if (
        filtros.responsaveis.length > 0 &&
        !filtros.responsaveis.includes(row.responsavel?.trim() || "")
      ) {
        return false;
      }
      return true;
    });
  }, [linhas, kpiFiltro, filtros]);

  const grade = useGradeFiltrosExcel({
    rows: linhasFiltradas,
    columnIds: COL_IDS,
    getCellText,
    valueForSort,
    defaultSortLevels: [{ id: "dataOcorrencia", dir: "desc" }],
    dateColumnIds: DATE_COLS,
  });

  const totalFiltrados = grade.rowsExibidas.length;
  const linhasVisiveis = grade.rowsExibidas.slice(0, visibleCount);
  const temMais = visibleCount < totalFiltrados;
  const qtdFiltrosPainel = filtrosAtivosCount(filtros);

  const resetVisiveis = useCallback(() => setVisibleCount(INITIAL_ROWS), []);

  const gradeFiltrosKey = useMemo(
    () =>
      JSON.stringify({
        kpi: kpiFiltro,
        filtros,
        cf: grade.columnFilters,
        sort: grade.sortState,
        levels: grade.sortLevels,
      }),
    [kpiFiltro, filtros, grade.columnFilters, grade.sortState, grade.sortLevels]
  );

  useEffect(() => {
    resetVisiveis();
  }, [linhasFiltradas, gradeFiltrosKey, resetVisiveis]);

  useEffect(() => {
    const root = grade.tableScrollRef.current;
    const sentinel = loadMoreRef.current;
    if (!root || !sentinel || !temMais) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((n) => Math.min(n + SCROLL_BATCH, totalFiltrados));
        }
      },
      { root, rootMargin: "80px", threshold: 0 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [grade.tableScrollRef, temMais, totalFiltrados, visibleCount]);

  useEffect(() => {
    if (!filtrosAbertos) return;
    const onDown = (e: Event) => {
      if (!filtrosWrapRef.current?.contains(e.target as Node)) {
        setFiltrosAbertos(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltrosAbertos(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [filtrosAbertos]);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      await withLoading(async () => {
        const data = await fetchRncPainelClient();
        setItens(data.itens);
        setIndicadores(data.indicadores);
        setSource(data.source);
        if (data.source === "indisponivel") {
          setErro("ERP Nomus indisponível no momento.");
        }
      }, "Carregando RNCs…");
    } catch (e) {
      setItens([]);
      setIndicadores(INDICADORES_VAZIOS);
      setSource(null);
      setErro(e instanceof Error ? e.message : "Erro ao carregar o painel de RNC.");
    }
  }, [withLoading]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const onAbrirFiltro = useCallback(
    (colId: string, e: MouseEvent<HTMLButtonElement>) => {
      resetVisiveis();
      grade.abrirFiltroExcel(colId, e);
    },
    [grade, resetVisiveis]
  );

  const abrirPainelFiltros = () => {
    setFiltrosDraft(filtros);
    setFiltrosAbertos((v) => !v);
  };

  const aplicarFiltrosPainel = () => {
    setFiltros(filtrosDraft);
    setFiltrosAbertos(false);
  };

  const limparFiltrosPainel = () => {
    setFiltrosDraft(FILTROS_VAZIOS);
    setFiltros(FILTROS_VAZIOS);
    setFiltrosAbertos(false);
  };

  const exportarExcel = async () => {
    setErroExport(null);
    setExportando(true);
    try {
      await downloadRncPainelXlsx(grade.rowsExibidas);
    } catch (e) {
      setErroExport(e instanceof Error ? e.message : "Não foi possível exportar o Excel.");
    } finally {
      setExportando(false);
    }
  };

  const kpis: Array<{
    id: KpiFiltro | "responsaveis";
    title: string;
    value: number;
    filtro: KpiFiltro;
  }> = [
    { id: "todos", title: "Em andamento", value: indicadores.total, filtro: "todos" },
    { id: "no_prazo", title: "No prazo", value: indicadores.noPrazo, filtro: "no_prazo" },
    { id: "vencidas", title: "Prazo vencido", value: indicadores.vencidas, filtro: "vencidas" },
    {
      id: "responsaveis",
      title: "Responsáveis",
      value: indicadores.responsaveis,
      filtro: "todos",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">RNC</h1>
          <p className="text-sm text-muted-foreground">
            Relatório de Não Conformidade — em andamento (FOR-SA-0021)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {grade.temFiltrosOuOrdem ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                grade.limparFiltrosGrade();
                resetVisiveis();
              }}
            >
              Limpar filtros da grade
            </Button>
          ) : null}
          <div ref={filtrosWrapRef} className="relative">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={abrirPainelFiltros}
              aria-expanded={filtrosAbertos}
              aria-haspopup="dialog"
            >
              <Filter className="size-4" />
              Filtros
              {qtdFiltrosPainel > 0 ? (
                <span className="ml-0.5 inline-flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {qtdFiltrosPainel}
                </span>
              ) : null}
            </Button>
            {filtrosAbertos ? (
              <div
                className="absolute right-0 z-40 mt-2 w-[min(calc(100vw-2rem),22rem)] rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-lg"
                role="dialog"
                aria-label="Filtros do painel RNC"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Filtros</p>
                  <button
                    type="button"
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => setFiltrosAbertos(false)}
                    aria-label="Fechar filtros"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Data da ocorrência</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-[11px] text-muted-foreground">De</span>
                        <Input
                          type="date"
                          value={filtrosDraft.dataOcorrenciaDe}
                          onChange={(e) =>
                            setFiltrosDraft((d) => ({
                              ...d,
                              dataOcorrenciaDe: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] text-muted-foreground">Até</span>
                        <Input
                          type="date"
                          value={filtrosDraft.dataOcorrenciaAte}
                          onChange={(e) =>
                            setFiltrosDraft((d) => ({
                              ...d,
                              dataOcorrenciaAte: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Prazo de execução</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-[11px] text-muted-foreground">De</span>
                        <Input
                          type="date"
                          value={filtrosDraft.prazoDe}
                          onChange={(e) =>
                            setFiltrosDraft((d) => ({ ...d, prazoDe: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] text-muted-foreground">Até</span>
                        <Input
                          type="date"
                          value={filtrosDraft.prazoAte}
                          onChange={(e) =>
                            setFiltrosDraft((d) => ({ ...d, prazoAte: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Responsável</Label>
                    <MultiSelectSearch
                      options={opcoesResponsavel}
                      value={filtrosDraft.responsaveis}
                      onChange={(responsaveis) =>
                        setFiltrosDraft((d) => ({ ...d, responsaveis }))
                      }
                      placeholder="Múltipla escolha…"
                      searchPlaceholder="Buscar responsável…"
                      emptyMessage="Nenhum responsável na lista."
                    />
                  </div>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={limparFiltrosPainel}>
                    Limpar
                  </Button>
                  <Button type="button" size="sm" onClick={aplicarFiltrosPainel}>
                    Aplicar
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void carregar()}>
            <RefreshCw className="size-4" />
            Atualizar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void exportarExcel()}
            disabled={exportando || totalFiltrados === 0}
            title={
              totalFiltrados === 0
                ? "Não há linhas filtradas para exportar"
                : "Exportar a grade com os filtros atuais"
            }
          >
            <FileSpreadsheet className="size-4" />
            {exportando ? "Exportando…" : "Excel"}
          </Button>
        </div>
      </div>

      {erro ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {erro}
        </div>
      ) : null}
      {erroExport ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {erroExport}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => {
          const selecionado = kpi.id !== "responsaveis" && kpiFiltro === kpi.filtro;

          return (
            <button
              key={kpi.id}
              type="button"
              onClick={() => {
                if (kpi.id === "responsaveis") {
                  setKpiFiltro("todos");
                  return;
                }
                if (kpi.filtro === "todos") {
                  setKpiFiltro("todos");
                  return;
                }
                setKpiFiltro((atual) => (atual === kpi.filtro ? "todos" : kpi.filtro));
              }}
              className="text-left"
            >
              <Card
                className={cn(
                  "transition-[border-color,box-shadow] hover:shadow-md",
                  selecionado
                    ? "border-2 border-primary shadow-md"
                    : "border border-border"
                )}
              >
                <CardHeader className="pb-3">
                  <CardDescription>{kpi.title}</CardDescription>
                  <CardTitle className="text-3xl">{kpi.value}</CardTitle>
                </CardHeader>
              </Card>
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden p-0">
        <CardHeader className="gap-2 space-y-0 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>RNCs em andamento</CardTitle>
            <CardDescription>
              Exibindo {Math.min(visibleCount, totalFiltrados)} de {totalFiltrados} registro
              {totalFiltrados === 1 ? "" : "s"}
              {totalFiltrados !== linhas.length ? ` (${linhas.length} no painel)` : ""}
              {source === "erp" ? " · Nomus" : ""}
            </CardDescription>
          </div>
        </CardHeader>
        <div
          ref={grade.tableScrollRef}
          className="max-h-[min(70vh,560px)] overflow-auto border-t"
        >
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-primary text-primary-foreground">
                {COLUNAS.map((col) => {
                  const sortAtivo =
                    grade.sortState?.key === col.id ||
                    grade.sortLevels.some((l) => l.id === col.id);
                  return (
                    <th
                      key={col.id}
                      className="border border-primary-foreground/15 px-2 py-2 text-left font-semibold whitespace-nowrap"
                    >
                      <div className="flex min-w-0 items-center justify-between gap-1">
                        <span className="inline-flex min-w-0 items-center gap-1 truncate text-[11px] uppercase leading-tight tracking-wide">
                          <span className="truncate">{col.label}</span>
                          {"hint" in col && col.hint ? (
                            <span
                              title={col.hint}
                              aria-label={col.hint}
                              className="inline-flex shrink-0 cursor-help opacity-90"
                            >
                              <CircleHelp className="size-3.5" aria-hidden />
                            </span>
                          ) : null}
                        </span>
                        <GradeFiltroCabecalhoBtn
                          ativo={grade.colunaComFiltroAtivo(col.id) || sortAtivo}
                          onClick={(e) => onAbrirFiltro(col.id, e)}
                        />
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {linhasVisiveis.length === 0 ? (
                <tr>
                  <td colSpan={COLUNAS.length} className="px-3 py-8 text-center text-muted-foreground">
                    Nenhuma RNC encontrada com os critérios atuais.
                  </td>
                </tr>
              ) : (
                linhasVisiveis.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/40">
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{item.id}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5 font-medium">
                        <span>{item.codigoDocumento}</span>
                        <CopiarTextoBtn texto={item.codigoDocumento} title="Copiar código da RNC" />
                      </div>
                    </td>
                    <td className="px-3 py-2">{formatarDataPainel(item.dataOcorrencia)}</td>
                    <td className="px-3 py-2">{formatarDataPainel(item.prazoExecucao)}</td>
                    <td className="px-3 py-2">{item.responsavel ?? "—"}</td>
                    <td className="px-3 py-2">
                      {item.situacaoPrazo === "vencida" ? (
                        <Badge variant="destructive">Atrasada</Badge>
                      ) : item.situacaoPrazo === "no_prazo" ? (
                        <Badge variant="warning">Em andamento</Badge>
                      ) : (
                        <Badge variant="secondary">Concluída</Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {temMais ? <div ref={loadMoreRef} className="h-8" aria-hidden /> : null}
        </div>
      </Card>

      {grade.colunaFiltroAberta && grade.filtroAbertoRect ? (
        <GradeFiltroExcelPortal
          colunaAberta={grade.colunaFiltroAberta}
          rect={grade.filtroAbertoRect}
          dropdownRef={grade.filtroDropdownRef}
          excelFilterDrafts={grade.excelFilterDrafts}
          setExcelFilterDrafts={grade.setExcelFilterDrafts}
          valoresUnicosPorColuna={grade.valoresUnicosPorColuna}
          onSortAsc={(colId) => {
            grade.setSortState({ key: colId, direction: "asc" });
            grade.setSortLevels([]);
            grade.fecharFiltroExcel();
          }}
          onSortDesc={(colId) => {
            grade.setSortState({ key: colId, direction: "desc" });
            grade.setSortLevels([]);
            grade.fecharFiltroExcel();
          }}
          onAplicar={grade.aplicarFiltroExcel}
          onCancelar={grade.fecharFiltroExcel}
          showDateRangeFilters={DATE_COLS_SET.has(grade.colunaFiltroAberta)}
        />
      ) : null}
    </div>
  );
}
