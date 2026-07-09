interface Props {
  mensagem?: string;
  subtitulo?: string;
}

export default function PendenciasPdfGeneratingOverlay({
  mensagem = 'Gerando relatório PDF…',
  subtitulo,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-slate-200 bg-white px-10 py-8 shadow-xl dark:border-slate-600 dark:bg-slate-800">
        <div className="pendencias-pdf-circles" aria-hidden="true">
          <span className="pendencias-pdf-circle" />
          <span className="pendencias-pdf-circle" />
          <span className="pendencias-pdf-circle" />
        </div>

        <div className="text-center">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{mensagem}</p>
          {subtitulo ? (
            <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">{subtitulo}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
