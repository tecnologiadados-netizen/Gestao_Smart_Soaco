import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@rh/components/ui/input";
import { cn } from "@rh/lib/utils";
import { commandFilterScore, textIncludesSearch } from "@rh/lib/normalize-search-text";

type Props = {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  onBlur?: (value: string) => void;
};

export default function CidCadastroSugestaoInput({
  value,
  onChange,
  options,
  disabled = false,
  placeholder = "Digite código ou descrição do CID…",
  className,
  onBlur,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const uniqueOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const o of options) {
      const t = String(o).trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
    return out.sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [options]);

  const suggestions = useMemo(() => {
    const q = value.trim();
    if (!q) return uniqueOptions.slice(0, 12);
    return uniqueOptions
      .filter((opt) => commandFilterScore(opt, q) > 0 || textIncludesSearch(opt, q))
      .slice(0, 12);
  }, [uniqueOptions, value]);

  useEffect(() => {
    setHighlight(0);
  }, [value, suggestions.length]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = useCallback(
    (opt: string) => {
      onChange(opt);
      setOpen(false);
    },
    [onChange],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" && suggestions[highlight]) {
      e.preventDefault();
      pick(suggestions[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className={cn("relative flex-1 min-w-0", className)}>
      <Input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        className="h-8 text-xs"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          onBlur?.(value);
        }}
        onKeyDown={onKeyDown}
        autoComplete="off"
      />
      {open && !disabled && suggestions.length > 0 ? (
        <ul
          className="absolute z-50 mt-0.5 w-full max-h-48 overflow-auto rounded-sm border border-border bg-popover shadow-md text-xs"
          role="listbox"
        >
          {suggestions.map((opt, idx) => (
            <li key={opt} role="option" aria-selected={idx === highlight}>
              <button
                type="button"
                className={cn(
                  "w-full px-2 py-1.5 text-left hover:bg-accent/10 whitespace-normal break-words",
                  idx === highlight && "bg-accent/15",
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(opt);
                }}
                onMouseEnter={() => setHighlight(idx)}
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
