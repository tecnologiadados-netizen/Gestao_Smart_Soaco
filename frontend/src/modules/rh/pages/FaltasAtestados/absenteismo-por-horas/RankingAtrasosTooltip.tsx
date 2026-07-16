import { memo, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { SancaoDisciplinarRow } from "@rh/types/api";
import { cn } from "@rh/lib/utils";
import type { CtpsSource } from "./types";
import {
  clampIsoDate,
  formatDataAplicacaoLongaPt,
  sancoesDoColaboradorPorNome,
} from "./sancoesTooltipHelpers";
import { normalizeAbsenteismoNomeKey } from "./organico-match";

const HORAS_MES_CLT_REF = 220;

function formatBRL(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

type SancaoSortKey = "nome" | "tipo" | "data" | "motivo";

function compareSancaoRows(a: SancaoDisciplinarRow, b: SancaoDisciplinarRow, key: SancaoSortKey): number {
  switch (key) {
    case "nome":
      return String(a.nomeFuncionario ?? "").localeCompare(String(b.nomeFuncionario ?? ""), "pt-BR", {
        sensitivity: "base",
      });
    case "tipo":
      return String(a.tipo ?? "")
        .trim()
        .localeCompare(String(b.tipo ?? "").trim(), "pt-BR", { sensitivity: "base" });
    case "data": {
      const ia = clampIsoDate(a.dataAplicacao);
      const ib = clampIsoDate(b.dataAplicacao);
      return ia.localeCompare(ib, "en-CA");
    }
    case "motivo":
      return String(a.observacoes ?? "")
        .trim()
        .localeCompare(String(b.observacoes ?? "").trim(), "pt-BR", { sensitivity: "base" });
    default:
      return 0;
  }
}

export type AtrasosAggPayload = {
  label: string;
  qtd: number;
  media: number;
  total: number;
  percentual: number;
  score?: number;
  ctpsOrganico?: number;
  ctpsSource?: CtpsSource;
};

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function formatMinHuman(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const mi = m % 60;
  if (h === 0) return `${mi} min`;
  return `${h}h ${String(mi).padStart(2, "0")}min`;
}

function formatMinutosAudit(min: number): string {
  const n = Math.max(0, min);
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(n) ? 0 : 1 })} min`;
}

function ResumoAtrasosColaborador({
  a,
  totalQtd,
  ctpsByNomeNorm,
  isLoadingOrganico,
}: {
  a: AtrasosAggPayload;
  totalQtd: number;
  ctpsByNomeNorm: Map<string, number>;
  isLoadingOrganico: boolean;
}) {
  const ctpsFromAgg =
    a.ctpsOrganico != null && Number.isFinite(a.ctpsOrganico) && a.ctpsOrganico > 0 ? a.ctpsOrganico : null;
  const ctps = ctpsFromAgg ?? (ctpsByNomeNorm.get(normalizeAbsenteismoNomeKey(a.label)) ?? 0);
  const custoReais = ctps > 0 ? (a.total / 60) * (ctps / HORAS_MES_CLT_REF) : null;

  return (
    <div className="space-y-1 text-xs">
      <div className="font-semibold text-foreground">{a.label}</div>
      <div className="text-muted-foreground">Quantidade de atrasos: {a.qtd}</div>
      <div className="text-muted-foreground">Tempo médio: {formatMinHuman(a.media)}</div>
      <div className="text-muted-foreground">Tempo total: {formatMinHuman(a.total)}</div>
      <div className="text-muted-foreground">
        % relativo: {formatPercent(totalQtd > 0 ? (a.qtd / totalQtd) * 100 : 0)}
      </div>
      {a.score != null ? (
        <div className="text-muted-foreground">Score pontualidade (proxy): {formatPercent(a.score)}</div>
      ) : null}
      <div className="border-t border-border/70 pt-2 mt-2 space-y-0.5">
        <div className="font-medium text-foreground">
          Custo estimado (atraso):{" "}
          {isLoadingOrganico ? (
            <span className="font-normal text-muted-foreground">carregando…</span>
          ) : custoReais != null ? (
            formatBRL(custoReais)
          ) : (
            <span className="font-normal text-muted-foreground">— sem CTPS (Secullum/Orgânico)</span>
          )}
        </div>
        {!isLoadingOrganico && custoReais != null ? (
          <p className="text-[10px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">
            <span className="block">
              ({formatMinutosAudit(a.total)} ÷ 60) × ({formatBRL(ctps)} ÷ {HORAS_MES_CLT_REF} h/mês) ={" "}
              {formatBRL(custoReais)}
            </span>
            <span className="mt-0.5 block text-[9px] opacity-90">
              Equiv.: {(a.total / 60).toLocaleString("pt-BR", { maximumFractionDigits: 3, minimumFractionDigits: 0 })} h
              de atraso × {formatBRL(ctps / HORAS_MES_CLT_REF)}/h.
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

export type RankingAtrasosTooltipProps = {
  agg: AtrasosAggPayload | null;
  totalDelayed: number;
  todasSancoes: SancaoDisciplinarRow[];
  isLoadingSancoes: boolean;
  isErrorSancoes: boolean;
  ctpsByNomeNorm: Map<string, number>;
  isLoadingOrganico?: boolean;
};

function SancaoSortTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SancaoSortKey;
  activeKey: SancaoSortKey;
  dir: "asc" | "desc";
  onSort: (k: SancaoSortKey) => void;
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <th className={cn("p-0 align-bottom", className)} scope="col">
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-0.5 rounded-sm px-0 py-2 pr-2 text-left text-[10px] font-bold uppercase tracking-wide transition-colors",
          "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          active && "text-foreground",
        )}
        onClick={() => onSort(sortKey)}
        aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      >
        <span className="min-w-0 flex-1 leading-tight">{label}</span>
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
          ) : (
            <ArrowDown className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 shrink-0 opacity-35" aria-hidden />
        )}
      </button>
    </th>
  );
}

export const RankingAtrasosTooltip = memo(function RankingAtrasosTooltip({
  agg,
  totalDelayed,
  todasSancoes,
  isLoadingSancoes,
  isErrorSancoes,
  ctpsByNomeNorm,
  isLoadingOrganico = false,
}: RankingAtrasosTooltipProps) {
  const nome = agg?.label?.trim() ?? "";
  const [sancaoSort, setSancaoSort] = useState<{ key: SancaoSortKey; dir: "asc" | "desc" }>({
    key: "data",
    dir: "desc",
  });

  useEffect(() => {
    setSancaoSort({ key: "data", dir: "desc" });
  }, [nome]);

  const listaBase = useMemo(() => sancoesDoColaboradorPorNome(todasSancoes, nome), [todasSancoes, nome]);

  const listaOrdenada = useMemo(() => {
    const copy = [...listaBase];
    copy.sort((a, b) => {
      const c = compareSancaoRows(a, b, sancaoSort.key);
      if (c === 0) return 0;
      return sancaoSort.dir === "asc" ? c : -c;
    });
    return copy;
  }, [listaBase, sancaoSort]);

  const handleSancaoSort = (key: SancaoSortKey) => {
    setSancaoSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return { key, dir: key === "data" ? "desc" : "asc" };
    });
  };

  if (!agg) return null;

  return (
    <div
      className={cn(
        "flex w-full max-w-[min(840px,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-border bg-background shadow-lg",
        "ring-1 ring-black/5 dark:ring-white/10",
      )}
    >
      <div className="w-[min(288px,34%)] min-w-[210px] max-w-[300px] shrink-0 border-r border-border bg-card px-3 py-3">
        <ResumoAtrasosColaborador
          a={agg}
          totalQtd={totalDelayed}
          ctpsByNomeNorm={ctpsByNomeNorm}
          isLoadingOrganico={isLoadingOrganico}
        />
      </div>
      <div className="flex min-h-0 min-w-0 max-h-[min(420px,58vh)] flex-1 flex-col overflow-hidden bg-popover text-popover-foreground">
        <div className="shrink-0 border-b border-border bg-muted/50 px-3 py-2.5">
          <p className="text-sm font-semibold text-foreground">Sanções do colaborador</p>
          <p className="text-[11px] text-muted-foreground">
            Histórico geral na base (todas as sanções do nome, independente do período dos filtros desta tela).
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-2.5 py-2">
          {isLoadingSancoes ? (
            <p className="px-1 py-4 text-center text-xs text-muted-foreground">Carregando sanções…</p>
          ) : isErrorSancoes ? (
            <p className="px-1 py-4 text-center text-xs text-destructive">
              Não foi possível carregar sanções. Verifique a API ou a aba Faltas e Atestados.
            </p>
          ) : listaBase.length === 0 ? (
            <p className="px-1 py-4 text-center text-xs text-muted-foreground">
              Nenhuma sanção encontrada na base para este colaborador.
            </p>
          ) : (
            <table className="w-full table-fixed border-collapse text-xs">
              <colgroup>
                <col style={{ width: "24%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "34%" }} />
              </colgroup>
              <thead>
                <tr className="border-b border-border text-left">
                  <SancaoSortTh
                    label="Nome"
                    sortKey="nome"
                    activeKey={sancaoSort.key}
                    dir={sancaoSort.dir}
                    onSort={handleSancaoSort}
                  />
                  <SancaoSortTh
                    label="Tipo"
                    sortKey="tipo"
                    activeKey={sancaoSort.key}
                    dir={sancaoSort.dir}
                    onSort={handleSancaoSort}
                  />
                  <SancaoSortTh
                    label="Data aplicação"
                    sortKey="data"
                    activeKey={sancaoSort.key}
                    dir={sancaoSort.dir}
                    onSort={handleSancaoSort}
                  />
                  <SancaoSortTh
                    label="Motivo / obs."
                    sortKey="motivo"
                    activeKey={sancaoSort.key}
                    dir={sancaoSort.dir}
                    onSort={handleSancaoSort}
                    className="pr-0"
                  />
                </tr>
              </thead>
              <tbody>
                {listaOrdenada.map((s, idx) => (
                  <tr
                    key={`${String(s.id)}-${idx}`}
                    className={cn(
                      "align-top border-b border-border/70 last:border-0",
                      idx % 2 === 1 ? "bg-muted/30" : "",
                    )}
                  >
                    <td className="py-2.5 pr-3 font-medium break-words align-top leading-snug">
                      {s.nomeFuncionario}
                    </td>
                    <td className="py-2.5 pr-3 break-words align-top leading-snug">
                      {String(s.tipo ?? "").trim() || "—"}
                    </td>
                    <td className="py-2.5 pr-3 break-words text-muted-foreground align-top leading-snug">
                      {formatDataAplicacaoLongaPt(s.dataAplicacao)}
                    </td>
                    <td className="py-2.5 break-words text-muted-foreground align-top leading-relaxed [overflow-wrap:anywhere]">
                      {String(s.observacoes ?? "").trim() || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
});

RankingAtrasosTooltip.displayName = "RankingAtrasosTooltip";
