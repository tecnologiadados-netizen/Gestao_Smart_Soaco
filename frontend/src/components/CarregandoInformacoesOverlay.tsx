import LoaderCirculo from './LoaderCirculo';
import { LOADER_DURACAO_MINIMA_MS, useDuracaoMinima } from '../hooks/useDuracaoMinima';

/**
 * Overlay de vidro fosco com a animação padrão e texto — uso durante
 * carregamento de filtros, gravação de análises, etc.
 * - `viewport`: tela inteira (bloqueia menu e abas).
 * - `contained`: somente o pai `relative` (aba atual — menu e outras abas livres).
 *
 * Fica visível por `duracaoMinimaMs` mesmo que a resposta volte antes, para a
 * animação não piscar.
 */
export type CarregandoInformacoesOverlayProps = {
  show: boolean;
  mensagem?: string;
  mode?: 'viewport' | 'contained';
  className?: string;
  duracaoMinimaMs?: number;
  /** Inline para vencer o z-index das classes utilitárias quando preciso cobrir o menu. */
  zIndex?: number;
};

export default function CarregandoInformacoesOverlay({
  show,
  mensagem = 'Carregando informações...',
  mode = 'viewport',
  className = '',
  duracaoMinimaMs = LOADER_DURACAO_MINIMA_MS,
  zIndex,
}: CarregandoInformacoesOverlayProps) {
  const visivel = useDuracaoMinima(show, duracaoMinimaMs);

  if (!visivel) return null;

  const position =
    mode === 'viewport'
      ? 'fixed inset-0 z-[100] flex items-center justify-center'
      : 'absolute inset-0 z-50 flex min-h-[12rem] items-center justify-center rounded-b-xl';

  return (
    <div
      className={`${position} bg-slate-950/45 backdrop-blur-md ${className}`.trim()}
      style={zIndex === undefined ? undefined : { zIndex }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-4 px-8 py-10">
        <LoaderCirculo tamanho={48} cores={['#FFAD00', '#9BA3E8']} className="shrink-0" />
        <p className="max-w-sm text-center text-sm font-medium tracking-tight text-white/90">{mensagem}</p>
      </div>
    </div>
  );
}
