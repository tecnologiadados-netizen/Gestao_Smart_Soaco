import { useMemo } from "react";
import { formatCurrency } from "../lib/formatters";
import { calcularIndicadoresRecuperado } from "../lib/contas-recuperado-indicadores";
import type { IndicadorPeriodoConta } from "../lib/contas-periodo-indicadores";
import type { PeriodoVencimentoConta } from "../lib/contas-periodo-indicadores";
import type { Recebimento } from "../lib/types";

interface Props {
  recebimentos: Recebimento[];
  periodoSelecionado: PeriodoVencimentoConta | null;
  onSelecionarPeriodo: (periodo: PeriodoVencimentoConta | null) => void;
}

const TEMA = {
  card: "border-emerald-100 bg-emerald-50",
  cardHover: "hover:border-emerald-400 hover:bg-emerald-100/80",
  cardAtivo: "border-emerald-600 bg-emerald-100 ring-2 ring-emerald-500/40",
  valor: "text-emerald-800",
  badge: "bg-emerald-100 text-emerald-700",
  badgeAtivo: "bg-emerald-600 text-white",
};

function CardRecuperado({
  indicador,
  selecionado,
  onClick,
}: {
  indicador: IndicadorPeriodoConta;
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
          ? "Sem recebimentos recuperados neste período"
          : selecionado
            ? "Clique para voltar às contas em atraso"
            : "Clique para ver os recebimentos recuperados deste período"
      }
      className={`rounded-xl border p-4 text-left shadow-sm transition ${
        desabilitado
          ? "cursor-not-allowed opacity-50"
          : `cursor-pointer ${TEMA.cardHover}`
      } ${selecionado ? TEMA.cardAtivo : TEMA.card}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900/80">
        {indicador.label}
      </p>
      <p className="mt-0.5 text-[11px] leading-snug text-emerald-800/70">
        {indicador.descricao}
      </p>
      <p className={`mt-2 text-xl font-bold ${TEMA.valor}`}>
        {formatCurrency(indicador.valor)}
      </p>
      <p className="mt-1">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
            selecionado ? TEMA.badgeAtivo : TEMA.badge
          }`}
        >
          {indicador.quantidade.toLocaleString("pt-BR")}{" "}
          {indicador.quantidade === 1 ? "linha" : "linhas"}
        </span>
      </p>
    </button>
  );
}

export default function IndicadoresRecuperadoContas({
  recebimentos,
  periodoSelecionado,
  onSelecionarPeriodo,
}: Props) {
  const indicadores = useMemo(
    () => calcularIndicadoresRecuperado(recebimentos),
    [recebimentos],
  );

  const handleClick = (id: PeriodoVencimentoConta) => {
    onSelecionarPeriodo(periodoSelecionado === id ? null : id);
  };

  return (
    <section
      className="shrink-0 border-b border-slate-200 bg-white px-5 py-4"
      aria-label="Indicadores de recebimentos recuperados"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {indicadores.map((indicador) => (
          <CardRecuperado
            key={indicador.id}
            indicador={indicador}
            selecionado={periodoSelecionado === indicador.id}
            onClick={() => handleClick(indicador.id)}
          />
        ))}
      </div>
    </section>
  );
}
