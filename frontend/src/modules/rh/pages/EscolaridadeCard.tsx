import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { rhChartAxisTick, rhChartTooltipStyle, useRhChartTheme } from "@rh/lib/chart-theme";
import {
  type EscolaridadeNivelResumo,
  type EscolaridadeResumo,
  type GeneroEscolaridade,
  type NivelEscolaridadeId,
} from "@rh/lib/escolaridade";

const COR_HOMENS = "#14B8A6";
const COR_MULHERES = "#F43F7A";

type ModoEscolaridade = "distribuicao" | "salario";

function formatPct(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatMoeda(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function formatMoedaEixo(value: number): string {
  if (value >= 1000) {
    const mil = value / 1000;
    const texto = mil.toLocaleString("pt-BR", { maximumFractionDigits: mil >= 10 ? 0 : 1 });
    return `${texto} mil`;
  }
  return formatMoeda(value);
}

function EscolaridadeTooltip({
  active,
  payload,
  modo,
}: {
  active?: boolean;
  payload?: Array<{ payload?: EscolaridadeNivelResumo }>;
  modo: ModoEscolaridade;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const linha = (rotulo: string, quantidade: number, detalhe: string) => (
    <p className="mt-1.5 first:mt-1.5">
      <span className="text-muted-foreground">{rotulo}: </span>
      <span className="font-medium tabular-nums">
        {quantidade.toLocaleString("pt-BR")} {quantidade === 1 ? "pessoa" : "pessoas"} · {detalhe}
      </span>
    </p>
  );
  return (
    <div className="rounded-sm border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="border-b border-border pb-1.5 font-semibold text-foreground">{row.rotulo}</p>
      {modo === "salario" ? (
        <>
          {linha("Homens", row.homensComSalario, row.homensMedia > 0 ? formatMoeda(row.homensMedia) : "sem salário")}
          {linha("Mulheres", row.mulheresComSalario, row.mulheresMedia > 0 ? formatMoeda(row.mulheresMedia) : "sem salário")}
        </>
      ) : (
        <>
          {linha("Homens", row.homens, `${formatPct(row.homensPct)}%`)}
          {linha("Mulheres", row.mulheres, `${formatPct(row.mulheresPct)}%`)}
        </>
      )}
    </div>
  );
}

export function EscolaridadeCard({
  resumo,
  referencia,
  onSelect,
}: {
  resumo: EscolaridadeResumo;
  referencia: string;
  onSelect: (selecao: { nivelId: NivelEscolaridadeId; genero: GeneroEscolaridade }) => void;
}) {
  const chart = useRhChartTheme();
  const [modo, setModo] = useState<ModoEscolaridade>("distribuicao");
  const total = resumo.homensTotal + resumo.mulheresTotal + resumo.semSexo;
  const mostrarHomens = resumo.homensTotal > 0;
  const mostrarMulheres = resumo.mulheresTotal > 0;
  const salario = modo === "salario";
  const maiorValor = salario
    ? Math.max(1, ...resumo.niveis.flatMap((nivel) => [nivel.homensMedia, nivel.mulheresMedia]))
    : Math.max(10, ...resumo.niveis.flatMap((nivel) => [nivel.homensPct, nivel.mulheresPct]));
  const domainMax = salario
    ? Math.ceil((maiorValor * 1.22) / 500) * 500
    : Math.min(100, Math.ceil((maiorValor * 1.18) / 5) * 5);
  const chartHeight = Math.max(320, resumo.niveis.length * 42 + 28);

  const abrir = (genero: GeneroEscolaridade) => (item: { payload?: EscolaridadeNivelResumo }) => {
    const row = item?.payload;
    if (!row) return;
    const quantidade = genero === "masculino" ? row.homens : row.mulheres;
    if (quantidade <= 0) return;
    onSelect({ nivelId: row.id, genero });
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border border-border bg-card p-6 shadow-level-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="label-industrial">Nível de escolaridade</span>
        <span className="text-xs text-muted-foreground">{referencia}</span>
      </div>

      {total <= 0 ? (
        <p className="mt-4 border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          Sem colaboradores ativos para esta empresa.
        </p>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between gap-4 rounded-sm border border-[#1E22AA]/20 bg-[#1E22AA]/[0.06] px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Concluíram a educação básica
              </p>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-5 gap-y-1">
                {mostrarHomens ? (
                  <p>
                    <span className="text-2xl font-semibold tabular-nums" style={{ color: COR_HOMENS }}>
                      {formatPct(resumo.basica.homensPct)}%
                    </span>
                    <span className="ml-2 text-sm text-muted-foreground">Homens</span>
                  </p>
                ) : null}
                {mostrarMulheres ? (
                  <p>
                    <span className="text-2xl font-semibold tabular-nums" style={{ color: COR_MULHERES }}>
                      {formatPct(resumo.basica.mulheresPct)}%
                    </span>
                    <span className="ml-2 text-sm text-muted-foreground">Mulheres</span>
                  </p>
                ) : null}
              </div>
            </div>
            <div className="inline-flex shrink-0 rounded-sm border border-border bg-background/70 p-0.5">
              <button
                type="button"
                className={`rounded-sm px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  modo === "distribuicao"
                    ? "bg-[#1E22AA] text-white shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                aria-pressed={modo === "distribuicao"}
                onClick={() => setModo("distribuicao")}
              >
                Distribuição
              </button>
              <button
                type="button"
                className={`rounded-sm px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  modo === "salario"
                    ? "bg-[#1E22AA] text-white shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                aria-pressed={modo === "salario"}
                onClick={() => setModo("salario")}
              >
                Média salarial
              </button>
            </div>
          </div>

          <div className="mt-3 max-h-[min(420px,55vh)] min-h-0 flex-1 overflow-x-hidden overflow-y-auto rounded-sm border border-border/40 bg-muted/20 pr-1">
            <div style={{ height: chartHeight, minHeight: 320 }}>
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart
                  data={resumo.niveis}
                  layout="vertical"
                  margin={{ top: 8, right: salario ? 78 : 46, left: 4, bottom: 8 }}
                  barGap={2}
                  barCategoryGap="22%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, domainMax]}
                    tick={rhChartAxisTick(chart)}
                    tickFormatter={(value) => (salario ? formatMoedaEixo(Number(value)) : `${value}%`)}
                  />
                  <YAxis
                    dataKey="rotulo"
                    type="category"
                    width={148}
                    interval={0}
                    tick={{ ...rhChartAxisTick(chart, 11), fill: chart.axisCategory }}
                  />
                  <Tooltip
                    content={<EscolaridadeTooltip modo={modo} />}
                    contentStyle={rhChartTooltipStyle(chart)}
                    cursor={{ fill: chart.grid }}
                  />
                  {salario ? null : (
                    <ReferenceArea
                      y1="Médio completo"
                      y2="Pós-graduação"
                      fill={chart.legendGold}
                      fillOpacity={0.14}
                      ifOverflow="extendDomain"
                    />
                  )}
                  {mostrarHomens ? (
                    <Bar
                      dataKey={salario ? "homensMedia" : "homensPct"}
                      name="Homens"
                      fill={COR_HOMENS}
                      barSize={11}
                      maxBarSize={14}
                      cursor="pointer"
                      onClick={abrir("masculino")}
                    >
                      <LabelList
                        dataKey={salario ? "homensMedia" : "homensPct"}
                        position="right"
                        formatter={(value: number) =>
                          Number(value) > 0 ? (salario ? formatMoeda(Number(value)) : formatPct(Number(value))) : ""
                        }
                        style={{ fill: chart.axisCategory, fontSize: 10 }}
                      />
                    </Bar>
                  ) : null}
                  {mostrarMulheres ? (
                    <Bar
                      dataKey={salario ? "mulheresMedia" : "mulheresPct"}
                      name="Mulheres"
                      fill={COR_MULHERES}
                      barSize={11}
                      maxBarSize={14}
                      cursor="pointer"
                      onClick={abrir("feminino")}
                    >
                      <LabelList
                        dataKey={salario ? "mulheresMedia" : "mulheresPct"}
                        position="right"
                        formatter={(value: number) =>
                          Number(value) > 0 ? (salario ? formatMoeda(Number(value)) : formatPct(Number(value))) : ""
                        }
                        style={{ fill: chart.axisCategory, fontSize: 10 }}
                      />
                    </Bar>
                  ) : null}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="flex flex-wrap items-center gap-3">
              {mostrarHomens ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COR_HOMENS }} />
                  Homens
                </span>
              ) : null}
              {mostrarMulheres ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COR_MULHERES }} />
                  Mulheres
                </span>
              ) : null}
            </span>
            <span>Clique na barra para ver os colaboradores</span>
          </div>
        </>
      )}
    </div>
  );
}
