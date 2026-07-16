import { SgqAnexosTable } from "@qualidade/components/ui/sgq-anexos-table";
import type { RegistroAnexo } from "@qualidade/types/registro-anexo";

interface RegistroAnexosTableProps {
  anexos: RegistroAnexo[];
  onChange: (anexos: RegistroAnexo[]) => void;
  disabled?: boolean;
}

export function RegistroAnexosTable({
  anexos,
  onChange,
  disabled = false,
}: RegistroAnexosTableProps) {
  return (
    <SgqAnexosTable
      anexos={anexos}
      onChange={onChange}
      disabled={disabled}
      emptyMessage='Nenhuma evidência adicionada. Clique em "Adicionar anexo" para incluir um arquivo.'
      addButtonLabel="Adicionar anexo"
      readOnlyEmptyMessage="Nenhuma evidência anexada."
    />
  );
}
