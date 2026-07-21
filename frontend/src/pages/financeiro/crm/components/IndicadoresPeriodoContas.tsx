import { useMemo } from "react";
import { formatCurrency } from "../lib/formatters";
import {
  calcularIndicadoresPeriodoContas,
  type IndicadorPeriodoConta,
  type PeriodoVencimentoConta,
} from "../lib/contas-periodo-indicadores";
import type { ColunaIndicador, ContaFinanceira } from "../lib/types";

interface Props {
  contas: ContaFinanceira[];
  coluna: ColunaIndicador;
  periodoSelecionado: PeriodoVencimentoConta | null;
  onSelecionarPeriodo: (periodo: PeriodoVencimentoConta | null) => void;
}

const TEMA: Record<
  ColunaIndicador,
  {
    card: string;
    cardHover: string;
    cardAtivo: string;
    valor: string;
    badge: string;
    badgeAtivo: string;
  }
> = {
  total: {
    card: "border-blue-100 bg-blue-50",
    cardHover: "hover:border-blue-300 hover:bg-blue-100/80",
    cardAtivo: "border-blue-600 bg-blue-100 ring-2 ring-blue-500/40",
    valor: "text-blue-800",
    badge: "bg-blue-100 text-blue-700",
    badgeAtivo: "bg-blue-700 text-white",
  },
  emAtraso: {
    card: "border-red-100 bg-red-50",
    cardHover: "hover:border-red-300 hover:bg-red-100/80",
    cardAtivo: "border-red-600 bg-red-100 ring-2 ring-red-500/40",
    valor: "text-red-800",
    badge: "bg-red-100 text-red-700",
    badgeAtivo: "bg-red-600 text-white",
  },
  emDia: {
    card: "border-emerald-100 bg-emerald-50",
    cardHover: "hover:border-emerald-300 hover:bg-emerald-100/80",
    cardAtivo: "border-emerald-600 bg-emerald-100 ring-2 ring-emerald-500/40",
    valor: "text-emerald-800",
    badge: "bg-emerald-100 text-emerald-700",
    badgeAtivo: "bg-emerald-600 text-white",
  },
  recebido30d: {
    card: "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800",
    cardHover: "hover:border-slate-300 dark:hover:border-slate-600",
    cardAtivo: "border-slate-600 ring-2 ring-slate-500/40",
    valor: "text-slate-800 dark:text-slate-100",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
    badgeAtivo: "bg-slate-700 text-white",
  },
  recebido90d: {
    card: "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800",
    cardHover: "hover:border-slate-300 dark:hover:border-slate-600",
    cardAtivo: "border-slate-600 ring-2 ring-slate-500/40",
    valor: "text-slate-800 dark:text-slate-100",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
    badgeAtivo: "bg-slate-700 text-white",
  },
  recebidoAno: {
    card: "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800",
    cardHover: "hover:border-slate-300 dark:hover:border-slate-600",
    cardAtivo: "border-slate-600 ring-2 ring-slate-500/40",
    valor: "text-slate-800 dark:text-slate-100",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
    badgeAtivo: "bg-slate-700 text-white",
  },
  recebidoHistorico: {
    card: "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800",
    cardHover: "hover:border-slate-300 dark:hover:border-slate-600",
    cardAtivo: "border-slate-600 ring-2 ring-slate-500/40",
    valor: "text-slate-800 dark:text-slate-100",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
    badgeAtivo: "bg-slate-700 text-white",
  },
};

function CardPeriodo({
  indicador,
  tema,
  selecionado,
  onClick,
}: {
  indicador: IndicadorPeriodoConta;
  tema: (typeof TEMA)[ColunaIndicador];
  selecionado: boolean;
  onClick: () => void;
}) {
  const desabilitado = indicador.quantidade === 0;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      aria-pressed={selecionado}
      title={
        desabilitado
          ? "Sem registros neste período"
          : selecionado
            ? "Clique para remover o filtro"
            : "Clique para filtrar a tabela por este período"
      }
      className={`rounded-xl border p-4 text-left shadow-sm transition ${
        desabilitado
          ? "cursor-not-allowed opacity-50"
          : `cursor-pointer ${tema.cardHover}`
      } ${selecionado ? tema.cardAtivo : tema.card}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
        {indicador.label}
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        {indicador.descricao}
      </p>
      <p className={`mt-2 text-xl font-bold ${tema.valor}`}>
        {formatCurrency(indicador.valor)}
      </p>
      <p className="mt-1">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
            selecionado ? tema.badgeAtivo : tema.badge
          }`}
        >
          {indicador.quantidade.toLocaleString("pt-BR")}{" "}
          {indicador.quantidade === 1 ? "linha" : "linhas"}
        </span>
      </p>
    </button>
  );
}

export default function IndicadoresPeriodoContas({
  contas,
  coluna,
  periodoSelecionado,
  onSelecionarPeriodo,
}: Props) {
  const indicadores = useMemo(
    () => calcularIndicadoresPeriodoContas(contas, coluna),
    [contas, coluna],
  );
  const tema = TEMA[coluna];

  const handleClick = (id: PeriodoVencimentoConta) => {
    onSelecionarPeriodo(periodoSelecionado === id ? null : id);
  };

  return (
    <section
      className="shrink-0 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900"
      aria-label="Indicadores por período de vencimento"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {indicadores.map((indicador) => (
          <CardPeriodo
            key={indicador.id}
            indicador={indicador}
            tema={tema}
            selecionado={periodoSelecionado === indicador.id}
            onClick={() => handleClick(indicador.id)}
          />
        ))}
      </div>
    </section>
  );
}
