import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@qualidade/components/ui/input";
import { Label } from "@qualidade/components/ui/label";
import { cn } from "@qualidade/lib/utils";
import { formatarData } from "@qualidade/lib/utils/dates";
import {
  fetchDocumentosEntradaClient,
  DOCUMENTOS_ENTRADA_INITIAL_LIMIT,
  DOCUMENTOS_ENTRADA_MIN_SEARCH_CHARS,
  DOCUMENTOS_ENTRADA_SEARCH_LIMIT,
  type DocumentoEntradaErp,
} from "@qualidade/lib/avaliacao-fornecedor/fetch-documentos-entrada-client";

interface DocumentoEntradaSearchFieldProps {
  id?: string;
  label?: string;
  fornecedorId: string | null;
  value: string;
  onSelect: (numero: string) => void;
  onClear?: () => void;
  disabled?: boolean;
  required?: boolean;
}

export function DocumentoEntradaSearchField({
  id = "documento-entrada-search",
  label = "Número do contrato / documento",
  fornecedorId,
  value,
  onSelect,
  onClear,
  disabled = false,
  required = false,
}: DocumentoEntradaSearchFieldProps) {
  const listId = useId();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<DocumentoEntradaErp[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState(false);

  async function buscarDocumentos(busca: string) {
    if (!fornecedorId) {
      setResultados([]);
      return;
    }

    setCarregando(true);
    setErro("");

    try {
      const limit =
        busca.trim().length >= DOCUMENTOS_ENTRADA_MIN_SEARCH_CHARS
          ? DOCUMENTOS_ENTRADA_SEARCH_LIMIT
          : DOCUMENTOS_ENTRADA_INITIAL_LIMIT;

      const lista = await fetchDocumentosEntradaClient({
        fornecedorId,
        q: busca.trim() || undefined,
        limit,
      });
      setResultados(lista);
    } catch {
      setErro("Não foi possível buscar documentos de entrada.");
      setResultados([]);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (!value) setTermo("");
  }, [value]);

  useEffect(() => {
    if (disabled || !fornecedorId || value) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      void buscarDocumentos(termo);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [termo, disabled, fornecedorId, value]);

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

  function selecionar(doc: DocumentoEntradaErp) {
    onSelect(doc.numero);
    setTermo(doc.numero);
    setAberto(false);
  }

  function limparSelecao() {
    setTermo("");
    onClear?.();
    setAberto(true);
  }

  const semFornecedor = !fornecedorId;
  const hint =
    termo.trim().length > 0 &&
    termo.trim().length < DOCUMENTOS_ENTRADA_MIN_SEARCH_CHARS
      ? `Digite pelo menos ${DOCUMENTOS_ENTRADA_MIN_SEARCH_CHARS} caracteres para refinar (ex.: DE% ou %540).`
      : null;

  return (
    <div ref={containerRef} className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </Label>

      {semFornecedor ? (
        <Input
          id={id}
          disabled
          value=""
          placeholder="Selecione o fornecedor primeiro"
          className="bg-muted/40"
        />
      ) : value ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{value}</p>
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
            placeholder="Busque o documento DE..."
            disabled={disabled}
            className="pl-9"
            required={required}
          />
        </div>
      )}

      {!semFornecedor && !value && aberto ? (
        <div
          id={listId}
          role="listbox"
          className="max-h-56 overflow-y-auto rounded-lg border border-border bg-card shadow-sm"
        >
          {carregando ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Buscando documentos...
            </div>
          ) : erro ? (
            <p className="px-3 py-4 text-sm text-destructive" role="alert">
              {erro}
            </p>
          ) : hint ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">{hint}</p>
          ) : resultados.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              Nenhum documento de entrada encontrado para este fornecedor.
            </p>
          ) : (
            <ul>
              {resultados.map((doc) => {
                const dataRef = doc.dataEntrada || doc.dataEmissao;
                return (
                  <li key={doc.id}>
                    <button
                      type="button"
                      role="option"
                      className={cn(
                        "w-full px-3 py-2.5 text-left text-sm transition-colors",
                        "hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                      )}
                      onClick={() => selecionar(doc)}
                    >
                      <span className="block truncate font-medium">
                        {doc.numero}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[
                          dataRef ? formatarData(dataRef) : null,
                          doc.tipoMovimentacao,
                          doc.numeroNFe ? `NF ${doc.numeroNFe}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {!carregando && !erro && resultados.length > 0 ? (
            <p className="border-t px-3 py-2 text-xs text-muted-foreground">
              {termo.trim().length >= DOCUMENTOS_ENTRADA_MIN_SEARCH_CHARS
                ? `${resultados.length} resultado(s). Continue digitando para refinar.`
                : `Exibindo ${resultados.length} documento(s) mais recentes. Digite para buscar.`}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
