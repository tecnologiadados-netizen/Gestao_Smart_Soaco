"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  adicionarOpcaoCustomizada,
  carregarOpcoesCustomizadas,
  filtrarOpcoesLista,
  mesclarOpcoesLista,
} from "@/lib/registros/opcoes-lista-customizadas";
import { cn } from "@/lib/utils";

interface OpcaoListaPesquisavelFieldProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  opcoesBase: readonly string[];
  storageKey: string;
  disabled?: boolean;
  placeholder?: string;
}

export function OpcaoListaPesquisavelField({
  id,
  label,
  value,
  onChange,
  opcoesBase,
  storageKey,
  disabled = false,
  placeholder = "Selecione...",
}: OpcaoListaPesquisavelFieldProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [novaOpcao, setNovaOpcao] = useState("");
  const [opcoesCustomizadas, setOpcoesCustomizadas] = useState<string[]>([]);

  useEffect(() => {
    setOpcoesCustomizadas(carregarOpcoesCustomizadas(storageKey));
  }, [storageKey]);

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

  const opcoes = useMemo(
    () => mesclarOpcoesLista(opcoesBase, opcoesCustomizadas, value),
    [opcoesBase, opcoesCustomizadas, value]
  );

  const opcoesFiltradas = useMemo(
    () => filtrarOpcoesLista(opcoes, busca),
    [opcoes, busca]
  );

  function selecionar(opcao: string) {
    onChange(opcao);
    setAberto(false);
    setBusca("");
    setNovaOpcao("");
  }

  function handleAdicionar(termo: string) {
    const trimmed = termo.trim();
    if (!trimmed) return;

    const proximas = adicionarOpcaoCustomizada(
      storageKey,
      opcoesCustomizadas,
      opcoesBase,
      trimmed
    );
    setOpcoesCustomizadas(proximas);
    onChange(trimmed);
    setAberto(false);
    setBusca("");
    setNovaOpcao("");
  }

  if (disabled) {
    return (
      <div className="space-y-2">
        {label ? <Label htmlFor={id}>{label}</Label> : null}
        <Input
          id={id}
          value={value}
          readOnly
          disabled
          className="bg-muted/40"
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative space-y-2">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={listId}
        onClick={() => setAberto((prev) => !prev)}
        className={cn(
          "flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-2.5 py-2 text-sm transition-colors outline-none select-none",
          "hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "dark:bg-input/30 dark:hover:bg-input/50"
        )}
      >
        <span className={cn("truncate text-left", !value && "text-muted-foreground")}>
          {value || placeholder}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {aberto ? (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-md">
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Pesquisar..."
                className="h-8 pl-9"
                autoFocus
              />
            </div>
          </div>

          <ul
            id={listId}
            role="listbox"
            className="max-h-52 overflow-auto py-1"
          >
            {opcoesFiltradas.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                Nenhuma opção encontrada.
              </li>
            ) : (
              opcoesFiltradas.map((opcao) => (
                <li key={opcao} role="option" aria-selected={value === opcao}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full px-3 py-2 text-left text-sm hover:bg-muted",
                      value === opcao && "bg-muted/60 font-medium"
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selecionar(opcao)}
                  >
                    {opcao}
                  </button>
                </li>
              ))
            )}
          </ul>

          <div className="flex gap-2 border-t border-border p-2">
            <Input
              value={novaOpcao}
              onChange={(e) => setNovaOpcao(e.target.value)}
              placeholder="Nova opção..."
              className="h-8"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdicionar(novaOpcao || busca);
                }
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0"
              disabled={!(novaOpcao.trim() || busca.trim())}
              onClick={() => handleAdicionar(novaOpcao || busca)}
            >
              <Plus className="size-4" />
              Adicionar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
