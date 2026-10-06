import { useId } from "react";

type ExperienciaContagem = {
  experiencia: number;
  fixos: number;
};

const COR_EXPERIENCIA = "#F59E0B";
const COR_FIXOS = "#4F7CFF";
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
        {quantidade.toLocaleString("pt-BR")} {quantidade === 1 ? "colaborador ativo" : "colaboradores ativos"}
      </p>
      <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground/75">{detalhe}</p>
    </div>
  );
}

export function DistribuicaoExperienciaCard({
  contagem,
  referencia,
}: {
  contagem: ExperienciaContagem;
  referencia: string;
}) {
  const uid = useId().replace(/:/g, "");
  const total = contagem.experiencia + contagem.fixos;
  const experienciaPct = total > 0 ? (contagem.experiencia / total) * 100 : 0;
  const fixosPct = total > 0 ? 100 - experienciaPct : 0;
  const experienciaTraco = (experienciaPct / 100) * CIRCUNFERENCIA;
  const fixosTraco = (fixosPct / 100) * CIRCUNFERENCIA;

  return (
    <div className="w-full border border-border bg-card p-5 shadow-level-1">
      <div className="flex items-start justify-between gap-3">
        <span className="label-industrial">Experiência x quadro fixo</span>
        <span className="shrink-0 text-[11px] text-muted-foreground">{referencia}</span>
      </div>

      {total <= 0 ? (
        <p className="mt-4 border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          Sem colaboradores ativos para esta empresa.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-[168px_minmax(0,1fr)] items-center gap-4">
          <svg viewBox="0 0 150 150" className="h-[168px] w-[168px]" role="img" aria-label={`${experienciaPct.toFixed(1)}% em experiência e ${fixosPct.toFixed(1)}% fixos`}>
            <defs>
              <linearGradient id={`experiencia-${uid}`} x1="24" y1="16" x2="128" y2="136" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FBBF24" />
                <stop offset="100%" stopColor="#F97316" />
              </linearGradient>
              <linearGradient id={`fixos-${uid}`} x1="125" y1="18" x2="25" y2="136" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#60A5FA" />
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
            {experienciaPct > 0 ? (
              <circle
                cx="75"
                cy="75"
                r={RAIO}
                fill="none"
                stroke={`url(#experiencia-${uid})`}
                strokeWidth="19"
                strokeDasharray={`${experienciaTraco} ${CIRCUNFERENCIA}`}
                transform="rotate(-90 75 75)"
              />
            ) : null}
            {fixosPct > 0 ? (
              <circle
                cx="75"
                cy="75"
                r={RAIO}
                fill="none"
                stroke={`url(#fixos-${uid})`}
                strokeWidth="19"
                strokeDasharray={`${fixosTraco} ${CIRCUNFERENCIA}`}
                transform={`rotate(${experienciaPct * 3.6 - 90} 75 75)`}
              />
            ) : null}

            <circle cx="75" cy="75" r="46" fill="#ffffff" filter={`url(#sombra-${uid})`} />
            <circle cx="75" cy="75" r="40.5" fill={`url(#miolo-${uid})`} stroke="#d9e2ea" strokeWidth="1.5" />

            <g fill={COR_FIXOS}>
              <circle cx="65" cy="63" r="5" />
              <path d="M58.5 71.5c.5-3.7 3-5.8 6.5-5.8s6 2.1 6.5 5.8l.7 11H57.8z" />
              <rect x="59.5" y="80" width="4.8" height="13" rx="2.3" />
              <rect x="65.8" y="80" width="4.8" height="13" rx="2.3" />
            </g>
            <g fill={COR_EXPERIENCIA}>
              <circle cx="86" cy="63" r="5" />
              <path d="M79.5 71.5c.5-3.7 3-5.8 6.5-5.8s6 2.1 6.5 5.8l.7 11H78.8z" />
              <rect x="80.5" y="80" width="4.8" height="13" rx="2.3" />
              <rect x="86.8" y="80" width="4.8" height="13" rx="2.3" />
            </g>
          </svg>

          <div className="space-y-5">
            <ItemLegenda
              titulo="Fixos"
              percentual={fixosPct}
              quantidade={contagem.fixos}
              detalhe="Demais colaboradores ativos."
              cor={COR_FIXOS}
            />
            <ItemLegenda
              titulo="Em experiência"
              percentual={experienciaPct}
              quantidade={contagem.experiencia}
              detalhe="Até 90 dias de admissão ou aprendiz."
              cor={COR_EXPERIENCIA}
            />
          </div>
        </div>
      )}
    </div>
  );
}
