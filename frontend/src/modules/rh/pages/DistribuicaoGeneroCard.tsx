import { useId } from "react";

type GeneroContagem = {
  masculino: number;
  feminino: number;
  naoInformado: number;
};

export type GeneroFiltro = "masculino" | "feminino" | null;

const VB = 200;
const CX = 100;
const RAIO_EXTERNO = 76;
const RAIO_INTERNO = 51;
const RAIO_CANTO = 4;
const GAP = 5;
const SEGMENTO = (360 - GAP * 4) / 4;
const TRILHO = "#D1D9E4";

const TEMAS = {
  masculino: {
    rotulo: "Homens",
    numero: "#14B8A6",
    de: "#5EEAD4",
    meio: "#2DD4BF",
    ate: "#3B82F6",
  },
  feminino: {
    rotulo: "Mulheres",
    numero: "#F43F7A",
    de: "#FDA4AF",
    meio: "#FB7185",
    ate: "#EC4899",
  },
} as const;

function percentuais(contagem: GeneroContagem) {
  const total = contagem.masculino + contagem.feminino + contagem.naoInformado;
  if (total <= 0) return { total, masculino: 0, feminino: 0, naoInformado: 0 };
  const feminino = Math.round((contagem.feminino / total) * 100);
  const naoInformado = contagem.naoInformado > 0 ? Math.round((contagem.naoInformado / total) * 100) : 0;
  const masculino = Math.max(0, 100 - feminino - naoInformado);
  return { total, masculino, feminino, naoInformado };
}

function segmentos(percentual: number) {
  let restante = (Math.min(100, Math.max(0, percentual)) / 100) * (SEGMENTO * 4);
  const fatias: { inicio: number; fim: number; preenchido: number }[] = [];
  for (let i = 0; i < 4; i += 1) {
    const inicio = i * (SEGMENTO + GAP) + GAP / 2;
    const preenchido = Math.min(SEGMENTO, Math.max(0, restante));
    fatias.push({ inicio, fim: inicio + SEGMENTO, preenchido });
    restante -= preenchido;
  }
  return fatias;
}

function pontoPolar(raio: number, angulo: number) {
  const rad = (angulo * Math.PI) / 180;
  return {
    x: CX + raio * Math.sin(rad),
    y: CX - raio * Math.cos(rad),
  };
}

function arcoAnular(inicio: number, fim: number) {
  const externoInicio = pontoPolar(RAIO_EXTERNO, inicio);
  const externoFim = pontoPolar(RAIO_EXTERNO, fim);
  const internoFim = pontoPolar(RAIO_INTERNO, fim);
  const internoInicio = pontoPolar(RAIO_INTERNO, inicio);
  const grande = fim - inicio > 180 ? 1 : 0;
  return [
    `M ${externoInicio.x} ${externoInicio.y}`,
    `A ${RAIO_EXTERNO} ${RAIO_EXTERNO} 0 ${grande} 1 ${externoFim.x} ${externoFim.y}`,
    `L ${internoFim.x} ${internoFim.y}`,
    `A ${RAIO_INTERNO} ${RAIO_INTERNO} 0 ${grande} 0 ${internoInicio.x} ${internoInicio.y}`,
    "Z",
  ].join(" ");
}

