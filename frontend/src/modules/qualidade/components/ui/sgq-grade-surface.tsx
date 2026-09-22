import type { ReactNode, Ref } from "react";
import { ClearFiltersButton } from "@qualidade/components/ui/table-filters-toolbar";
import { cn } from "@qualidade/lib/utils";

interface SgqGradeSurfaceProps {
  children: ReactNode;
  scrollRef: Ref<HTMLDivElement | null>;
  temFiltros?: boolean;
  onLimparFiltros?: () => void;
  className?: string;
}

export function SgqGradeSurface({
  children,
  scrollRef,
  temFiltros = false,
  onLimparFiltros,
  className,
}: SgqGradeSurfaceProps) {
  return (
    <div
      className={cn(
        "sgq-table-surface overflow-hidden rounded-xl border border-border bg-card shadow-sm ring-1 ring-foreground/6",
        className
      )}
    >
      {temFiltros && onLimparFiltros ? (
        <div className="flex justify-end border-b border-border px-3 py-2">
          <ClearFiltersButton
            onClick={onLimparFiltros}
            label="Limpar filtros da grade"
          />
        </div>
      ) : null}
      <div ref={scrollRef} className="overflow-x-auto">
        {children}
      </div>
    </div>
  );
}
