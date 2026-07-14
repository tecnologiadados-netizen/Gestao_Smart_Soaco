import { useEffect, useMemo, useState } from "react";
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from "date-fns";
import { X } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
import { Dialog, DialogContent } from "@qualidade/components/ui/dialog";
import { Input } from "@qualidade/components/ui/input";
import { Label } from "@qualidade/components/ui/label";
import { Textarea } from "@qualidade/components/ui/textarea";
import { DocumentoStepper } from "@qualidade/components/documentos/documento-stepper";
import { DocumentoArquivoField } from "@qualidade/components/documentos/documento-arquivo-field";
import {
  defaultResponsaveisValues,
  DocumentoResponsaveisFieldset,
  type ResponsaveisFormValues,
} from "@qualidade/components/documentos/documento-responsaveis-fieldset";
import { useDocumentsStore } from "@qualidade/lib/store/documents-store";
import { useConfigStore } from "@qualidade/lib/store/config-store";
import { calcularProximaDataValidade } from "@qualidade/lib/documents/validity";
import { formatarData } from "@qualidade/lib/utils/dates";
import {
  codigoBaseFromCodigo,
  formatDocumentCodigo,
  formatDocumentCodigoExibicao,
} from "@qualidade/lib/documents/document-codigo";

interface Props {
  documentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConcluido?: () => void;
  /** Volta para o modal de revalidação em vez de fechar. */
  onVoltar?: () => void;
  /** Revisão iniciada a partir do fluxo de revalidação. */
  fromRevalidacao?: boolean;
}

function toDateInputValue(iso: string): string {
  return format(parseISO(iso), "yyyy-MM-dd");
}

function fromDateInputValue(value: string): string {
  return new Date(`${value}T12:00:00`).toISOString();
}

