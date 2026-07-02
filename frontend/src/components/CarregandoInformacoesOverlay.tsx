/**
 * Overlay escuro com spinner e texto — uso durante carregamento de filtros,
 * gravação de análises, etc.
 * - `viewport`: tela inteira (bloqueia menu e abas).
 * - `contained`: somente o pai `relative` (aba atual — menu e outras abas livres).
 */
export type CarregandoInformacoesOverlayProps = {
  show: boolean;
  mensagem?: string;
  mode?: 'viewport' | 'contained';
  className?: string;
};

export default function CarregandoInformacoesOverlay({
  show,
  mensagem = 'Carregando informações...',
  mode = 'viewport',
  className = '',
}: CarregandoInformacoesOverlayProps) {
  if (!show) return null;

  const position =
    mode === 'viewport'
      ? 'fixed inset-0 z-[100] flex items-center justify-center'
      : 'absolute inset-0 z-50 flex min-h-[12rem] items-center justify-center rounded-b-xl';

  return (
    <div
      className={`${position} bg-black/95 backdrop-blur-[2px] ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-4 px-8 py-10">
        <div className="relative h-12 w-12 shrink-0" aria-hidden>
          <div className="absolute inset-0 rounded-full border-[3px] border-accent-500/25" />
          <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-accent-500 border-r-primary-600/40 animate-spin" />
        </div>
        <p className="max-w-sm text-center text-sm font-medium tracking-tight text-white/90">{mensagem}</p>
      </div>
    </div>
  );
}
