import { Dialog, DialogContent } from "@qualidade/components/ui/dialog";
import { Button } from "@qualidade/components/ui/button";
import { Badge } from "@qualidade/components/ui/badge";
import { StarRatingDisplay } from "@qualidade/components/avaliacao-fornecedor/star-rating";
import { CRITERIOS_AVALIACAO, NOTA_MAX } from "@qualidade/lib/avaliacao-fornecedor/criterios";
import { formatarData } from "@qualidade/lib/utils/dates";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import {
  getDataAvaliacao,
  type AvaliacaoFornecedor,
} from "@qualidade/types/avaliacao-fornecedor";

interface AvaliacaoDetalheDialogProps {
  avaliacao: AvaliacaoFornecedor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AvaliacaoDetalheDialog({
  avaliacao,
  open,
  onOpenChange,
}: AvaliacaoDetalheDialogProps) {
  const users = useConfigStore((s) => s.users);

  if (!avaliacao) return null;

  const avaliador = users.find((u) => u.id === avaliacao.avaliadorId);
  const dataAvaliacao = getDataAvaliacao(avaliacao);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92vh,100dvh)] max-w-lg gap-0 overflow-hidden p-0">
        <div className="modal-header-bar px-5 py-3.5">
          <h2 className="text-base font-semibold text-white">
            Detalhe da avaliação
          </h2>
          <p className="mt-0.5 text-xs text-white/80">
            {avaliacao.fornecedorNome}
          </p>
        </div>

        <div className="space-y-4 overflow-y-auto p-6">
          <fieldset className="brand-fieldset space-y-3">
            <legend>Dados da avaliação</legend>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Data referência</p>
                <p className="font-medium">
                  {avaliacao.dataReferencia
                    ? formatarData(avaliacao.dataReferencia)
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Data avaliação</p>
                <p className="font-medium">{formatarData(dataAvaliacao)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Responsável</p>
                <p className="font-medium">{avaliador?.nome ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Nº documento</p>
                <p className="font-medium">
                  {avaliacao.numeroDocumento || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fornecedor aprovado</p>
                {typeof avaliacao.fornecedorAprovado === "boolean" ? (
                  <Badge
                    variant={
                      avaliacao.fornecedorAprovado ? "default" : "destructive"
                    }
                  >
                    {avaliacao.fornecedorAprovado ? "Sim" : "Não"}
                  </Badge>
                ) : (
                  <p className="font-medium">—</p>
                )}
              </div>
              {avaliacao.rncNumero ? (
                <div>
                  <p className="text-xs text-muted-foreground">RNC Nº</p>
                  <p className="font-medium">{avaliacao.rncNumero}</p>
                </div>
              ) : null}
            </div>
          </fieldset>

          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground">Média geral</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StarRatingDisplay
                  value={Math.round(avaliacao.media)}
                  size="md"
                  showValue={false}
                />
                <span className="text-lg font-semibold text-primary">
                  {avaliacao.media.toFixed(1)}/{NOTA_MAX}
                </span>
              </div>
            </div>
          </div>

          <fieldset className="brand-fieldset space-y-3">
            <legend>Notas por critério</legend>
            <ul className="space-y-2">
              {CRITERIOS_AVALIACAO.map((criterio) => {
                const nota = avaliacao.notas[criterio.id];
                return (
                  <li
                    key={criterio.id}
                    className="flex flex-col gap-2 rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span>{criterio.label}</span>
                    {typeof nota === "number" ? (
                      <StarRatingDisplay value={nota} size="sm" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </fieldset>

          {avaliacao.observacoes ? (
            <div>
              <p className="text-xs text-muted-foreground">Observações</p>
              <p className="mt-1 text-sm">{avaliacao.observacoes}</p>
            </div>
          ) : null}
        </div>

        <div className="sgq-form-footer justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
