import { useEffect, useState } from 'react';

type Props = {
  url: string;
  title: string;
  onClose: () => void;
};

/** Modal de visualização de imagem anexada (chamados de suporte). */
export function SuporteAnexoPreviewModal({ url, title, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoading(true);
    setFailed(false);
  }, [url]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4 md:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="suporte-anexo-preview-title"
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-600 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-700 px-4 py-3">
          <h2
            id="suporte-anexo-preview-title"
            className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100"
            title={title}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800"
            aria-label="Fechar visualização"
          >
            Fechar
          </button>
        </header>
        <div className="relative flex min-h-[12rem] flex-1 items-center justify-center overflow-auto p-4 md:p-6">
          {failed ? (
            <p className="text-center text-sm text-red-300" role="alert">
              Não foi possível carregar a imagem. O arquivo pode ter sido removido ou está inacessível.
            </p>
          ) : (
            <>
              {loading && (
                <p className="absolute text-sm text-slate-400" aria-live="polite">
                  Carregando imagem…
                </p>
              )}
              <img
                src={url}
                alt={title}
                className={`max-h-[calc(92vh-6rem)] max-w-full rounded object-contain ${loading ? 'opacity-0' : 'opacity-100'}`}
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setFailed(true);
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
