import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ExternalLink, FileText, Printer, X } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
import { Dialog, DialogContent } from "@qualidade/components/ui/dialog";
import { Input } from "@qualidade/components/ui/input";
import { Label } from "@qualidade/components/ui/label";
import { Textarea } from "@qualidade/components/ui/textarea";
import { Badge } from "@qualidade/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qualidade/components/ui/select";
import { useDocumentsStore } from "@qualidade/lib/store/documents-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import {
  downloadDocumentFile,
  openDocumentFileViewer,
} from "@qualidade/lib/documents/file-actions";
import {
  calcularProximaDataValidade,
  documentoExigeRevalidacao,
} from "@qualidade/lib/documents/validity";
import { formatarData } from "@qualidade/lib/utils/dates";
import { formatDocumentCodigoExibicao } from "@qualidade/lib/documents/document-codigo";
import { acaoRevalidacaoSelectLabel } from "@qualidade/lib/utils/select-display";
import { cn } from "@qualidade/lib/utils";
import { format, parseISO } from "date-fns";

interface Props {
  documentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSolicitarRevisao?: (documentId: string) => void;
  /** Oculta o modal sem desmontar (ex.: ao abrir configuração da revisão). */
  hidden?: boolean;
}

function toDateInputValue(iso: string): string {
  return format(parseISO(iso), "yyyy-MM-dd");
}

function fromDateInputValue(value: string): string {
  return new Date(`${value}T12:00:00`).toISOString();
}

type AcaoRevalidacao = "prorrogar" | "nova_revisao" | "";

const selectTriggerClass =
  "h-10 w-full min-w-0 *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal";

