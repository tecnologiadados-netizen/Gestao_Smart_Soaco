import { useCallback, useMemo, useState } from "react";
import { ChevronDown, Plus, Trash2, Search } from "lucide-react";
import { Input } from "@rh/components/ui/input";
import { Button } from "@rh/components/ui/button";
import type { FaltaGrupoSintomaCidRow } from "@rh/types/api";
import { textIncludesSearch } from "@rh/lib/normalize-search-text";
import { tituloGrupoSintoma } from "@rh/lib/grupos-sintomas-cid-titulos";
import CidCadastroSugestaoInput from "@rh/pages/FaltasAtestados/CidCadastroSugestaoInput";
import { normalizarParaLinhaCadastro } from "@rh/lib/grupos-sintomas-cid-utils";

type Props = {
  grupos: FaltaGrupoSintomaCidRow[];
  setGrupos: React.Dispatch<React.SetStateAction<FaltaGrupoSintomaCidRow[]>>;
  cidsCadastro: string[];
  canEdit?: boolean;
  search: string;
  setSearch: (s: string) => void;
};

export default function GruposSintomasColumn({
  grupos,
  setGrupos,
  cidsCadastro,
  canEdit = true,
  search,
  setSearch,
}: Props) {
  const [abertoId, setAbertoId] = useState<string | null>(null);

  const gruposOrdenados = useMemo(
    () => [...grupos].sort((a, b) => a.ordem - b.ordem),
    [grupos],
  );

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return gruposOrdenados;
    return gruposOrdenados.filter(
      (g) =>
        textIncludesSearch(tituloGrupoSintoma(g.id, g.titulo), q)
        || g.cids.some((c) => textIncludesSearch(c, q)),
    );
  }, [gruposOrdenados, search]);

  const totalCids = useMemo(() => grupos.reduce((acc, g) => acc + g.cids.length, 0), [grupos]);

  const addCid = useCallback(
    (grupoId: string) =>
      setGrupos((prev) =>
        prev.map((g) => (g.id === grupoId ? { ...g, cids: [...g.cids, ""] } : g)),
      ),
    [setGrupos],
  );

  const updateCid = useCallback(
    (grupoId: string, index: number, valor: string) =>
      setGrupos((prev) =>
        prev.map((g) => {
          if (g.id !== grupoId) return g;
          const cids = [...g.cids];
          cids[index] = valor;
          return { ...g, cids };
        }),
      ),
    [setGrupos],
  );

  const commitCid = useCallback(
    (grupoId: string, index: number, valor: string) => {
      const normalized = normalizarParaLinhaCadastro(valor, cidsCadastro);
      if (normalized !== valor.trim()) {
        updateCid(grupoId, index, normalized);
      }
    },
    [cidsCadastro, updateCid],
  );

  const removeCid = useCallback(
    (grupoId: string, index: number) =>
      setGrupos((prev) =>
        prev.map((g) => {
          if (g.id !== grupoId) return g;
          return { ...g, cids: g.cids.filter((_, i) => i !== index) };
        }),
      ),
    [setGrupos],
  );

  return (
    <div className="border border-border rounded-xl bg-card shadow-sm flex flex-col min-h-[280px] overflow-hidden lg:col-span-2">
      <div className="px-4 py-3 border-b border-border bg-muted/40">
        <p className="text-sm font-semibold text-foreground">Grupos de sintomas (CID-10)</p>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          Mesmo padrão do painel «Quais os principais CIDs?». Clique num grupo para ver as linhas do cadastro
          correlatas. A classificação de ausências usa a mesma regra clínica do diagnóstico.
        </p>
      </div>
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar grupo ou CID do cadastro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
      </div>
      <ul className="overflow-auto flex-1 max-h-[calc(100vh-320px)] p-3 space-y-2">
        {filtered.map((grupo, index) => {
          const titulo = tituloGrupoSintoma(grupo.id, grupo.titulo);
          const expandido = abertoId === grupo.id;
          return (
            <li key={grupo.id} className={`relative ${expandido ? "z-10" : "z-0"}`}>
              <button
                type="button"
                aria-expanded={expandido}
                className="flex w-full items-start gap-3 rounded-xl border border-border py-3 pl-4 pr-3 text-left shadow-sm transition hover:bg-muted/30"
                onClick={() => setAbertoId((cur) => (cur === grupo.id ? null : grupo.id))}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-foreground">{titulo}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {grupo.cids.length} linha(s) do cadastro neste grupo
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 pt-0.5">
                  <span className="inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-primary/10 px-2 text-xs font-bold tabular-nums text-primary">
                    {index + 1}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expandido ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </div>
              </button>
              {expandido ? (
                <div className="mt-1 rounded-xl border border-border bg-background shadow-md overflow-hidden">
                  <div className="border-b border-border px-4 py-2 bg-muted/30">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      CIDs neste grupo (cadastro)
                    </p>
                  </div>
                  <ul className="max-h-[240px] overflow-y-auto p-2 space-y-0">
                    {grupo.cids.map((cid, idx) => (
                      <li
                        key={`${grupo.id}-${idx}-${cid}`}
                        className="group flex gap-1 border-b border-border/50 py-2 last:border-0"
                      >
                        {canEdit ? (
                          <>
                            <CidCadastroSugestaoInput
                              value={cid}
                              onChange={(v) => updateCid(grupo.id, idx, v)}
                              onBlur={(v) => commitCid(grupo.id, idx, v)}
                              options={cidsCadastro}
                              disabled={!canEdit}
                              placeholder="Linha do cadastro de CIDs…"
                            />
                            <button
                              type="button"
                              onClick={() => removeCid(grupo.id, idx)}
                              className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-destructive hover:bg-destructive/10 rounded-sm self-start"
                              aria-label="Remover CID"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <span className="text-sm leading-snug text-foreground px-1">{cid}</span>
                        )}
                      </li>
                    ))}
                    {canEdit ? (
                      <li className="pt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => addCid(grupo.id)}
                        >
                          <Plus className="w-3 h-3 mr-1" /> Adicionar linha do cadastro
                        </Button>
                      </li>
                    ) : null}
                    {grupo.cids.length === 0 ? (
                      <li className="py-4 text-center text-xs text-muted-foreground">
                        Nenhuma linha do cadastro neste grupo.
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </li>
          );
        })}
        {filtered.length === 0 ? (
          <li className="py-10 text-center text-muted-foreground text-sm">Nenhum grupo encontrado.</li>
        ) : null}
      </ul>
      <div className="text-xs text-muted-foreground px-4 py-2 border-t border-border bg-muted/20">
        {filtered.length} de {grupos.length} grupo(s) · {totalCids} linha(s) de CID no cadastro
      </div>
    </div>
  );
}
