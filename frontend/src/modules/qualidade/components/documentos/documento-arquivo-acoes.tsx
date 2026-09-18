import { useState } from "react";
import { SgqArquivoAcoes } from "@qualidade/components/documentos/sgq-arquivo-imprimir-btn";
import { MSG_VISUALIZACAO_BAIXAR_ORIGINAL } from "@qualidade/lib/documents/sgq-print-window";
import type { DocumentVersion } from "@qualidade/types/document";

type Props = {
  version: DocumentVersion;
  /** Exibe o nome do arquivo acima dos botões */
  showFileName?: boolean;
};

/**
 * Imprimir (visualizador nativo) e baixar o arquivo original da versão.
 */
export function DocumentoArquivoAcoes({ version, showFileName = true }: Props) {
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

  const anexo = version.anexos?.find(
    (a) => a.storagePath?.trim() || a.dataUrl?.trim()
  );

  return (
    <div className="space-y-2">
      {showFileName ? (
        <p className="break-all text-sm font-medium text-brand-navy">{nome}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <SgqArquivoAcoes
          arquivo={{
            nome,
            dataUrl: version.arquivoDataUrl || anexo?.dataUrl,
            storagePath: version.arquivoStoragePath || anexo?.storagePath,
          }}
          variant="default"
          size="sm"
          className="gap-1.5"
          labeled
          onError={setErro}
        />
      </div>
      {erro ? (
        <p
          className={`text-sm ${
            erro === MSG_VISUALIZACAO_BAIXAR_ORIGINAL
              ? "text-amber-700 dark:text-amber-400"
              : "text-destructive"
          }`}
          role="status"
        >
          {erro}
        </p>
      ) : null}
    </div>
  );
}
