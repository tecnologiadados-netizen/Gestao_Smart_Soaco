import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save } from "lucide-react";
import { Button } from "@rh/components/ui/button";
import { Input } from "@rh/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rh/components/ui/select";
import { useToast } from "@rh/hooks/use-toast";
import { getConfig, getOrganico, setConfig } from "@rh/lib/api-client";
import { rhFieldLabel, rhFieldSelectTrigger, rhFormSection, rhFormSectionBody, rhFormSectionHeader } from "@rh/lib/form-field-styles";
import {
  LIDER_A_DEFINIR,
  ORGANOGRAMA_DIRETORIAS,
  ORGANOGRAMA_VINCULACOES_CONFIG_KEY,
  mergeVinculacoesComSetores,
  normalizarChave,
  normalizarLiderExibido,
  parseOrganogramaVinculacoes,
  stringifyOrganogramaVinculacoes,
  type OrganogramaDiretoriaId,
  type OrganogramaVinculacao,
} from "@rh/lib/organograma-vinculacoes";
import { ORGANICO_IDX, getStatusFromRow } from "@rh/pages/Organico/organico-derive";
import { criarMatcherTextoLivre } from "@/utils/textoLivreBusca";

const STATUS_VALIDOS = new Set(["Ativo", "Férias", "Afastado"]);
const DIRETORIA_NONE = "__none__";
const LIDER_NONE = "__a_definir__";

type LiderOpcao = {
  value: string;
  label: string;
  nome: string;
  matricula?: string;
  cargo?: string;
};

function cell(values: unknown[], index: number): string {
  return values[index] != null ? String(values[index]).trim() : "";
}

