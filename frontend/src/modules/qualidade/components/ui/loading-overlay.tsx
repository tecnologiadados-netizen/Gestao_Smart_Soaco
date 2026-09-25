import CarregandoInformacoesOverlay from "../../../../components/CarregandoInformacoesOverlay";

interface Props {
  open: boolean;
  message?: string;
  className?: string;
}

/**
 * Overlay centrado do Qualidade — mesma animação padrão do sistema
 * (`LoaderCirculo` via CarregandoInformacoesOverlay), em portal no body
 * para ficar acima de modais (z-index do dialog = 100).
 */
export function LoadingOverlay({
  open,
  message = "Carregando...",
  className,
}: Props) {
  return (
    <CarregandoInformacoesOverlay
      show={open}
      mensagem={message}
      mode="viewport"
      zIndex={10050}
      className={className}
    />
  );
}
