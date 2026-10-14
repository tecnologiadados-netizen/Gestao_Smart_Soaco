import { useEffect, useMemo, useState } from "react";
import { SgqAnexosTable } from "@qualidade/components/ui/sgq-anexos-table";
import {
  anexoTemArquivo,
  SGQ_ANEXO_MAX_MB,
  type SgqAnexo,
} from "@qualidade/types/registro-anexo";

export interface DocumentoArquivoSelecionado {
  nome: string;
  dataUrl: string;
}

const DEFAULT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

interface DocumentoArquivoFieldProps {
  label: string;
  arquivoNome?: string;
  arquivoDataUrl?: string;
  /** Arquivo já gravado no servidor. O bootstrap não devolve base64. */
  arquivoStoragePath?: string;
  /** Preferir este: a grade já entregou nome e base64, sem reler o arquivo. */
  onArquivoChange?: (arquivo: DocumentoArquivoSelecionado) => void;
  /** @deprecated Use onArquivoChange. Relê o arquivo e pode apagar a linha no intervalo. */
  onFileSelect?: (file: File) => void;
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
  onArquivoChange,
  onFileSelect,
  onRemove,
  accept = DEFAULT_ACCEPT,
  hint = `PDF, Word, Excel ou PowerPoint · máx. ${SGQ_ANEXO_MAX_MB} MB`,
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

    const principal = preenchidos[0]!;
    // Sem base64 o arquivo veio do servidor e segue inalterado — nada a reenviar.
    if (!principal.dataUrl.trim()) return;
    if (
      principal.nome === (arquivoNome ?? "") &&
      principal.dataUrl === (arquivoDataUrl ?? "")
    ) {
      return;
    }

    // A grade já leu o arquivo. Aplicar direto evita reconverter o base64
    // (o que apagava a linha antes do estado do formulário atualizar).
    if (onArquivoChange) {
      onArquivoChange({
        nome: principal.nome,
        dataUrl: principal.dataUrl,
      });
      return;
    }

    // Mantém a linha visível enquanto o formulário relê o File.
    setRascunho(preenchidos);
    if (!onFileSelect) return;
    const blob = dataUrlToBlob(principal.dataUrl);
    onFileSelect(
      new File([blob], principal.nome, {
        type: blob.type || "application/octet-stream",
      })
    );
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

