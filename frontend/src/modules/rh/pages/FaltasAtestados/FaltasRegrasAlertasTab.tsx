import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Badge } from "@rh/components/ui/badge";
import { Button } from "@rh/components/ui/button";
import { Input } from "@rh/components/ui/input";
import { Switch } from "@rh/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rh/components/ui/select";
import { Textarea } from "@rh/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rh/components/ui/dialog";
import { ScrollArea } from "@rh/components/ui/scroll-area";
import { cn } from "@rh/lib/utils";
import type {
  FaltaAlertaBaseLegal,
  FaltaAlertaEnquadramentoRow,
  FaltaAlertaRegraRow,
  FaltaAusenciaInconsistenciaRow,
  FaltaAusenciaInconsistenciaStatus,
} from "@rh/types/api";
import {
  FALTAS_ALERTAS_CHANGED_EVENT,
  getFaltasAlertaEnquadramentos,
  getFaltasAlertaRegras,
  getFaltasAusenciaInconsistenciasSincronizadas,
  setFaltaAlertaRegraAtiva,
  updateFaltaAusenciaInconsistenciaStatus,
} from "@rh/lib/ausencia-inconsistencias/faltas-alerta-storage";
import { getFaltasAtestados } from "@rh/lib/api-client";
import { textIncludesSearch } from "@rh/lib/normalize-search-text";
import { useToast } from "@rh/hooks/use-toast";
import { useSavingOverlay } from "@rh/contexts/saving-overlay-context";

const STATUS_ORDER: Record<FaltaAusenciaInconsistenciaStatus, number> = {
  pendente: 0,
  em_analise: 1,
  resolvida: 2,
  ignorada: 3,
};

const BASE_LEGAL_LABEL: Record<FaltaAlertaBaseLegal, string> = {
  clt: "CLT",
  previdenciario: "Previdenciário",
  politica_interna: "Política interna",
  operacional: "Operacional",
};

const BASE_LEGAL_CLASS: Record<FaltaAlertaBaseLegal, string> = {
  clt: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  previdenciario: "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  politica_interna: "bg-amber-500/10 text-amber-800 dark:text-amber-200",
  operacional: "bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<FaltaAusenciaInconsistenciaStatus, string> = {
  pendente: "Pendente",
  em_analise: "Em análise",
  resolvida: "Resolvida",
  ignorada: "Ignorada",
};

const STATUS_CLASS: Record<FaltaAusenciaInconsistenciaStatus, string> = {
  pendente: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  em_analise: "bg-blue-500/15 text-blue-800 dark:text-blue-200",
  resolvida: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  ignorada: "bg-muted text-muted-foreground",
};

function formatDetectada(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return iso;
  }
}

function ResolucaoDetalhes({
  status,
  resolvidaEm,
  resolvidoPor,
  resolucaoNotas,
}: {
  status: FaltaAusenciaInconsistenciaStatus;
  resolvidaEm?: string;
  resolvidoPor?: string;
  resolucaoNotas?: string;
}) {
  if (status === "em_analise" && resolucaoNotas) {
    return (
      <div className="text-xs text-muted-foreground border-t border-border pt-2 space-y-0.5">
        <p>Observações: {resolucaoNotas}</p>
      </div>
    );
  }
  if (status !== "resolvida" && status !== "ignorada") return null;
  return (
    <div className="text-xs text-muted-foreground border-t border-border pt-2 space-y-0.5">
      {resolvidaEm ? (
        <p>{status === "ignorada" ? "Ignorada em" : "Resolvida em"}: {formatDetectada(resolvidaEm)}</p>
      ) : null}
      {resolvidoPor ? <p>{status === "ignorada" ? "Ignorada por" : "Resolvida por"}: {resolvidoPor}</p> : null}
      {resolucaoNotas ? <p>Justificativa: {resolucaoNotas}</p> : null}
    </div>
  );
}

type Props = {
  canEdit?: boolean;
  highlightInconsistenciaId?: string | null;
};

