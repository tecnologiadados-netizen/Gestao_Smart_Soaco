import { useMemo, useState } from "react";
import {
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  Pencil,
  Printer,
  X,
} from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
import { Dialog, DialogContent } from "@qualidade/components/ui/dialog";
import { Badge } from "@qualidade/components/ui/badge";
import { useDocumentsStore } from "@qualidade/lib/store/documents-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import {
  documentOrigemLabelsLong,
  documentStatusLabels,
  getDocumentStatusVariant,
  getDueStatusVariant,
  dueStatusLabels,
} from "@qualidade/lib/utils/status-labels";
import { formatarData, formatarDataHora } from "@qualidade/lib/utils/dates";
import {
  calcularDiasRestantesValidade,
  calcularProximaDataValidade,
  calcularValidadeStatus,
  documentoExigeRevalidacao,
  marcosAlertaAplicaveis,
  mensagemAlertaValidade,
  severidadeAlertaValidade,
} from "@qualidade/lib/documents/validity";
import {
  downloadDocumentFile,
  openDocumentFileViewer,
} from "@qualidade/lib/documents/file-actions";
import { cn } from "@qualidade/lib/utils";
import {
  formatPermissaoProcessos,
  formatPermissaoUsuarios,
} from "@qualidade/components/documentos/documento-permissoes-fieldset";
import { SolicitarRevisaoDocumentoDialog } from "@qualidade/components/documentos/solicitar-revisao-documento-dialog";
import { CadastroDocumentoInternoDialog } from "@qualidade/components/documentos/cadastro-documento-interno-dialog";
import { ConfirmacaoDialog } from "@qualidade/components/ui/confirmacao-dialog";
import { RevalidarDocumentoDialog } from "@qualidade/components/documentos/revalidar-documento-dialog";

interface Props {
  documentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium leading-relaxed text-brand-navy">
        {value}
      </p>
    </div>
  );
}

function PermissaoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[minmax(180px,240px)_1fr] sm:gap-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-medium leading-relaxed text-brand-navy">
        {value}
      </p>
    </div>
  );
}

function SecaoPainel({
  titulo,
  children,
  defaultOpen = false,
}: {
  titulo: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [aberto, setAberto] = useState(defaultOpen);

  return (
    <section className="overflow-hidden rounded-xl border border-brand-blue-muted/60 bg-card shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-brand-blue-light/20"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
      >
        <span className="text-sm font-semibold text-brand-navy">{titulo}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            aberto && "rotate-180"
          )}
        />
      </button>
      {aberto ? (
        <div className="border-t border-brand-blue-muted/40 px-5 py-5">
          {children}
        </div>
      ) : null}
    </section>
  );
}

