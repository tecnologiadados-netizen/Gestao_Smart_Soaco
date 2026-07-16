import { formatDocumentCodigoExibicao } from "@qualidade/lib/documents/document-codigo";
import type { Document, DocumentVersion } from "@qualidade/types/document";
import type { Department, DocumentType, User } from "@qualidade/types/user";

const readonlyFieldClass =
  "flex min-h-10 items-center rounded-lg border-2 border-brand-blue/30 bg-brand-blue-light/70 px-3 text-base font-medium text-brand-navy";

interface Props {
  doc: Document;
  version: DocumentVersion;
  categoria?: DocumentType;
  processo?: Department;
  users: User[];
}

export function DocumentoIdentificacaoResumo({
  doc,
  version,
  categoria,
  processo,
  users,
}: Props) {
  const elaborador = users.find((u) => u.id === version.elaboradorId);
  const consenso = users.find((u) => u.id === version.consensoId);
  const aprovador = users.find((u) => u.id === version.aprovadorId);

  return (
    <fieldset className="brand-fieldset space-y-4">
      <legend className="text-base">Dados do cadastro</legend>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Categoria</p>
          <div className={readonlyFieldClass}>
            {categoria ? `${categoria.sigla} — ${categoria.nome}` : "—"}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Setor</p>
          <div className={readonlyFieldClass}>
            {processo ? `${processo.sigla} — ${processo.nome}` : "—"}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(180px,220px)_1fr]">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Código</p>
          <div className={`${readonlyFieldClass} font-mono text-lg font-bold`}>
            {formatDocumentCodigoExibicao(doc.codigo, doc.versaoAtual)}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Título</p>
          <div className={readonlyFieldClass}>{doc.titulo}</div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-brand-blue-muted/60 bg-background/80 p-3 text-sm">
          <p className="font-semibold text-brand-blue">Elaborador</p>
          <p className="mt-1">{elaborador?.nome ?? "—"}</p>
          {version.prazos && (
            <p className="text-muted-foreground">
              Prazo: {version.prazos.elaboracao} dias
            </p>
          )}
        </div>
        <div className="rounded-lg border border-brand-blue-muted/60 bg-background/80 p-3 text-sm">
          <p className="font-semibold text-brand-blue">Consenso</p>
          <p className="mt-1">{consenso?.nome ?? "—"}</p>
          {version.prazos && (
            <p className="text-muted-foreground">
              Prazo: {version.prazos.consenso} dias
            </p>
          )}
        </div>
        <div className="rounded-lg border border-brand-blue-muted/60 bg-background/80 p-3 text-sm">
          <p className="font-semibold text-brand-blue">Aprovador</p>
          <p className="mt-1">{aprovador?.nome ?? "—"}</p>
          {version.prazos && (
            <p className="text-muted-foreground">
              Prazo: {version.prazos.aprovacao} dias
            </p>
          )}
        </div>
      </div>
    </fieldset>
  );
}
