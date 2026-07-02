import { formatCurrency } from "../lib/formatters";
import type { IndicadoresResumo } from "../lib/types";

interface Props {
  titulo: string;
  indicadores: IndicadoresResumo;
  tipo: "receber" | "pagar";
}

export default function KpiCards({ titulo, indicadores, tipo }: Props) {
  const labelBaixado =
    tipo === "receber" ? "Recebido (30 dias)" : "Pago (30 dias)";
  const labelHistorico =
    tipo === "receber" ? "Total recebido" : "Total pago";

  const cards = [
    {
      label: "Total pendente",
      value: indicadores.total,
      color: "text-blue-700",
      bg: "bg-blue-50 border-blue-100",
    },
    {
      label: "Em atraso",
      value: indicadores.emAtraso,
      color: "text-red-700",
      bg: "bg-red-50 border-red-100",
    },
    {
      label: "A vencer",
      value: indicadores.emDia,
      color: "text-emerald-700",
      bg: "bg-emerald-50 border-emerald-100",
    },
    {
      label: labelBaixado,
      value: indicadores.recebido30d,
      color: "text-slate-700",
      bg: "bg-slate-50 border-slate-200",
    },
    {
      label: labelHistorico,
      value: indicadores.recebidoHistorico,
      color: "text-indigo-700",
      bg: "bg-indigo-50 border-indigo-100",
    },
  ];

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {titulo}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <article
            key={card.label}
            className={`rounded-xl border p-4 shadow-sm ${card.bg}`}
          >
            <p className="text-xs font-medium text-slate-500">{card.label}</p>
            <p className={`mt-1 text-xl font-bold ${card.color}`}>
              {formatCurrency(card.value)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
