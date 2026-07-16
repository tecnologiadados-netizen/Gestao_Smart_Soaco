import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import AppLayout from "@rh/components/AppLayout";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { AlertTriangle, Maximize2, Minus, Plus, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@rh/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@rh/components/ui/dialog";
import { getCargos, getOrganico, setCargoFaixa } from "@rh/lib/api-client";
import { getCurrentUser } from "@rh/lib/auth";
import { canEditRoute } from "@rh/lib/route-permissions";
import { ORGANICO_IDX, parseCtpsToNumber } from "@rh/pages/Organico/organico-derive";

type FaixaDraft = {
  faixaMin: string;
  faixaMax: string;
};

type SortDirection = "asc" | "desc";
type SortColumn = "cargo" | "count" | "faixaMin" | "faixaMax" | "media" | "status";
type SortRule = { column: SortColumn; direction: SortDirection };
type SaveState = "idle" | "saving" | "saved" | "error";

const SIMULACAO_FAIXAS_STORAGE_KEY = "people-s-rh:cargos-simulacao-faixas";

type SetorColaborador = {
  matricula: string;
  nome: string;
  cargo: string;
  area: string;
  salario: number;
};

type ColaboradorPorCargoLinha = {
  matricula: string;
  nome: string;
  setor: string;
  salarioMaisPorFora: number;
};

function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

const Cargos = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canEdit = canEditRoute("/cargos");
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const { data: cargosMeta, isLoading: isLoadingCargos, isError: isErrorCargos } = useQuery({
    queryKey: ["cargos"],
    queryFn: () => getCargos(),
  });
  const { data: organicoRows, isLoading: isLoadingOrganico, isError: isErrorOrganico } = useQuery({
    queryKey: ["organico-cargos-context"],
    queryFn: getOrganico,
  });
  const [drafts, setDrafts] = useState<Record<string, FaixaDraft>>({});
  const [sortRules, setSortRules] = useState<SortRule[]>([]);
  const [saveStateByCargo, setSaveStateByCargo] = useState<Record<string, SaveState>>({});
  const hideSavedTimersRef = useRef<Record<string, number>>({});
  const [inconsistenciaFiltroCargo, setInconsistenciaFiltroCargo] = useState<string | null>(null);
  const inconsistenciasRef = useRef<HTMLDivElement | null>(null);
  const [selectedSetor, setSelectedSetor] = useState<string | null>(null);
  const [simDrafts, setSimDrafts] = useState<Record<string, FaixaDraft>>({});
  const [simSortRules, setSimSortRules] = useState<SortRule[]>([]);
  const [simInconsistenciaFiltroCargo, setSimInconsistenciaFiltroCargo] = useState<string | null>(null);
  const [simSelectedSetor, setSimSelectedSetor] = useState<string | null>(null);
  const [setorChartFullscreen, setSetorChartFullscreen] = useState<"cadastro" | "simulacao" | null>(null);
  const simInconsistenciasRef = useRef<HTMLDivElement | null>(null);
  /** Linhas de cargo cuja lista de colaboradores está expandida (aba Cadastro ou Simulação). */
  const [expandedCargoRows, setExpandedCargoRows] = useState<Record<string, boolean>>({});

  const faixasByCargo = useMemo(() => {
    const map = new Map<string, (typeof cargosMeta.cargos)[number]>();
    for (const c of cargosMeta?.cargos ?? []) map.set(c.cargo, c);
    return map;
  }, [cargosMeta?.cargos]);

  const hasText = (v: unknown): boolean => String(v ?? "").trim() !== "";
  const isApiOnlyRow = (values: unknown[]): boolean => {
    const origem = String(values[85] ?? "").trim().toUpperCase();
    if (origem === "API_SECULLUM") return true;
    const hasPlanilhaSignals = hasText(values[11]) || hasText(values[15]) || hasText(values[16]) || hasText(values[85]);
    return !hasPlanilhaSignals;
  };

  const allRows = useMemo(() => {
    const rows = Array.isArray(organicoRows) ? organicoRows : [];
    return rows
      .map((r) => (Array.isArray(r.values) ? r.values : []))
      .filter((values) => values.length > 0 && !isApiOnlyRow(values));
  }, [organicoRows]);

  const areas = useMemo(() => {
    const set = new Set<string>();
    for (const values of allRows) {
      const area = String(values[13] ?? "").trim() || "—";
      set.add(area);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [allRows]);

  const rowsByArea = useMemo(() => {
    if (!selectedAreas.length) return allRows;
    const selected = new Set(selectedAreas);
    return allRows.filter((values) => selected.has(String(values[13] ?? "").trim() || "—"));
  }, [allRows, selectedAreas]);

  const cargos = useMemo(() => {
    const byCargo = new Map<string, { count: number; sum: number }>();
    for (const values of rowsByArea) {
      const cargo = String(values[12] ?? "").trim() || "—";
      const salario = parseCtpsToNumber(values[ORGANICO_IDX.SALARIO_MAIS_POR_FORA]);
      const agg = byCargo.get(cargo) ?? { count: 0, sum: 0 };
      agg.count += 1;
      agg.sum += salario;
      byCargo.set(cargo, agg);
    }
    return Array.from(byCargo.entries())
      .map(([cargo, agg]) => {
        const faixa = faixasByCargo.get(cargo);
        return {
          cargo,
          faixaMin: faixa?.faixaMin ?? null,
          faixaMax: faixa?.faixaMax ?? null,
          media: agg.count > 0 ? Number((agg.sum / agg.count).toFixed(2)) : 0,
          count: agg.count,
          faixaUpdatedBy: faixa?.faixaUpdatedBy ?? null,
          faixaUpdatedAt: faixa?.faixaUpdatedAt ?? null,
        };
      })
      .sort((a, b) => a.cargo.localeCompare(b.cargo, "pt-BR"));
  }, [rowsByArea, faixasByCargo]);

  /** Cargos em todo o orgânico (sem filtro de área) — chaves estáveis para simulação em cache. */
  const cargosGlobal = useMemo(() => {
    const byCargo = new Map<string, { count: number; sum: number }>();
    for (const values of allRows) {
      const cargo = String(values[12] ?? "").trim() || "—";
      const salario = parseCtpsToNumber(values[ORGANICO_IDX.SALARIO_POR_FORA_ADICIONAIS]);
      const agg = byCargo.get(cargo) ?? { count: 0, sum: 0 };
      agg.count += 1;
      agg.sum += salario;
      byCargo.set(cargo, agg);
    }
    return Array.from(byCargo.entries())
      .map(([cargo, agg]) => {
        const faixa = faixasByCargo.get(cargo);
        return {
          cargo,
          faixaMin: faixa?.faixaMin ?? null,
          faixaMax: faixa?.faixaMax ?? null,
          media: agg.count > 0 ? Number((agg.sum / agg.count).toFixed(2)) : 0,
          count: agg.count,
          faixaUpdatedBy: faixa?.faixaUpdatedBy ?? null,
          faixaUpdatedAt: faixa?.faixaUpdatedAt ?? null,
        };
      })
      .sort((a, b) => a.cargo.localeCompare(b.cargo, "pt-BR"));
  }, [allRows, faixasByCargo]);

  const salaryBySetor = useMemo(() => {
    const bySetor = new Map<string, { count: number; sum: number }>();
    for (const values of rowsByArea) {
      const setor = String(values[ORGANICO_IDX.SETOR] ?? "").trim() || "—";
      const salario = parseCtpsToNumber(values[ORGANICO_IDX.SALARIO_POR_FORA_ADICIONAIS]);
      const agg = bySetor.get(setor) ?? { count: 0, sum: 0 };
      agg.count += 1;
      agg.sum += salario;
      bySetor.set(setor, agg);
    }
    return Array.from(bySetor.entries())
      .map(([setor, agg]) => ({
        setor,
        media: agg.count > 0 ? Number((agg.sum / agg.count).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.media - a.media);
  }, [rowsByArea]);

  const colaboradoresBySetor = useMemo(() => {
    const map = new Map<string, SetorColaborador[]>();
    for (const values of rowsByArea) {
      const setor = String(values[ORGANICO_IDX.SETOR] ?? "").trim() || "—";
      const list = map.get(setor) ?? [];
      list.push({
        matricula: String(values[0] ?? "").trim() || "—",
        nome: String(values[1] ?? "").trim() || "—",
        cargo: String(values[12] ?? "").trim() || "—",
        area: String(values[13] ?? "").trim() || "—",
        salario: parseCtpsToNumber(values[ORGANICO_IDX.SALARIO_POR_FORA_ADICIONAIS]),
      });
      map.set(setor, list);
    }
    for (const [setor, list] of map.entries()) {
      map.set(
        setor,
        list.sort((a, b) => b.salario - a.salario || a.nome.localeCompare(b.nome, "pt-BR"))
      );
    }
    return map;
  }, [rowsByArea]);

  const colaboradoresByCargo = useMemo(() => {
    const map = new Map<string, ColaboradorPorCargoLinha[]>();
    for (const values of rowsByArea) {
      const cargo = String(values[ORGANICO_IDX.CARGO] ?? "").trim() || "—";
      const list = map.get(cargo) ?? [];
      list.push({
        matricula: String(values[ORGANICO_IDX.MATRICULA] ?? "").trim() || "—",
        nome: String(values[ORGANICO_IDX.NOME] ?? "").trim() || "—",
        setor: String(values[ORGANICO_IDX.SETOR] ?? "").trim() || "—",
        salarioMaisPorFora: parseCtpsToNumber(values[ORGANICO_IDX.SALARIO_MAIS_POR_FORA]),
      });
      map.set(cargo, list);
    }
    for (const [cargo, list] of map.entries()) {
      map.set(cargo, list.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
    }
    return map;
  }, [rowsByArea]);

  function parseNumberOrNull(value: string): number | null {
    const normalized = value.replace(",", ".").trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const inconsistencias = useMemo(() => {
    const list: Array<{
      matricula: string;
      nome: string;
      cargo: string;
      setor: string;
      area?: string;
      salario: number;
      faixaMin: number;
      faixaMax: number;
      problema: string;
      severity: "red" | "yellow";
    }> = [];
    for (const values of rowsByArea) {
      const cargo = String(values[12] ?? "").trim() || "—";
      const setor = String(values[ORGANICO_IDX.SETOR] ?? "").trim() || "—";
      const area = String(values[13] ?? "").trim() || "—";
      const matricula = String(values[0] ?? "").trim() || "—";
      const nome = String(values[1] ?? "").trim() || "—";
      const salario = parseCtpsToNumber(values[ORGANICO_IDX.SALARIO_POR_FORA_ADICIONAIS]);
      const faixa = faixasByCargo.get(cargo);
      if (faixa?.faixaMin == null || faixa?.faixaMax == null) continue;
      if (salario < faixa.faixaMin) {
        const diff = faixa.faixaMin > 0 ? ((faixa.faixaMin - salario) / faixa.faixaMin) * 100 : 0;
        list.push({ matricula, nome, cargo, setor, area, salario, faixaMin: faixa.faixaMin, faixaMax: faixa.faixaMax, problema: `Salário ${diff.toFixed(2).replace(".", ",")}% abaixo da faixa mínima`, severity: "red" });
      } else if (salario > faixa.faixaMax) {
        const diff = faixa.faixaMax > 0 ? ((salario - faixa.faixaMax) / faixa.faixaMax) * 100 : 0;
        list.push({ matricula, nome, cargo, setor, area, salario, faixaMin: faixa.faixaMin, faixaMax: faixa.faixaMax, problema: `Salário ${diff.toFixed(2).replace(".", ",")}% acima da faixa máxima`, severity: "red" });
      }
    }
    return list.slice(0, 50);
  }, [rowsByArea, faixasByCargo]);

  /** Inconsistências usando apenas faixas da simulação (cache). */
  const inconsistenciasSim = useMemo(() => {
    const list: Array<{
      matricula: string;
      nome: string;
      cargo: string;
      setor: string;
      area?: string;
      salario: number;
      faixaMin: number;
      faixaMax: number;
      problema: string;
      severity: "red" | "yellow";
    }> = [];
    for (const values of rowsByArea) {
      const cargo = String(values[12] ?? "").trim() || "—";
      const setor = String(values[ORGANICO_IDX.SETOR] ?? "").trim() || "—";
      const area = String(values[13] ?? "").trim() || "—";
      const matricula = String(values[0] ?? "").trim() || "—";
      const nome = String(values[1] ?? "").trim() || "—";
      const salario = parseCtpsToNumber(values[ORGANICO_IDX.SALARIO_POR_FORA_ADICIONAIS]);
      const draft = simDrafts[cargo] ?? { faixaMin: "", faixaMax: "" };
      const faixaMinParsed = parseNumberOrNull(draft.faixaMin);
      const faixaMaxParsed = parseNumberOrNull(draft.faixaMax);
      if (faixaMinParsed == null || faixaMaxParsed == null) continue;
      if (salario < faixaMinParsed) {
        const diff = faixaMinParsed > 0 ? ((faixaMinParsed - salario) / faixaMinParsed) * 100 : 0;
        list.push({
          matricula,
          nome,
          cargo,
          setor,
          area,
          salario,
          faixaMin: faixaMinParsed,
          faixaMax: faixaMaxParsed,
          problema: `Salário ${diff.toFixed(2).replace(".", ",")}% abaixo da faixa mínima`,
          severity: "red",
        });
      } else if (salario > faixaMaxParsed) {
        const diff = faixaMaxParsed > 0 ? ((salario - faixaMaxParsed) / faixaMaxParsed) * 100 : 0;
        list.push({
          matricula,
          nome,
          cargo,
          setor,
          area,
          salario,
          faixaMin: faixaMinParsed,
          faixaMax: faixaMaxParsed,
          problema: `Salário ${diff.toFixed(2).replace(".", ",")}% acima da faixa máxima`,
          severity: "red",
        });
      }
    }
    return list.slice(0, 50);
  }, [rowsByArea, simDrafts]);

  useEffect(() => {
    if (!cargosGlobal.length) return;
    setSimDrafts((prev) => {
      const baselineRecord = (): Record<string, FaixaDraft> => {
        const next: Record<string, FaixaDraft> = {};
        for (const c of cargosGlobal) {
          next[c.cargo] = {
            faixaMin: c.faixaMin != null ? String(c.faixaMin) : "",
            faixaMax: c.faixaMax != null ? String(c.faixaMax) : "",
          };
        }
        return next;
      };

      const baseRecord = baselineRecord();

      if (Object.keys(prev).length === 0) {
        try {
          const raw = localStorage.getItem(SIMULACAO_FAIXAS_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as Record<string, FaixaDraft>;
            const merged = { ...baseRecord };
            for (const c of cargosGlobal) {
              const s = parsed[c.cargo];
              if (s && typeof s.faixaMin === "string" && typeof s.faixaMax === "string") {
                merged[c.cargo] = { faixaMin: s.faixaMin, faixaMax: s.faixaMax };
              }
            }
            return merged;
          }
        } catch {
          /* cache inválido: ignora */
        }
        return baseRecord;
      }

      const next = { ...prev };
      let changed = false;
      for (const c of cargosGlobal) {
        if (!(c.cargo in next)) {
          next[c.cargo] = baseRecord[c.cargo];
          changed = true;
        }
      }
      for (const key of Object.keys(next)) {
        if (!(key in baseRecord)) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [cargosGlobal]);

  useEffect(() => {
    if (Object.keys(simDrafts).length === 0) return;
    try {
      localStorage.setItem(SIMULACAO_FAIXAS_STORAGE_KEY, JSON.stringify(simDrafts));
    } catch {
      /* quota / privado */
    }
  }, [simDrafts]);

  useEffect(() => {
    const next: Record<string, FaixaDraft> = {};
    for (const c of cargos) {
      next[c.cargo] = {
        faixaMin: c.faixaMin != null ? String(c.faixaMin) : "",
        faixaMax: c.faixaMax != null ? String(c.faixaMax) : "",
      };
    }
    setDrafts(next);
  }, [cargos]);

  useEffect(() => {
    setInconsistenciaFiltroCargo(null);
  }, [selectedAreas]);

  useEffect(() => {
    return () => {
      for (const k of Object.keys(hideSavedTimersRef.current)) {
        window.clearTimeout(hideSavedTimersRef.current[k]);
      }
    };
  }, []);

  const saveFaixaMutation = useMutation({
    mutationFn: setCargoFaixa,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cargos"] });
    },
  });

  function formatAuditDate(value: string | null | undefined): string {
    if (!value) return "—";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return value;
    return dt.toLocaleString("pt-BR");
  }

  function getStatusLabelForDrafts(cargoRow: (typeof cargos)[number], draftRecord: Record<string, FaixaDraft>): "N/A" | "OK" | "ATENÇÃO" {
    const draft = draftRecord[cargoRow.cargo] ?? { faixaMin: "", faixaMax: "" };
    const faixaMin = parseNumberOrNull(draft.faixaMin);
    const faixaMax = parseNumberOrNull(draft.faixaMax);
    const hasRange = faixaMin != null && faixaMax != null;
    if (!hasRange) return "N/A";
    return cargoRow.media >= faixaMin && cargoRow.media <= faixaMax ? "OK" : "ATENÇÃO";
  }

  function compareByRuleWithDrafts(
    a: (typeof cargos)[number],
    b: (typeof cargos)[number],
    rule: SortRule,
    draftRecord: Record<string, FaixaDraft>
  ): number {
    const getNumber = (n: number | null): number => (n == null ? Number.NEGATIVE_INFINITY : n);
    switch (rule.column) {
      case "cargo":
        return a.cargo.localeCompare(b.cargo, "pt-BR");
      case "count":
        return a.count - b.count;
      case "faixaMin": {
        const aVal = parseNumberOrNull(draftRecord[a.cargo]?.faixaMin ?? "");
        const bVal = parseNumberOrNull(draftRecord[b.cargo]?.faixaMin ?? "");
        return getNumber(aVal) - getNumber(bVal);
      }
      case "faixaMax": {
        const aVal = parseNumberOrNull(draftRecord[a.cargo]?.faixaMax ?? "");
        const bVal = parseNumberOrNull(draftRecord[b.cargo]?.faixaMax ?? "");
        return getNumber(aVal) - getNumber(bVal);
      }
      case "media":
        return a.media - b.media;
      case "status": {
        const rank = (status: "N/A" | "OK" | "ATENÇÃO") => {
          if (status === "N/A") return 0;
          if (status === "OK") return 1;
          return 2;
        };
        return rank(getStatusLabelForDrafts(a, draftRecord)) - rank(getStatusLabelForDrafts(b, draftRecord));
      }
      default:
        return 0;
    }
  }

  const sortedCargos = useMemo(() => {
    if (!sortRules.length) return cargos;
    const list = [...cargos];
    list.sort((a, b) => {
      for (const rule of sortRules) {
        const cmp = compareByRuleWithDrafts(a, b, rule, drafts);
        if (cmp !== 0) return rule.direction === "asc" ? cmp : -cmp;
      }
      return 0;
    });
    return list;
  }, [cargos, drafts, sortRules]);

  const sortedCargosSim = useMemo(() => {
    if (!simSortRules.length) return cargos;
    const list = [...cargos];
    list.sort((a, b) => {
      for (const rule of simSortRules) {
        const cmp = compareByRuleWithDrafts(a, b, rule, simDrafts);
        if (cmp !== 0) return rule.direction === "asc" ? cmp : -cmp;
      }
      return 0;
    });
    return list;
  }, [cargos, simDrafts, simSortRules]);

  useEffect(() => {
    if (!selectedSetor) return;
    if (!salaryBySetor.some((s) => s.setor === selectedSetor)) {
      setSelectedSetor(null);
    }
  }, [salaryBySetor, selectedSetor]);

  useEffect(() => {
    if (!simSelectedSetor) return;
    if (!salaryBySetor.some((s) => s.setor === simSelectedSetor)) {
      setSimSelectedSetor(null);
    }
  }, [salaryBySetor, simSelectedSetor]);

  const selectedSetorFullscreen = setorChartFullscreen === "simulacao" ? simSelectedSetor : selectedSetor;
  const selectedSetorFullscreenDistribuicao = selectedSetorFullscreen
    ? colaboradoresBySetor.get(selectedSetorFullscreen) ?? []
    : [];

  const renderDistribuicaoOverlay = (
    setor: string | null,
    distribuicao: SetorColaborador[],
    onClose: () => void,
    widthClass = "w-[min(760px,92vw)]",
  ) => {
    if (!setor) return null;
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/35 backdrop-blur-[1px]">
        <div className={`${widthClass} border border-border bg-popover p-3 shadow-xl`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-foreground uppercase tracking-wide">
              {setor} — distribuição salarial
            </p>
            <button
              type="button"
              className="text-[10px] font-bold px-2 py-1 border border-border hover:bg-muted transition-colors"
              onClick={onClose}
            >
              Fechar tooltip
            </button>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={distribuicao.slice(0, 24).map((col) => ({
                  colaborador: col.nome.length > 24 ? `${col.nome.slice(0, 24)}...` : col.nome,
                  salario: col.salario,
                }))}
                layout="vertical"
                margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(20,2%,90%)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#808080" }} />
                <YAxis dataKey="colaborador" type="category" width={170} tick={{ fontSize: 10, fill: "#374151" }} interval={0} />
                <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR")}`} />
                <Bar dataKey="salario" fill="#12305A" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">Tooltip de distribuição: até 24 maiores salários do setor.</p>
        </div>
      </div>
    );
  };

  const inconsistenciasFiltradas = useMemo(() => {
    if (!inconsistenciaFiltroCargo) return inconsistencias;
    return inconsistencias.filter((item) => item.cargo === inconsistenciaFiltroCargo);
  }, [inconsistencias, inconsistenciaFiltroCargo]);

  const inconsistenciasFiltradasSim = useMemo(() => {
    if (!simInconsistenciaFiltroCargo) return inconsistenciasSim;
    return inconsistenciasSim.filter((item) => item.cargo === simInconsistenciaFiltroCargo);
  }, [inconsistenciasSim, simInconsistenciaFiltroCargo]);

  useEffect(() => {
    setSimInconsistenciaFiltroCargo(null);
  }, [selectedAreas]);

  function handleSortClick(column: SortColumn, isMulti: boolean): void {
    setSortRules((prev) => {
      const idx = prev.findIndex((r) => r.column === column);
      const nextDirection = idx >= 0 ? (prev[idx].direction === "asc" ? "desc" : "asc") : "asc";

      if (!isMulti) {
        return [{ column, direction: nextDirection }];
      }

      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { column, direction: nextDirection };
        return next;
      }
      return [...prev, { column, direction: "asc" }];
    });
  }

  function sortColumnMeta(column: SortColumn, rules: SortRule[]): { direction: SortDirection | null; priority: number | null } {
    const idx = rules.findIndex((r) => r.column === column);
    if (idx < 0) return { direction: null, priority: null };
    return { direction: rules[idx].direction, priority: idx + 1 };
  }

  function dbSortColumnMeta(column: SortColumn) {
    return sortColumnMeta(column, sortRules);
  }

  function simSortColumnMeta(column: SortColumn) {
    return sortColumnMeta(column, simSortRules);
  }

  function handleSimSortClick(column: SortColumn, isMulti: boolean): void {
    setSimSortRules((prev) => {
      const idx = prev.findIndex((r) => r.column === column);
      const nextDirection = idx >= 0 ? (prev[idx].direction === "asc" ? "desc" : "asc") : "asc";

      if (!isMulti) {
        return [{ column, direction: nextDirection }];
      }

      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { column, direction: nextDirection };
        return next;
      }
      return [...prev, { column, direction: "asc" }];
    });
  }

  function handleLimparSimulacao(): void {
    try {
      localStorage.removeItem(SIMULACAO_FAIXAS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    const next: Record<string, FaixaDraft> = {};
    for (const c of cargosGlobal) {
      next[c.cargo] = {
        faixaMin: c.faixaMin != null ? String(c.faixaMin) : "",
        faixaMax: c.faixaMax != null ? String(c.faixaMax) : "",
      };
    }
    setSimDrafts(next);
    setSimSortRules([]);
    setSimInconsistenciaFiltroCargo(null);
    setSimSelectedSetor(null);
  }

  async function handleSaveFaixa(cargo: string): Promise<void> {
    if (!canEdit) return;
    const draft = drafts[cargo];
    if (!draft) return;
    const row = cargos.find((c) => c.cargo === cargo);
    const nextFaixaMin = parseNumberOrNull(draft.faixaMin);
    const nextFaixaMax = parseNumberOrNull(draft.faixaMax);
    if (row && row.faixaMin === nextFaixaMin && row.faixaMax === nextFaixaMax) return;
    setSaveStateByCargo((prev) => ({ ...prev, [cargo]: "saving" }));
    try {
      await saveFaixaMutation.mutateAsync({
        cargo,
        faixaMin: nextFaixaMin,
        faixaMax: nextFaixaMax,
        updatedBy: getCurrentUser() ?? "desconhecido",
      });
      setSaveStateByCargo((prev) => ({ ...prev, [cargo]: "saved" }));
      if (hideSavedTimersRef.current[cargo] != null) {
        window.clearTimeout(hideSavedTimersRef.current[cargo]);
      }
      hideSavedTimersRef.current[cargo] = window.setTimeout(() => {
        setSaveStateByCargo((prev) => ({ ...prev, [cargo]: "idle" }));
        delete hideSavedTimersRef.current[cargo];
      }, 1400);
    } catch {
      setSaveStateByCargo((prev) => ({ ...prev, [cargo]: "error" }));
    }
  }

  if (isLoadingCargos || isLoadingOrganico) {
    return (
      <AppLayout>
        <div className="py-8 px-10 flex items-center justify-center min-h-[40vh]">
          <p className="text-muted-foreground">Carregando cargos...</p>
        </div>
      </AppLayout>
    );
  }
  if (isErrorCargos || isErrorOrganico) {
    return (
      <AppLayout>
        <div className="py-8 px-10 flex items-center justify-center min-h-[40vh]">
          <p className="text-destructive">Erro ao carregar cargos.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="py-8 px-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Cargos & Salários</h1>
        </div>

        <div className="border border-border bg-card shadow-level-1 mb-4 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className="label-industrial">Filtrar por Área</span>
            {selectedAreas.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedAreas([])}
                className="text-[10px] font-bold px-2 py-1 border border-border hover:bg-muted transition-colors"
              >
                Limpar filtro
              </button>
            )}
          </div>
          {areas.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma área disponível no contexto atual.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {areas.map((area) => {
                const checked = selectedAreas.includes(area);
                return (
                  <label key={area} className="rh-filter-chip">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setSelectedAreas((prev) =>
                          isChecked ? [...prev, area] : prev.filter((x) => x !== area)
                        );
                      }}
                    />
                    <span className="font-medium">{area}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <Tabs defaultValue="cadastro" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="cadastro">Cadastro (banco)</TabsTrigger>
            <TabsTrigger value="simulacao">Simulações</TabsTrigger>
          </TabsList>

          <TabsContent value="cadastro" className="mt-4 space-y-8 focus-visible:outline-none">
            {/* Salary table */}
            <div className="border border-border bg-card shadow-level-1 mb-8 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-border bg-secondary/60">
                <th
                  className="text-left p-4 label-industrial cursor-pointer select-none"
                  onClick={(e) => handleSortClick("cargo", e.ctrlKey)}
                >
                  Cargo {dbSortColumnMeta("cargo").direction ? (dbSortColumnMeta("cargo").direction === "asc" ? "↑" : "↓") : ""}
                  {dbSortColumnMeta("cargo").priority ? ` (${dbSortColumnMeta("cargo").priority})` : ""}
                </th>
                <th
                  className="text-right p-4 label-industrial cursor-pointer select-none"
                  onClick={(e) => handleSortClick("count", e.ctrlKey)}
                >
                  Qtd. {dbSortColumnMeta("count").direction ? (dbSortColumnMeta("count").direction === "asc" ? "↑" : "↓") : ""}
                  {dbSortColumnMeta("count").priority ? ` (${dbSortColumnMeta("count").priority})` : ""}
                </th>
                <th
                  className="text-right p-4 label-industrial cursor-pointer select-none"
                  onClick={(e) => handleSortClick("faixaMin", e.ctrlKey)}
                >
                  Faixa Mín. {dbSortColumnMeta("faixaMin").direction ? (dbSortColumnMeta("faixaMin").direction === "asc" ? "↑" : "↓") : ""}
                  {dbSortColumnMeta("faixaMin").priority ? ` (${dbSortColumnMeta("faixaMin").priority})` : ""}
                </th>
                <th
                  className="text-right p-4 label-industrial cursor-pointer select-none"
                  onClick={(e) => handleSortClick("faixaMax", e.ctrlKey)}
                >
                  Faixa Máx. {dbSortColumnMeta("faixaMax").direction ? (dbSortColumnMeta("faixaMax").direction === "asc" ? "↑" : "↓") : ""}
                  {dbSortColumnMeta("faixaMax").priority ? ` (${dbSortColumnMeta("faixaMax").priority})` : ""}
                </th>
                <th
                  className="text-right p-4 label-industrial cursor-pointer select-none"
                  onClick={(e) => handleSortClick("media", e.ctrlKey)}
                >
                  Média Atual {dbSortColumnMeta("media").direction ? (dbSortColumnMeta("media").direction === "asc" ? "↑" : "↓") : ""}
                  {dbSortColumnMeta("media").priority ? ` (${dbSortColumnMeta("media").priority})` : ""}
                </th>
                <th
                  className="text-center p-4 label-industrial cursor-pointer select-none"
                  onClick={(e) => handleSortClick("status", e.ctrlKey)}
                >
                  Status {dbSortColumnMeta("status").direction ? (dbSortColumnMeta("status").direction === "asc" ? "↑" : "↓") : ""}
                  {dbSortColumnMeta("status").priority ? ` (${dbSortColumnMeta("status").priority})` : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedCargos.map((c) => {
                const draft = drafts[c.cargo] ?? { faixaMin: "", faixaMax: "" };
                const faixaMin = parseNumberOrNull(draft.faixaMin);
                const faixaMax = parseNumberOrNull(draft.faixaMax);
                const hasRange = faixaMin != null && faixaMax != null;
                const withinRange = hasRange ? c.media >= faixaMin && c.media <= faixaMax : false;
                const hasInconsistenciasCargo = inconsistencias.some((item) => item.cargo === c.cargo);
                const canFilterInconsistencias = hasRange && !withinRange && hasInconsistenciasCargo;
                const isDirty = c.faixaMin !== faixaMin || c.faixaMax !== faixaMax;
                const saveState = saveStateByCargo[c.cargo] ?? "idle";
                const showSaveButton = isDirty || saveState === "saving" || saveState === "saved" || saveState === "error";
                const auditText =
                  c.faixaUpdatedBy || c.faixaUpdatedAt
                    ? `Definido por ${c.faixaUpdatedBy ?? "desconhecido"} em ${formatAuditDate(c.faixaUpdatedAt)}`
                    : "Sem registro de auditoria";
                const cargoListaExpanded = !!expandedCargoRows[c.cargo];
                const linhasColaboradores = colaboradoresByCargo.get(c.cargo) ?? [];
                return (
                  <Fragment key={c.cargo}>
                  <tr
                    className={`border-b border-border transition-colors ${
                      canFilterInconsistencias ? "cursor-pointer" : "cursor-default"
                    } ${inconsistenciaFiltroCargo === c.cargo ? "bg-primary/5" : "hover:bg-muted/30"} ${
                      canFilterInconsistencias ? "hover:bg-primary/5" : ""
                    }`}
                    onClick={() => {
                      if (!canFilterInconsistencias) return;
                      setInconsistenciaFiltroCargo(c.cargo);
                      window.setTimeout(() => {
                        inconsistenciasRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }, 50);
                    }}
                  >
                    <td className="p-4 text-sm font-medium text-foreground">
                      <div className="flex items-start gap-2 min-w-0">
                        <button
                          type="button"
                          aria-expanded={cargoListaExpanded}
                          aria-label={cargoListaExpanded ? "Recolher colaboradores do cargo" : "Ver colaboradores do cargo"}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedCargoRows((prev) => ({ ...prev, [c.cargo]: !prev[c.cargo] }));
                          }}
                          className="mt-0.5 shrink-0 inline-flex size-7 items-center justify-center rounded-md border border-input bg-card text-foreground shadow-level-1 hover:bg-muted"
                        >
                          {cargoListaExpanded ? <Minus className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
                        </button>
                        <span className="leading-snug break-words">{c.cargo}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-right tabular-nums text-muted-foreground">{c.count}</td>
                    <td className="p-3 text-sm text-right tabular-nums text-foreground">
                      <div title={auditText}>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="—"
                          value={draft.faixaMin}
                          disabled={!canEdit}
                          onChange={(e) => {
                            e.stopPropagation();
                            setDrafts((prev) => ({
                              ...prev,
                              [c.cargo]: { ...(prev[c.cargo] ?? { faixaMin: "", faixaMax: "" }), faixaMin: e.target.value },
                            }));
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="rh-inline-field w-32 ml-auto text-right px-2 py-1.5 text-xs tabular-nums"
                        />
                      </div>
                    </td>
                    <td className="p-3 text-sm text-right tabular-nums text-foreground">
                      <div title={auditText}>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="—"
                          value={draft.faixaMax}
                          disabled={!canEdit}
                          onChange={(e) => {
                            e.stopPropagation();
                            setDrafts((prev) => ({
                              ...prev,
                              [c.cargo]: { ...(prev[c.cargo] ?? { faixaMin: "", faixaMax: "" }), faixaMax: e.target.value },
                            }));
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="rh-inline-field w-32 ml-auto text-right px-2 py-1.5 text-xs tabular-nums"
                        />
                      </div>
                    </td>
                    <td className="p-4 text-sm text-right tabular-nums font-bold text-foreground">{formatCurrency(c.media)}</td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-1 ${
                            !hasRange
                              ? "bg-muted text-muted-foreground"
                              : withinRange
                                ? "bg-success text-success-foreground"
                                : "bg-accent text-accent-foreground"
                          }`}
                        >
                          {!hasRange ? "N/A" : withinRange ? "OK" : "ATENÇÃO"}
                        </span>
                        {canEdit && showSaveButton && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleSaveFaixa(c.cargo);
                            }}
                            disabled={saveState === "saving"}
                            className={`text-[10px] font-bold px-2 py-1 border transition-all duration-300 ${
                              saveState === "saving"
                                ? "border-primary bg-primary/10 text-primary animate-pulse"
                                : saveState === "saved"
                                  ? "border-success bg-success/10 text-success"
                                  : saveState === "error"
                                    ? "border-destructive bg-destructive/10 text-destructive"
                                    : "border-border hover:bg-muted"
                            }`}
                          >
                            {saveState === "saving"
                              ? "Salvando..."
                              : saveState === "saved"
                                ? "Salvo"
                                : saveState === "error"
                                  ? "Tentar de novo"
                                  : "Salvar"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {cargoListaExpanded && (
                    <tr className="border-b border-border bg-muted/15">
                      <td colSpan={6} className="p-0">
                        <div className="px-4 py-3 pl-14">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Colaboradores neste cargo</p>
                          {linhasColaboradores.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Nenhum colaborador listado neste cargo com o filtro atual.</p>
                          ) : (
                            <table className="w-full text-xs border border-border bg-card">
                              <thead>
                                <tr className="border-b border-border bg-muted/50">
                                  <th className="text-left p-2 font-semibold text-muted-foreground uppercase tracking-wide">Colaborador</th>
                                  <th className="text-left p-2 font-semibold text-muted-foreground uppercase tracking-wide">Setor</th>
                                  <th className="text-right p-2 font-semibold text-muted-foreground uppercase tracking-wide">Salário + Adendo</th>
                                </tr>
                              </thead>
                              <tbody>
                                {linhasColaboradores.map((row) => (
                                  <tr key={row.matricula + row.nome} className="border-b border-border last:border-b-0">
                                    <td className="p-2 font-medium text-foreground">{row.nome}</td>
                                    <td className="p-2 text-muted-foreground">{row.setor}</td>
                                    <td className="p-2 text-right tabular-nums font-semibold text-foreground">
                                      {formatCurrency(row.salarioMaisPorFora)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Salary comparison chart */}
          <div className="relative border border-border bg-card p-6 shadow-level-1 overflow-visible">
            <div className="flex items-center justify-between gap-2">
              <span className="label-industrial">Média Salarial por Setor</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSetorChartFullscreen("cadastro")}
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 border border-border hover:bg-muted transition-colors"
                  title="Expandir gráfico"
                >
                  <Maximize2 className="h-3 w-3" />
                  Tela cheia
                </button>
                {selectedSetor && (
                  <button
                    type="button"
                    onClick={() => setSelectedSetor(null)}
                    className="text-[10px] font-bold px-2 py-1 border border-border hover:bg-muted transition-colors"
                  >
                    Fechar tooltip
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salaryBySetor} barCategoryGap="34%" margin={{ top: 12, right: 12, left: 0, bottom: 26 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="hsl(20,2%,88%)" vertical={false} />
                  <XAxis dataKey="setor" tick={{ fontSize: 10, fill: "#808080" }} angle={-30} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 10, fill: "#808080" }} />
                  <Tooltip
                    formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR")}`}
                    contentStyle={{ border: "1px solid #e5e5e5", borderRadius: 0, fontSize: 12 }}
                  />
                  <Bar
                    dataKey="media"
                    barSize={16}
                    radius={[4, 4, 0, 0]}
                    onClick={(entry) => {
                      const setor = String((entry as { setor?: string })?.setor ?? "").trim();
                      if (!setor) return;
                      setSelectedSetor((prev) => (prev === setor ? null : setor));
                    }}
                  >
                    {salaryBySetor.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={
                          selectedSetor
                            ? selectedSetor === entry.setor
                              ? "#1E22AA"
                              : "#94A3B8"
                            : entry.media > 7000
                              ? "#1E22AA"
                              : "#0B2247"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {renderDistribuicaoOverlay(
              selectedSetor,
              colaboradoresBySetor.get(selectedSetor ?? "") ?? [],
              () => setSelectedSetor(null),
              "w-[min(760px,92vw)]",
            )}
          </div>

          {/* Inconsistencies */}
          <div ref={inconsistenciasRef} className="border border-border bg-card p-6 shadow-level-1">
            <div className="flex items-center justify-between gap-2">
              <span className="label-industrial">Inconsistências Salariais</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{inconsistenciasFiltradas.length} colaborador(es)</span>
                {inconsistenciaFiltroCargo && (
                  <button
                    type="button"
                    onClick={() => setInconsistenciaFiltroCargo(null)}
                    className="text-[10px] font-bold px-2 py-1 border border-border hover:bg-muted transition-colors"
                  >
                    Limpar filtro
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4 space-y-2 max-h-[300px] overflow-auto pr-1">
              {inconsistenciasFiltradas.length === 0 && (
                <div className="text-xs text-muted-foreground border border-border p-3">
                  {inconsistenciaFiltroCargo
                    ? "Nenhuma inconsistência encontrada para o cargo filtrado."
                    : "Nenhuma inconsistência encontrada para cargos com faixa cadastrada."}
                </div>
              )}
              {inconsistenciasFiltradas.map((item) => (
                <div
                  key={`${item.matricula}-${item.cargo}-${item.salario}`}
                  onClick={() => navigate(`/organico?focusMatricula=${encodeURIComponent(item.matricula)}`)}
                  className={`border border-border p-3 cursor-pointer transition-colors hover:bg-muted/30 ${
                    item.severity === "red" ? "border-l-4 border-l-destructive" : "border-l-4 border-l-accent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{item.nome}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Matrícula: <span className="font-mono">{item.matricula}</span> · {item.cargo} · {item.setor}
                      </p>
                    </div>
                    <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${item.severity === "red" ? "text-destructive" : "text-accent"}`} />
                  </div>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <span className="text-muted-foreground block uppercase tracking-wide">Salário atual</span>
                      <span className="font-semibold">{formatCurrency(item.salario)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block uppercase tracking-wide">Faixa mínima</span>
                      <span className="font-medium">{formatCurrency(item.faixaMin)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block uppercase tracking-wide">Faixa máxima</span>
                      <span className="font-medium">{formatCurrency(item.faixaMax)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{item.problema}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
          </TabsContent>

          <TabsContent value="simulacao" className="mt-4 space-y-8 focus-visible:outline-none">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <p className="text-xs text-muted-foreground max-w-xl">
                Faixas editadas são guardadas apenas neste navegador (localStorage). Use &quot;Excluir simulação&quot; para voltar aos
                valores vindos do banco.
              </p>
              <button
                type="button"
                onClick={handleLimparSimulacao}
                className="inline-flex items-center gap-2 text-xs font-bold px-3 py-2 border border-destructive/50 text-destructive hover:bg-destructive/10 transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" />
                Excluir simulação
              </button>
            </div>

            <div className="border border-border bg-card shadow-level-1 mb-8 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-border bg-secondary/60">
                    <th
                      className="text-left p-4 label-industrial cursor-pointer select-none"
                      onClick={(e) => handleSimSortClick("cargo", e.ctrlKey)}
                    >
                      Cargo{" "}
                      {simSortColumnMeta("cargo").direction ? (simSortColumnMeta("cargo").direction === "asc" ? "↑" : "↓") : ""}
                      {simSortColumnMeta("cargo").priority ? ` (${simSortColumnMeta("cargo").priority})` : ""}
                    </th>
                    <th
                      className="text-right p-4 label-industrial cursor-pointer select-none"
                      onClick={(e) => handleSimSortClick("count", e.ctrlKey)}
                    >
                      Qtd.{" "}
                      {simSortColumnMeta("count").direction ? (simSortColumnMeta("count").direction === "asc" ? "↑" : "↓") : ""}
                      {simSortColumnMeta("count").priority ? ` (${simSortColumnMeta("count").priority})` : ""}
                    </th>
                    <th
                      className="text-right p-4 label-industrial cursor-pointer select-none"
                      onClick={(e) => handleSimSortClick("faixaMin", e.ctrlKey)}
                    >
                      Faixa Mín.{" "}
                      {simSortColumnMeta("faixaMin").direction ? (simSortColumnMeta("faixaMin").direction === "asc" ? "↑" : "↓") : ""}
                      {simSortColumnMeta("faixaMin").priority ? ` (${simSortColumnMeta("faixaMin").priority})` : ""}
                    </th>
                    <th
                      className="text-right p-4 label-industrial cursor-pointer select-none"
                      onClick={(e) => handleSimSortClick("faixaMax", e.ctrlKey)}
                    >
                      Faixa Máx.{" "}
                      {simSortColumnMeta("faixaMax").direction ? (simSortColumnMeta("faixaMax").direction === "asc" ? "↑" : "↓") : ""}
                      {simSortColumnMeta("faixaMax").priority ? ` (${simSortColumnMeta("faixaMax").priority})` : ""}
                    </th>
                    <th
                      className="text-right p-4 label-industrial cursor-pointer select-none"
                      onClick={(e) => handleSimSortClick("media", e.ctrlKey)}
                    >
                      Média Atual{" "}
                      {simSortColumnMeta("media").direction ? (simSortColumnMeta("media").direction === "asc" ? "↑" : "↓") : ""}
                      {simSortColumnMeta("media").priority ? ` (${simSortColumnMeta("media").priority})` : ""}
                    </th>
                    <th
                      className="text-center p-4 label-industrial cursor-pointer select-none"
                      onClick={(e) => handleSimSortClick("status", e.ctrlKey)}
                    >
                      Status{" "}
                      {simSortColumnMeta("status").direction ? (simSortColumnMeta("status").direction === "asc" ? "↑" : "↓") : ""}
                      {simSortColumnMeta("status").priority ? ` (${simSortColumnMeta("status").priority})` : ""}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCargosSim.map((c) => {
                    const draft = simDrafts[c.cargo] ?? { faixaMin: "", faixaMax: "" };
                    const faixaMin = parseNumberOrNull(draft.faixaMin);
                    const faixaMax = parseNumberOrNull(draft.faixaMax);
                    const hasRange = faixaMin != null && faixaMax != null;
                    const withinRange = hasRange ? c.media >= faixaMin && c.media <= faixaMax : false;
                    const hasInconsistenciasCargo = inconsistenciasSim.some((item) => item.cargo === c.cargo);
                    const canFilterInconsistencias = hasRange && !withinRange && hasInconsistenciasCargo;
                    const simAuditTitle = "Valores da simulação (somente neste navegador)";
                    const cargoListaExpandedSim = !!expandedCargoRows[c.cargo];
                    const linhasColaboradoresSim = colaboradoresByCargo.get(c.cargo) ?? [];
                    return (
                      <Fragment key={`sim-${c.cargo}`}>
                      <tr
                        className={`border-b border-border transition-colors ${
                          canFilterInconsistencias ? "cursor-pointer" : "cursor-default"
                        } ${simInconsistenciaFiltroCargo === c.cargo ? "bg-primary/5" : "hover:bg-muted/30"} ${
                          canFilterInconsistencias ? "hover:bg-primary/5" : ""
                        }`}
                        onClick={() => {
                          if (!canFilterInconsistencias) return;
                          setSimInconsistenciaFiltroCargo(c.cargo);
                          window.setTimeout(() => {
                            simInconsistenciasRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }, 50);
                        }}
                      >
                        <td className="p-4 text-sm font-medium text-foreground">
                          <div className="flex items-start gap-2 min-w-0">
                            <button
                              type="button"
                              aria-expanded={cargoListaExpandedSim}
                              aria-label={cargoListaExpandedSim ? "Recolher colaboradores do cargo" : "Ver colaboradores do cargo"}
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedCargoRows((prev) => ({ ...prev, [c.cargo]: !prev[c.cargo] }));
                              }}
                              className="mt-0.5 shrink-0 inline-flex size-7 items-center justify-center rounded-md border border-input bg-card text-foreground shadow-level-1 hover:bg-muted"
                            >
                              {cargoListaExpandedSim ? <Minus className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
                            </button>
                            <span className="leading-snug break-words">{c.cargo}</span>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-right tabular-nums text-muted-foreground">{c.count}</td>
                        <td className="p-3 text-sm text-right tabular-nums text-foreground">
                          <div title={simAuditTitle}>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="—"
                              value={draft.faixaMin}
                              disabled={!canEdit}
                              onChange={(e) => {
                                e.stopPropagation();
                                setSimDrafts((prev) => ({
                                  ...prev,
                                  [c.cargo]: { ...(prev[c.cargo] ?? { faixaMin: "", faixaMax: "" }), faixaMin: e.target.value },
                                }));
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="rh-inline-field w-32 ml-auto text-right px-2 py-1.5 text-xs tabular-nums"
                            />
                          </div>
                        </td>
                        <td className="p-3 text-sm text-right tabular-nums text-foreground">
                          <div title={simAuditTitle}>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="—"
                              value={draft.faixaMax}
                              disabled={!canEdit}
                              onChange={(e) => {
                                e.stopPropagation();
                                setSimDrafts((prev) => ({
                                  ...prev,
                                  [c.cargo]: { ...(prev[c.cargo] ?? { faixaMin: "", faixaMax: "" }), faixaMax: e.target.value },
                                }));
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="rh-inline-field w-32 ml-auto text-right px-2 py-1.5 text-xs tabular-nums"
                            />
                          </div>
                        </td>
                        <td className="p-4 text-sm text-right tabular-nums font-bold text-foreground">{formatCurrency(c.media)}</td>
                        <td className="p-4 text-center">
                          <span
                            className={`text-[10px] font-bold px-2 py-1 inline-block ${
                              !hasRange
                                ? "bg-muted text-muted-foreground"
                                : withinRange
                                  ? "bg-success text-success-foreground"
                                  : "bg-accent text-accent-foreground"
                            }`}
                          >
                            {!hasRange ? "N/A" : withinRange ? "OK" : "ATENÇÃO"}
                          </span>
                        </td>
                      </tr>
                      {cargoListaExpandedSim && (
                        <tr className="border-b border-border bg-muted/15">
                          <td colSpan={6} className="p-0">
                            <div className="px-4 py-3 pl-14">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Colaboradores neste cargo</p>
                              {linhasColaboradoresSim.length === 0 ? (
                                <p className="text-xs text-muted-foreground">Nenhum colaborador listado neste cargo com o filtro atual.</p>
                              ) : (
                                <table className="w-full text-xs border border-border bg-card">
                                  <thead>
                                    <tr className="border-b border-border bg-muted/50">
                                      <th className="text-left p-2 font-semibold text-muted-foreground uppercase tracking-wide">Colaborador</th>
                                      <th className="text-left p-2 font-semibold text-muted-foreground uppercase tracking-wide">Setor</th>
                                      <th className="text-right p-2 font-semibold text-muted-foreground uppercase tracking-wide">Salário + Adendo</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {linhasColaboradoresSim.map((row) => (
                                      <tr key={`sim-${row.matricula}-${row.nome}`} className="border-b border-border last:border-b-0">
                                        <td className="p-2 font-medium text-foreground">{row.nome}</td>
                                        <td className="p-2 text-muted-foreground">{row.setor}</td>
                                        <td className="p-2 text-right tabular-nums font-semibold text-foreground">
                                          {formatCurrency(row.salarioMaisPorFora)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="relative border border-border bg-card p-6 shadow-level-1 overflow-visible">
                <div className="flex items-center justify-between gap-2">
                  <span className="label-industrial">Média Salarial por Setor</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSetorChartFullscreen("simulacao")}
                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 border border-border hover:bg-muted transition-colors"
                      title="Expandir gráfico"
                    >
                      <Maximize2 className="h-3 w-3" />
                      Tela cheia
                    </button>
                    {simSelectedSetor && (
                      <button
                        type="button"
                        onClick={() => setSimSelectedSetor(null)}
                        className="text-[10px] font-bold px-2 py-1 border border-border hover:bg-muted transition-colors"
                      >
                        Fechar tooltip
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-4 h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salaryBySetor} barCategoryGap="34%" margin={{ top: 12, right: 12, left: 0, bottom: 26 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="hsl(20,2%,88%)" vertical={false} />
                      <XAxis dataKey="setor" tick={{ fontSize: 10, fill: "#808080" }} angle={-30} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 10, fill: "#808080" }} />
                      <Tooltip
                        formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR")}`}
                        contentStyle={{ border: "1px solid #e5e5e5", borderRadius: 0, fontSize: 12 }}
                      />
                      <Bar
                        dataKey="media"
                        barSize={16}
                        radius={[4, 4, 0, 0]}
                        onClick={(entry) => {
                          const setor = String((entry as { setor?: string })?.setor ?? "").trim();
                          if (!setor) return;
                          setSimSelectedSetor((prev) => (prev === setor ? null : setor));
                        }}
                      >
                        {salaryBySetor.map((entry, index) => (
                          <Cell
                            key={index}
                            fill={
                              simSelectedSetor
                                ? simSelectedSetor === entry.setor
                                  ? "#1E22AA"
                                  : "#94A3B8"
                                : entry.media > 7000
                                  ? "#1E22AA"
                                  : "#0B2247"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {renderDistribuicaoOverlay(
                  simSelectedSetor,
                  colaboradoresBySetor.get(simSelectedSetor ?? "") ?? [],
                  () => setSimSelectedSetor(null),
                  "w-[min(760px,92vw)]",
                )}
              </div>

              <div ref={simInconsistenciasRef} className="border border-border bg-card p-6 shadow-level-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="label-industrial">Inconsistências (simulação)</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{inconsistenciasFiltradasSim.length} colaborador(es)</span>
                    {simInconsistenciaFiltroCargo && (
                      <button
                        type="button"
                        onClick={() => setSimInconsistenciaFiltroCargo(null)}
                        className="text-[10px] font-bold px-2 py-1 border border-border hover:bg-muted transition-colors"
                      >
                        Limpar filtro
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-4 space-y-2 max-h-[300px] overflow-auto pr-1">
                  {inconsistenciasFiltradasSim.length === 0 && (
                    <div className="text-xs text-muted-foreground border border-border p-3">
                      {simInconsistenciaFiltroCargo
                        ? "Nenhuma inconsistência encontrada para o cargo filtrado."
                        : "Nenhuma inconsistência encontrada para as faixas simuladas preenchidas."}
                    </div>
                  )}
                  {inconsistenciasFiltradasSim.map((item) => (
                    <div
                      key={`sim-inc-${item.matricula}-${item.cargo}-${item.salario}`}
                      onClick={() => navigate(`/organico?focusMatricula=${encodeURIComponent(item.matricula)}`)}
                      className={`border border-border p-3 cursor-pointer transition-colors hover:bg-muted/30 ${
                        item.severity === "red" ? "border-l-4 border-l-destructive" : "border-l-4 border-l-accent"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{item.nome}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Matrícula: <span className="font-mono">{item.matricula}</span> · {item.cargo} · {item.setor}
                          </p>
                        </div>
                        <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${item.severity === "red" ? "text-destructive" : "text-accent"}`} />
                      </div>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                        <div>
                          <span className="text-muted-foreground block uppercase tracking-wide">Salário atual</span>
                          <span className="font-semibold">{formatCurrency(item.salario)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block uppercase tracking-wide">Faixa mínima</span>
                          <span className="font-medium">{formatCurrency(item.faixaMin)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block uppercase tracking-wide">Faixa máxima</span>
                          <span className="font-medium">{formatCurrency(item.faixaMax)}</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">{item.problema}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={setorChartFullscreen !== null} onOpenChange={(open) => !open && setSetorChartFullscreen(null)}>
          <DialogContent className="max-w-[95vw] h-[90vh]">
            <DialogHeader>
              <DialogTitle>Média Salarial por Setor — Tela Cheia</DialogTitle>
            </DialogHeader>
            <div className="relative h-[calc(90vh-90px)]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salaryBySetor} barCategoryGap="28%" margin={{ top: 18, right: 24, left: 10, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="hsl(20,2%,88%)" vertical={false} />
                  <XAxis dataKey="setor" tick={{ fontSize: 11, fill: "#808080" }} angle={-25} textAnchor="end" height={72} />
                  <YAxis tick={{ fontSize: 11, fill: "#808080" }} />
                  <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR")}`} />
                  <Bar
                    dataKey="media"
                    barSize={22}
                    radius={[4, 4, 0, 0]}
                    onClick={(entry) => {
                      const setor = String((entry as { setor?: string })?.setor ?? "").trim();
                      if (!setor) return;
                      if (setorChartFullscreen === "simulacao") {
                        setSimSelectedSetor((prev) => (prev === setor ? null : setor));
                      } else {
                        setSelectedSetor((prev) => (prev === setor ? null : setor));
                      }
                    }}
                  >
                    {salaryBySetor.map((entry, index) => {
                      const selected = setorChartFullscreen === "simulacao" ? simSelectedSetor : selectedSetor;
                      return (
                        <Cell
                          key={index}
                          fill={selected ? (selected === entry.setor ? "#1E22AA" : "#94A3B8") : entry.media > 7000 ? "#1E22AA" : "#0B2247"}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {renderDistribuicaoOverlay(
                selectedSetorFullscreen,
                selectedSetorFullscreenDistribuicao,
                () => {
                  if (setorChartFullscreen === "simulacao") setSimSelectedSetor(null);
                  else setSelectedSetor(null);
                },
                "w-[min(980px,92vw)]",
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Cargos;
