import { useId, useState } from "react";
import { Paperclip, Plus, Trash2, Upload } from "lucide-react";
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
import { SgqArquivoAcoes } from "@qualidade/components/documentos/sgq-arquivo-imprimir-btn";
import { MSG_VISUALIZACAO_BAIXAR_ORIGINAL } from "@qualidade/lib/documents/sgq-print-window";
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
    <div className="min-w-0 space-y-3">
      {label ? <Label className="text-base">{label}</Label> : null}

      <Table surface className="table-fixed">
        <TableHeader>
          <TableRow className="border-b-2 border-border">
            <TableHead className="w-10 border-r border-border/70">#</TableHead>
            <TableHead className="min-w-0 border-r border-border/70">
              Arquivo
            </TableHead>
            <TableHead className="w-52 text-right sm:w-56">Ações</TableHead>
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
                <TableCell className="max-w-0 border-r border-border/60 !whitespace-normal">
                  <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                    <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                    <span
                      className="min-w-0 truncate text-sm"
                      title={temArquivo ? anexo.nome : undefined}
                    >
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
                <TableCell className="align-middle">
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    {temArquivo ? (
                      <SgqArquivoAcoes
                        arquivo={anexo}
                        onError={setErro}
                      />
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
                          className="h-8 shrink-0 gap-1.5 text-xs"
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
                          className="shrink-0 text-destructive hover:text-destructive"
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
        <p
          className={`text-xs ${
            erro === MSG_VISUALIZACAO_BAIXAR_ORIGINAL
              ? "text-amber-700 dark:text-amber-400"
              : "text-destructive"
          }`}
          role="status"
        >
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
