import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@qualidade/components/ui/input";
import { Label } from "@qualidade/components/ui/label";
import { cn } from "@qualidade/lib/utils";
import {
  fetchFornecedoresClient,
  FORNECEDORES_INITIAL_LIMIT,
  FORNECEDORES_MIN_SEARCH_CHARS,
  FORNECEDORES_SEARCH_LIMIT,
} from "@qualidade/lib/avaliacao-fornecedor/fetch-fornecedores-client";
import type { Fornecedor } from "@qualidade/types/avaliacao-fornecedor";

interface FornecedorSearchFieldProps {
  id?: string;
  label?: string;
  value: Fornecedor | null;
  onSelect: (fornecedor: Fornecedor) => void;
  onClear?: () => void;
  disabled?: boolean;
}

export function FornecedorSearchField({
  id = "fornecedor-search",
  label = "Fornecedor",
  value,
  onSelect,
  onClear,
  disabled = false,
}: FornecedorSearchFieldProps) {
  const listId = useId();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<Fornecedor[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState(false);

  async function buscarFornecedores(busca: string) {
    setCarregando(true);
    setErro("");

    try {
      const limit =
        busca.trim().length >= FORNECEDORES_MIN_SEARCH_CHARS
          ? FORNECEDORES_SEARCH_LIMIT
          : FORNECEDORES_INITIAL_LIMIT;

      const lista = await fetchFornecedoresClient({
        q: busca.trim() || undefined,
        limit,
      });
      setResultados(lista);
    } catch {
      setErro("Não foi possível buscar fornecedores.");
      setResultados([]);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (disabled) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      void buscarFornecedores(termo);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [termo, disabled]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setAberto(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selecionar(fornecedor: Fornecedor) {
    onSelect(fornecedor);
    setTermo(fornecedor.nome);
    setAberto(false);
  }

  function limparSelecao() {
    setTermo("");
    onClear?.();
    setAberto(true);
  }

  const hint =
    termo.trim().length > 0 &&
    termo.trim().length < FORNECEDORES_MIN_SEARCH_CHARS
      ? `Digite pelo menos ${FORNECEDORES_MIN_SEARCH_CHARS} caracteres para refinar a busca.`
      : null;

  return (
    <div ref={containerRef} className="space-y-2">
      <Label htmlFor={id}>{label}</Label>

      {value ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{value.nome}</p>
            <p className="truncate text-xs text-muted-foreground">{value.id}</p>
          </div>
          {!disabled ? (
            <button
              type="button"
              onClick={limparSelecao}
              className="shrink-0 text-xs font-medium text-primary hover:underline"
            >
              Alterar
            </button>
          ) : null}
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={id}
            role="combobox"
            aria-expanded={aberto}
            aria-controls={listId}
            autoComplete="off"
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value);
              setAberto(true);
            }}
            onFocus={() => setAberto(true)}
            placeholder="Digite o nome do fornecedor..."
            disabled={disabled}
            className="pl-9"
          />
        </div>
      )}

      {!value && aberto ? (
        <div
          id={listId}
          role="listbox"
          className="max-h-56 overflow-y-auto rounded-lg border border-border bg-card shadow-sm"
        >
          {carregando ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Buscando fornecedores...
            </div>
          ) : erro ? (
            <p className="px-3 py-4 text-sm text-destructive" role="alert">
              {erro}
            </p>
          ) : hint ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">{hint}</p>
          ) : resultados.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              Nenhum fornecedor encontrado.
            </p>
          ) : (
            <ul>
              {resultados.map((fornecedor) => (
                <li key={fornecedor.id}>
                  <button
                    type="button"
                    role="option"
                    className={cn(
                      "w-full px-3 py-2.5 text-left text-sm transition-colors",
                      "hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                    )}
                    onClick={() => selecionar(fornecedor)}
                  >
                    <span className="block truncate font-medium">
                      {fornecedor.nome}
                    </span>
                    {fornecedor.documento ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {fornecedor.documento}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!carregando && !erro && resultados.length > 0 ? (
            <p className="border-t px-3 py-2 text-xs text-muted-foreground">
              {termo.trim().length >= FORNECEDORES_MIN_SEARCH_CHARS
                ? `${resultados.length} resultado(s). Continue digitando para refinar.`
                : `Exibindo ${resultados.length} fornecedores. Digite para buscar.`}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
