import { useCallback, useState } from 'react';

/** Número do PD sem prefixo "PD ". */
export function numeroPedidoLimpo(pedido: string | undefined): string {
  return String(pedido ?? '')
    .replace(/^PD\s*/i, '')
    .trim();
}

type Props = {
  texto: string;
  title?: string;
  className?: string;
};

/** Ícone DocumentDuplicate — copia `texto` para a área de transferência. */
export default function CopiarTextoBtn({
  texto,
  title = 'Copiar',
  className = '',
}: Props) {
  const [ok, setOk] = useState(false);

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const t = String(texto ?? '').trim();
      if (!t) return;
      void navigator.clipboard.writeText(t).then(() => {
        setOk(true);
        window.setTimeout(() => setOk(false), 1200);
      });
    },
    [texto]
  );

  if (!String(texto ?? '').trim()) return null;

  return (
    <button
      type="button"
      title={ok ? 'Copiado!' : title}
      aria-label={ok ? 'Copiado' : title}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center justify-center rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200 ${className}`}
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        {ok ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        )}
      </svg>
    </button>
  );
}
