import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qualidade/components/ui/select";
import {
  MODULO_REGISTRO_TIPOS,
  moduloRegistroTipoLabels,
  type ModuloRegistroTipo,
} from "@qualidade/lib/registros/constants";

interface RegistroTipoSeletorProps {
  value: ModuloRegistroTipo | null;
  onChange: (tipo: ModuloRegistroTipo) => void;
}

export function RegistroTipoSeletor({
  value,
  onChange,
}: RegistroTipoSeletorProps) {
  return (
    <Select
      value={value ?? undefined}
      onValueChange={(v) => {
        if (v) onChange(v as ModuloRegistroTipo);
      }}
    >
      <SelectTrigger className="h-9 w-full max-w-xl bg-background">
        <SelectValue placeholder="Selecione o tipo de registro" />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} className="max-h-60">
        {MODULO_REGISTRO_TIPOS.map((tipo) => (
          <SelectItem key={tipo} value={tipo}>
            {moduloRegistroTipoLabels[tipo]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