function arcoAnularArredondado(inicio: number, fim: number) {
  const ajusteExterno = (RAIO_CANTO / RAIO_EXTERNO) * (180 / Math.PI);
  const ajusteInterno = (RAIO_CANTO / RAIO_INTERNO) * (180 / Math.PI);
  const externoInicio = pontoPolar(RAIO_EXTERNO, inicio + ajusteExterno);
  const externoFim = pontoPolar(RAIO_EXTERNO, fim - ajusteExterno);
  const cantoExternoFim = pontoPolar(RAIO_EXTERNO, fim);
  const lateralExternaFim = pontoPolar(RAIO_EXTERNO - RAIO_CANTO, fim);
  const lateralInternaFim = pontoPolar(RAIO_INTERNO + RAIO_CANTO, fim);
  const cantoInternoFim = pontoPolar(RAIO_INTERNO, fim);
  const internoFim = pontoPolar(RAIO_INTERNO, fim - ajusteInterno);
  const internoInicio = pontoPolar(RAIO_INTERNO, inicio + ajusteInterno);
  const cantoInternoInicio = pontoPolar(RAIO_INTERNO, inicio);
  const lateralInternaInicio = pontoPolar(RAIO_INTERNO + RAIO_CANTO, inicio);
  const lateralExternaInicio = pontoPolar(RAIO_EXTERNO - RAIO_CANTO, inicio);
  const cantoExternoInicio = pontoPolar(RAIO_EXTERNO, inicio);
  return [
    `M ${externoInicio.x} ${externoInicio.y}`,
    `A ${RAIO_EXTERNO} ${RAIO_EXTERNO} 0 0 1 ${externoFim.x} ${externoFim.y}`,
    `Q ${cantoExternoFim.x} ${cantoExternoFim.y} ${lateralExternaFim.x} ${lateralExternaFim.y}`,
    `L ${lateralInternaFim.x} ${lateralInternaFim.y}`,
    `Q ${cantoInternoFim.x} ${cantoInternoFim.y} ${internoFim.x} ${internoFim.y}`,
    `A ${RAIO_INTERNO} ${RAIO_INTERNO} 0 0 0 ${internoInicio.x} ${internoInicio.y}`,
    `Q ${cantoInternoInicio.x} ${cantoInternoInicio.y} ${lateralInternaInicio.x} ${lateralInternaInicio.y}`,
    `L ${lateralExternaInicio.x} ${lateralExternaInicio.y}`,
    `Q ${cantoExternoInicio.x} ${cantoExternoInicio.y} ${externoInicio.x} ${externoInicio.y}`,
    "Z",
  ].join(" ");
}

function Figura({ variante, gradId }: { variante: "masculino" | "feminino"; gradId: string }) {
  const fill = `url(#${gradId})`;
  if (variante === "masculino") {
    return (
      <g fill={fill}>
        <circle cx={CX} cy={79} r={8} />
        <path d="M93 90h14c4.4 0 7.6 3.8 7.1 8.2l-2.2 18.6c-.2 2-1.9 3.5-3.9 3.5h-16c-2 0-3.7-1.5-3.9-3.5l-2.2-18.6C85.4 93.8 88.6 90 93 90z" />
        <path d="M91.5 117.5h7.3v13.2c0 2.1-1.7 3.8-3.8 3.8s-3.8-1.7-3.8-3.8z" />
        <path d="M101.2 117.5h7.3l.3 13.2c0 2.1-1.7 3.8-3.8 3.8s-3.8-1.7-3.8-3.8z" />
      </g>
    );
  }
  return (
    <g fill={fill}>
      <circle cx={CX} cy={78.5} r={7.8} />
      <path d="M95.2 89.5h9.6c3.4 0 5.8 3.1 5.1 6.4l-2.8 13.3H92.9l-2.8-13.3c-.7-3.3 1.7-6.4 5.1-6.4z" />
      <path d="M91.9 105.5h16.2l8.5 20.7c.6 1.5-.5 3.1-2.1 3.1h-29c-1.6 0-2.7-1.6-2.1-3.1z" />
      <path d="M96.2 126.5h7.6v4.4c0 2.1-1.7 3.8-3.8 3.8s-3.8-1.7-3.8-3.8z" />
    </g>
  );
}

