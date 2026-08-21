import type { RfvSegmentoAgg } from '../../api/rfvClientes';
import { formatMoeda, formatNumero } from './painelComercialUtils';
import { RFV_MATRIZ_LAYOUT, centroCelulas, clipPathCelulas } from './rfvMatrizLayout';
import { isSegmentoSelecionado, type RfvSelecao } from './rfvSelecao';

const EIXO_TICKS = [1, 2, 3, 4, 5] as const;

export default function RfvTreemapMatrix({
  segmentos,
  selecao,
  loading,
  onSelectSegmento,
}: {
  segmentos: RfvSegmentoAgg[];
  selecao: RfvSelecao;
  loading?: boolean;
  onSelectSegmento: (segmentoId: string) => void;
}) {
  if (loading) {
    return (
      <div className="card-panel flex min-h-[480px] animate-pulse p-4 lg:min-h-[560px]">
        <div className="h-full w-full rounded bg-slate-200 dark:bg-slate-700" />
      </div>
    );
  }

  const segMap = new Map(segmentos.map((s) => [s.id, s]));
  const temSelecaoSegmento = selecao?.tipo === 'segmento';

  return (
    <div className="card-panel flex h-full min-h-[480px] w-full flex-1 flex-col p-3 lg:min-h-[540px] lg:p-4">
      <h3 className="mb-2 shrink-0 text-center text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-slate-200">
        Análise RFV
      </h3>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="relative mx-auto h-full w-full min-h-[380px] flex-1 lg:min-h-[460px]">
          {/* Rótulo eixo Y */}
          <div
            className="pointer-events-none absolute bottom-12 left-0 top-2 z-10 flex w-6 items-center justify-center text-[9px] font-semibold leading-tight text-slate-600 dark:text-slate-400 lg:text-[10px]"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Frequência + Monetariedade (Média) ↑
          </div>

          {/* Marcadores eixo Y */}
          <div className="pointer-events-none absolute bottom-12 left-6 top-2 flex w-4 flex-col justify-between lg:left-7">
            {[5, 4, 3, 2, 1].map((n) => (
              <span key={n} className="text-center text-[10px] font-medium text-slate-600 dark:text-slate-400 lg:text-xs">
                {n}
              </span>
            ))}
          </div>

          {/* Grade + blocos */}
          <div className="absolute bottom-10 left-10 right-1 top-2 lg:bottom-11 lg:left-11 lg:right-2">
            <div className="absolute inset-0 rounded-sm bg-slate-200/70 dark:bg-slate-700/50" aria-hidden />

            {/* Blocos unificados — clip-path sobre a grade inteira */}
            <div className="absolute inset-0">
              {RFV_MATRIZ_LAYOUT.filter((def) => def.celulas.length > 0)
                .sort((a, b) => a.ordem - b.ordem)
                .map((def) => {
                  const agg = segMap.get(def.id);
                  const clientes = agg?.clientes ?? 0;
                  const ativo = isSegmentoSelecionado(selecao, def.id);
                  const dimmed = temSelecaoSegmento && !ativo;
                  const clip = clipPathCelulas(def.celulas);
                  const { x, y } = centroCelulas(def.celulas);

                  return (
                    <button
                      key={def.id}
                      type="button"
                      style={{
                        clipPath: clip,
                        WebkitClipPath: clip,
                        backgroundColor: def.cor,
                      }}
                      title={
                        agg
                          ? `${def.label}: ${formatNumero(clientes)} clientes · ${formatMoeda(agg.valor, true)}`
                          : def.label
                      }
                      onClick={() => onSelectSegmento(def.id)}
                      aria-pressed={ativo}
                      className={`absolute inset-0 border-0 shadow-sm transition hover:brightness-105 ${
                        dimmed ? 'opacity-40' : ''
                      } ${ativo ? 'z-20 ring-2 ring-inset ring-amber-400' : 'z-10'}`}
                    >
                      <span
                        className="pointer-events-none absolute flex flex-col items-center justify-center text-center"
                        style={{
                          left: `${x}%`,
                          top: `${y}%`,
                          transform: 'translate(-50%, -50%)',
                          color: def.textCor,
                          maxWidth: '42%',
                        }}
                      >
                        <span className="text-lg font-bold leading-none lg:text-2xl">{formatNumero(clientes)}</span>
                        <span className="mt-1 text-[10px] font-semibold leading-tight lg:text-xs">{def.label}</span>
                        {agg && clientes > 0 && (
                          <span className="mt-0.5 text-[9px] opacity-90 lg:text-[10px]">{agg.pctClientes.toFixed(0)}%</span>
                        )}
                      </span>
                    </button>
                  );
                })}
            </div>

            {/* Linhas da grade */}
            <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
              {[1, 2, 3, 4].map((i) => {
                const p = i * 20;
                return (
                  <g key={i} className="stroke-slate-400/30 dark:stroke-slate-500/35">
                    <line x1={`${p}%`} y1="0" x2={`${p}%`} y2="100%" strokeWidth="1" />
                    <line x1="0" y1={`${p}%`} x2="100%" y2={`${p}%`} strokeWidth="1" />
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="absolute bottom-6 left-10 right-1 flex justify-between lg:bottom-7 lg:left-11 lg:right-2">
            {EIXO_TICKS.map((n) => (
              <span key={n} className="flex-1 text-center text-[10px] font-medium text-slate-600 dark:text-slate-400 lg:text-xs">
                {n}
              </span>
            ))}
          </div>

          <div className="absolute bottom-0 left-10 right-1 flex items-center justify-center text-[9px] font-semibold text-slate-600 dark:text-slate-400 lg:text-[10px]">
            Recência →
          </div>
        </div>
      </div>

      <p className="mt-2 shrink-0 text-center text-[10px] text-slate-500 dark:text-slate-400">
        Clique em um segmento, linha da tabela ou barra R/F/V para filtrar a tabela de clientes.
      </p>
    </div>
  );
}
