import LoaderCirculo from '../../../../components/LoaderCirculo';
import { useDuracaoMinima } from '../../../../hooks/useDuracaoMinima';

interface Props {
  show?: boolean;
  mensagem?: string;
  subtitulo?: string;
}

export default function PdfGeneratingOverlay({
  show = true,
  mensagem = 'Gerando relatório em PDF…',
  subtitulo,
}: Props) {
  const visivel = useDuracaoMinima(show);

  if (!visivel) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-4 px-8 py-10">
        <LoaderCirculo tamanho={48} cores={['#FFAD00', '#9BA3E8']} />
        <div className="text-center">
          <p className="text-sm font-medium tracking-tight text-white/90">{mensagem}</p>
          {subtitulo ? (
            <p className="mt-1 max-w-xs text-xs text-white/60">{subtitulo}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