export default function FaltasRegrasAlertasTab({
  canEdit = true,
  highlightInconsistenciaId = null,
}: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { runWithSaving } = useSavingOverlay();
  const [search, setSearch] = useState("");
  const [selectedRegraId, setSelectedRegraId] = useState<string | null>(null);
  const [logSearch, setLogSearch] = useState("");
  const [logStatusFiltro, setLogStatusFiltro] = useState<FaltaAusenciaInconsistenciaStatus | "todas">("todas");
  const [inconsSearch, setInconsSearch] = useState("");
  const [inconsStatusFiltro, setInconsStatusFiltro] = useState<FaltaAusenciaInconsistenciaStatus | "abertas" | "todas">(
    "todas",
  );
  const [resolverItem, setResolverItem] = useState<FaltaAusenciaInconsistenciaRow | null>(null);
  const [notas, setNotas] = useState("");
  const [novoStatus, setNovoStatus] = useState<FaltaAusenciaInconsistenciaStatus>("resolvida");

  const { data: regras = [], isLoading: loadingRegras } = useQuery({
    queryKey: ["faltas-alerta-regras"],
    queryFn: getFaltasAlertaRegras,
  });

  const { data: inconsistencias = [], isLoading: loadingIncons } = useQuery({
    queryKey: ["faltas-ausencia-inconsistencias"],
    queryFn: async () => {
      const faltas = await getFaltasAtestados();
      return getFaltasAusenciaInconsistenciasSincronizadas(faltas);
    },
  });

  const { data: enquadramentos = [] } = useQuery({
    queryKey: ["faltas-alerta-enquadramentos", selectedRegraId],
    queryFn: () => getFaltasAlertaEnquadramentos(selectedRegraId ?? undefined),
    enabled: Boolean(selectedRegraId),
  });

  const invalidateAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["faltas-alerta-regras"] });
    void queryClient.invalidateQueries({ queryKey: ["faltas-alerta-enquadramentos"] });
    void queryClient.invalidateQueries({ queryKey: ["faltas-ausencia-inconsistencias"] });
  }, [queryClient]);

  useEffect(() => {
    const handler = async () => {
      const { getFaltasAusenciaInconsistencias } = await import(
        "@rh/lib/ausencia-inconsistencias/faltas-alerta-storage"
      );
      const rows = await getFaltasAusenciaInconsistencias();
      queryClient.setQueryData(["faltas-ausencia-inconsistencias"], rows);
      void queryClient.invalidateQueries({ queryKey: ["faltas-alerta-enquadramentos"] });
    };
    window.addEventListener(FALTAS_ALERTAS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(FALTAS_ALERTAS_CHANGED_EVENT, handler);
  }, [queryClient]);

  useEffect(() => {
    if (!highlightInconsistenciaId || inconsistencias.length === 0) return;
    const item = inconsistencias.find((i) => i.id === highlightInconsistenciaId);
    if (item) setSelectedRegraId(item.regraId);
  }, [highlightInconsistenciaId, inconsistencias]);

  const regrasFiltradas = useMemo(() => {
    const q = search.trim();
    if (!q) return regras;
    return regras.filter(
      (r) =>
        textIncludesSearch(r.titulo, q)
        || textIncludesSearch(r.descricao, q)
        || textIncludesSearch(r.referenciaLegal ?? "", q),
    );
  }, [regras, search]);

  const selectedRegra = useMemo(
    () => regras.find((r) => r.id === selectedRegraId) ?? null,
    [regras, selectedRegraId],
  );

  const inconsistenciasFiltradas = useMemo(() => {
    const q = inconsSearch.trim();
    const filtered = inconsistencias.filter((item) => {
      if (inconsStatusFiltro === "abertas") {
        if (item.status !== "pendente" && item.status !== "em_analise") return false;
      } else if (inconsStatusFiltro !== "todas" && item.status !== inconsStatusFiltro) {
        return false;
      }
      if (!q) return true;
      return (
        textIncludesSearch(item.nomeFuncionario, q)
        || textIncludesSearch(item.matricula, q)
        || textIncludesSearch(item.titulo, q)
        || textIncludesSearch(item.descricao, q)
      );
    });
    return filtered.sort((a, b) => {
      const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (byStatus !== 0) return byStatus;
      return b.detectadaEm.localeCompare(a.detectadaEm);
    });
  }, [inconsistencias, inconsSearch, inconsStatusFiltro]);

  const pendentesTotal = useMemo(
    () => inconsistencias.filter((i) => i.status === "pendente" || i.status === "em_analise").length,
    [inconsistencias],
  );

  const pendentesPorRegra = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of inconsistencias) {
      if (item.status !== "pendente" && item.status !== "em_analise") continue;
      map.set(item.regraId, (map.get(item.regraId) ?? 0) + 1);
    }
    return map;
  }, [inconsistencias]);

  const enquadramentos30dPorRegra = useMemo(() => {
    const desde = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const map = new Map<string, number>();
    for (const item of inconsistencias) {
      const t = Date.parse(item.detectadaEm);
      if (!Number.isFinite(t) || t < desde) continue;
      map.set(item.regraId, (map.get(item.regraId) ?? 0) + 1);
    }
    return map;
  }, [inconsistencias]);

  const logFiltrado = useMemo(() => {
    const q = logSearch.trim();
    return enquadramentos
      .filter((e) => {
        const status = e.statusResolucao ?? "pendente";
        if (logStatusFiltro !== "todas" && status !== logStatusFiltro) return false;
        if (!q) return true;
        return (
          textIncludesSearch(e.nomeFuncionario, q)
          || textIncludesSearch(e.matricula, q)
          || textIncludesSearch(e.motivo, q)
          || textIncludesSearch(e.lancadoPor, q)
          || textIncludesSearch(e.resolucaoNotas ?? "", q)
          || textIncludesSearch(e.resolvidoPor ?? "", q)
          || textIncludesSearch(STATUS_LABEL[status], q)
        );
      })
      .sort((a, b) => {
        const byStatus = STATUS_ORDER[(a.statusResolucao ?? "pendente")] - STATUS_ORDER[(b.statusResolucao ?? "pendente")];
        if (byStatus !== 0) return byStatus;
        return b.detectadaEm.localeCompare(a.detectadaEm);
      });
  }, [enquadramentos, logSearch, logStatusFiltro]);

  const logResumo = useMemo(() => {
    const counts = { pendente: 0, em_analise: 0, resolvida: 0, ignorada: 0 };
    for (const e of enquadramentos) {
      const status = e.statusResolucao ?? "pendente";
      counts[status] += 1;
    }
    return counts;
  }, [enquadramentos]);

  const toggleRegra = useCallback(
    async (regra: FaltaAlertaRegraRow, ativa: boolean) => {
      if (!canEdit) return;
      await runWithSaving(async () => {
        await setFaltaAlertaRegraAtiva(regra.id, ativa);
        invalidateAll();
      }, "Salvando regra…");
    },
    [canEdit, invalidateAll, runWithSaving],
  );

  const abrirResolver = useCallback((item: FaltaAusenciaInconsistenciaRow, status: FaltaAusenciaInconsistenciaStatus) => {
    setResolverItem(item);
    setNovoStatus(status);
    setNotas(item.resolucaoNotas ?? "");
  }, []);

  const confirmarResolucao = useCallback(async () => {
    if (!resolverItem || !canEdit) return;
    const regraId = resolverItem.regraId;
    await runWithSaving(async () => {
      await updateFaltaAusenciaInconsistenciaStatus(
        resolverItem.id,
        novoStatus,
        notas.trim() || undefined,
      );
      setSelectedRegraId(regraId);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["faltas-ausencia-inconsistencias"] }),
        queryClient.refetchQueries({ queryKey: ["faltas-alerta-enquadramentos", regraId] }),
      ]);
      toast({
        title: novoStatus === "ignorada" ? "Inconsistência ignorada" : "Inconsistência resolvida",
        description: "O registro permanece no log da regra com status e justificativa atualizados.",
      });
      setResolverItem(null);
      setNotas("");
    }, "Salvando resolução…");
  }, [resolverItem, canEdit, novoStatus, notas, queryClient, toast, runWithSaving]);

  const focarRegra = useCallback((regraId: string) => {
    setSelectedRegraId(regraId);
  }, []);

  if (loadingRegras || loadingIncons) {
    return <p className="text-sm text-muted-foreground">Carregando regras de alerta…</p>;
  }

  return (
    <div className="space-y-4">
      {!canEdit ? (
        <p className="text-xs text-muted-foreground border border-border bg-muted/30 px-3 py-2 rounded-md">
          Modo somente leitura: você pode visualizar regras, logs e inconsistências, mas não ativar/desativar regras nem
          resolver pendências.
        </p>
      ) : null}
      <div className="space-y-3 border border-border bg-card p-4 shadow-level-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="label-industrial">Inconsistências identificadas</span>
            <p className="text-xs text-muted-foreground mt-1">
              Fila para análise e resolução pelo RH.
              {pendentesTotal > 0 ? ` ${pendentesTotal} pendente(s).` : " Nenhuma pendente."}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={inconsSearch}
              onChange={(e) => setInconsSearch(e.target.value)}
              placeholder="Buscar colaborador, matrícula ou regra…"
              className="pl-9"
            />
          </div>
          <Select
            value={inconsStatusFiltro}
            onValueChange={(v) => setInconsStatusFiltro(v as typeof inconsStatusFiltro)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="abertas">Abertas (pendente / análise)</SelectItem>
              <SelectItem value="todas">Todos os status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="em_analise">Em análise</SelectItem>
              <SelectItem value="resolvida">Resolvida</SelectItem>
              <SelectItem value="ignorada">Ignorada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ScrollArea className="h-[min(28vh,240px)] pr-2">
          {inconsistenciasFiltradas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma inconsistência com os filtros atuais.
            </p>
          ) : (
            <ul className="space-y-2">
              {inconsistenciasFiltradas.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "rounded-lg border border-border p-3 space-y-2",
                    highlightInconsistenciaId === item.id && "ring-2 ring-primary/50 bg-primary/5",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <button
                      type="button"
                      className="text-left min-w-0 flex-1"
                      onClick={() => focarRegra(item.regraId)}
                    >
                      <p className="font-medium text-sm text-foreground">{item.titulo}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.nomeFuncionario} · Mat. {item.matricula} · {item.dataAusencia}
                      </p>
                    </button>
                    <Badge variant="outline" className={cn("text-[10px] shrink-0", STATUS_CLASS[item.status])}>
                      {STATUS_LABEL[item.status]}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground/90">{item.descricao}</p>
                  {canEdit && (item.status === "pendente" || item.status === "em_analise") ? (
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {item.status === "pendente" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void updateFaltaAusenciaInconsistenciaStatus(item.id, "em_analise").then(invalidateAll)
                          }
                        >
                          Marcar em análise
                        </Button>
                      ) : null}
                      <Button type="button" size="sm" variant="default" onClick={() => abrirResolver(item, "resolvida")}>
                        Resolver
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => abrirResolver(item, "ignorada")}>
                        Ignorar
                      </Button>
                    </div>
                  ) : null}
                  <ResolucaoDetalhes
                    status={item.status}
                    resolvidaEm={item.resolvidaEm}
                    resolvidoPor={item.resolvidoPor}
                    resolucaoNotas={item.resolucaoNotas}
                  />
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-3 border border-border bg-card p-4 shadow-level-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="label-industrial">Regras de alertas</span>
            <span className="text-xs text-muted-foreground">{regrasFiltradas.length} regra(s)</span>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar regra…"
              className="pl-9"
            />
          </div>
          <ScrollArea className="h-[min(55vh,520px)] pr-2">
            <ul className="space-y-2">
              {regrasFiltradas.map((regra) => {
                const selected = selectedRegraId === regra.id;
                const total30 = enquadramentos30dPorRegra.get(regra.id) ?? 0;
                const pendentesRegra = pendentesPorRegra.get(regra.id) ?? 0;
                return (
                  <li
                    key={regra.id}
                    className={cn(
                      "rounded-lg border border-border p-3 transition-colors",
                      selected ? "border-primary/40 bg-primary/5" : "hover:bg-muted/30",
                      pendentesRegra > 0 && !selected && "border-amber-500/30",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={() => setSelectedRegraId(selected ? null : regra.id)}
                        aria-label={selected ? "Recolher log" : "Ver log de enquadramento"}
                      >
                        {selected ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <div className="min-w-0 flex-1 space-y-2">
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => setSelectedRegraId(selected ? null : regra.id)}
                        >
                          <p className="font-medium text-sm leading-snug text-foreground">{regra.titulo}</p>
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{regra.descricao}</p>
                        </button>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={cn("text-[10px]", BASE_LEGAL_CLASS[regra.baseLegal])}>
                            {BASE_LEGAL_LABEL[regra.baseLegal]}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">{regra.limiteResumo}</span>
                          {pendentesRegra > 0 ? (
                            <Badge variant="secondary" className="text-[10px] bg-amber-500/15 text-amber-900 dark:text-amber-100">
                              {pendentesRegra} pendente(s)
                            </Badge>
                          ) : null}
                          {total30 > 0 ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {total30} acionamento(s) / 30d
                            </Badge>
                          ) : null}
                        </div>
                        {regra.referenciaLegal ? (
                          <p className="text-[11px] text-muted-foreground">{regra.referenciaLegal}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Switch
                          checked={regra.ativa}
                          disabled={!canEdit}
                          onCheckedChange={(v) => void toggleRegra(regra, v)}
                          aria-label={`${regra.ativa ? "Desativar" : "Ativar"} ${regra.titulo}`}
                        />
                        <span className="text-[10px] text-muted-foreground">{regra.ativa ? "Ativa" : "Inativa"}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </div>

        <div className="space-y-3 border border-border bg-card p-4 shadow-level-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="label-industrial">Log de enquadramento</span>
              {selectedRegra && enquadramentos.length > 0 ? (
                <p className="text-xs text-muted-foreground mt-1">
                  {enquadramentos.length} registro(s) — pendentes, em análise, resolvidas e ignoradas.
                </p>
              ) : null}
            </div>
            {selectedRegra ? (
              <span className="text-xs text-muted-foreground truncate max-w-[16rem]">{selectedRegra.titulo}</span>
            ) : (
              <span className="text-xs text-muted-foreground">Selecione uma regra à esquerda</span>
            )}
          </div>

          {!selectedRegra ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Clique em uma regra para ver quando, por quem e por qual motivo ela foi acionada.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    placeholder="Filtrar log (colaborador, matrícula, operador)…"
                    className="pl-9"
                  />
                </div>
                <Select
                  value={logStatusFiltro}
                  onValueChange={(v) => setLogStatusFiltro(v as typeof logStatusFiltro)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todos os status</SelectItem>
                    <SelectItem value="pendente">Pendente ({logResumo.pendente})</SelectItem>
                    <SelectItem value="em_analise">Em análise ({logResumo.em_analise})</SelectItem>
                    <SelectItem value="resolvida">Resolvida ({logResumo.resolvida})</SelectItem>
                    <SelectItem value="ignorada">Ignorada ({logResumo.ignorada})</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <ScrollArea className="h-[min(55vh,520px)] pr-2">
                {logFiltrado.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Nenhum enquadramento registrado para esta regra ainda.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {logFiltrado.map((item) => (
                      <EnquadramentoLogItem key={item.id} item={item} />
                    ))}
                  </ul>
                )}
              </ScrollArea>
            </>
          )}
        </div>
      </div>

      <Dialog open={resolverItem != null} onOpenChange={(o) => !o && setResolverItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{novoStatus === "ignorada" ? "Ignorar inconsistência" : "Resolver inconsistência"}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Justificativa da resolução (opcional)…"
            rows={4}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResolverItem(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void confirmarResolucao()}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EnquadramentoLogItem({ item }: { item: FaltaAlertaEnquadramentoRow }) {
  const status = item.statusResolucao ?? "pendente";
  return (
    <li className="rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-sm space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-foreground">{item.nomeFuncionario}</span>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn("text-[10px]", STATUS_CLASS[status])}>
            {STATUS_LABEL[status]}
          </Badge>
          <span className="text-xs text-muted-foreground">{formatDetectada(item.detectadaEm)}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Matrícula {item.matricula} · Ausência em {item.dataAusencia} · {item.tipo}
        {item.cid ? ` · CID ${item.cid}` : ""}
      </p>
      <p className="text-sm text-foreground/90 leading-relaxed">{item.motivo}</p>
      <p className="text-[11px] text-muted-foreground">Lançado por: {item.lancadoPor}</p>
      <ResolucaoDetalhes
        status={status}
        resolvidaEm={item.resolvidaEm}
        resolvidoPor={item.resolvidoPor}
        resolucaoNotas={item.resolucaoNotas}
      />
    </li>
  );
}
