import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@rh/components/ui/button";
import { Checkbox } from "@rh/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@rh/components/ui/popover";
import { attachDialogSafeWheelScroll } from "@rh/lib/scroll-container-wheel";
import { Eye, EyeOff } from "lucide-react";

type ColumnOption = {
  key: string;
  label: string;
};

type Props = {
  columns: ColumnOption[];
  hiddenKeys: string[];
  onHiddenKeysChange: (next: string[]) => void;
  title?: string;
};

export function ColumnVisibilityPopover({
  columns,
  hiddenKeys,
  onHiddenKeysChange,
  title = "Colunas visíveis",
}: Props) {
  const [open, setOpen] = useState(false);
  const listScrollRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    let cleanup: (() => void) | undefined;
    const id = requestAnimationFrame(() => {
      const el = listScrollRef.current;
      if (el) cleanup = attachDialogSafeWheelScroll(el, "vertical");
    });
    return () => {
      cancelAnimationFrame(id);
      cleanup?.();
    };
  }, [open]);

  const hiddenSet = new Set(hiddenKeys);
  const visibleCount = columns.length - hiddenKeys.length;

  const toggleColumn = (key: string, nextChecked: boolean) => {
    if (nextChecked) {
      onHiddenKeysChange(hiddenKeys.filter((item) => item !== key));
      return;
    }
    if (visibleCount <= 1) return;
    onHiddenKeysChange([...hiddenKeys, key]);
  };

  const showAll = () => onHiddenKeysChange([]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          {hiddenKeys.length > 0 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          Colunas
          {hiddenKeys.length > 0 ? (
            <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] leading-none">{hiddenKeys.length}</span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,22rem)] p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-[11px] text-muted-foreground">
              Oculte colunas e reexiba quando quiser.
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={showAll} disabled={hiddenKeys.length === 0}>
            Reexibir todas
          </Button>
        </div>
        <div
          ref={listScrollRef}
          className="max-h-[min(60vh,20rem)] overflow-y-auto overscroll-contain p-2"
        >
          <div className="space-y-1">
            {columns.map((column) => {
              const checked = !hiddenSet.has(column.key);
              const disableUncheck = checked && visibleCount <= 1;
              return (
                <label
                  key={column.key}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-muted/70"
                >
                  <Checkbox
                    checked={checked}
                    disabled={disableUncheck}
                    onCheckedChange={(value) => toggleColumn(column.key, value === true)}
                  />
                  <span className="min-w-0 flex-1 truncate">{column.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
