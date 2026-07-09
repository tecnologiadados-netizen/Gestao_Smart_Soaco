import { useRef } from "react";
import { FileText, FileUp, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
import { Label } from "@qualidade/components/ui/label";
import { cn } from "@qualidade/lib/utils";

const DEFAULT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

interface DocumentoArquivoFieldProps {
  inputId: string;
  label: string;
  arquivoNome?: string;
  arquivoDataUrl?: string;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  accept?: string;
  hint?: string;
  className?: string;
}

export function DocumentoArquivoField({
  inputId,
  label,
  arquivoNome,
  arquivoDataUrl,
  onFileSelect,
  onRemove,
  accept = DEFAULT_ACCEPT,
  hint = "PDF, Word, Excel ou PowerPoint · máx. 5 MB",
  className,
}: DocumentoArquivoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    e.target.value = "";
  }

  function handleSubstituir() {
    inputRef.current?.click();
  }

  const temArquivo = Boolean(arquivoNome);

  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-base" htmlFor={inputId}>
        {label}
      </Label>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={handleChange}
      />

      {!temArquivo ? (
        <label
          htmlFor={inputId}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-brand-blue/40 bg-brand-blue-light/30 px-6 py-8 transition-colors hover:bg-brand-blue-light/50"
        >
          <FileUp className="size-8 text-brand-blue" />
          <span className="text-sm font-medium text-brand-navy">
            Clique para selecionar o arquivo
          </span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </label>
      ) : (
        <div className="rounded-lg border border-brand-blue-muted/60 bg-background/80 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-brand-blue-light p-2">
              <FileText className="size-5 text-brand-blue" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium text-brand-navy break-all">
                {arquivoNome}
              </p>
              <p className="text-xs text-muted-foreground">
                Documento anexado nesta etapa
              </p>
              {arquivoDataUrl && (
                <a
                  href={arquivoDataUrl}
                  download={arquivoNome}
                  className="inline-block text-sm font-medium text-brand-blue hover:underline"
                >
                  Baixar arquivo
                </a>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSubstituir}
            >
              <RefreshCw className="size-4" />
              Substituir documento atual
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="size-4" />
              Excluir documento atual
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
