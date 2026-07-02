import { useState } from "react";
import {
  DESCRICAO_MEDIA_GERAL,
  DESCRICAO_MEDIA_GERAL_EMPRESA,
  type FaixaSaude,
  type PilarDetalhes,
  type SaudeClienteResult,
} from "../lib/saude-cliente";

export type SaudeGaugesVariant = "cliente" | "empresa";

interface Props {
  saude: SaudeClienteResult;
  exportId?: string;
  variant?: SaudeGaugesVariant;
}

const VARIANT_CONFIG: Record<
  SaudeGaugesVariant,
  {
    ariaLabel: string;
    titulo: string;
    subtitulo: string;
    descricaoMediaGeral: string;
  }
> = {
  cliente: {
    ariaLabel: "Indicador de saúde do cliente",
    titulo: "Saúde do cliente",
    subtitulo: "Contas a receber — histórico completo (Confirmada + Adiantamento)",
    descricaoMediaGeral: DESCRICAO_MEDIA_GERAL,
  },
  empresa: {
    ariaLabel: "Indicador de saúde do quadro de contas a receber da empresa",
    titulo: "Saúde do quadro de contas a receber da empresa",
    subtitulo:
      "Visão consolidada de todas as classificações e clientes — histórico completo",
    descricaoMediaGeral: DESCRICAO_MEDIA_GERAL_EMPRESA,
  },
};

const FAIXA_STYLES: Record<
  FaixaSaude,
  { arc: string; text: string; bg: string; border: string }
> = {
  excelente: {
    arc: "stroke-emerald-500",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  bom: {
    arc: "stroke-blue-500",
    text: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  atencao: {
    arc: "stroke-amber-500",
    text: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  critico: {
    arc: "stroke-red-500",
    text: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
  },
};

function GaugeArc({
  score,
  faixa,
  size,
}: {
  score: number;
  faixa: FaixaSaude;
  size: "sm" | "lg";
}) {
  const styles = FAIXA_STYLES[faixa];
  const width = size === "lg" ? 172 : 128;
  const height = size === "lg" ? 100 : 76;
  const strokeWidth = size === "lg" ? 16 : 13;
  const radius = size === "lg" ? 58 : 44;
  const cx = width / 2;
  const cy = height - 6;
  const circumference = Math.PI * radius;
  const progress = (Math.max(0, Math.min(100, score)) / 100) * circumference;

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${width} ${height}`}
      className={size === "lg" ? "h-[100px] w-[172px]" : "h-[76px] w-[128px]"}
    >
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        className="stroke-slate-200"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
        fill="none"
        className={styles.arc}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${progress} ${circumference}`}
      />
    </svg>
  );
}

function getDetalheItemStyle(rotulo: string): {
  row: string;
  label: string;
  value: string;
  dot: string;
} {
  const text = rotulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (
    text.includes("prazo") ||
    text.includes("a vencer") ||
    text.includes("com juros") ||
    text.includes("media final")
  ) {
    return {
      row: "border-emerald-100 bg-emerald-50",
      label: "text-emerald-900",
      value: "bg-emerald-600 text-white",
      dot: "bg-emerald-500",
    };
  }

  if (text.includes("desconsider")) {
    return {
      row: "border-amber-100 bg-amber-50",
      label: "text-amber-900",
      value: "bg-amber-500 text-white",
      dot: "bg-amber-500",
    };
  }

  if (
    text.includes("atraso") ||
    text.includes("vencidas") ||
    text.includes("sem juros")
  ) {
    return {
      row: "border-red-100 bg-red-50",
      label: "text-red-900",
      value: "bg-red-600 text-white",
      dot: "bg-red-500",
    };
  }

  return {
    row: "border-slate-200 bg-slate-50",
    label: "text-slate-700",
    value: "bg-white text-slate-900 ring-1 ring-inset ring-slate-200",
    dot: "bg-slate-400",
  };
}

function PainelDetalhes({
  detalhes,
  painelId,
}: {
  detalhes: PilarDetalhes;
  painelId: string;
}) {
  return (
    <div
      id={painelId}
      role="tooltip"
      className="absolute bottom-full left-1/2 z-30 mb-3 w-[min(25rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-xl ring-1 ring-black/5"
    >
      <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700">
          Resumo do indicador
        </p>
        <p className="mt-1 text-sm font-bold leading-snug text-slate-950 sm:text-base">
          {detalhes.resumo}
        </p>
      </div>

      <dl className="mt-3 space-y-1.5">
        {detalhes.itens.map((item) => {
          const itemStyle = getDetalheItemStyle(item.rotulo);

          return (
            <div
              key={item.rotulo}
              className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${itemStyle.row}`}
            >
              <dt
                className={`flex min-w-0 items-center gap-2 font-medium leading-snug ${itemStyle.label}`}
              >
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${itemStyle.dot}`}
                  aria-hidden="true"
                />
                <span>{item.rotulo}</span>
              </dt>
              <dd
                className={`shrink-0 rounded-full px-2.5 py-1 text-right text-sm font-bold tabular-nums ${itemStyle.value}`}
              >
                {item.valor}
              </dd>
            </div>
          );
        })}
      </dl>
      <span
        className="absolute left-1/2 top-full h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-slate-200 bg-white"
        aria-hidden="true"
      />
    </div>
  );
}

