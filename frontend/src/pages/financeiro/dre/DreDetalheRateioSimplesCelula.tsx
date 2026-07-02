import {
  DFC_ID_EMPRESA_REFRIGERACAO,
  DFC_ID_EMPRESA_RN_MARQUES,
} from '../dfc/dfcEmpresas';
import {
  montarTooltipRateioSimples,
  nfPctRateioSimples,
  nfRateioSimples,
  valorSimplesGradePorEmpresas,
  type DreSimplesRateioPeriodo,
} from './dreSimplesNacionalRateio';

type Props = {
  ctx: DreSimplesRateioPeriodo;
  valorOriginal: number;
  refrigeracao: number;
  rnMarques: number;
  idEmpresas: number[];
  rotuloPeriodo?: string;
};

export default function DreDetalheRateioSimplesCelula({
  ctx,
  valorOriginal,
  refrigeracao,
  rnMarques,
  idEmpresas,
  rotuloPeriodo,
}: Props) {
  const exibido = valorSimplesGradePorEmpresas(valorOriginal, refrigeracao, rnMarques, idEmpresas);
  const temRef = idEmpresas.includes(DFC_ID_EMPRESA_REFRIGERACAO);
  const temRn = idEmpresas.includes(DFC_ID_EMPRESA_RN_MARQUES);
  const tooltip = montarTooltipRateioSimples({
    ctx,
    valorOriginal,
    refrigeracao,
    rnMarques,
    rotuloPeriodo,
    idEmpresas,
  });

  return (
    <div className="flex items-start gap-1 min-w-0">
      <div className="relative shrink-0 group/rateio">
        <button
          type="button"
          tabIndex={0}
          className="mt-0.5 flex h-5 w-5 items-center justify-center rounded text-violet-600 hover:bg-violet-100 dark:text-violet-300 dark:hover:bg-violet-900/40"
          aria-label="Ver detalhe do rateio Simples Nacional"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="7" cy="7" r="2.5" />
            <circle cx="17" cy="17" r="2.5" />
            <path d="M9 9l6 6" />
          </svg>
        </button>
        <div
          role="tooltip"
          className="pointer-events-none invisible group-hover/rateio:visible group-focus-within/rateio:visible absolute bottom-full left-0 z-[10060] mb-1.5 w-max max-w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[11px] leading-snug text-slate-700 shadow-lg dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
        >
          <p className="whitespace-pre-line">{tooltip}</p>
        </div>
      </div>
      <div className="min-w-0 flex-1 tabular-nums text-[11px] leading-tight text-slate-700 dark:text-slate-300">
        {temRef && temRn ? (
          <>
            <span className="block truncate">
              <span className="text-slate-500 dark:text-slate-400">Ref </span>
              {nfRateioSimples.format(refrigeracao)}
            </span>
            <span className="block truncate">
              <span className="text-slate-500 dark:text-slate-400">RN </span>
              {nfRateioSimples.format(rnMarques)}
            </span>
          </>
        ) : temRef ? (
          <span className="block truncate font-medium">
            {nfRateioSimples.format(exibido)}
            <span className="font-normal text-slate-400 dark:text-slate-500">
              {' '}
              ({nfPctRateioSimples.format(ctx.pctRefrigeracao)})
            </span>
          </span>
        ) : temRn ? (
          <span className="block truncate font-medium">
            {nfRateioSimples.format(exibido)}
            <span className="font-normal text-slate-400 dark:text-slate-500">
              {' '}
              ({nfPctRateioSimples.format(ctx.pctRnMarques)})
            </span>
          </span>
        ) : (
          <span className="block truncate text-slate-400 dark:text-slate-500">—</span>
        )}
      </div>
    </div>
  );
}
