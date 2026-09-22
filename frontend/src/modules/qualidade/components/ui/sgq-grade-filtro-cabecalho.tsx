import type { MouseEvent } from "react";
import GradeFiltroCabecalhoBtn from "@/components/grade/GradeFiltroCabecalhoBtn";
import { TableHead } from "@qualidade/components/ui/table";
import { cn } from "@qualidade/lib/utils";

interface SgqGradeFiltroCabecalhoProps {
  label: string;
  ativo: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  align?: "left" | "right";
}

export function SgqGradeFiltroCabecalho({
  label,
  ativo,
  onClick,
  className,
  align = "left",
}: SgqGradeFiltroCabecalhoProps) {
  return (
    <TableHead className={cn("sticky top-0 z-10", className)}>
      <div
        className={cn(
          "flex min-w-0 items-center gap-1",
          align === "right" ? "justify-end" : "justify-between"
        )}
      >
        <span className="min-w-0 truncate">{label}</span>
        <GradeFiltroCabecalhoBtn ativo={ativo} onClick={onClick} />
      </div>
    </TableHead>
  );
}

export function sgqTextoOuTraco(value?: string | null): string {
  const t = (value ?? "").trim();
  return t || "—";
}

export function sgqIsoToYmd(value?: string | null): string | null {
  if (!value) return null;
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}
