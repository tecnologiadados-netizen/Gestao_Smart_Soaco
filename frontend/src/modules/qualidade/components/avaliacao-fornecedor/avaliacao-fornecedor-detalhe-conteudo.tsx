import { Badge } from "@qualidade/components/ui/badge";
import { StarRatingDisplay } from "@qualidade/components/avaliacao-fornecedor/star-rating";
import { CRITERIOS_AVALIACAO, NOTA_MAX } from "@qualidade/lib/avaliacao-fornecedor/criterios";
import type { AvaliacaoDetalheViewModel } from "@qualidade/lib/avaliacao-fornecedor/montar-detalhe-avaliacao";

function NotaResumo({
  titulo,
  descricao,
  nota,
}: {
  titulo: string;
  descricao?: string;
  nota: number | null;
}) {
  return (
    <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-3">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      {descricao ? (
        <p className="mt-0.5 text-[11px] text-muted-foreground/80">{descricao}</p>
      ) : null}
      {typeof nota === "number" ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StarRatingDisplay
            value={Math.round(nota)}
            size="md"
            showValue={false}
          />
          <span className="text-lg font-semibold text-primary tabular-nums">
            {nota.toFixed(1)}/{NOTA_MAX}
          </span>
        </div>
      ) : (
        <p className="mt-2 text-sm font-medium text-muted-foreground">—</p>
      )}
    </div>
  );
}

interface AvaliacaoFornecedorDetalheConteudoProps {
  viewModel: AvaliacaoDetalheViewModel;
}

export function AvaliacaoFornecedorDetalheConteudo({
  viewModel,
}: AvaliacaoFornecedorDetalheConteudoProps) {
  const { avaliacao } = viewModel;

  return (
    <div className="overflow-hidden bg-background text-foreground">
      <div className="modal-header-bar px-5 py-3.5">
        <h2 className="text-base font-semibold text-white">
          Detalhe da avaliação
        </h2>
        <p className="mt-0.5 text-xs text-white/80">
          {avaliacao.fornecedorNome}
        </p>
      </div>

      <div className="space-y-4 p-6">
        <fieldset className="brand-fieldset space-y-3">
          <legend>Dados da avaliação</legend>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Data referência</p>
              <p className="font-medium">{viewModel.dataReferenciaFormatada}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Data avaliação</p>
              <p className="font-medium">{viewModel.dataAvaliacaoFormatada}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Responsável</p>
              <p className="font-medium">{viewModel.avaliadorNome}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Nº documento</p>
              <p className="font-medium">
                {avaliacao.numeroDocumento || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fornecedor aprovado</p>
              {viewModel.fornecedorAprovadoLabel ? (
                <Badge
                  variant={
                    avaliacao.fornecedorAprovado ? "default" : "destructive"
                  }
                >
                  {viewModel.fornecedorAprovadoLabel}
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
          <NotaResumo
            titulo="Nota desta avaliação"
            descricao={viewModel.descricaoNotaDocumento}
            nota={avaliacao.media}
          />
          <NotaResumo
            titulo="Média do fornecedor (6 meses)"
            descricao={viewModel.descricaoMediaSeisMeses}
            nota={viewModel.mediaSeisMeses.media}
          />
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
            <p className="mt-1 text-sm whitespace-pre-wrap">
              {avaliacao.observacoes}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
