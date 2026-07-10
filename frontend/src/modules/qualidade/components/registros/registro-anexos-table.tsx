import { useId, useState } from "react";
import { Download, Eye, Paperclip, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
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
import type { RegistroAnexo } from "@qualidade/types/registro-anexo";

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp";
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

interface RegistroAnexosTableProps {
  anexos: RegistroAnexo[];
  onChange: (anexos: RegistroAnexo[]) => void;
  disabled?: boolean;
}

function novoAnexo(): RegistroAnexo {
  return { id: crypto.randomUUID(), nome: "", dataUrl: "" };
}

export function RegistroAnexosTable({
  anexos,
  onChange,
  disabled = false,
}: RegistroAnexosTableProps) {
  const baseId = useId();
  const [erro, setErro] = useState("");

  function atualizarLinha(id: string, patch: Partial<RegistroAnexo>) {
    onChange(anexos.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removerLinha(id: string) {
    onChange(anexos.filter((row) => row.id !== id));
  }

  function adicionarLinha() {
    onChange([...anexos, novoAnexo()]);
  }

  function selecionarArquivo(id: string, file: File) {
    if (file.size > MAX_SIZE_BYTES) {
      setErro(`"${file.name}" excede o limite de 5 MB.`);
      return;
    }
    setErro("");
    const reader = new FileReader();
    reader.onload = () => {
      atualizarLinha(id, { nome: file.name, dataUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  }

  function podeVisualizar(anexo: RegistroAnexo) {
    return isPdfFile(anexo.nome) || isImageFile(anexo.nome);
  }

  const anexosVisiveis = disabled
    ? anexos.filter((row) => row.nome.trim() && row.dataUrl.trim())
    : anexos;

  if (disabled && anexosVisiveis.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma evidência anexada.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-border">
        <Table bare>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Arquivo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {anexosVisiveis.map((anexo, index) => {
              const inputId = `${baseId}-${anexo.id}`;
              const temArquivo = Boolean(
                anexo.nome.trim() && anexo.dataUrl.trim()
              );
              return (
                <TableRow key={anexo.id}>
                  <TableCell className="text-muted-foreground">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 truncate">
                        {temArquivo ? (
                          anexo.nome
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
                      {temArquivo ? (
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
                            accept={ACCEPT}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) selecionarArquivo(anexo.id, file);
                              e.target.value = "";
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title={temArquivo ? "Substituir arquivo" : "Selecionar arquivo"}
                            onClick={() =>
                              document.getElementById(inputId)?.click()
                            }
                          >
                            <Upload className="size-4" />
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
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  Nenhuma evidência adicionada. Clique em "Adicionar linha" para
                  anexar um arquivo.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {erro ? (
        <p className="text-xs text-destructive" role="alert">
          {erro}
        </p>
      ) : null}

      {!disabled ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={adicionarLinha}
        >
          <Plus className="size-4" />
          Adicionar linha
        </Button>
      ) : null}
    </div>
  );
}