export function RevalidarDocumentoDialog({
  documentId,
  open,
  onOpenChange,
  onSolicitarRevisao,
  hidden = false,
}: Props) {
  const documents = useDocumentsStore((s) => s.documents);
  const allVersions = useDocumentsStore((s) => s.versions);
  const getVersionsByDocumentId = useDocumentsStore(
    (s) => s.getVersionsByDocumentId
  );
  const revalidarDocumento = useDocumentsStore((s) => s.revalidarDocumento);

  const users = useConfigStore((s) => s.users);

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
  const temArquivo = Boolean(
    versaoAtual?.arquivoDataUrl && versaoAtual?.arquivoNome
  );

  const [observacoes, setObservacoes] = useState("");
  const [novaDataValidade, setNovaDataValidade] = useState("");
  const [acaoRevalidacao, setAcaoRevalidacao] = useState<AcaoRevalidacao>("");
  const [error, setError] = useState("");
  const [erroArquivo, setErroArquivo] = useState("");
  const apenasProrrogar = acaoRevalidacao === "prorrogar";
  const gerarNovaRevisao = acaoRevalidacao === "nova_revisao";
  const dialogVisivel = open && !hidden;
  const estavaAbertoRef = useRef(false);

  useEffect(() => {
    const acabouDeAbrir = open && !estavaAbertoRef.current;
    estavaAbertoRef.current = open;

    if (!open || hidden || !doc) return;

    if (!acabouDeAbrir) return;

    if (!documentoExigeRevalidacao(doc)) {
      onOpenChange(false);
      return;
    }
    if (!doc.validade) return;
    const defaultDate = doc.validade.dataValidade
      ? calcularProximaDataValidade(
          doc.validade.dataValidade,
          doc.validade.periodoDias
        )
      : calcularProximaDataValidade(
          new Date().toISOString(),
          doc.validade.periodoDias
        );
    setNovaDataValidade(toDateInputValue(defaultDate));
    setObservacoes("");
    setAcaoRevalidacao("");
    setError("");
    setErroArquivo("");
  }, [open, hidden, doc, onOpenChange]);

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
    } catch (err) {
      setErroArquivo(
        err instanceof Error
          ? err.message
          : "Não foi possível abrir o arquivo."
      );
    }
  }

  function handleBaixar() {
    if (
      !temArquivo ||
      !versaoAtual?.arquivoDataUrl ||
      !versaoAtual.arquivoNome
    ) {
      return;
    }
    downloadDocumentFile(versaoAtual.arquivoDataUrl, versaoAtual.arquivoNome);
  }

  function handleDialogOpenChange(aberto: boolean) {
    if (!aberto && !hidden) {
      onOpenChange(false);
    }
  }

  function handleContinuarRevisao() {
    if (!documentId || !doc) return;
    if (acaoRevalidacao !== "nova_revisao") return;
    onSolicitarRevisao?.(documentId);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!documentId || !doc) return;

    if (!acaoRevalidacao) {
      setError("Selecione sua opção.");
      return;
    }

    if (acaoRevalidacao === "nova_revisao") {
      handleContinuarRevisao();
      return;
    }

    if (!observacoes.trim()) {
      setError("Informe as observações da revalidação.");
      return;
    }
    if (!novaDataValidade) {
      setError("Informe a nova data de validade.");
      return;
    }

    const ok = revalidarDocumento(documentId, {
      observacoes: observacoes.trim(),
      novaDataValidade: fromDateInputValue(novaDataValidade),
    });

    if (!ok) {
      setError(
        documentoExigeRevalidacao(doc)
          ? "Não foi possível registrar a revalidação."
          : "A revalidação só pode ser feita após o vencimento da validade."
      );
      return;
    }

    onOpenChange(false);
  }

  if (!doc) return null;

  return (
    <Dialog open={dialogVisivel} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="z-[70] max-h-[94vh] w-[calc(100%-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        <div className="modal-header-bar flex items-center justify-between px-8 py-4">
          <h2 className="text-base font-semibold text-white">
            Revalidar documento
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

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto bg-muted/20 p-8">
            <fieldset className="brand-fieldset space-y-4">
              <legend className="text-base">Identificação</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Código
                  </p>
                  <p className="font-semibold text-brand-navy">
                    {formatDocumentCodigoExibicao(doc.codigo, doc.versaoAtual)}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Título
                  </p>
                  <p className="font-medium text-brand-navy">{doc.titulo}</p>
                </div>
                {doc.validade?.dataValidade ? (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Validade anterior
                    </p>
                    <p className="text-sm">
                      {formatarData(doc.validade.dataValidade)}
                    </p>
                  </div>
                ) : null}
              </div>
            </fieldset>

            <fieldset className="brand-fieldset space-y-4">
              <legend className="text-base">Documento vigente</legend>
              <p className="text-sm text-muted-foreground">
                Consulte o arquivo atual antes de decidir se basta prorrogar a
                validade ou se é necessário gerar uma nova revisão.
              </p>
              <div className="flex items-start gap-4 rounded-lg border border-brand-blue-muted/50 bg-card p-4">
                <div className="rounded-lg bg-brand-blue-light p-3">
                  <FileText className="size-6 text-brand-blue" />
                </div>
                <div className="min-w-0 flex-1">
                  {temArquivo ? (
                    <p className="break-all text-sm font-medium text-brand-navy">
                      {versaoAtual?.arquivoNome}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhum anexo na revisão vigente.
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Revisão {doc.versaoAtual}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  className="gap-2"
                  disabled={!temArquivo}
                  onClick={() => abrirArquivo("view")}
                >
                  <ExternalLink className="size-4" />
                  Visualizar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={!temArquivo}
                  onClick={() => abrirArquivo("print")}
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
            </fieldset>

            <fieldset className="brand-fieldset space-y-3">
              <legend className="text-base">Histórico de revisões</legend>
              <ul className="space-y-2">
                {versoes.map((ver) => {
                  const elaborador = users.find(
                    (u) => u.id === ver.elaboradorId
                  );
                  const isAtual = ver.versao === doc.versaoAtual;
                  return (
                    <li
                      key={ver.id}
                      className={cn(
                        "rounded-lg border px-4 py-3 text-sm",
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
                          {isAtual ? (
                            <Badge
                              variant="outline"
                              className="border-brand-blue/40 text-brand-blue"
                            >
                              Atual
                            </Badge>
                          ) : null}
                        </div>
                        {isAtual &&
                        ver.arquivoDataUrl &&
                        ver.arquivoNome ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-xs text-brand-blue"
                            onClick={() => {
                              try {
                                openDocumentFileViewer(
                                  ver.arquivoDataUrl!,
                                  ver.arquivoNome!,
                                  "view"
                                );
                              } catch (err) {
                                setErroArquivo(
                                  err instanceof Error
                                    ? err.message
                                    : "Não foi possível abrir o arquivo."
                                );
                              }
                            }}
                          >
                            <ExternalLink className="size-3.5" />
                            Visualizar
                          </Button>
                        ) : null}
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        Elaborado por {elaborador?.nome ?? "—"} em{" "}
                        {formatarData(ver.dataElaboracao)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </fieldset>

            <fieldset className="brand-fieldset space-y-4">
              <legend className="text-base">Revalidação</legend>

              <div className="space-y-2">
                <Label className="text-base" htmlFor="acao-revalidacao">
                  Gerar nova revisão? *
                </Label>
                <Select
                  value={acaoRevalidacao}
                  onValueChange={(v) => {
                    if (!v) return;
                    setAcaoRevalidacao(v as Exclude<AcaoRevalidacao, "">);
                    setError("");
                  }}
                >
                  <SelectTrigger
                    id="acao-revalidacao"
                    className={selectTriggerClass}
                  >
                    <SelectValue placeholder="Selecione sua opção">
                      {acaoRevalidacaoSelectLabel(acaoRevalidacao) ?? null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prorrogar">
                      Não — apenas prorrogar validade
                    </SelectItem>
                    <SelectItem value="nova_revisao">
                      Sim — gerar nova revisão
                    </SelectItem>
                  </SelectContent>
                </Select>
                {apenasProrrogar ? (
                  <p className="text-xs text-muted-foreground">
                    Informe a nova data de validade e as observações abaixo.
                  </p>
                ) : gerarNovaRevisao ? (
                  <p className="text-xs text-muted-foreground">
                    O fluxo de revisão será aberto (elaboração → consenso →
                    aprovação → publicação).
                  </p>
                ) : null}
              </div>

              {apenasProrrogar ? (
                <>
                  <div className="space-y-2">
                    <Label className="text-base" htmlFor="nova-data-validade">
                      Nova data de validade *
                    </Label>
                    <Input
                      id="nova-data-validade"
                      type="date"
                      className="h-10 max-w-xs text-base"
                      value={novaDataValidade}
                      min={toDateInputValue(new Date().toISOString())}
                      onChange={(e) => setNovaDataValidade(e.target.value)}
                      required
                    />
                    {doc.validade ? (
                      <p className="text-xs text-muted-foreground">
                        Sugestão:{" "}
                        {formatarData(
                          calcularProximaDataValidade(
                            new Date().toISOString(),
                            doc.validade.periodoDias
                          )
                        )}{" "}
                        ({doc.validade.periodoDias} dias)
                      </p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base" htmlFor="obs-revalidacao">
                      Observações *
                    </Label>
                    <Textarea
                      id="obs-revalidacao"
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      placeholder="Descreva a revalidação realizada..."
                      rows={4}
                      className="text-base"
                      required
                    />
                  </div>
                </>
              ) : null}
            </fieldset>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <div className="sgq-form-footer justify-end px-8 py-5">
            <Button
              type="submit"
              size="lg"
              className="min-w-40"
              disabled={!acaoRevalidacao}
            >
              {gerarNovaRevisao
                ? "Continuar para revisão"
                : "Confirmar revalidação"}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={handleFechar}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
