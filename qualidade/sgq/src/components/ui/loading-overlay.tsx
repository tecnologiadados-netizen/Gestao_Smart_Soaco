"use client";

import { LoaderCirculo } from "@/components/ui/loader-circulo";
import { cn } from "@/lib/utils";

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
        <LoaderCirculo tamanho={48} className="text-primary" />
        <p className="text-sm font-medium text-foreground">{message}</p>
      </div>
    </div>
  );
}
