import { AlertTriangle, CheckCircle2, FileText, XCircle } from "lucide-react";
import type { DocumentVersion } from "@qualidade/types/document";
import type { User } from "@qualidade/types/user";
import { formatarDataHora } from "@qualidade/lib/utils/dates";

interface Props {
  version: DocumentVersion;
  users: User[];
}

export function DocumentoHistoricoElaboracao({
  version,
  users,
  ocultarArquivo = false,
  documentoAjustadoNoConsenso = false,
}: Props & {
  ocultarArquivo?: boolean;
  documentoAjustadoNoConsenso?: boolean;
}) {
  const elaborador = users.find((u) => u.id === version.elaboradorId);

  return (
    <fieldset className="brand-fieldset space-y-4">
      <legend className="text-base">Elaboração</legend>

      <div className="flex items-start gap-3 rounded-lg border border-brand-blue-muted/60 bg-background/80 p-4">
        <div className="rounded-md bg-brand-blue-light p-2">
          <FileText className="size-5 text-brand-blue" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm text-muted-foreground">
            Elaborado por{" "}
            <span className="font-medium text-foreground">
              {elaborador?.nome ?? "—"}
            </span>
            {!documentoAjustadoNoConsenso && version.arquivoAtualizadoEm && (
              <> · Atualizado em {formatarDataHora(version.arquivoAtualizadoEm)}</>
            )}
          </p>

          {documentoAjustadoNoConsenso ? (
            <div className="rounded-md border border-brand-blue/30 bg-brand-blue-light/40 p-3 text-sm text-brand-navy">
              O documento foi ajustado na etapa de consenso após reprovação da
              aprovação. A versão final para análise está disponível no quadro
              de Consenso.
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-brand-navy">
                {ocultarArquivo
                  ? "Arquivo disponível para substituição abaixo"
                  : (version.arquivoNome ?? "Nenhum arquivo anexado")}
              </p>
              {!ocultarArquivo &&
                version.arquivoDataUrl &&
                version.arquivoNome && (
                  <a
                    href={version.arquivoDataUrl}
                    download={version.arquivoNome}
                    className="inline-block text-sm font-medium text-brand-blue hover:underline"
                  >
                    Baixar arquivo
                  </a>
                )}
            </>
          )}

          {version.observacoesElaboracao && (
            <p className="text-sm text-muted-foreground">
              {version.observacoesElaboracao}
            </p>
          )}
        </div>
      </div>
    </fieldset>
  );
}

export function DocumentoHistoricoConsenso({ version, users }: Props) {
  const responsavelConsenso = users.find((u) => u.id === version.consensoId);

  return (
    <fieldset className="brand-fieldset space-y-4">
      <legend className="text-base">Consenso</legend>

      <div className="flex items-start gap-3 rounded-lg border border-brand-blue-muted/60 bg-background/80 p-4">
        <div className="rounded-md bg-brand-blue-light p-2">
          <FileText className="size-5 text-brand-blue" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm text-muted-foreground">
            Registrado por{" "}
            <span className="font-medium text-foreground">
              {responsavelConsenso?.nome ?? "—"}
            </span>
            {version.arquivoAtualizadoEm && (
              <> · Atualizado em {formatarDataHora(version.arquivoAtualizadoEm)}</>
            )}
            {!version.arquivoAtualizadoEm && version.dataRevisao && (
              <>
                {" "}
                · {new Date(version.dataRevisao).toLocaleDateString("pt-BR")}
              </>
            )}
          </p>
          <p className="text-sm font-medium text-brand-navy">
            {version.arquivoNome ?? "Nenhum arquivo anexado"}
          </p>
          {version.observacoesConsenso && (
            <p className="text-sm text-muted-foreground">
              {version.observacoesConsenso}
            </p>
          )}
          {version.arquivoDataUrl && version.arquivoNome && (
            <a
              href={version.arquivoDataUrl}
              download={version.arquivoNome}
              className="inline-block text-sm font-medium text-brand-blue hover:underline"
            >
              Baixar arquivo
            </a>
          )}
        </div>
      </div>
    </fieldset>
  );
}

export function DocumentoLogsProcesso({ version, users }: Props) {
  const movimentacoes = version.movimentacoes ?? [];

  return (
    <div className="brand-fieldset rounded-lg p-4">
      <h2 className="mb-3 text-base font-semibold text-brand-navy">
        Logs do processo
      </h2>
      {movimentacoes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
      ) : (
        <ul className="space-y-3">
          {movimentacoes.map((mov) => {
            const usuario = users.find((u) => u.id === mov.usuarioId);
            const aprovou = mov.acao === "aprovacao";
            return (
              <li
                key={mov.id}
                className="rounded-lg border border-brand-blue-muted/60 bg-background/80 p-3 text-sm"
              >
                <div className="flex items-start gap-2">
                  {aprovou ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-blue" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium leading-snug">
                      {mov.etapa === "consenso" ? "Consenso" : "Aprovação"} —{" "}
                      {aprovou ? "Aprovado" : "Reprovado"} por{" "}
                      {usuario?.nome ?? "—"}
                    </p>
                    <p className="text-muted-foreground">
                      {formatarDataHora(mov.data)}
                    </p>
                    {mov.motivo && (
                      <p className="mt-1 break-words text-foreground">
                        {mov.motivo}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface AlertaProps {
  titulo: string;
  motivo: string;
  etapaOrigem: string;
}

export function DocumentoReprovacaoAlerta({
  titulo,
  motivo,
  etapaOrigem,
}: AlertaProps) {
  return (
    <div
      className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4"
      role="alert"
    >
      <AlertTriangle className="size-5 shrink-0 text-destructive" />
      <div className="space-y-1 text-sm">
        <p className="font-semibold text-destructive">{titulo}</p>
        <p className="text-muted-foreground">
          Reprovado na etapa de {etapaOrigem}. Ajuste conforme o parecer abaixo:
        </p>
        <p className="font-medium text-foreground">{motivo}</p>
      </div>
    </div>
  );
}

export function getUltimaReprovacao(
  version: DocumentVersion,
  etapaOrigem: "consenso" | "aprovacao"
) {
  const movimentacoes = version.movimentacoes ?? [];
  for (let i = movimentacoes.length - 1; i >= 0; i--) {
    const mov = movimentacoes[i];
    if (mov.acao === "reprovacao" && mov.etapa === etapaOrigem) {
      return mov;
    }
  }
  return undefined;
}

export function exigeSubstituicaoNoConsenso(version: DocumentVersion): boolean {
  if (version.requerSubstituicaoConsenso) return true;
  return Boolean(getUltimaReprovacao(version, "aprovacao"));
}

/** Documento reenviado ao consenso após reprovação na aprovação e substituído antes de voltar. */
export function documentoAjustadoNoConsenso(version: DocumentVersion): boolean {
  if (!getUltimaReprovacao(version, "aprovacao")) return false;
  return Boolean(version.arquivoAtualizadoEm);
}
