import { useCallback, useState, type MouseEvent } from 'react';

/** Número do PD sem prefixo "PD ". */
export function numeroPedidoLimpo(pedido: string | undefined): string {
  return String(pedido ?? '')
    .replace(/^PD\s*/i, '')
    .trim();
}

/** Copia texto para a área de transferência (Clipboard API + fallback). */
export async function copiarTextoParaClipboard(texto: string): Promise<boolean> {
  const t = String(texto ?? '').trim();
  if (!t) return false;

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch {
    // segue para fallback (ex.: permissão negada / contexto inseguro)
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = t;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, t.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
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
  const [status, setStatus] = useState<'idle' | 'ok' | 'erro'>('idle');

  const limparStatus = useCallback(() => {
    window.setTimeout(() => setStatus('idle'), 1200);
  }, []);

  const onCopy = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const t = String(texto ?? '').trim();
      if (!t) return;
      void copiarTextoParaClipboard(t).then((copied) => {
        setStatus(copied ? 'ok' : 'erro');
        limparStatus();
      });
    },
    [texto, limparStatus]
  );

  if (!String(texto ?? '').trim()) return null;

  const label =
    status === 'ok' ? 'Copiado!' : status === 'erro' ? 'Falha ao copiar' : title;

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onCopy}
      className={`inline-flex shrink-0 items-center justify-center rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200 ${className}`}
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        {status === 'ok' ? (
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
