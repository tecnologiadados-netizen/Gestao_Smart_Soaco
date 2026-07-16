import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@qualidade/components/ui/input";
import { cn } from "@qualidade/lib/utils";
import {
  tableFilterInputClass,
} from "@qualidade/components/ui/table-filters-toolbar";
import { criarMatcherTextoLivre } from "@/utils/textoLivreBusca";

const SUGESTAO_MAX = 12;
const SUGESTAO_INICIAL_MAX = 8;

interface DocumentoAvaliadoFilterSearchProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Números de documento já avaliados, do mais recente ao mais antigo. */
  documentos: string[];
  placeholder?: string;
  className?: string;
}

export function DocumentoAvaliadoFilterSearch({
  id,
  value,
  onChange,
  documentos,
  placeholder = "Ex.: DE38138 ou DE%",
  className,
}: DocumentoAvaliadoFilterSearchProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = useState(false);
  const [ativoIdx, setAtivoIdx] = useState(-1);

  const termoDigitado = value.trim();
  const exibindoIniciais = termoDigitado === "";

  const sugestoes = useMemo(() => {
    const match = criarMatcherTextoLivre(value);
    const filtrados = exibindoIniciais
      ? documentos
      : documentos.filter((doc) => match(doc));
    const limite = exibindoIniciais ? SUGESTAO_INICIAL_MAX : SUGESTAO_MAX;
    return filtrados.slice(0, limite);
  }, [value, documentos, exibindoIniciais]);

  const totalFiltrados = useMemo(() => {
    if (exibindoIniciais) return documentos.length;
    const match = criarMatcherTextoLivre(value);
    return documentos.filter((doc) => match(doc)).length;
  }, [value, documentos, exibindoIniciais]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setAberto(false);
        setAtivoIdx(-1);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setAtivoIdx(-1);
  }, [value, aberto]);

  function selecionar(numero: string) {
    onChange(numero);
    setAberto(false);
    setAtivoIdx(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!aberto || sugestoes.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivoIdx((i) => Math.min(i + 1, sugestoes.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivoIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && ativoIdx >= 0) {
      e.preventDefault();
      selecionar(sugestoes[ativoIdx]);
    } else if (e.key === "Escape") {
      setAberto(false);
      setAtivoIdx(-1);
    }
  }

  const mostrarLista = aberto && sugestoes.length > 0;

  return (
    <div ref={containerRef} className={cn("relative min-w-0", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        role="combobox"
        aria-expanded={mostrarLista}
        aria-controls={listId}
        autoComplete="off"
        placeholder={placeholder}
        className={cn(tableFilterInputClass, "pl-9")}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={handleKeyDown}
      />

      {mostrarLista ? (
        <div
          id={listId}
          role="listbox"
          className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-md"
        >
          <ul className="max-h-48 overflow-y-auto">
            {sugestoes.map((numero, idx) => (
              <li key={numero}>
                <button
                  type="button"
                  role="option"
                  aria-selected={idx === ativoIdx}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm transition-colors",
                    "hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none",
                    idx === ativoIdx && "bg-muted/60"
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selecionar(numero)}
                >
                  <span className="block truncate font-medium">{numero}</span>
                </button>
              </li>
            ))}
          </ul>
          {totalFiltrados > sugestoes.length ? (
            <p className="border-t px-3 py-2 text-xs text-muted-foreground">
              {exibindoIniciais
                ? `Exibindo ${sugestoes.length} de ${totalFiltrados} documento(s). Digite para refinar.`
                : `${totalFiltrados} documento(s) encontrado(s). Continue digitando para refinar.`}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
