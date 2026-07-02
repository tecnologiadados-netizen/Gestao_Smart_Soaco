interface Props {
  mensagem?: string;
  subtitulo?: string;
}

export default function PdfGeneratingOverlay({
  mensagem = "Gerando relatório em PDF...",
  subtitulo,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-slate-200 bg-white px-10 py-8 shadow-xl">
        <div className="pdf-generating-icon-wrap" aria-hidden="true">
          <div className="pdf-generating-ring" />
          <svg
            className="pdf-generating-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="M9 13h6" />
            <path d="M9 17h4" />
            <path d="M8 11h2.5v5" />
          </svg>
        </div>

        <div className="text-center">
          <p className="text-sm font-semibold text-slate-800">{mensagem}</p>
          {subtitulo && (
            <p className="mt-1 max-w-xs text-xs text-slate-500">{subtitulo}</p>
          )}
        </div>
      </div>
    </div>
  );
}
