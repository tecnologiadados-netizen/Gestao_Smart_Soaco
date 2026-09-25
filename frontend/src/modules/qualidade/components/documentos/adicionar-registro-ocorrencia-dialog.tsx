import { useId, useState } from "react";
import { format } from "date-fns";
import { Paperclip, Upload, X } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
import { Dialog, DialogContent } from "@qualidade/components/ui/dialog";
import { Input } from "@qualidade/components/ui/input";
import { Label } from "@qualidade/components/ui/label";
import { Textarea } from "@qualidade/components/ui/textarea";
import { afterUiTransition } from "@qualidade/lib/motion";
import {
  markQualidadeDocumentFilesPending,
  scheduleQualidadeDocumentsFlush,
} from "@qualidade/lib/qualidadePersistence";
import { useDocumentsStore } from "@qualidade/lib/store/documents-store";
import {
  SGQ_ANEXO_ACCEPT,
  SGQ_ANEXO_MAX_BYTES,
} from "@qualidade/types/registro-anexo";
import { useLoading } from "@qualidade/components/providers/loading-provider";

interface Props {
  documentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdicionarRegistroOcorrenciaDialog({
  documentId,
  open,
  onOpenChange,
}: Props) {
  const { withLoading } = useLoading();
  const addRegistroInternoOcorrencia = useDocumentsStore(
    (s) => s.addRegistroInternoOcorrencia
  );
  const getDocumentById = useDocumentsStore((s) => s.getDocumentById);
  const getVersionsByDocumentId = useDocumentsStore(
    (s) => s.getVersionsByDocumentId
  );
  const fileInputId = useId();

  const [arquivoNome, setArquivoNome] = useState("");
  const [arquivoDataUrl, setArquivoDataUrl] = useState("");
  const [dataOcorrencia, setDataOcorrencia] = useState(() =>
    format(new Date(), "yyyy-MM-dd")
  );
  const [observacao, setObservacao] = useState("");
  const [erro, setErro] = useState("");
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setArquivoNome("");
    setArquivoDataUrl("");
    setDataOcorrencia(format(new Date(), "yyyy-MM-dd"));
    setObservacao("");
    setErro("");
  }

  function handleClose() {
    onOpenChange(false);
    afterUiTransition(resetForm);
  }

  function selecionarArquivo(file: File) {
    if (file.size > SGQ_ANEXO_MAX_BYTES) {
      setErro(`"${file.name}" excede o limite de 5 MB.`);
      return;
    }
    setErro("");
    const reader = new FileReader();
    reader.onload = () => {
      setArquivoNome(file.name);
      setArquivoDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!documentId) return;
    if (!arquivoNome.trim() || !arquivoDataUrl.trim()) {
      setErro("Selecione o arquivo da ocorrência.");
      return;
    }
    if (!dataOcorrencia.trim()) {
      setErro("Informe a data da ocorrência.");
      return;
    }
    setErro("");
    setSaving(true);

    try {
      await withLoading(async () => {
        const ok = addRegistroInternoOcorrencia(documentId, {
          nome: arquivoNome,
          dataUrl: arquivoDataUrl,
          dataOcorrencia,
          observacao,
        });
        if (!ok) {
          throw new Error("Não foi possível adicionar o registro.");
        }

        const doc = getDocumentById(documentId);
        const versaoAtual = getVersionsByDocumentId(documentId).find(
          (v) => v.versao === doc?.versaoAtual
        );
        markQualidadeDocumentFilesPending(documentId, versaoAtual?.id ?? "");
        onOpenChange(false);
        afterUiTransition(resetForm);
      }, "Gravando registro...");
      scheduleQualidadeDocumentsFlush();
    } catch (err) {
      console.error("[qualidade] falha ao sincronizar ocorrência:", err);
      setErro(
        err instanceof Error && err.message.startsWith("Não foi possível")
          ? err.message
          : "Registro adicionado localmente, mas falhou ao gravar no servidor."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : handleClose())}>
      <DialogContent
        showCloseButton={false}
        className="z-[60] max-h-[min(92vh,100dvh)] w-full max-w-lg flex-col gap-0 overflow-hidden p-0"
      >
        <div className="modal-header-bar flex shrink-0 items-center justify-between px-5 py-3.5">
          <h2 className="text-base font-semibold text-white">
            Adicionar registro
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1.5 hover:bg-white/20"
            aria-label="Fechar"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-5 p-6">
            <div className="space-y-2">
              <Label className="text-base">Arquivo *</Label>
              <input
                id={fileInputId}
                type="file"
                className="hidden"
                accept={SGQ_ANEXO_ACCEPT}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) selecionarArquivo(file);
                  e.target.value = "";
                }}
              />
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {arquivoNome ? (
                    <span className="font-medium text-foreground">
                      {arquivoNome}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Nenhum arquivo selecionado
                    </span>
                  )}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => document.getElementById(fileInputId)?.click()}
                >
                  <Upload className="size-3.5" />
                  {arquivoNome ? "Substituir" : "Inserir"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base" htmlFor="ocorrencia-data">
                Data *
              </Label>
              <Input
                id="ocorrencia-data"
                type="date"
                className="h-10 max-w-xs text-base"
                value={dataOcorrencia}
                onChange={(e) => setDataOcorrencia(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-base" htmlFor="ocorrencia-obs">
                Observação
              </Label>
              <Textarea
                id="ocorrencia-obs"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={3}
                className="text-base"
                placeholder="Opcional — ex.: reunião de fevereiro"
              />
            </div>
          </div>

          {erro ? (
            <p
              role="alert"
              className="border-t border-destructive/30 bg-destructive/10 px-6 py-3 text-sm font-medium text-destructive"
            >
              {erro}
            </p>
          ) : null}

          <div className="sgq-form-footer">
            <Button type="submit" size="lg" disabled={saving}>
              {saving ? "Gravando..." : "Gravar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