export function DocumentoConsultaDetalheDialog({
  documentId,
  open,
  onOpenChange,
}: Props) {
  const documents = useDocumentsStore((s) => s.documents);
  const allVersions = useDocumentsStore((s) => s.versions);
  const getVersionsByDocumentId = useDocumentsStore(
    (s) => s.getVersionsByDocumentId
  );
  const getNextRevisionForDocument = useDocumentsStore(
    (s) => s.getNextRevisionForDocument
  );
  const inativarDocumento = useDocumentsStore((s) => s.inativarDocumento);
  const excluirDocumento = useDocumentsStore((s) => s.excluirDocumento);
  const getRevalidacoesByDocumentId = useDocumentsStore(
    (s) => s.getRevalidacoesByDocumentId
  );

  const [revisaoAberta, setRevisaoAberta] = useState(false);
  const [revisaoFromRevalidacao, setRevisaoFromRevalidacao] = useState(false);
  const [revalidarAberta, setRevalidarAberta] = useState(false);
  const [edicaoAberta, setEdicaoAberta] = useState(false);
  const [confirmacao, setConfirmacao] = useState<"inativar" | "excluir" | null>(
    null
  );
  const [erroArquivo, setErroArquivo] = useState("");

  const users = useConfigStore((s) => s.users);
  const departments = useConfigStore((s) => s.departments);
  const documentTypes = useConfigStore((s) => s.documentTypes);

  const doc = useMemo(
    () =>
      documentId ? documents.find((d) => d.id === documentId) : undefined,
    [documents, documentId]
  );
  const versoes = useMemo(
    () => (documentId ? getVersionsByDocumentId(documentId) : []),
    [documentId, getVersionsByDocumentId, allVersions]
  );

  const versaoAtual = versoes.find((v) => v.versao === doc?.versaoAtual);
  const tipo = documentTypes.find((t) => t.id === doc?.tipoId);
  const setor = departments.find((d) => d.id === doc?.setorId);
  const temArquivo = Boolean(
    versaoAtual?.arquivoDataUrl && versaoAtual?.arquivoNome
  );
  const revalidacoes = documentId
    ? getRevalidacoesByDocumentId(documentId)
    : [];
  const diasValidade =
    doc?.validade?.ativa && doc.validade.dataValidade
      ? calcularDiasRestantesValidade(doc.validade.dataValidade)
      : null;
  const statusValidade = calcularValidadeStatus(diasValidade);
  const podeRevalidar = doc ? documentoExigeRevalidacao(doc) : false;

  function handleFechar() {
    onOpenChange(false);
  }

  function abrirArquivo(mode: "view" | "print") {
    if (
      !temArquivo ||
      !versaoAtual?.arquivoDataUrl ||
      !versaoAtual.arquivoNome
    ) {
      return;
    }

    setErroArquivo("");
    try {
      openDocumentFileViewer(
        versaoAtual.arquivoDataUrl,
        versaoAtual.arquivoNome,
        mode
      );
    } catch (error) {
      setErroArquivo(
        error instanceof Error
          ? error.message
          : "Não foi possível abrir o arquivo."
      );
    }
  }

  function handleVisualizar() {
    abrirArquivo("view");
  }

  function handleImprimir() {
    abrirArquivo("print");
  }

  function handleBaixar() {
    if (
      !temArquivo ||
      !versaoAtual?.arquivoDataUrl ||
      !versaoAtual.arquivoNome
    ) {
      return;
    }

    setErroArquivo("");
    try {
      downloadDocumentFile(
        versaoAtual.arquivoDataUrl,
        versaoAtual.arquivoNome
      );
    } catch {
      setErroArquivo("Não foi possível baixar o arquivo.");
    }
  }

  function handleRevisar() {
    if (!documentId) return;
    setRevisaoAberta(true);
  }

  function handleInativar() {
    if (!documentId || !doc || doc.status !== "vigente") return;
    setConfirmacao("inativar");
  }

  function handleExcluir() {
    if (!documentId) return;
    setConfirmacao("excluir");
  }

  function confirmarInativacao() {
    if (!documentId) return;
    inativarDocumento(documentId);
    onOpenChange(false);
  }

  function confirmarExclusao() {
    if (!documentId) return;
    excluirDocumento(documentId);
    onOpenChange(false);
  }

  if (!doc) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[min(94vh,100dvh)] w-[calc(100%-2rem)] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl"
      >
        <div className="modal-header-bar flex items-center justify-between px-8 py-4">
          <h2 className="text-base font-semibold text-white">
            Detalhes do documento
          </h2>
          <button
            type="button"
            onClick={handleFechar}
            className="rounded p-1.5 hover:bg-white/20"
            aria-label="Fechar"
          >
            <X className="size-5 text-white" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20">
          <div className="space-y-8 p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-md bg-brand-blue px-2.5 py-1 text-sm font-bold text-white">
                    {doc.codigo}
                  </span>
                  <Badge variant={getDocumentStatusVariant(doc.status)}>
                    {documentStatusLabels[doc.status]}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Rev. {doc.versaoAtual}
                  </span>
                </div>
                <h3 className="max-w-3xl text-xl font-semibold leading-snug text-brand-navy">
                  {doc.titulo}
                </h3>
              </div>
              {doc.origem === "interno" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  className="shrink-0 gap-2 border-brand-blue/30 px-4 text-brand-blue hover:bg-brand-blue-light/40"
                  onClick={() => setEdicaoAberta(true)}
                >
                  <Pencil className="size-3.5" />
                  Editar cadastro
                </Button>
              ) : null}
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <section className="space-y-4 rounded-xl border border-brand-blue-muted/60 bg-card p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Arquivo vigente
                </p>
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-brand-blue-light p-3">
                    <FileText className="size-6 text-brand-blue" />
                  </div>
                  <div className="min-w-0 flex-1 py-0.5">
                    {temArquivo ? (
                      <p className="break-all text-base font-medium leading-relaxed text-brand-navy">
                        {versaoAtual?.arquivoNome}
                      </p>
                    ) : (
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        Nenhum anexo disponível nesta revisão.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button
                    type="button"
                    className="gap-2"
                    disabled={!temArquivo}
                    onClick={handleVisualizar}
                  >
                    <ExternalLink className="size-4" />
                    Visualizar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={!temArquivo}
                    onClick={handleImprimir}
                  >
                    <Printer className="size-4" />
                    Imprimir
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={!temArquivo}
                    onClick={handleBaixar}
                  >
                    <Download className="size-4" />
                    Baixar
                  </Button>
                </div>
                {erroArquivo ? (
                  <p className="text-sm text-destructive">{erroArquivo}</p>
                ) : null}
              </section>

              <section className="rounded-xl border border-brand-blue-muted/60 bg-card p-6 shadow-sm">
                <p className="mb-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Identificação
                </p>
                <div className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
                  <MetaItem label="Setor" value={setor?.nome ?? "—"} />
                  <MetaItem label="Categoria" value={tipo?.nome ?? "—"} />
                  <MetaItem
                    label="Origem"
                    value={documentOrigemLabelsLong[doc.origem] ?? doc.origem}
                  />
                  <MetaItem
                    label="Atualizado em"
                    value={formatarDataHora(doc.updatedAt)}
                  />
                  <MetaItem
                    label="Revisão atual"
                    value={doc.versaoAtual}
                  />
                </div>
              </section>
            </div>

            <div className="space-y-4">
              <SecaoPainel titulo="Responsáveis" defaultOpen>
                {doc.origem === "interno" ? (
                  <div className="grid gap-x-8 gap-y-5 sm:grid-cols-3">
                    <MetaItem
                      label="Elaborador"
                      value={
                        users.find((u) => u.id === versaoAtual?.elaboradorId)
                          ?.nome ?? "—"
                      }
                    />
                    <MetaItem
                      label="Consenso"
                      value={
                        users.find((u) => u.id === versaoAtual?.consensoId)
                          ?.nome ?? "—"
                      }
                    />
                    <MetaItem
                      label="Aprovador"
                      value={
                        users.find((u) => u.id === versaoAtual?.aprovadorId)
                          ?.nome ?? "—"
                      }
                    />
                    {versaoAtual?.prazos && (
                      <div className="sm:col-span-3">
                        <p className="text-xs text-muted-foreground">
                          Prazos — Elaboração: {versaoAtual.prazos.elaboracao}{" "}
                          dias · Consenso: {versaoAtual.prazos.consenso} dias ·
                          Aprovação: {versaoAtual.prazos.aprovacao} dias
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <MetaItem
                    label="Responsável"
                    value={
                      users.find((u) => u.id === versaoAtual?.elaboradorId)
                        ?.nome ?? "—"
                    }
                  />
                )}
              </SecaoPainel>

              <SecaoPainel titulo="Permissões / Cópias distribuídas">
                {doc.permissoes ? (
                  <div className="space-y-4 text-sm">
                    <PermissaoItem
                      label="Aviso de publicação por e-mail"
                      value={formatPermissaoUsuarios(
                        doc.permissoes.avisoPublicacaoEmailIds,
                        users
                      )}
                    />
                    <PermissaoItem
                      label="Quem pode baixar o arquivo"
                      value={formatPermissaoUsuarios(
                        doc.permissoes.baixarArquivoIds,
                        users
                      )}
                    />
                    <PermissaoItem
                      label="Quem pode imprimir arquivo"
                      value={formatPermissaoUsuarios(
                        doc.permissoes.imprimirArquivoIds,
                        users
                      )}
                    />
                    <PermissaoItem
                      label="Cópias distribuídas"
                      value={formatPermissaoProcessos(
                        doc.permissoes.copiasDistribuidasIds,
                        departments,
                        "Nenhuma cópia distribuída"
                      )}
                    />
                    <PermissaoItem
                      label="Quem pode consultar"
                      value={
                        doc.permissoes.consultarTodos
                          ? "Todos"
                          : formatPermissaoUsuarios(
                              doc.permissoes.consultarIds,
                              users
                            )
                      }
                    />
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Permissões não configuradas para este documento.
                  </p>
                )}
              </SecaoPainel>

              {doc.validade?.ativa ? (
                <SecaoPainel titulo="Validade" defaultOpen>
                  <div className="space-y-4">
                    <div className="grid gap-x-8 gap-y-5 sm:grid-cols-3">
                      <MetaItem
                        label="Vencimento"
                        value={
                          doc.validade.dataValidade
                            ? formatarData(doc.validade.dataValidade)
                            : "Aguardando publicação"
                        }
                      />
                      <MetaItem
                        label="Forma"
                        value={
                          doc.validade.modo === "data"
                            ? "Data específica"
                            : "Período em dias"
                        }
                      />
                      {doc.validade.modo !== "data" ? (
                        <MetaItem
                          label="Período"
                          value={`${doc.validade.periodoDias} dias`}
                        />
                      ) : null}
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Situação
                        </p>
                        {doc.validade.dataValidade && statusValidade ? (
                          <Badge variant={getDueStatusVariant(statusValidade)}>
                            {dueStatusLabels[statusValidade]}
                            {diasValidade !== null
                              ? ` · ${diasValidade <= 0 ? `${Math.abs(diasValidade)}d atraso` : `${diasValidade}d restantes`}`
                              : ""}
                          </Badge>
                        ) : (
                          <p className="text-sm font-medium text-brand-navy">
                            —
                          </p>
                        )}
                      </div>
                    </div>
                    {revalidacoes.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Histórico de revalidações
                        </p>
                        <ul className="space-y-2">
                          {revalidacoes.map((rev) => (
                            <li
                              key={rev.id}
                              className="rounded-lg border border-border/80 bg-muted/20 px-4 py-3 text-sm"
                            >
                              <p className="font-medium text-brand-navy">
                                {formatarData(rev.data)} → nova validade{" "}
                                {formatarData(rev.novaDataValidade)}
                              </p>
                              <p className="mt-1 text-muted-foreground">
                                {rev.observacoes}
                              </p>
                              {rev.evidenciaNome ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Evidência: {rev.evidenciaNome}
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </SecaoPainel>
              ) : null}

              <SecaoPainel titulo="Revisões" defaultOpen>
                <ul className="space-y-3">
                  {versoes.map((ver) => {
                    const elaborador = users.find(
                      (u) => u.id === ver.elaboradorId
                    );
                    const aprovador = users.find(
                      (u) => u.id === ver.aprovadorId
                    );
                    const isAtual = ver.versao === doc.versaoAtual;
                    return (
                      <li
                        key={ver.id}
                        className={cn(
                          "rounded-lg border px-4 py-4 text-sm",
                          isAtual
                            ? "border-brand-blue/30 bg-brand-blue-light/25"
                            : "border-border/80 bg-muted/20"
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-brand-navy">
                              Revisão {ver.versao}
                            </span>
                            {isAtual && (
                              <Badge
                                variant="outline"
                                className="border-brand-blue/40 text-brand-blue"
                              >
                                Atual
                              </Badge>
                            )}
                          </div>
                          {ver.arquivoNome && ver.arquivoDataUrl ? (
                            <button
                              type="button"
                              onClick={() =>
                                downloadDocumentFile(
                                  ver.arquivoDataUrl!,
                                  ver.arquivoNome!
                                )
                              }
                              className="inline-flex items-center gap-1 text-xs font-medium text-brand-blue hover:underline"
                            >
                              <Download className="size-3.5" />
                              Baixar
                            </button>
                          ) : ver.arquivoNome ? (
                            <span className="text-xs text-muted-foreground">
                              {ver.arquivoNome}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1.5 text-muted-foreground">
                          {doc.origem === "interno" ? (
                            <>
                              Elaborado por {elaborador?.nome ?? "—"} em{" "}
                              {formatarData(ver.dataElaboracao)}
                            </>
                          ) : (
                            <>
                              Responsável: {elaborador?.nome ?? "—"} ·{" "}
                              {formatarData(ver.dataElaboracao)}
                            </>
                          )}
                        </p>
                        {doc.origem === "interno" && ver.dataAprovacao && (
                          <p className="text-muted-foreground">
                            Aprovado por {aprovador?.nome ?? "—"} em{" "}
                            {formatarData(ver.dataAprovacao)}
                          </p>
                        )}
                        {ver.observacoes && (
                          <p className="mt-1 text-muted-foreground italic">
                            {ver.observacoes}
                          </p>
                        )}
                        {ver.justificativaRevisao && (
                          <p className="mt-1 text-muted-foreground">
                            <span className="font-medium not-italic">
                              Motivo da revisão:
                            </span>{" "}
                            {ver.justificativaRevisao}
                          </p>
                        )}
                        {ver.alteracoesRevisao && (
                          <p className="text-muted-foreground">
                            <span className="font-medium not-italic">
                              Alterações:
                            </span>{" "}
                            {ver.alteracoesRevisao}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </SecaoPainel>

              <SecaoPainel titulo="Visualizações">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Registro de visualizações e downloads será habilitado na versão
                  integrada ao servidor.
                </p>
              </SecaoPainel>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-brand-blue-muted bg-card px-8 py-5">
          <Button type="button" variant="outline" onClick={handleFechar}>
            Fechar
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={doc.status !== "vigente"}
            onClick={handleInativar}
          >
            Inativar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleExcluir}
          >
            Excluir
          </Button>
          {podeRevalidar ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setRevalidarAberta(true)}
            >
              Revalidar
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={doc.status !== "vigente"}
            onClick={handleRevisar}
          >
            Revisar
            {doc.status === "vigente"
              ? ` (${getNextRevisionForDocument(doc.id)})`
              : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <CadastroDocumentoInternoDialog
      open={edicaoAberta}
      onOpenChange={setEdicaoAberta}
      documentId={documentId}
    />

    <SolicitarRevisaoDocumentoDialog
      documentId={documentId}
      open={revisaoAberta}
      fromRevalidacao={revisaoFromRevalidacao}
      onOpenChange={(aberto) => {
        if (!aberto && !revisaoFromRevalidacao) setRevisaoAberta(false);
      }}
      onVoltar={
        revisaoFromRevalidacao
          ? () => {
              setRevisaoAberta(false);
              setRevisaoFromRevalidacao(false);
            }
          : undefined
      }
      onConcluido={() => {
        setRevisaoAberta(false);
        setRevalidarAberta(false);
        setRevisaoFromRevalidacao(false);
        onOpenChange(false);
      }}
    />

    <RevalidarDocumentoDialog
      documentId={documentId}
      open={revalidarAberta}
      hidden={revisaoFromRevalidacao}
      onOpenChange={(aberto) => {
        if (!aberto) {
          setRevalidarAberta(false);
          setRevisaoFromRevalidacao(false);
          setRevisaoAberta(false);
        }
      }}
      onSolicitarRevisao={() => {
        setRevisaoFromRevalidacao(true);
        setRevisaoAberta(true);
      }}
    />

    <ConfirmacaoDialog
      open={confirmacao === "inativar"}
      onOpenChange={(aberto) => !aberto && setConfirmacao(null)}
      titulo="Inativar documento"
      mensagem="Deseja inativar este documento? Ele ficará obsoleto e não poderá mais ser revisado."
      confirmarLabel="Inativar"
      onConfirmar={confirmarInativacao}
    />

    <ConfirmacaoDialog
      open={confirmacao === "excluir"}
      onOpenChange={(aberto) => !aberto && setConfirmacao(null)}
      titulo="Excluir documento"
      mensagem="Deseja excluir este documento permanentemente? Esta ação não pode ser desfeita."
      confirmarLabel="Excluir"
      variant="destructive"
      onConfirmar={confirmarExclusao}
    />
    </>
  );
}