function GaugeCard({
  titulo,
  descricao,
  score,
  faixa,
  rotulo,
  emoji,
  detalhes,
  cardId,
  destaque = false,
}: {
  titulo: string;
  descricao: string;
  score: number;
  faixa: FaixaSaude;
  rotulo: string;
  emoji: string;
  detalhes: PilarDetalhes;
  cardId: string;
  destaque?: boolean;
}) {
  const styles = FAIXA_STYLES[faixa];
  const popupId = `saude-${cardId}`;
  const painelId = `${popupId}-painel`;
  const [popupAberto, setPopupAberto] = useState(false);

  return (
    <div
      className={`flex min-w-0 flex-1 flex-col items-center rounded-xl border px-4 py-5 text-center sm:px-5 ${
        destaque
          ? `${styles.bg} ${styles.border} shadow-sm ring-1 ring-inset ring-black/5`
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="mb-2 min-h-[5rem] w-full space-y-1.5">
        <p
          className={`text-sm font-bold leading-tight sm:text-base ${
            destaque ? styles.text : "text-slate-800"
          }`}
        >
          {titulo}
        </p>
        <p
          className={`text-sm leading-snug sm:text-[15px] ${
            destaque ? `${styles.text} opacity-90` : "text-slate-500"
          }`}
        >
          {descricao}
        </p>
      </div>

      <div
        className="relative flex w-full flex-col items-center"
        onMouseEnter={() => setPopupAberto(true)}
        onMouseLeave={() => setPopupAberto(false)}
      >
        {popupAberto && (
          <PainelDetalhes detalhes={detalhes} painelId={painelId} />
        )}

        <GaugeArc score={score} faixa={faixa} size={destaque ? "lg" : "sm"} />

        <p
          className={`-mt-2 text-3xl font-bold tabular-nums sm:text-4xl ${styles.text}`}
        >
          {score}%
        </p>
        <div className={`mt-1.5 flex items-center justify-center gap-2.5 ${styles.text}`}>
          <span className="text-base font-semibold sm:text-lg">{rotulo}</span>
          <span
            className="text-3xl leading-none sm:text-4xl"
            role="img"
            aria-label={rotulo}
          >
            {emoji}
          </span>
        </div>

        <button
          type="button"
          id={popupId}
          aria-expanded={popupAberto}
          aria-controls={painelId}
          onClick={() => setPopupAberto((prev) => !prev)}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          Ver números
        </button>
      </div>
    </div>
  );
}

export default function SaudeClienteGauges({
  saude,
  exportId,
  variant = "cliente",
}: Props) {
  const config = VARIANT_CONFIG[variant];

  return (
    <section
      id={exportId}
      aria-label={config.ariaLabel}
      className="w-full min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 sm:text-lg">
            {config.titulo}
          </h2>
          <p className="text-sm text-slate-500">{config.subtitulo}</p>
        </div>
      </div>

      <div
        data-saude-grid
        className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${
          variant === "empresa" ? "lg:grid-cols-4" : "lg:grid-cols-5"
        }`}
      >
        {saude.pilares.map((pilar) => (
          <GaugeCard
            key={pilar.id}
            cardId={pilar.id}
            titulo={pilar.legenda}
            descricao={pilar.descricao}
            score={pilar.score}
            faixa={pilar.faixa.faixa}
            rotulo={pilar.faixa.rotulo}
            emoji={pilar.faixa.emoji}
            detalhes={pilar.detalhes}
          />
        ))}

        <GaugeCard
          cardId="media-geral"
          titulo="Média geral"
          descricao={config.descricaoMediaGeral}
          score={saude.mediaGeral}
          faixa={saude.faixaGeral.faixa}
          rotulo={saude.faixaGeral.rotulo}
          emoji={saude.faixaGeral.emoji}
          detalhes={saude.detalhesMediaGeral}
          destaque
        />
      </div>
    </section>
  );
}
