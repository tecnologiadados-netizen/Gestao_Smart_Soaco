import { useEffect, useMemo, useState } from "react";
import { SgqAnexosTable } from "@qualidade/components/ui/sgq-anexos-table";
import type { SgqAnexo } from "@qualidade/types/registro-anexo";

const DEFAULT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

interface DocumentoArquivoFieldProps {
  label: string;
  arquivoNome?: string;
  arquivoDataUrl?: string;
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
  onFileSelect,
  onRemove,
  accept = DEFAULT_ACCEPT,
  hint = "PDF, Word, Excel ou PowerPoint · máx. 5 MB",
  maxRows = 1,
}: DocumentoArquivoFieldProps) {
  const [rascunho, setRascunho] = useState<SgqAnexo[]>([]);

  useEffect(() => {
    if (arquivoNome?.trim() && arquivoDataUrl?.trim()) {
      setRascunho([]);
    }
  }, [arquivoNome, arquivoDataUrl]);

  const anexos = useMemo<SgqAnexo[]>(() => {
    if (arquivoNome?.trim() && arquivoDataUrl?.trim()) {
      return [
        {
          id: "arquivo-principal",
          nome: arquivoNome,
          dataUrl: arquivoDataUrl,
        },
      ];
    }
    return rascunho;
  }, [arquivoNome, arquivoDataUrl, rascunho]);

  function handleChange(next: SgqAnexo[]) {
    const preenchidos = next.filter((a) => a.nome.trim() && a.dataUrl.trim());

    if (preenchidos.length === 0) {
      setRascunho(next);
      if (arquivoNome?.trim() || arquivoDataUrl?.trim()) {
        onRemove();
      }
      return;
    }

    setRascunho([]);
    const principal = preenchidos[0]!;
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
