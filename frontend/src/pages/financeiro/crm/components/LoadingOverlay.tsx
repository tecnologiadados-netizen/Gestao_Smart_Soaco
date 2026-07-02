interface Props {
  mensagem?: string;
  subtitulo?: string;
}

export default function LoadingOverlay({
  mensagem = "Carregando...",
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
        <div className="crm-loading-spinner" aria-hidden="true" />
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
