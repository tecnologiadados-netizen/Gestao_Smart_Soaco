import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@qualidade/components/ui/input";
import { Label } from "@qualidade/components/ui/label";
import { cn } from "@qualidade/lib/utils";
import {
  fetchClientesClient,
  CLIENTES_INITIAL_LIMIT,
  CLIENTES_MIN_SEARCH_CHARS,
  CLIENTES_SEARCH_LIMIT,
} from "@qualidade/lib/registros/fetch-clientes-client";
import { formatarCidadeRcc } from "@qualidade/types/cliente-erp";
import type { ClienteErp } from "@qualidade/types/cliente-erp";

interface ClienteSearchFieldProps {
  id?: string;
  label?: string;
  value: string;
  onValueChange: (nome: string) => void;
  onClienteSelect: (cliente: ClienteErp) => void;
  onVinculoClear?: () => void;
  disabled?: boolean;
}

export function ClienteSearchField({
  id = "cliente-search",
  label = "Nome do cliente consumidor",
  value,
  onValueChange,
  onClienteSelect,
  onVinculoClear,
  disabled = false,
}: ClienteSearchFieldProps) {
  const listId = useId();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [termo, setTermo] = useState(value);
  const [resultados, setResultados] = useState<ClienteErp[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    setTermo(value);
  }, [value]);

  async function buscarClientes(busca: string) {
    setCarregando(true);
    setErro("");

    try {
      const limit =
        busca.trim().length >= CLIENTES_MIN_SEARCH_CHARS
          ? CLIENTES_SEARCH_LIMIT
          : CLIENTES_INITIAL_LIMIT;

      const lista = await fetchClientesClient({
        q: busca.trim() || undefined,
        limit,
      });
      setResultados(lista);
    } catch {
      setErro("Não foi possível buscar clientes.");
      setResultados([]);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (disabled) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      void buscarClientes(termo);
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

  function selecionar(cliente: ClienteErp) {
    setTermo(cliente.nome);
    onValueChange(cliente.nome);
    onClienteSelect(cliente);
    setAberto(false);
  }

  return (
    <div ref={containerRef} className="relative space-y-2">
      <Label htmlFor={id}>{label} *</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          value={termo}
          onChange={(e) => {
            const next = e.target.value;
            setTermo(next);
            onValueChange(next);
            onVinculoClear?.();
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          disabled={disabled}
          placeholder="Digite o nome do cliente..."
          className="pl-9"
          autoComplete="off"
          role="combobox"
          aria-expanded={aberto}
          aria-controls={listId}
          required
        />
        {carregando ? (
          <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      {erro ? (
        <p className="text-xs text-destructive" role="alert">
          {erro}
        </p>
      ) : null}

      {aberto && !disabled && resultados.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-popover py-1 shadow-md"
        >
          {resultados.map((cliente) => (
            <li key={cliente.id} role="option">
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted"
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selecionar(cliente)}
              >
                <span className="font-medium text-primary">{cliente.nome}</span>
                {cliente.razaoSocial !== cliente.nome ? (
                  <span className="line-clamp-1 text-xs text-muted-foreground">
                    {cliente.razaoSocial}
                  </span>
                ) : null}
                <span className="text-[11px] text-muted-foreground">
                  {formatarCidadeRcc(cliente.municipio, cliente.uf)}
                  {cliente.documento ? ` · ${cliente.documento}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Busque no cadastro de clientes do ERP para preencher endereço, contato,
        telefone, cidade e estado automaticamente.
      </p>
    </div>
  );
}
