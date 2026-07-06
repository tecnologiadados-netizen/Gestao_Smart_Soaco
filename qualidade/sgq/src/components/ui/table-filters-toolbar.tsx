"use client";

import { FilterX, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const TABLE_FILTER_ALL = "todos";

export const tableFilterInputClass = "border-border/80 bg-card shadow-sm";
export const tableFilterSelectTriggerClass =
  "w-full border-border/80 bg-card shadow-sm";

interface TableFiltersToolbarProps {
  children: React.ReactNode;
  className?: string;
  gridClassName?: string;
  onClear?: () => void;
  hasActiveFilters?: boolean;
  clearLabel?: string;
}

export function TableFiltersToolbar({
  children,
  className,
  gridClassName,
  onClear,
  hasActiveFilters = false,
  clearLabel = "Limpar filtros",
}: TableFiltersToolbarProps) {
  return (
    <div className={cn("sgq-table-toolbar", className)}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
        <div className={cn("grid min-w-0 flex-1 gap-4", gridClassName)}>
          {children}
        </div>
        {onClear && hasActiveFilters ? (
          <div className="sgq-table-toolbar-actions flex shrink-0 justify-end">
            <ClearFiltersButton onClick={onClear} label={clearLabel} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface TableFilterFieldProps {
  label: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}

export function TableFilterField({
  label,
  htmlFor,
  className,
  children,
}: TableFilterFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label
        htmlFor={htmlFor}
        className="text-xs font-medium text-muted-foreground"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}

interface TableFilterSearchProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function TableFilterSearch({
  id,
  value,
  onChange,
  placeholder = "Buscar...",
  className,
}: TableFilterSearchProps) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        placeholder={placeholder}
        className={cn(tableFilterInputClass, "pl-9")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

interface ClearFiltersButtonProps {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}

export function ClearFiltersButton({
  onClick,
  disabled = false,
  label = "Limpar filtros",
}: ClearFiltersButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className="border-border/80 bg-card shadow-sm"
    >
      <FilterX className="size-4" />
      {label}
    </Button>
  );
}