export function SolicitarRevisaoDocumentoDialog({
  documentId,
  open,
  onOpenChange,
  onConcluido,
  onVoltar,
  fromRevalidacao = false,
}: Props) {
  const navigate = useNavigate();
  const documents = useDocumentsStore((s) => s.documents);
  const allVersions = useDocumentsStore((s) => s.versions);
  const createNewRevision = useDocumentsStore((s) => s.createNewRevision);
  const getNextRevisionForDocument = useDocumentsStore(
    (s) => s.getNextRevisionForDocument
  );

  const users = useConfigStore((s) => s.users);
  const departments = useConfigStore((s) => s.departments);
  const documentTypes = useConfigStore((s) => s.documentTypes);
  const currentUserId = useConfigStore((s) => s.currentUserId);

  const doc = useMemo(
    () =>
      documentId ? documents.find((d) => d.id === documentId) : undefined,
    [documents, documentId]
  );
  const versaoAnterior = useMemo(() => {
    if (!documentId || !doc) return undefined;
    return allVersions.find(
      (v) => v.documentId === documentId && v.versao === doc.versaoAtual
    );
  }, [allVersions, documentId, doc]);

  const [responsaveis, setResponsaveis] = useState<ResponsaveisFormValues>(() =>
    defaultResponsaveisValues(currentUserId)
  );
  const [motivoRevisao, setMotivoRevisao] = useState("");
  const [arquivoNome, setArquivoNome] = useState("");
  const [arquivoDataUrl, setArquivoDataUrl] = useState("");
  const [novaDataValidade, setNovaDataValidade] = useState("");
  const [error, setError] = useState("");
  const exigeValidadeRevalidacao =
    fromRevalidacao && Boolean(doc?.validade?.ativa && doc.validade.dataValidade);

  useEffect(() => {
    if (!open || !versaoAnterior) return;
    setResponsaveis({
      elaboradorId: versaoAnterior.elaboradorId,
      consensoId: versaoAnterior.consensoId ?? "",
      aprovadorId: versaoAnterior.aprovadorId ?? "",
      prazos: versaoAnterior.prazos ?? defaultResponsaveisValues("").prazos,
    });
    setMotivoRevisao("");
    setArquivoNome(versaoAnterior.arquivoNome ?? "");
    setArquivoDataUrl(versaoAnterior.arquivoDataUrl ?? "");
    if (fromRevalidacao && doc?.validade?.ativa) {
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
    } else {
      setNovaDataValidade("");
    }
    setError("");
  }, [open, versaoAnterior, fromRevalidacao, doc]);

  const proximaRevisao = documentId
    ? getNextRevisionForDocument(documentId)
    : "—";
  const categoria = documentTypes.find((t) => t.id === doc?.tipoId);
  const processo = departments.find((d) => d.id === doc?.setorId);
  const fluxoInterno = doc?.origem === "interno";
  const fluxoSimplificado = doc?.origem === "externo" || doc?.origem === "registro";

  function handleFileSelect(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setError("O arquivo excede o limite de 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setArquivoNome(file.name);
      setArquivoDataUrl(reader.result as string);
      setError("");
    };
    reader.readAsDataURL(file);
  }

  function handleRemoveArquivo() {
    setArquivoNome("");
    setArquivoDataUrl("");
  }

  function handleFechar() {
    if (onVoltar) {
      onVoltar();
      return;
    }
    onOpenChange(false);
  }

  function handleDialogOpenChange(aberto: boolean) {
    if (!aberto) handleFechar();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!documentId || !doc) return;
    if (doc.status !== "vigente") {
      setError("Somente documentos vigentes podem ser revisados.");
      return;
    }
    if (
      !responsaveis.elaboradorId ||
      (fluxoInterno &&
        (!responsaveis.consensoId || !responsaveis.aprovadorId))
    ) {
      setError(
        fluxoInterno
          ? "Informe elaborador, consenso e aprovador."
          : "Informe o responsável."
      );
      return;
    }
    if (!motivoRevisao.trim()) {
      setError("Informe o motivo da revisão.");
      return;
    }
    if (fluxoSimplificado && (!arquivoNome.trim() || !arquivoDataUrl.trim())) {
      setError("Anexe o novo arquivo da revisão.");
      return;
    }
    if (exigeValidadeRevalidacao && !novaDataValidade) {
      setError("Informe a nova data de validade.");
      return;
    }

    const versao = createNewRevision(documentId, {
      elaboradorId: responsaveis.elaboradorId,
      consensoId: fluxoInterno ? responsaveis.consensoId : undefined,
      aprovadorId: fluxoInterno ? responsaveis.aprovadorId : undefined,
      prazos: responsaveis.prazos,
      justificativaRevisao: motivoRevisao.trim(),
      ...(fluxoSimplificado
        ? { arquivoNome: arquivoNome.trim(), arquivoDataUrl: arquivoDataUrl.trim() }
        : {}),
      ...(exigeValidadeRevalidacao
        ? { novaDataValidade: fromDateInputValue(novaDataValidade) }
        : {}),
    });

    if (!versao) {
      setError("Não foi possível solicitar a revisão.");
      return;
    }

    onOpenChange(false);
    onConcluido?.();
    navigate(
      fluxoInterno
        ? `/qualidade/documentos/${documentId}/elaborar`
        : `/qualidade/documentos/${documentId}`
    );
  }

  if (!doc) return null;

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="z-[80] flex max-h-[94vh] w-[calc(100%-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
      >
        <div className="modal-header-bar flex items-center justify-between px-8 py-4">
          <h2 className="text-base font-semibold text-white">
            Solicitar revisão do documento
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
          <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 p-8">
            <div className="mx-auto w-full max-w-3xl space-y-6">
              {fluxoInterno ? (
                <div className="space-y-3 text-center">
                  <DocumentoStepper activeStep={0} variant="revisao" />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Após confirmar, o documento seguirá o fluxo: elaboração →
                    consenso → aprovação → publicação.
                  </p>
                </div>
              ) : null}

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
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Nova revisão
                    </p>
                    <p className="font-semibold text-brand-blue">
                      {formatDocumentCodigo(
                        codigoBaseFromCodigo(doc.codigo),
                        proximaRevisao
                      )}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Título
                    </p>
                    <p className="font-medium text-brand-navy">{doc.titulo}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Categoria
                    </p>
                    <p className="text-sm">{categoria?.nome ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Setor
                    </p>
                    <p className="text-sm">{processo?.nome ?? "—"}</p>
                  </div>
                </div>
              </fieldset>

              <DocumentoResponsaveisFieldset
                users={users}
                values={responsaveis}
                onChange={setResponsaveis}
                modo={fluxoInterno ? "completo" : "responsavel"}
              />

              {fluxoSimplificado ? (
                <fieldset className="brand-fieldset space-y-4">
                  <legend className="text-base">Documento da revisão</legend>
                  <DocumentoArquivoField
                    label="Substituir documento *"
                    arquivoNome={arquivoNome}
                    arquivoDataUrl={arquivoDataUrl}
                    onFileSelect={handleFileSelect}
                    onRemove={handleRemoveArquivo}
                    hint="Selecione o arquivo atualizado desta revisão · máx. 5 MB"
                  />
                </fieldset>
              ) : null}

              {exigeValidadeRevalidacao ? (
                <fieldset className="brand-fieldset space-y-4">
                  <legend className="text-base">Validade</legend>
                  {doc.validade?.dataValidade ? (
                    <p className="text-sm text-muted-foreground">
                      Validade anterior:{" "}
                      <span className="font-medium text-foreground">
                        {formatarData(doc.validade.dataValidade)}
                      </span>
                    </p>
                  ) : null}
                  <div className="space-y-2">
                    <Label className="text-base" htmlFor="nova-data-validade-revisao">
                      Nova data de validade *
                    </Label>
                    <Input
                      id="nova-data-validade-revisao"
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
                </fieldset>
              ) : null}

              <fieldset className="brand-fieldset space-y-4">
                <legend className="text-base">Justificativa</legend>
                <div className="space-y-2">
                  <Label className="text-base" htmlFor="motivo-revisao">
                    Motivo da revisão *
                  </Label>
                  <Textarea
                    id="motivo-revisao"
                    value={motivoRevisao}
                    onChange={(e) => setMotivoRevisao(e.target.value)}
                    placeholder="Explique por que esta revisão está sendo solicitada..."
                    rows={4}
                    className="text-base"
                    required
                  />
                </div>
                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
              </fieldset>
            </div>
          </div>

          <div className="sgq-form-footer justify-end px-8 py-5">
            <Button type="submit" size="lg" className="min-w-48">
              {fluxoInterno ? "Enviar para elaboração" : "Confirmar nova revisão"}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={handleFechar}
            >
              {onVoltar ? "Voltar para revalidação" : "Cancelar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
