import { useMemo } from "react";
import { randomUUID } from "@/utils/randomUUID";
import { SgqAnexosTable } from "@qualidade/components/ui/sgq-anexos-table";
import type { SgqAnexo } from "@qualidade/types/registro-anexo";

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
  disabled?: boolean;
}

function createAnexoRow(): AnexoItem {
  return { id: randomUUID() };
}

export function defaultAnexoRows(count = 1): AnexoItem[] {
  return Array.from({ length: count }, () => createAnexoRow());
}

function toSgqAnexos(rows: AnexoItem[]): SgqAnexo[] {
  return rows.map((row) => ({
    id: row.id,
    nome: row.nome ?? "",
    dataUrl: row.dataUrl ?? "",
  }));
}

function fromSgqAnexos(rows: SgqAnexo[]): AnexoItem[] {
  return rows.map((row) => ({
    id: row.id,
    nome: row.nome || undefined,
    dataUrl: row.dataUrl || undefined,
  }));
}

export function EquipamentoAnexosField({
  label = "Anexos complementares",
  value,
  onChange,
  accept,
  disabled = false,
}: Props) {
  const anexos = useMemo(() => toSgqAnexos(value), [value]);

  function handleChange(next: SgqAnexo[]) {
    if (disabled) return;
    const mapped = fromSgqAnexos(next);
    onChange(mapped.length > 0 ? mapped : [createAnexoRow()]);
  }

  return (
    <SgqAnexosTable
      label={label}
      anexos={anexos}
      onChange={handleChange}
      accept={accept}
      disabled={disabled}
      emptyMessage='Nenhum anexo adicionado. Clique em "Adicionar anexo" para incluir um arquivo.'
      addButtonLabel="Adicionar anexo"
      readOnlyEmptyMessage="Nenhum anexo complementar."
    />
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
