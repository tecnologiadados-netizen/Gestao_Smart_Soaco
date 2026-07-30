import { useEffect, useMemo, useState } from "react";
import { SgqAnexosTable } from "@qualidade/components/ui/sgq-anexos-table";
import { anexoTemArquivo, type SgqAnexo } from "@qualidade/types/registro-anexo";

const DEFAULT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

interface DocumentoArquivoFieldProps {
  label: string;
  arquivoNome?: string;
  arquivoDataUrl?: string;
  /** Arquivo já gravado no servidor. O bootstrap não devolve base64. */
  arquivoStoragePath?: string;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  accept?: string;
  hint?: string;
  maxRows?: number;
}

export function DocumentoArquivoField({
  label,
  arquivoNome,
  arquivoDataUrl,
  arquivoStoragePath,
  onFileSelect,
  onRemove,
  accept = DEFAULT_ACCEPT,
  hint = "PDF, Word, Excel ou PowerPoint · máx. 5 MB",
  maxRows = 1,
}: DocumentoArquivoFieldProps) {
  const [rascunho, setRascunho] = useState<SgqAnexo[]>([]);

  const temArquivo = Boolean(
    arquivoNome?.trim() &&
      (arquivoDataUrl?.trim() || arquivoStoragePath?.trim())
  );

  useEffect(() => {
    if (temArquivo) setRascunho([]);
  }, [temArquivo]);

  const anexos = useMemo<SgqAnexo[]>(() => {
    if (temArquivo) {
      return [
        {
          id: "arquivo-principal",
          nome: arquivoNome!,
          dataUrl: arquivoDataUrl ?? "",
          ...(arquivoStoragePath ? { storagePath: arquivoStoragePath } : {}),
        },
      ];
    }
    return rascunho;
  }, [temArquivo, arquivoNome, arquivoDataUrl, arquivoStoragePath, rascunho]);

  function handleChange(next: SgqAnexo[]) {
    const preenchidos = next.filter(anexoTemArquivo);

    if (preenchidos.length === 0) {
      setRascunho(next);
      if (temArquivo) onRemove();
      return;
    }

    setRascunho([]);
    const principal = preenchidos[0]!;
    // Sem base64 o arquivo veio do servidor e segue inalterado — nada a reenviar.
    if (!principal.dataUrl.trim()) return;
    if (
      principal.nome !== (arquivoNome ?? "") ||
      principal.dataUrl !== (arquivoDataUrl ?? "")
    ) {
      const blob = dataUrlToBlob(principal.dataUrl);
      const file = new File([blob], principal.nome, {
        type: blob.type || "application/octet-stream",
      });
      onFileSelect(file);
    }
  }

  return (
    <SgqAnexosTable
      label={label}
      anexos={anexos}
      onChange={handleChange}
      accept={accept}
      maxRows={maxRows}
      emptyMessage={`Nenhum arquivo selecionado. Clique em "Adicionar anexo". ${hint}`}
      addButtonLabel="Adicionar anexo"
      readOnlyEmptyMessage="Nenhum arquivo anexado."
    />
  );
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(",");
  const mime = header?.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
  const binary = atob(data ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}
