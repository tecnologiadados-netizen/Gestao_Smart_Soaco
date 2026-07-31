import { createPortal } from 'react-dom';

/** Botão padrão “Como ler” — mesmo estilo do Gerenciador de Pedidos. */
export function ComoLerBtn({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
        />
      </svg>
      Como ler
    </button>
  );
}

export type SecaoAjuda = {
  id: string;
  titulo: string;
  oQueE: string;
  comoLe: string;
  detalhes?: { titulo: string; texto: string }[];
};

export type AjudaTelaModalProps = {
  aberto: boolean;
  onClose: () => void;
  titulo: string;
  subtitulo: string;
  introducao: string;
  secoes: SecaoAjuda[];
  tituloId?: string;
};

export default function AjudaTelaModal({
  aberto,
  onClose,
  titulo,
  subtitulo,
  introducao,
  secoes,
  tituloId = 'ajuda-tela-titulo',
}: AjudaTelaModalProps) {
  if (!aberto || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-3 sm:p-4 bg-black/70 dark:bg-slate-950/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex w-full max-w-2xl max-h-[min(92vh,800px)] min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div className="min-w-0 pr-2">
            <h2 id={tituloId} className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {titulo}
            </h2>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{subtitulo}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700 px-3 py-2">
            {introducao}
          </p>

          {secoes.map((s) => (
            <section
              key={s.id}
              className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/60 overflow-hidden"
            >
              <h3 className="px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 bg-slate-100/80 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-600">
                {s.titulo}
              </h3>
              <div className="px-3 py-3 space-y-3 text-sm leading-relaxed">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    O que é
                  </p>
                  <p className="mt-0.5 text-slate-700 dark:text-slate-200">{s.oQueE}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Como ler na prática
                  </p>
                  <p className="mt-0.5 text-slate-700 dark:text-slate-200">{s.comoLe}</p>
                </div>
                {s.detalhes?.length ? (
                  <ul className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-700">
                    {s.detalhes.map((d) => (
                      <li key={d.titulo}>
                        <p className="font-medium text-slate-800 dark:text-slate-100">{d.titulo}</p>
                        <p className="text-slate-600 dark:text-slate-300">{d.texto}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}
        </div>

        <div className="shrink-0 flex justify-end border-t border-slate-200 px-4 py-3 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 transition shadow-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
