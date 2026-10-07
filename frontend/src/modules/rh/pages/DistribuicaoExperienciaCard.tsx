import { useId } from "react";

export type RetencaoExperienciaResumo = {
  retidos: number;
  desligadosNaExperiencia: number;
  emAvaliacao: number;
  aprendizesExcluidos: number;
};

const COR_RETIDOS = "#7B88FF";
const COR_DESLIGADOS = "#FFAD00";
const RAIO = 56;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

function ItemLegenda({
  titulo,
  percentual,
  quantidade,
  detalhe,
  cor,
}: {
  titulo: string;
  percentual: number;
  quantidade: number;
  detalhe: string;
  cor: string;
}) {
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-baseline gap-2">
        <strong className="text-[22px] font-semibold tabular-nums leading-none" style={{ color: cor }}>
          {percentual.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
        </strong>
        <span className="text-sm font-medium text-muted-foreground">{titulo}</span>
      </p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
        {quantidade.toLocaleString("pt-BR")} {quantidade === 1 ? "colaborador" : "colaboradores"}
      </p>
      <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground/75">{detalhe}</p>
    </div>
  );
}

export function DistribuicaoExperienciaCard({
  resumo,
  referencia,
  prazoDias = 90,
  onOpen,
}: {
  resumo: RetencaoExperienciaResumo;
  referencia: string;
  prazoDias?: number;
  onOpen: () => void;
}) {
  const uid = useId().replace(/:/g, "");
  const totalConclusivo = resumo.retidos + resumo.desligadosNaExperiencia;
  const retidosPct = totalConclusivo > 0 ? (resumo.retidos / totalConclusivo) * 100 : 0;
  const desligadosPct = totalConclusivo > 0 ? 100 - retidosPct : 0;
  const retidosTraco = (retidosPct / 100) * CIRCUNFERENCIA;
  const desligadosTraco = (desligadosPct / 100) * CIRCUNFERENCIA;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-full w-full flex-col border border-border bg-card p-5 text-left shadow-level-1 transition-colors hover:border-primary/45 hover:bg-muted/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Abrir evolução da retenção pós-experiência"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="label-industrial">Retenção pós-experiência</span>
        <span className="shrink-0 text-[11px] text-muted-foreground">{referencia}</span>
      </div>

      {resumo.retidos + resumo.desligadosNaExperiencia + resumo.emAvaliacao <= 0 ? (
        <p className="mt-4 border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          Nenhuma admissão neste período. Recue a data inicial para incluir admissões mais antigas.
        </p>
      ) : totalConclusivo <= 0 ? (
        <p className="mt-4 border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          Ainda não há coortes com resultado conclusivo.
        </p>
      ) : (
        <div className="mt-4 flex flex-1 items-center justify-center gap-8">
          <svg viewBox="0 0 150 150" className="aspect-square w-[200px] shrink-0" role="img" aria-label={`${retidosPct.toFixed(1)}% retidos após a experiência e ${desligadosPct.toFixed(1)}% desligados durante a experiência`}>
            <defs>
              <linearGradient id={`desligados-${uid}`} x1="24" y1="16" x2="128" y2="136" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFD56A" />
                <stop offset="100%" stopColor="#F59E0B" />
              </linearGradient>
              <linearGradient id={`retidos-${uid}`} x1="125" y1="18" x2="25" y2="136" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#A5B4FC" />
                <stop offset="100%" stopColor="#4F46E5" />
              </linearGradient>
              <radialGradient id={`miolo-${uid}`} cx="45%" cy="38%" r="70%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#e8eef5" />
              </radialGradient>
              <filter id={`sombra-${uid}`} x="-30%" y="-30%" width="160%" height="170%">
                <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#0f172a" floodOpacity="0.22" />
              </filter>
            </defs>

            <circle cx="75" cy="75" r={RAIO} fill="none" stroke="currentColor" strokeWidth="19" className="text-foreground/10" />
            {desligadosPct > 0 ? (
              <circle
                cx="75"
                cy="75"
                r={RAIO}
                fill="none"
                stroke={`url(#desligados-${uid})`}
                strokeWidth="19"
                strokeDasharray={`${desligadosTraco} ${CIRCUNFERENCIA}`}
                transform="rotate(-90 75 75)"
              />
            ) : null}
            {retidosPct > 0 ? (
              <circle
                cx="75"
                cy="75"
                r={RAIO}
                fill="none"
                stroke={`url(#retidos-${uid})`}
                strokeWidth="19"
                strokeDasharray={`${retidosTraco} ${CIRCUNFERENCIA}`}
                transform={`rotate(${desligadosPct * 3.6 - 90} 75 75)`}
              />
            ) : null}

            <circle cx="75" cy="75" r="46" fill="#ffffff" filter={`url(#sombra-${uid})`} />
            <circle cx="75" cy="75" r="40.5" fill={`url(#miolo-${uid})`} stroke="#d9e2ea" strokeWidth="1.5" />

            <g fill={COR_RETIDOS}>
              <circle cx="65" cy="63" r="5" />
              <path d="M58.5 71.5c.5-3.7 3-5.8 6.5-5.8s6 2.1 6.5 5.8l.7 11H57.8z" />
              <rect x="59.5" y="80" width="4.8" height="13" rx="2.3" />
              <rect x="65.8" y="80" width="4.8" height="13" rx="2.3" />
            </g>
            <g fill={COR_DESLIGADOS}>
              <circle cx="86" cy="63" r="5" />
              <path d="M79.5 71.5c.5-3.7 3-5.8 6.5-5.8s6 2.1 6.5 5.8l.7 11H78.8z" />
              <rect x="80.5" y="80" width="4.8" height="13" rx="2.3" />
              <rect x="86.8" y="80" width="4.8" height="13" rx="2.3" />
            </g>
          </svg>

          <div className="max-w-[240px] space-y-5">
            <ItemLegenda
              titulo="Retidos"
              percentual={retidosPct}
              quantidade={resumo.retidos}
              detalhe={`Permaneceram após o ${prazoDias}º dia.`}
              cor={COR_RETIDOS}
            />
            <ItemLegenda
              titulo="Desligados"
              percentual={desligadosPct}
              quantidade={resumo.desligadosNaExperiencia}
              detalhe={`Desligados até o ${prazoDias}º dia.`}
              cor={COR_DESLIGADOS}
            />
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3 text-[10px] text-muted-foreground">
        <span>
          {resumo.emAvaliacao.toLocaleString("pt-BR")} ainda em avaliação até o {prazoDias}º dia
        </span>
        <span className="font-medium text-primary">Ver evolução</span>
      </div>
    </button>
  );
}
