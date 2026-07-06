import { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
import { Label } from "@qualidade/components/ui/label";

const DEFAULT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png";
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export interface AnexoItem {
  id: string;
  nome?: string;
  dataUrl?: string;
}

interface Props {
  label?: string;
  value: AnexoItem[];
  onChange: (value: AnexoItem[]) => void;
  accept?: string;
}

function createAnexoRow(): AnexoItem {
  return { id: crypto.randomUUID() };
}

export function defaultAnexoRows(count = 1): AnexoItem[] {
  return Array.from({ length: count }, () => createAnexoRow());
}

export function EquipamentoAnexosField({
  label = "Anexo",
  value,
  onChange,
  accept = DEFAULT_ACCEPT,
}: Props) {
  const baseId = useId();

  function updateRow(id: string, patch: Partial<AnexoItem>) {
    onChange(value.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: string) {
    const next = value.filter((row) => row.id !== id);
    onChange(next.length > 0 ? next : [createAnexoRow()]);
  }

  function addRow() {
    onChange([...value, createAnexoRow()]);
  }

  function handleFileSelect(id: string, file: File) {
    if (file.size > MAX_SIZE_BYTES) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateRow(id, {
        nome: file.name,
        dataUrl: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="space-y-3">
        {value.map((row, index) => {
          const inputId = `${baseId}-${row.id}`;
          return (
            <div
              key={row.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border/80 bg-muted/20 px-4 py-3"
            >
              <input
                type="file"
                id={inputId}
                className="hidden"
                accept={accept}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(row.id, file);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById(inputId)?.click()}
              >
                Inserir arquivo
              </Button>
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                {row.nome ?? `Anexo ${index + 1} — nenhum arquivo selecionado`}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remover linha de anexo"
                onClick={() => removeRow(row.id)}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          );
        })}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="size-4" />
        Adicionar anexo
      </Button>
    </div>
  );
}

export function anexosPreenchidos(
  rows: AnexoItem[]
): { nome: string; dataUrl: string }[] {
  return rows
    .filter((row) => row.nome?.trim() && row.dataUrl?.trim())
    .map((row) => ({
      nome: row.nome!.trim(),
      dataUrl: row.dataUrl!.trim(),
    }));
}
