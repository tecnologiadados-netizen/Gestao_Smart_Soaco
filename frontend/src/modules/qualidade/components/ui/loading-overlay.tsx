import { Loader2 } from "lucide-react";
import { cn } from "@qualidade/lib/utils";

interface Props {
  open: boolean;
  message?: string;
  className?: string;
}

export function LoadingOverlay({ open, message = "Carregando...", className }: Props) {
  if (!open) return null;

  return (
    <div
      className={cn("sgq-glass-loader", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="sgq-loader-card">
        <Loader2 className="sgq-loader-spinner size-10 text-primary" aria-hidden />
        <p className="text-sm font-medium text-foreground">{message}</p>
      </div>
    </div>
  );
}
