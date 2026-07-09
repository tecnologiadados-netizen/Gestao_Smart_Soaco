import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qualidade/components/ui/select";
import { Label } from "@qualidade/components/ui/label";
import type { Fornecedor } from "@qualidade/types/avaliacao-fornecedor";

interface FornecedorSelectFieldProps {
  id?: string;
  label?: string;
  fornecedores: Fornecedor[];
  value: string;
  onValueChange: (fornecedorId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function FornecedorSelectField({
  id = "fornecedor-select",
  label = "Fornecedor",
  fornecedores,
  value,
  onValueChange,
  placeholder = "Selecione um fornecedor",
  disabled = false,
}: FornecedorSelectFieldProps) {
  const selecionado = fornecedores.find((f) => f.id === value);

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value || undefined}
        onValueChange={(v) => v && onValueChange(v)}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="w-full border-border/80 bg-card shadow-sm">
          <SelectValue placeholder={placeholder}>
            {selecionado
              ? `${selecionado.id} — ${selecionado.nome}`
              : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {fornecedores.map((fornecedor) => (
            <SelectItem key={fornecedor.id} value={fornecedor.id}>
              {fornecedor.id} — {fornecedor.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
