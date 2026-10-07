import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@qualidade/components/ui/input";
import { Label } from "@qualidade/components/ui/label";
import { cn } from "@qualidade/lib/utils";
import {
  fetchProdutosClient,
  PRODUTOS_INITIAL_LIMIT,
  PRODUTOS_MIN_SEARCH_CHARS,
  PRODUTOS_SEARCH_LIMIT,
} from "@qualidade/lib/registros/fetch-produtos-client";
import type { ProdutoErp } from "@qualidade/types/produto-erp";
import { ListaSugestaoFlutuante } from "@qualidade/components/registros/lista-sugestao-flutuante";

interface ProdutoCodigoFieldProps {
  id?: string;
  label?: string;
  value: string;
  onCodigoChange: (codigo: string) => void;
  onProdutoSelect: (produto: ProdutoErp) => void;
  onVinculoClear?: () => void;
  disabled?: boolean;
  /** Quando informado, a lista mostra só produtos deste pedido Nomus. */
  pedidoId?: string | null;
  /** Mantido por compatibilidade. A lista traz todos os produtos ativos. */
  somenteAcabadosIntermediarios?: boolean;
  ocultarRotulo?: boolean;
}

export function ProdutoCodigoField({
  id = "produto-codigo",
  label = "Código do produto",
  value,
  onCodigoChange,
  onProdutoSelect,
  onVinculoClear,
  disabled = false,
  pedidoId = null,
  somenteAcabadosIntermediarios = false,
  ocultarRotulo = false,
}: ProdutoCodigoFieldProps) {
  const listId = useId();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const ancoraRef = useRef<HTMLDivElement>(null);

  const [termo, setTermo] = useState(value);
  const [resultados, setResultados] = useState<ProdutoErp[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState(false);

  const pedidoIdFiltro = pedidoId?.trim() || undefined;

  useEffect(() => {
    setTermo(value);
  }, [value]);

  async function buscarProdutos(busca: string) {
    setCarregando(true);
    setErro("");

    try {
      const limit =
        busca.trim().length >= PRODUTOS_MIN_SEARCH_CHARS
          ? PRODUTOS_SEARCH_LIMIT
          : PRODUTOS_INITIAL_LIMIT;

      const lista = await fetchProdutosClient({
        q: busca.trim() || undefined,
        pedidoId: pedidoIdFiltro,
        somenteAcabadosIntermediarios,
        limit: pedidoIdFiltro ? Math.max(limit, 200) : limit,
      });
      setResultados(lista);
    } catch {
      setErro(
        pedidoIdFiltro
          ? "Não foi possível buscar os produtos deste pedido."
          : "Não foi possível buscar produtos."
      );
      setResultados([]);
    } finally {
      setCarregando(false);
    }
  }

  async function buscarPorCodigoExato(codigo: string) {
    const normalizado = codigo.trim();
    if (!normalizado) return null;

    try {
      const lista = await fetchProdutosClient({
        codigo: normalizado,
        pedidoId: pedidoIdFiltro,
        somenteAcabadosIntermediarios,
        limit: 1,
      });
      return lista[0] ?? null;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    if (disabled) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      void buscarProdutos(termo);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [termo, disabled, pedidoIdFiltro, somenteAcabadosIntermediarios]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const alvo = event.target;
      if (!(alvo instanceof Node)) return;
      if (containerRef.current?.contains(alvo)) return;
      if (alvo instanceof Element && alvo.closest("[data-lista-sugestao]")) return;
      setAberto(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selecionar(produto: ProdutoErp) {
    setTermo(produto.codigo);
    onCodigoChange(produto.codigo);
    onProdutoSelect(produto);
    setAberto(false);
  }

  async function handleBlur() {
    if (disabled || !termo.trim()) return;

    const produto = await buscarPorCodigoExato(termo);
    if (produto) {
      selecionar(produto);
    }
  }

  return (
    <div ref={containerRef} className="relative space-y-2">
      {ocultarRotulo ? null : <Label htmlFor={id}>{label}</Label>}
      <div ref={ancoraRef} className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          value={termo}
          onChange={(e) => {
            const next = e.target.value;
            setTermo(next);
            onCodigoChange(next);
            onVinculoClear?.();
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          onBlur={() => {
            setTimeout(() => {
              void handleBlur();
            }, 150);
          }}
          disabled={disabled}
          placeholder={
            pedidoIdFiltro
              ? "Selecione um produto do pedido..."
              : "Ex.: PA 10005, MP 6861..."
          }
          className="pl-9"
          autoComplete="off"
          role="combobox"
          aria-expanded={aberto}
          aria-controls={listId}
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

      {aberto && !disabled && !carregando && resultados.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {pedidoIdFiltro
            ? "Nenhum produto encontrado neste pedido."
            : "Nenhum produto encontrado."}
        </p>
      ) : null}

      <ListaSugestaoFlutuante
        aberto={aberto && !disabled && resultados.length > 0}
        ancoraRef={ancoraRef}
        id={listId}
      >
        {resultados.map((produto) => (
          <li key={produto.codigo} role="option">
            <button
              type="button"
              className={cn(
                "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted"
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selecionar(produto)}
            >
              <span className="font-medium text-primary">{produto.codigo}</span>
              <span className="line-clamp-1 text-xs text-muted-foreground">
                {produto.descricao}
              </span>
              {produto.quantidadePedido != null && produto.quantidadePedido > 0 ? (
                <span className="text-[11px] text-muted-foreground">
                  Qtde no pedido: {produto.quantidadePedido}
                </span>
              ) : produto.grupoProduto ? (
                <span className="text-[11px] text-muted-foreground">
                  {produto.grupoProduto}
                  {produto.tipoProduto ? ` · ${produto.tipoProduto}` : ""}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ListaSugestaoFlutuante>

      {ocultarRotulo ? null : (
        <p className="text-xs text-muted-foreground">
          {pedidoIdFiltro
            ? "Exibindo apenas os códigos de produto deste pedido de venda."
            : "A busca inclui todos os produtos ativos. Digite o código ou parte do nome."}
        </p>
      )}
    </div>
  );
}