export function OrganogramaVinculosConfigPanel({ canEdit }: { canEdit: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState("");
  const [draft, setDraft] = useState<OrganogramaVinculacao[]>([]);
  const [dirty, setDirty] = useState(false);

  const { data: organicoRows = [], isLoading: loadingOrganico } = useQuery({
    queryKey: ["organico"],
    queryFn: getOrganico,
    staleTime: 60_000,
  });

  const { data: vinculacoesRaw, isLoading: loadingConfig } = useQuery({
    queryKey: ["organograma-vinculacoes"],
    queryFn: async () => (await getConfig(ORGANOGRAMA_VINCULACOES_CONFIG_KEY)).value,
    staleTime: 30_000,
  });

  const setoresAtivos = useMemo(() => {
    const bySetor = new Map<string, { setor: string; area: string; count: number }>();
    for (const row of organicoRows) {
      const values = Array.isArray(row.values) ? row.values : [];
      const status = getStatusFromRow(values);
      if (!STATUS_VALIDOS.has(status)) continue;
      const setor = cell(values, ORGANICO_IDX.SETOR);
      if (!setor) continue;
      const area = cell(values, ORGANICO_IDX.AREA);
      const key = normalizarChave(setor);
      const prev = bySetor.get(key);
      if (!prev) {
        bySetor.set(key, { setor, area, count: 1 });
      } else {
        prev.count += 1;
        if (!prev.area && area) prev.area = area;
      }
    }
    return [...bySetor.values()].sort((a, b) => a.setor.localeCompare(b.setor, "pt-BR"));
  }, [organicoRows]);

  const lideresPorSetor = useMemo(() => {
    const map = new Map<string, LiderOpcao[]>();
    const pessoasPorNome = new Map<string, { matricula: string; cargo: string; nome: string }>();

    for (const row of organicoRows) {
      const values = Array.isArray(row.values) ? row.values : [];
      const status = getStatusFromRow(values);
      if (!STATUS_VALIDOS.has(status)) continue;
      const nome = cell(values, ORGANICO_IDX.NOME);
      const matricula = cell(values, ORGANICO_IDX.MATRICULA);
      const cargo = cell(values, ORGANICO_IDX.CARGO);
      const setor = cell(values, ORGANICO_IDX.SETOR);
      if (!nome || !setor) continue;
      pessoasPorNome.set(normalizarChave(nome), { nome, matricula, cargo });

      const key = normalizarChave(setor);
      const list = map.get(key) ?? [];
      list.push({
        value: matricula || `__nome:${nome}`,
        label: cargo ? `${nome} · ${cargo}` : nome,
        nome,
        matricula: matricula || undefined,
        cargo: cargo || undefined,
      });
      map.set(key, list);
    }

    // Inclui gestores imediatos citados no setor (mesmo se lotados em outro setor).
    for (const row of organicoRows) {
      const values = Array.isArray(row.values) ? row.values : [];
      const status = getStatusFromRow(values);
      if (!STATUS_VALIDOS.has(status)) continue;
      const setor = cell(values, ORGANICO_IDX.SETOR);
      const liderNome = cell(values, ORGANICO_IDX.GESTOR_IMEDIATO);
      if (!setor || !liderNome) continue;
      if (normalizarLiderExibido(liderNome) === LIDER_A_DEFINIR) continue;
      const key = normalizarChave(setor);
      const list = map.get(key) ?? [];
      const pessoa = pessoasPorNome.get(normalizarChave(liderNome));
      const value = pessoa?.matricula || `__nome:${liderNome}`;
      if (list.some((item) => item.value === value)) continue;
      list.push({
        value,
        label: pessoa?.cargo ? `${liderNome} · ${pessoa.cargo}` : liderNome,
        nome: liderNome,
        matricula: pessoa?.matricula,
        cargo: pessoa?.cargo,
      });
      map.set(key, list);
    }

    for (const [key, list] of map) {
      list.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      map.set(key, list);
    }
    return map;
  }, [organicoRows]);

  useEffect(() => {
    if (dirty) return;
    const salvos = parseOrganogramaVinculacoes(vinculacoesRaw);
    setDraft(mergeVinculacoesComSetores(setoresAtivos, salvos));
  }, [vinculacoesRaw, setoresAtivos, dirty]);

  const matchFiltro = useMemo(() => criarMatcherTextoLivre(filtro), [filtro]);
  const linhas = useMemo(
    () =>
      draft.filter(
        (item) =>
          matchFiltro(item.setor) ||
          matchFiltro(item.area) ||
          matchFiltro(item.liderNome) ||
          matchFiltro(ORGANOGRAMA_DIRETORIAS.find((d) => d.id === item.diretoriaId)?.nome ?? ""),
      ),
    [draft, matchFiltro],
  );

  const vinculadosCount = draft.filter((item) => item.diretoriaId).length;
  const pendentesCount = draft.length - vinculadosCount;

  const saveMutation = useMutation({
    mutationFn: async (items: OrganogramaVinculacao[]) => {
      await setConfig(ORGANOGRAMA_VINCULACOES_CONFIG_KEY, stringifyOrganogramaVinculacoes(items));
    },
    onSuccess: async () => {
      setDirty(false);
      await queryClient.invalidateQueries({ queryKey: ["organograma-vinculacoes"] });
      toast({ title: "Vínculos salvos", description: "O mapa de vínculos foi atualizado." });
    },
    onError: (e) => {
      toast({
        title: "Erro ao salvar",
        description: (e as Error).message,
        variant: "destructive",
      });
    },
  });

  const updateLinha = (setorKey: string, patch: Partial<OrganogramaVinculacao>) => {
    setDirty(true);
    setDraft((prev) =>
      prev.map((item) => (normalizarChave(item.setor) === setorKey ? { ...item, ...patch } : item)),
    );
  };

  const loading = loadingOrganico || loadingConfig;

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Configurações</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Defina a qual diretoria cada setor (Secullum/Orgânico) se reporta e quem é o líder imediato.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="border border-border bg-card px-3 py-2 font-semibold text-foreground">
            {draft.length} setores
          </span>
          <span className="border border-border bg-card px-3 py-2 font-semibold text-foreground">
            {vinculadosCount} vinculados
          </span>
          <span className="border border-border bg-card px-3 py-2 font-semibold text-foreground">
            {pendentesCount} sem diretoria
          </span>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              disabled={!dirty || saveMutation.isPending}
              onClick={() => saveMutation.mutate(draft)}
            >
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar vínculos
            </Button>
          ) : null}
        </div>
      </div>

      <section className={rhFormSection}>
        <header className={rhFormSectionHeader}>Setores da empresa</header>
        <div className={rhFormSectionBody}>
          <div className="mb-4 max-w-md">
            <label className={rhFieldLabel} htmlFor="org-vinculos-filtro">
              Buscar setor (use % como curinga)
            </label>
            <Input
              id="org-vinculos-filtro"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Ex.: PCP, Vendas%, %Administrativo"
            />
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando setores…
            </div>
          ) : linhas.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhum setor encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2 font-semibold">Setor</th>
                    <th className="px-2 py-2 font-semibold">Área</th>
                    <th className="px-2 py-2 font-semibold">Diretoria</th>
                    <th className="px-2 py-2 font-semibold">Líder do setor</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((item) => {
                    const setorKey = normalizarChave(item.setor);
                    const opcoesLider = lideresPorSetor.get(setorKey) ?? [];
                    const liderValue =
                      item.liderNome === LIDER_A_DEFINIR
                        ? LIDER_NONE
                        : item.liderMatricula ||
                          opcoesLider.find((o) => normalizarChave(o.nome) === normalizarChave(item.liderNome))
                            ?.value ||
                          (item.liderNome ? `__nome:${item.liderNome}` : LIDER_NONE);

                    return (
                      <tr key={item.setor} className="border-b border-border/60 align-top">
                        <td className="px-2 py-3 font-medium text-foreground">{item.setor}</td>
                        <td className="px-2 py-3 text-muted-foreground">{item.area || "—"}</td>
                        <td className="px-2 py-3">
                          <Select
                            value={item.diretoriaId || DIRETORIA_NONE}
                            disabled={!canEdit}
                            onValueChange={(value) =>
                              updateLinha(setorKey, {
                                diretoriaId:
                                  value === DIRETORIA_NONE ? "" : (value as OrganogramaDiretoriaId),
                              })
                            }
                          >
                            <SelectTrigger className={rhFieldSelectTrigger}>
                              <SelectValue placeholder="Selecione a diretoria" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={DIRETORIA_NONE}>Sem diretoria</SelectItem>
                              {ORGANOGRAMA_DIRETORIAS.map((diretoria) => (
                                <SelectItem key={diretoria.id} value={diretoria.id}>
                                  {diretoria.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-3">
                          <Select
                            value={liderValue}
                            disabled={!canEdit}
                            onValueChange={(value) => {
                              if (value === LIDER_NONE) {
                                updateLinha(setorKey, {
                                  liderNome: LIDER_A_DEFINIR,
                                  liderMatricula: undefined,
                                  cargo: undefined,
                                });
                                return;
                              }
                              const opcao =
                                opcoesLider.find((o) => o.value === value) ||
                                (value.startsWith("__nome:")
                                  ? {
                                      value,
                                      label: value.slice("__nome:".length),
                                      nome: value.slice("__nome:".length),
                                    }
                                  : null);
                              if (!opcao) return;
                              updateLinha(setorKey, {
                                liderNome: normalizarLiderExibido(opcao.nome),
                                liderMatricula: opcao.matricula,
                                cargo: opcao.cargo,
                              });
                            }}
                          >
                            <SelectTrigger className={rhFieldSelectTrigger}>
                              <SelectValue placeholder="Selecione o líder" />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                              <SelectItem value={LIDER_NONE}>{LIDER_A_DEFINIR}</SelectItem>
                              {item.liderNome !== LIDER_A_DEFINIR &&
                              !opcoesLider.some((o) => o.value === liderValue) ? (
                                <SelectItem value={liderValue}>{item.liderNome}</SelectItem>
                              ) : null}
                              {opcoesLider.map((opcao) => (
                                <SelectItem key={opcao.value} value={opcao.value}>
                                  {opcao.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