function Medidor({
  variante,
  percentual,
  quantidade,
  selecionado,
  esmaecido,
  onClick,
}: {
  variante: "masculino" | "feminino";
  percentual: number;
  quantidade: number;
  selecionado: boolean;
  esmaecido: boolean;
  onClick: () => void;
}) {
  const uid = useId().replace(/:/g, "");
  const tema = TEMAS[variante];
  const fatias = segmentos(percentual);

  return (
    <button
      type="button"
      aria-label={`${selecionado ? "Remover filtro" : "Filtrar o painel"} por ${tema.rotulo.toLowerCase()}`}
      aria-pressed={selecionado}
      onClick={onClick}
      className={`flex min-w-0 flex-1 flex-col items-center rounded-xl px-1 pb-3 pt-1 outline-none transition duration-200 hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
        esmaecido ? "opacity-45 grayscale-[35%]" : "opacity-100"
      }`}
      style={selecionado ? { boxShadow: `inset 0 0 0 2px ${tema.numero}` } : undefined}
    >
      <svg viewBox={`0 0 ${VB} ${VB}`} className="h-auto w-full max-w-[224px]" role="img" aria-hidden>
        <defs>
          <linearGradient id={`anel-${uid}`} x1="40" y1="28" x2="168" y2="176" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={tema.de} />
            <stop offset="48%" stopColor={tema.meio} />
            <stop offset="100%" stopColor={tema.ate} />
          </linearGradient>
          <linearGradient id={`icone-${uid}`} x1="86" y1="78" x2="118" y2="128" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={tema.de} />
            <stop offset="100%" stopColor={tema.ate} />
          </linearGradient>
          <radialGradient id={`miolo-${uid}`} cx="46%" cy="38%" r="68%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="72%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#e8eef3" />
          </radialGradient>
          <filter id={`sombra-${uid}`} x="-30%" y="-30%" width="160%" height="170%">
            <feDropShadow dx="0" dy="9" stdDeviation="7" floodColor="#0f172a" floodOpacity="0.32" />
          </filter>
          {fatias.map((fatia, index) => (
            <clipPath key={index} id={`fatia-${uid}-${index}`}>
              <path d={arcoAnularArredondado(fatia.inicio, fatia.fim)} />
            </clipPath>
          ))}
        </defs>

        {fatias.map((fatia, index) => {
          const completa = fatia.preenchido >= SEGMENTO - 0.01;
          return (
            <g key={index}>
              <path d={arcoAnularArredondado(fatia.inicio, fatia.fim)} fill={TRILHO} />
              {fatia.preenchido > 0.01 ? (
                completa ? (
                  <path d={arcoAnularArredondado(fatia.inicio, fatia.fim)} fill={`url(#anel-${uid})`} />
                ) : (
                  <path
                    d={arcoAnular(fatia.inicio - 0.1, fatia.inicio + fatia.preenchido)}
                    fill={`url(#anel-${uid})`}
                    clipPath={`url(#fatia-${uid}-${index})`}
                  />
                )
              ) : null}
            </g>
          );
        })}

        <circle cx={CX} cy={CX} r={51} fill="#ffffff" filter={`url(#sombra-${uid})`} />
        <circle cx={CX} cy={CX} r={45.5} fill={`url(#miolo-${uid})`} stroke="#dce5eb" strokeWidth="1.5" />
        <Figura variante={variante} gradId={`icone-${uid}`} />
      </svg>

      <p className="mt-1 text-center">
        <span className="text-[22px] font-bold tabular-nums leading-none" style={{ color: tema.numero }}>
          {percentual.toLocaleString("pt-BR")}%
        </span>
        <span className="ml-2 text-sm font-semibold text-slate-400">{tema.rotulo}</span>
      </p>
      <p className="mt-1.5 text-center text-xs leading-relaxed text-muted-foreground">
        {quantidade.toLocaleString("pt-BR")} {quantidade === 1 ? "pessoa" : "pessoas"}
      </p>
      <span className="mt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {selecionado ? "Filtro ativo · clique para remover" : "Clique para filtrar"}
      </span>
    </button>
  );
}

export function DistribuicaoGeneroCard({
  contagem,
  referencia,
  filtro,
  onFiltroChange,
}: {
  contagem: GeneroContagem;
  referencia: string;
  filtro: GeneroFiltro;
  onFiltroChange: (filtro: GeneroFiltro) => void;
}) {
  const pct = percentuais(contagem);

  return (
    <div className="w-full border border-border bg-card p-6 shadow-level-1">
      <div className="flex items-start justify-between gap-3">
        <span className="label-industrial">Distribuição por gênero</span>
        <span className="shrink-0 text-[11px] text-muted-foreground">{referencia}</span>
      </div>

      {pct.total <= 0 ? (
        <p className="mt-4 border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          Sem colaboradores ativos para esta empresa.
        </p>
      ) : (
        <>
          <div className="mt-5 flex items-start justify-center gap-2">
            <Medidor
              variante="masculino"
              percentual={pct.masculino}
              quantidade={contagem.masculino}
              selecionado={filtro === "masculino"}
              esmaecido={filtro === "feminino"}
              onClick={() => onFiltroChange(filtro === "masculino" ? null : "masculino")}
            />
            <Medidor
              variante="feminino"
              percentual={pct.feminino}
              quantidade={contagem.feminino}
              selecionado={filtro === "feminino"}
              esmaecido={filtro === "masculino"}
              onClick={() => onFiltroChange(filtro === "feminino" ? null : "feminino")}
            />
          </div>
          {contagem.naoInformado > 0 ? (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {contagem.naoInformado.toLocaleString("pt-BR")} sem sexo informado ({pct.naoInformado}%)
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
