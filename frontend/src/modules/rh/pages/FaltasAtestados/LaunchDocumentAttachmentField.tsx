import { FileText, Folder, Paperclip, X } from "lucide-react";
import { isLaunchDocTestMode } from "@rh/lib/launch-document-config";
import type { ArchiveFolderOption } from "@rh/lib/organico-documents-api";
import { archiveFolderOptionKey } from "@rh/lib/organico-documents-api";
import { Label } from "@rh/components/ui/label";
import { Input } from "@rh/components/ui/input";
import { Button } from "@rh/components/ui/button";
import { Badge } from "@rh/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@rh/components/ui/select";
import { cn } from "@rh/lib/utils";
import { rhFieldInput } from "@rh/lib/form-field-styles";

const dashedInput = rhFieldInput;

export type LaunchDocumentFolderSelection = {
  id: string;
  scope: "global" | "local";
};

type LaunchDocumentAttachmentFieldProps = {
  visible: boolean;
  /** Quando false, o arquivo não é obrigatório para salvar. */
  attachmentRequired?: boolean;
  category: string;
  title: string;
  onTitleChange: (value: string) => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
  folderOptions: ArchiveFolderOption[];
  folderSelection: LaunchDocumentFolderSelection | null;
  onFolderChange: (selection: LaunchDocumentFolderSelection | null) => void;
  foldersLoading?: boolean;
  fileError?: string | null;
  folderError?: string | null;
  disabled?: boolean;
};

export function LaunchDocumentAttachmentField({
  visible,
  attachmentRequired = true,
  category,
  title,
  onTitleChange,
  file,
  onFileChange,
  folderOptions,
  folderSelection,
  onFolderChange,
  foldersLoading = false,
  fileError,
  folderError,
  disabled = false,
}: LaunchDocumentAttachmentFieldProps) {
  if (!visible) return null;

  const selectedKey = folderSelection ? archiveFolderOptionKey(folderSelection) : "";

  return (
    <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">
              {attachmentRequired ? "Anexo obrigatório" : "Anexo (opcional)"}
            </h4>
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {attachmentRequired
              ? "Anexe o documento escaneado e escolha a pasta do arquivamento digital do colaborador."
              : "Você pode anexar um comprovante ao arquivamento digital do colaborador, se desejar."}{" "}
            Categoria: <strong>{category}</strong>.
          </p>
        </div>
        {isLaunchDocTestMode() ? (
          <Badge variant="secondary" className="shrink-0">
            Modo teste
          </Badge>
        ) : null}
      </div>

      <div>
        <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Pasta de destino no card
          {attachmentRequired ? <span className="text-destructive"> *</span> : null}
        </Label>
        <Select
          value={selectedKey || undefined}
          onValueChange={(value) => {
            const option = folderOptions.find((item) => archiveFolderOptionKey(item) === value);
            if (!option) return;
            onFolderChange({ id: option.id, scope: option.scope });
          }}
          disabled={disabled || foldersLoading || folderOptions.length === 0}
        >
          <SelectTrigger className={cn(dashedInput, "h-9")}>
            <SelectValue
              placeholder={
                foldersLoading
                  ? "Carregando pastas do colaborador…"
                  : folderOptions.length === 0
                    ? "Nenhuma pasta no card deste colaborador"
                    : "Selecione a pasta de destino…"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {folderOptions.map((option) => (
              <SelectItem key={archiveFolderOptionKey(option)} value={archiveFolderOptionKey(option)}>
                <span className="inline-flex items-center gap-2">
                  <Folder className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate">{option.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {folderError ? <p className="mt-1.5 text-xs text-destructive">{folderError}</p> : null}
        {!foldersLoading && folderOptions.length === 0 ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Crie uma pasta no Orgânico deste colaborador antes de lançar com anexo.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Categoria no Orgânico</Label>
          <div className={cn(dashedInput, "flex items-center gap-2 bg-muted border-muted-foreground/25 cursor-default")}>
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">{category}</span>
          </div>
        </div>
        <div>
          <Label htmlFor="launch-doc-title" className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Título do documento
          </Label>
          <Input
            id="launch-doc-title"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            disabled={disabled}
            className={dashedInput}
            placeholder="Título sugerido automaticamente"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="launch-doc-file" className="text-xs font-medium text-muted-foreground mb-1.5 block">
          Arquivo (PDF ou imagem)
          {attachmentRequired ? <span className="text-destructive"> *</span> : null}
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="launch-doc-file"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
            disabled={disabled}
            className={cn(dashedInput, "max-w-md file:mr-3 file:rounded file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-xs file:font-medium")}
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          />
          {file ? (
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onFileChange(null)}>
              <X className="mr-1 h-4 w-4" />
              Remover
            </Button>
          ) : null}
        </div>
        {file ? (
          <p className="mt-1.5 text-xs text-muted-foreground truncate">
            {file.name} ({Math.max(1, Math.round(file.size / 1024))} KB)
          </p>
        ) : null}
        {fileError ? <p className="mt-1.5 text-xs text-destructive">{fileError}</p> : null}
      </div>
    </div>
  );
}
