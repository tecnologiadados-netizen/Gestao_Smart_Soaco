import { useId, useState } from "react";
import { Download, Eye, Paperclip, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
import { Label } from "@qualidade/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@qualidade/components/ui/table";
import {
  downloadDocumentFile,
  isImageFile,
  isPdfFile,
  openDocumentFileViewer,
} from "@qualidade/lib/documents/file-actions";
import {
  criarAnexoVazio,
  SGQ_ANEXO_ACCEPT,
  SGQ_ANEXO_MAX_BYTES,
  type SgqAnexo,
} from "@qualidade/types/registro-anexo";

export interface SgqAnexosTableProps {
  anexos: SgqAnexo[];
  onChange: (anexos: SgqAnexo[]) => void;
  disabled?: boolean;
  label?: string;
  accept?: string;
  maxRows?: number;
  emptyMessage?: string;
  addButtonLabel?: string;
  readOnlyEmptyMessage?: string;
}

export function SgqAnexosTable({
  anexos,
  onChange,
  disabled = false,
  label,
  accept = SGQ_ANEXO_ACCEPT,
  maxRows,
  emptyMessage = 'Nenhum anexo adicionado. Clique em "Adicionar anexo" para incluir um arquivo.',
  addButtonLabel = "Adicionar anexo",
  readOnlyEmptyMessage = "Nenhum anexo.",
}: SgqAnexosTableProps) {
  const baseId = useId();
  const [erro, setErro] = useState("");

  function atualizarLinha(id: string, patch: Partial<SgqAnexo>) {
    onChange(anexos.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removerLinha(id: string) {
    onChange(anexos.filter((row) => row.id !== id));
  }

  function adicionarLinha() {
    if (maxRows != null && anexos.length >= maxRows) return;
    onChange([...anexos, criarAnexoVazio()]);
  }

  function selecionarArquivo(id: string, file: File) {
    if (file.size > SGQ_ANEXO_MAX_BYTES) {
      setErro(`"${file.name}" excede o limite de 5 MB.`);
      return;
    }
    setErro("");
    const reader = new FileReader();
    reader.onload = () => {
      atualizarLinha(id, {
        nome: file.name,
        dataUrl: reader.result as string,
        storagePath: undefined,
      });
    };
    reader.readAsDataURL(file);
  }

  function podeVisualizar(anexo: SgqAnexo) {
    return (
      Boolean(anexo.dataUrl?.trim()) &&
      (isPdfFile(anexo.nome) || isImageFile(anexo.nome))
    );
  }

  const anexosVisiveis = disabled
    ? anexos.filter(
        (row) => row.nome.trim() && (row.dataUrl.trim() || row.storagePath?.trim())
      )
    : anexos;

  const podeAdicionar =
    !disabled && (maxRows == null || anexos.length < maxRows);

  if (disabled && anexosVisiveis.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{readOnlyEmptyMessage}</p>
    );
  }

  return (
    <div className="space-y-3">
      {label ? <Label className="text-base">{label}</Label> : null}

      <Table surface>
        <TableHeader>
          <TableRow className="border-b-2 border-border">
            <TableHead className="w-14 border-r border-border/70">#</TableHead>
            <TableHead className="border-r border-border/70">Arquivo</TableHead>
            <TableHead className="w-36 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {anexosVisiveis.map((anexo, index) => {
            const inputId = `${baseId}-${anexo.id}`;
            const temArquivo = Boolean(
              anexo.nome.trim() &&
                (anexo.dataUrl.trim() || Boolean(anexo.storagePath?.trim()))
            );
            return (
              <TableRow
                key={anexo.id}
                className="border-b border-border/80 last:border-b-0"
              >
                <TableCell className="border-r border-border/60 text-center text-muted-foreground">
                  {index + 1}
                </TableCell>
                <TableCell className="border-r border-border/60">
                  <div className="flex min-w-0 items-center gap-2">
                    <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 truncate text-sm">
                      {temArquivo ? (
                        <span className="font-medium text-foreground">
                          {anexo.nome}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          Nenhum arquivo selecionado
                        </span>
                      )}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {temArquivo && podeVisualizar(anexo) ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Visualizar"
                        onClick={() => {
                          try {
                            openDocumentFileViewer(
                              anexo.dataUrl,
                              anexo.nome,
                              "view"
                            );
                          } catch (err) {
                            setErro(
                              err instanceof Error
                                ? err.message
                                : "Não foi possível visualizar o arquivo."
                            );
                          }
                        }}
                      >
                        <Eye className="size-4" />
                      </Button>
                    ) : null}
                    {temArquivo && anexo.dataUrl.trim() ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Baixar"
                        onClick={() =>
                          downloadDocumentFile(anexo.dataUrl, anexo.nome)
                        }
                      >
                        <Download className="size-4" />
                      </Button>
                    ) : null}
                    {!disabled ? (
                      <>
                        <input
                          type="file"
                          id={inputId}
                          className="hidden"
                          accept={accept}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) selecionarArquivo(anexo.id, file);
                            e.target.value = "";
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          title={
                            temArquivo
                              ? "Substituir arquivo"
                              : "Selecionar arquivo"
                          }
                          onClick={() =>
                            document.getElementById(inputId)?.click()
                          }
                        >
                          <Upload className="size-3.5" />
                          {temArquivo ? "Substituir" : "Inserir"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title="Remover linha"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removerLinha(anexo.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {anexosVisiveis.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={3}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      {erro ? (
        <p className="text-xs text-destructive" role="alert">
          {erro}
        </p>
      ) : null}

      {podeAdicionar ? (
        <Button type="button" variant="outline" size="sm" onClick={adicionarLinha}>
          <Plus className="size-4" />
          {addButtonLabel}
        </Button>
      ) : null}
    </div>
  );
}
