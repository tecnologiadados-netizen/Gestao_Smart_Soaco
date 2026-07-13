import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@qualidade/components/ui/input";
import { Label } from "@qualidade/components/ui/label";
import { cn } from "@qualidade/lib/utils";
import {
  fetchPessoasClient,
  PESSOAS_INITIAL_LIMIT,
  PESSOAS_MIN_SEARCH_CHARS,
  PESSOAS_SEARCH_LIMIT,
} from "@qualidade/lib/registros/fetch-pessoas-client";
import type { PessoaErp } from "@qualidade/types/pessoa-erp";

interface PessoaSearchFieldProps {
  id?: string;
  label?: string;
  value: string;
  onValueChange: (nome: string) => void;
  onPessoaSelect?: (pessoa: PessoaErp) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function PessoaSearchField({
  id = "pessoa-search",
  label = "Pessoa",
  value,
  onValueChange,
  onPessoaSelect,
  disabled = false,
  placeholder = "Digite o nome...",
}: PessoaSearchFieldProps) {
  const listId = useId();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [termo, setTermo] = useState(value);
  const [resultados, setResultados] = useState<PessoaErp[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState(false);
  const [selecionado, setSelecionado] = useState(Boolean(value.trim()));

  useEffect(() => {
    setTermo(value);
    setSelecionado(Boolean(value.trim()));
  }, [value]);

  async function buscarPessoas(busca: string) {
    setCarregando(true);
    setErro("");
    try {
      const limit =
        busca.trim().length >= PESSOAS_MIN_SEARCH_CHARS
          ? PESSOAS_SEARCH_LIMIT
          : PESSOAS_INITIAL_LIMIT;
      const lista = await fetchPessoasClient({
        q: busca.trim() || undefined,
        limit,
      });
      setResultados(lista);
    } catch {
      setErro("Não foi possível buscar pessoas no Nomus.");
      setResultados([]);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (disabled || selecionado) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void buscarPessoas(termo);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [termo, disabled, selecionado]);

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

  function selecionar(pessoa: PessoaErp) {
    setTermo(pessoa.nome);
    setSelecionado(true);
    onValueChange(pessoa.nome);
    onPessoaSelect?.(pessoa);
    setAberto(false);
  }

  function limparSelecao() {
    setTermo("");
    setSelecionado(false);
    onValueChange("");
    setAberto(true);
  }

  return (
    <div ref={containerRef} className="space-y-2">
      <Label htmlFor={id}>{label}</Label>

      {selecionado && value.trim() ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5">
          <p className="truncate text-sm font-medium">{value}</p>
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
              onValueChange(e.target.value);
              setSelecionado(false);
              setAberto(true);
            }}
            onFocus={() => setAberto(true)}
            placeholder={placeholder}
            disabled={disabled}
            className="pl-9"
          />
          {carregando ? (
            <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
        </div>
      )}

      {!selecionado && aberto && !disabled ? (
        <div
          id={listId}
          role="listbox"
          className="max-h-56 overflow-y-auto rounded-lg border border-border bg-card shadow-sm"
        >
          {carregando ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Buscando pessoas...
            </div>
          ) : erro ? (
            <p className="px-3 py-4 text-sm text-destructive" role="alert">
              {erro}
            </p>
          ) : resultados.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              Nenhuma pessoa encontrada.
            </p>
          ) : (
            <ul>
              {resultados.map((pessoa) => (
                <li key={pessoa.id}>
                  <button
                    type="button"
                    role="option"
                    className={cn(
                      "w-full px-3 py-2.5 text-left text-sm transition-colors",
                      "hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                    )}
                    onClick={() => selecionar(pessoa)}
                  >
                    <span className="block truncate font-medium">
                      {pessoa.nome}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Busca pessoas (funcionários) ativas no Nomus.
      </p>
    </div>
  );
}
