import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@qualidade/components/ui/input";
import { Label } from "@qualidade/components/ui/label";
import { cn } from "@qualidade/lib/utils";
import {
  fetchPedidosVendaClient,
  PEDIDOS_VENDA_INITIAL_LIMIT,
  PEDIDOS_VENDA_MIN_SEARCH_CHARS,
  PEDIDOS_VENDA_SEARCH_LIMIT,
} from "@qualidade/lib/registros/fetch-pedidos-venda-client";
import { formatarCidadeRcc } from "@qualidade/types/cliente-erp";
import type { PedidoVendaErp } from "@qualidade/types/pedido-venda-erp";

interface PedidoVendaSearchFieldProps {
  id?: string;
  label?: string;
  value: string;
  onValueChange: (numero: string) => void;
  onPedidoSelect: (pedido: PedidoVendaErp) => void;
  onVinculoClear?: () => void;
  disabled?: boolean;
}

function formatarData(data: string): string {
  const texto = data.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  const [ano, mes, dia] = texto.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function PedidoVendaSearchField({
  id = "pedido-venda-search",
  label = "Nº do pedido de venda (interno)",
  value,
  onValueChange,
  onPedidoSelect,
  onVinculoClear,
  disabled = false,
}: PedidoVendaSearchFieldProps) {
  const listId = useId();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [termo, setTermo] = useState(value);
  const [resultados, setResultados] = useState<PedidoVendaErp[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    setTermo(value);
  }, [value]);

  async function buscarPedidos(busca: string) {
    setCarregando(true);
    setErro("");

    try {
      const limit =
        busca.trim().length >= PEDIDOS_VENDA_MIN_SEARCH_CHARS
          ? PEDIDOS_VENDA_SEARCH_LIMIT
          : PEDIDOS_VENDA_INITIAL_LIMIT;

      const lista = await fetchPedidosVendaClient({
        q: busca.trim() || undefined,
        limit,
      });
      setResultados(lista);
    } catch {
      setErro("Não foi possível buscar pedidos de venda.");
      setResultados([]);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (disabled) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      void buscarPedidos(termo);
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

  function selecionar(pedido: PedidoVendaErp) {
    setTermo(pedido.numero);
    onValueChange(pedido.numero);
    onPedidoSelect(pedido);
    setAberto(false);
  }

  return (
    <div ref={containerRef} className="relative space-y-2">
      <Label htmlFor={id}>{label}</Label>
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
          placeholder="Digite o número do pedido de venda..."
          className="pl-9"
          autoComplete="off"
          role="combobox"
          aria-expanded={aberto}
          aria-controls={listId}
          inputMode="numeric"
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
          {resultados.map((pedido) => (
            <li key={pedido.pedidoId} role="option">
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted"
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selecionar(pedido)}
              >
                <span className="font-medium text-primary">
                  Pedido {pedido.numero}
                  {pedido.dataEmissao ? ` · ${formatarData(pedido.dataEmissao)}` : ""}
                </span>
                {pedido.cliente ? (
                  <>
                    <span className="line-clamp-1 text-xs text-foreground">
                      {pedido.cliente.nome}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatarCidadeRcc(
                        pedido.cliente.municipio,
                        pedido.cliente.uf
                      )}
                      {pedido.cliente.documento
                        ? ` · ${pedido.cliente.documento}`
                        : ""}
                    </span>
                  </>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    Sem cliente vinculado
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Pesquise pelo número do pedido de venda para preencher automaticamente os
        dados do cliente.
      </p>
    </div>
  );
}
