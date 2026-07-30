import LoaderCirculo from "../../../../components/LoaderCirculo";
import { useDuracaoMinima } from "../../../../hooks/useDuracaoMinima";
import { cn } from "@qualidade/lib/utils";

interface Props {
  open: boolean;
  message?: string;
  className?: string;
}

export function LoadingOverlay({ open, message = "Carregando...", className }: Props) {
  const visivel = useDuracaoMinima(open);

  if (!visivel) return null;

  return (
    <div
      className={cn("sgq-glass-loader", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="sgq-loader-card">
        <LoaderCirculo tamanho={48} className="text-primary" />
        <p className="text-sm font-medium text-foreground">{message}</p>
      </div>
    </div>
  );
}
