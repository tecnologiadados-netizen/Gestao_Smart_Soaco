import { useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
import {
  downloadQualidadeArquivo,
  openQualidadeArquivo,
} from "@qualidade/lib/documents/file-actions";
import { arquivoRequerDownloadParaVisualizar } from "@qualidade/lib/documents/sgq-print-window";

type ArquivoRef = {
  nome?: string;
  dataUrl?: string;
  storagePath?: string;
};

type Props = {
  arquivo: ArquivoRef;
  disabled?: boolean;
  onError?: (message: string) => void;
  variant?: "ghost" | "outline" | "default";
  size?: "icon-sm" | "sm" | "default";
  className?: string;
  /** Se informado, vira botão com texto. Sem isso, fica só o ícone. */
  label?: string;
};

function arquivoDisponivel(arquivo: ArquivoRef) {
  return Boolean(
    arquivo.nome?.trim() &&
      (arquivo.dataUrl?.trim() || arquivo.storagePath?.trim())
  );
}

export function SgqArquivoImprimirBtn({
  arquivo,
  disabled,
  onError,
  variant = "ghost",
  size = "icon-sm",
  className,
  label,
}: Props) {
  const disponivel = arquivoDisponivel(arquivo);
  const soBaixar = arquivoRequerDownloadParaVisualizar(
    arquivo.nome,
    arquivo.storagePath
  );

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      title={
        soBaixar
          ? "Visualização indisponível — baixe o original"
          : "Imprimir"
      }
      disabled={disabled || !disponivel}
      onClick={() => {
        void openQualidadeArquivo(arquivo, "print").catch((err) => {
          onError?.(
            err instanceof Error
              ? err.message
              : "Não foi possível abrir o arquivo."
          );
        });
      }}
    >
      <Printer className={label ? "size-3.5" : "size-4"} />
      {label}
    </Button>
  );
}

export function SgqArquivoBaixarBtn({
  arquivo,
  disabled,
  onError,
  variant = "ghost",
  size = "icon-sm",
  className,
  label,
}: Props) {
  const [baixando, setBaixando] = useState(false);
  const disponivel = arquivoDisponivel(arquivo);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      title="Baixar original"
      disabled={disabled || !disponivel || baixando}
      onClick={() => {
        setBaixando(true);
        void downloadQualidadeArquivo(arquivo)
          .catch((err) => {
            onError?.(
              err instanceof Error
                ? err.message
                : "Não foi possível baixar o arquivo."
            );
          })
          .finally(() => setBaixando(false));
      }}
    >
      {baixando ? (
        <Loader2 className={label ? "size-3.5 animate-spin" : "size-4 animate-spin"} />
      ) : (
        <Download className={label ? "size-3.5" : "size-4"} />
      )}
      {label}
    </Button>
  );
}

/** Imprimir (visualizador nativo) + baixar o arquivo original. */
export function SgqArquivoAcoes({
  labeled = false,
  label,
  ...rest
}: Props & { labeled?: boolean }) {
  const comTexto = labeled || Boolean(label);
  return (
    <span className="inline-flex items-center gap-1">
      <SgqArquivoImprimirBtn {...rest} label={comTexto ? "Imprimir" : undefined} />
      <SgqArquivoBaixarBtn {...rest} label={comTexto ? "Baixar" : undefined} />
    </span>
  );
}
