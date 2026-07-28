import { useState } from "react";
import { Download, Eye, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
import {
  downloadDocumentFile,
  openDocumentFileViewer,
  resolveVersionArquivoParaAcao,
} from "@qualidade/lib/documents/file-actions";
import type { DocumentVersion } from "@qualidade/types/document";

type Props = {
  version: DocumentVersion;
  /** Exibe o nome do arquivo acima dos botões */
  showFileName?: boolean;
};

/**
 * Ações Visualizar / Baixar do arquivo da versão (consenso, aprovação, histórico).
 * Resolve dataUrl em memória ou via storagePath em /uploads.
 */
export function DocumentoArquivoAcoes({ version, showFileName = true }: Props) {
  const [busy, setBusy] = useState<"view" | "download" | null>(null);
  const [erro, setErro] = useState("");

  const nome =
    version.arquivoNome?.trim() ||
    version.anexos?.find((a) => a.nome?.trim())?.nome?.trim() ||
    "";

  if (!nome) {
    return (
      <p className="text-sm text-muted-foreground">Nenhum arquivo anexado</p>
    );
  }

  async function comArquivo(mode: "view" | "download") {
    setErro("");
    setBusy(mode);
    try {
      const arquivo = await resolveVersionArquivoParaAcao(version);
      if (!arquivo) {
        setErro(
          "Arquivo indisponível no servidor. Peça ao elaborador para reanexar e enviar novamente."
        );
        return;
      }
      if (mode === "view") {
        openDocumentFileViewer(arquivo.dataUrl, arquivo.nome, "view");
      } else {
        downloadDocumentFile(arquivo.dataUrl, arquivo.nome);
      }
    } catch (err) {
      setErro(
        err instanceof Error
          ? err.message
          : "Não foi possível abrir o arquivo."
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      {showFileName ? (
        <p className="break-all text-sm font-medium text-brand-navy">{nome}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          disabled={busy != null}
          onClick={() => void comArquivo("view")}
        >
          {busy === "view" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Eye className="size-3.5" />
          )}
          Visualizar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={busy != null}
          onClick={() => void comArquivo("download")}
        >
          {busy === "download" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
          Baixar
        </Button>
        <span className="inline-flex items-center gap-1 self-center text-xs text-muted-foreground">
          <ExternalLink className="size-3" />
          Abre em nova aba
        </span>
      </div>
      {erro ? (
        <p className="text-sm text-destructive" role="alert">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
