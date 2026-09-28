import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@qualidade/components/ui/input";
import { Label } from "@qualidade/components/ui/label";
import { ListaSugestaoFlutuante } from "@qualidade/components/registros/lista-sugestao-flutuante";
import {
  fetchOrganicoColaboradores,
  type OrganicoColaboradorRnc,
} from "@qualidade/lib/registros/fetch-organico-colaboradores-client";
import { cn } from "@qualidade/lib/utils";
import { criarMatcherTextoLivre } from "@/utils/textoLivreBusca";

interface OrganicoResponsavelFieldProps {
  id?: string;
  label?: string;
  value: string;
  onValueChange: (nome: string) => void;
  disabled?: boolean;
}

function detalheColaborador(pessoa: OrganicoColaboradorRnc): string {
  return [pessoa.cargo, pessoa.setor, pessoa.matricula ? `mat. ${pessoa.matricula}` : ""]
    .filter(Boolean)
    .join(" · ");
}

export function OrganicoResponsavelField({
  id = "organico-responsavel",
  label = "Responsável",
  value,
  onValueChange,
  disabled = false,
}: OrganicoResponsavelFieldProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const ancoraRef = useRef<HTMLDivElement>(null);
  const digitandoRef = useRef(false);

  const [termo, setTermo] = useState(value);
  const [opcoes, setOpcoes] = useState<OrganicoColaboradorRnc[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [aberto, setAberto] = useState(false);
  const [selecionado, setSelecionado] = useState(() => Boolean(value.trim()));

  useEffect(() => {
    setTermo(value);
    if (!digitandoRef.current) {
      setSelecionado(Boolean(value.trim()));
    }
  }, [value]);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    fetchOrganicoColaboradores()
      .then((lista) => {
        if (ativo) setOpcoes(lista);
      })
      .catch(() => {
        if (!ativo) return;
        setOpcoes([]);
        setErro("Não foi possível carregar o orgânico.");
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

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

  const filtrados = useMemo(() => {
    const match = criarMatcherTextoLivre(termo);
    return opcoes
      .filter(
        (pessoa) =>
          match(pessoa.nome) ||
          match(pessoa.matricula) ||
          match(pessoa.cargo) ||
          match(pessoa.setor)
      )
      .slice(0, 40);
  }, [opcoes, termo]);

  function selecionar(pessoa: OrganicoColaboradorRnc) {
    digitandoRef.current = false;
    setTermo(pessoa.nome);
    setSelecionado(true);
    onValueChange(pessoa.nome);
    setAberto(false);
  }

  function limparSelecao() {
    digitandoRef.current = false;
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
        <div ref={ancoraRef} className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={id}
            role="combobox"
            aria-expanded={aberto}
            aria-controls={listId}
            autoComplete="off"
            value={termo}
            onChange={(e) => {
              digitandoRef.current = true;
              setTermo(e.target.value);
              setSelecionado(false);
              setAberto(true);
            }}
            onFocus={() => setAberto(true)}
            placeholder="Digite o nome no orgânico… (% refina)"
            disabled={disabled || carregando}
            className="pl-9"
          />
          {carregando ? (
            <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
        </div>
      )}

      <ListaSugestaoFlutuante
        aberto={aberto && !disabled && !selecionado}
        ancoraRef={ancoraRef}
        id={listId}
      >
        {carregando ? (
          <li className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Carregando orgânico...
          </li>
        ) : erro ? (
          <li className="px-3 py-4 text-sm text-destructive" role="alert">
            {erro}
          </li>
        ) : filtrados.length === 0 ? (
          <li className="px-3 py-4 text-sm text-muted-foreground">
            Nenhum colaborador encontrado no orgânico.
          </li>
        ) : (
          filtrados.map((pessoa) => (
            <li key={pessoa.id} role="option">
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted"
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selecionar(pessoa)}
              >
                <span className="font-medium">{pessoa.nome}</span>
                {detalheColaborador(pessoa) ? (
                  <span className="line-clamp-1 text-xs text-muted-foreground">
                    {detalheColaborador(pessoa)}
                  </span>
                ) : null}
              </button>
            </li>
          ))
        )}
      </ListaSugestaoFlutuante>

      <p className="text-xs text-muted-foreground">
        Colaboradores do orgânico, exceto desligados.
      </p>
    </div>
  );
}
