import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Search, Trash2 } from "lucide-react";
import { Button } from "@rh/components/ui/button";
import { Input } from "@rh/components/ui/input";
import {
  getMotivosDesligamento,
  isApiConfigured,
  replaceMotivosDesligamentoFilhos,
  type MotivoDesligamentoPai,
} from "@rh/lib/api-client";
import { rhFieldInput } from "@rh/lib/form-field-styles";
import { normalizarMotivoPai } from "@rh/lib/motivo-desligamento";
import { randomUUID } from "@rh/lib/utils";
import { useToast } from "@rh/hooks/use-toast";
import { criarMatcherTextoLivre } from "@/utils/textoLivreBusca";

const PAIS_VAZIOS: MotivoDesligamentoPai[] = [];

type FilhoDraft = { key: string; descricao: string };

function filhosDoPai(pai: MotivoDesligamentoPai | undefined): FilhoDraft[] {
  return (pai?.filhos ?? []).map((filho) => ({ key: filho.id, descricao: filho.descricao }));
}

export default function MotivosDesligamentoCadastro({ canEdit }: { canEdit: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState("");
  const [filhos, setFilhos] = useState<FilhoDraft[]>([]);
  const [salvando, setSalvando] = useState(false);

  const { data: pais = PAIS_VAZIOS, isLoading, isError, refetch } = useQuery({
    queryKey: ["motivos-desligamento"],
    queryFn: getMotivosDesligamento,
    enabled: isApiConfigured(),
    staleTime: 30_000,
  });

  const filtrados = useMemo(() => {
    const match = criarMatcherTextoLivre(busca);
    return pais.filter((pai) => match(pai.motivoPai));
  }, [pais, busca]);

  useEffect(() => {
    if (selecionado && pais.some((pai) => pai.motivoPai === selecionado)) return;
    setSelecionado(filtrados[0]?.motivoPai ?? pais[0]?.motivoPai ?? "");
  }, [filtrados, pais, selecionado]);

  const paiAtual = pais.find((pai) => pai.motivoPai === selecionado);
  const assinaturaServidor = paiAtual?.filhos.map((filho) => `${filho.id}\t${filho.descricao}`).join("\n") ?? "";

  useEffect(() => {
    const atual = pais.find((pai) => pai.motivoPai === selecionado);
    setFilhos(filhosDoPai(atual));
  }, [selecionado, assinaturaServidor, pais]);

  const adicionar = () => setFilhos((prev) => [...prev, { key: `new-${randomUUID()}`, descricao: "" }]);
  const remover = (key: string) => setFilhos((prev) => prev.filter((item) => item.key !== key));

  const salvar = async () => {
    if (!paiAtual) return;
    const descricoes = filhos.map((item) => item.descricao.trim()).filter(Boolean);
    const vistos = new Set<string>();
    for (const descricao of descricoes) {
      const key = normalizarMotivoPai(descricao);
      if (vistos.has(key)) {
        toast({
          title: "Motivo filho repetido",
          description: `"${descricao}" já está na lista deste motivo.`,
          variant: "destructive",
        });
        return;
      }
      vistos.add(key);
    }
    setSalvando(true);
    try {
      await replaceMotivosDesligamentoFilhos({
        motivoPai: paiAtual.motivoPai,
        filhos: descricoes.map((descricao) => ({ descricao })),
      });
      await queryClient.invalidateQueries({ queryKey: ["motivos-desligamento"] });
      toast({
        title: "Motivos filhos salvos",
        description: `${paiAtual.motivoPai}: ${descricoes.length} motivo(s).`,
      });
    } catch (error) {
      toast({
        title: "Não foi possível salvar",
        description: error instanceof Error ? error.message : "Erro ao gravar os motivos filhos.",
        variant: "destructive",
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <section className="rounded-sm border border-border bg-card shadow-level-1">
      <div className="border-b border-border bg-muted/50 px-3 py-2.5">
        <p className="text-xs font-semibold tracking-wide">Motivos de desligamento (filhos)</p>
        <p className="mt-1 text-xs text-muted-foreground">
          O motivo pai vem da Secullum. Cada um tem a própria lista de motivos filhos, usada no alerta amarelo do
          Orgânico junto com um texto livre.
        </p>
      </div>
      {isLoading ? (
        <p className="px-3 py-6 text-sm text-muted-foreground">Carregando motivos da Secullum…</p>
      ) : isError ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-4">
          <p className="text-sm text-destructive">Não foi possível carregar os motivos de desligamento.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : pais.length === 0 ? (
        <p className="px-3 py-6 text-sm text-muted-foreground">
          Nenhum motivo pai encontrado na Secullum. Eles aparecem aqui quando a integração devolver o catálogo de
          demissão ou quando surgir um desligamento pendente.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-0 md:grid-cols-[minmax(220px,280px)_1fr]">
          <div className="border-b border-border md:border-b-0 md:border-r">
            <div className="p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  placeholder="Buscar motivo pai... use %"
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
            <div className="max-h-80 overflow-auto">
              {filtrados.length === 0 ? (
                <p className="px-3 py-4 text-xs text-muted-foreground">Nenhum motivo pai com esse filtro.</p>
              ) : (
                filtrados.map((pai) => {
                  const ativo = pai.motivoPai === selecionado;
                  return (
                    <button
                      key={pai.motivoPai}
                      type="button"
                      onClick={() => setSelecionado(pai.motivoPai)}
                      className={`flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 ${
                        ativo ? "bg-accent/15 font-medium text-foreground" : "hover:bg-muted/40"
                      }`}
                    >
                      <span className="min-w-0 truncate">{pai.motivoPai}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{pai.filhos.length}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <div className="flex min-h-64 flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
              <p className="text-sm font-medium text-foreground">{paiAtual?.motivoPai ?? "Selecione um motivo pai"}</p>
              {canEdit && paiAtual ? (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={adicionar}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Filho
                  </Button>
                  <Button type="button" size="sm" className="h-8 text-xs" onClick={salvar} disabled={salvando}>
                    <Save className="mr-1 h-3.5 w-3.5" /> {salvando ? "Salvando..." : "Salvar filhos"}
                  </Button>
                </div>
              ) : null}
            </div>
            <div className="flex-1 space-y-2 overflow-auto p-3">
              {filhos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum motivo filho neste motivo pai.</p>
              ) : (
                filhos.map((filho) => (
                  <div key={filho.key} className="flex items-center gap-2">
                    <Input
                      value={filho.descricao}
                      readOnly={!canEdit}
                      onChange={(event) =>
                        setFilhos((prev) =>
                          prev.map((item) => (item.key === filho.key ? { ...item, descricao: event.target.value } : item)),
                        )
                      }
                      placeholder="Descrição do motivo filho"
                      className={rhFieldInput}
                    />
                    {canEdit ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive hover:text-destructive"
                        onClick={() => remover(filho.key)}
                        aria-label="Remover motivo filho"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
