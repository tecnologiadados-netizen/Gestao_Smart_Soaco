/**
 * Toggle tri-estado para “Previsão confiável”:
 * - null = meio (não escolhido) — estado inicial ao abrir formulários
 * - false = Não (provisória; não entra no histórico da Comunicação Interna)
 * - true = Sim
 */
export type PrevisaoConfiavelTri = boolean | null;

type Props = {
  value: PrevisaoConfiavelTri;
  onChange: (v: PrevisaoConfiavelTri) => void;
  disabled?: boolean;
  /** Layout compacto (células de grade). */
  compact?: boolean;
  /** Exibe o texto de ajuda abaixo do controle. */
  showHelp?: boolean;
  id?: string;
  className?: string;
};

const BTN =
  'flex-1 px-2 py-1.5 text-center text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-800 disabled:cursor-not-allowed disabled:opacity-50';

export default function TogglePrevisaoConfiavel({
  value,
  onChange,
  disabled = false,
  compact = false,
  showHelp = true,
  id,
  className = '',
}: Props) {
  const pad = compact ? 'px-1.5 py-1 text-[11px]' : 'px-2 py-1.5 text-xs';

  return (
    <div className={className}>
      <div
        id={id}
        role="group"
        aria-label="Previsão confiável"
        className={`inline-flex w-full max-w-xs overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600 ${
          disabled ? 'opacity-60' : ''
        }`}
      >
        <button
          type="button"
          disabled={disabled}
          aria-pressed={value === false}
          onClick={() => onChange(false)}
          className={`${BTN} ${pad} border-r border-slate-300 dark:border-slate-600 ${
            value === false
              ? 'bg-rose-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          Não
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-pressed={value === null}
          title="Sem escolha"
          onClick={() => onChange(null)}
          className={`${BTN} ${pad} border-r border-slate-300 dark:border-slate-600 ${
            value === null
              ? 'bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-100'
              : 'bg-white text-slate-400 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-500 dark:hover:bg-slate-700'
          }`}
        >
          <span className="inline-block min-w-[1.25rem]">&nbsp;</span>
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-pressed={value === true}
          onClick={() => onChange(true)}
          className={`${BTN} ${pad} ${
            value === true
              ? 'bg-emerald-600 text-white'
              : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          Sim
        </button>
      </div>
      {showHelp && (
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          Escolha <span className="font-medium">Sim</span> ou <span className="font-medium">Não</span> para
          salvar. <span className="font-medium">Não</span> = data provisória (não entra no histórico da
          Comunicação Interna). O controle sempre inicia no meio.
        </p>
      )}
    </div>
  );
}
