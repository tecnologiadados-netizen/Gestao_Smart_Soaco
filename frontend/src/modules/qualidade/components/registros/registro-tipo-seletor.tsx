import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qualidade/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { tiposRegistroPermitidos } from "@/utils/qualidadePermissoes";
import {
  isModuloRegistroTipo,
  moduloRegistroTipoLabels,
  type ModuloRegistroTipo,
} from "@qualidade/lib/registros/constants";

function rotuloTipoRegistro(tipo: ModuloRegistroTipo): string {
  return moduloRegistroTipoLabels[tipo].toLocaleUpperCase("pt-BR");
}

interface RegistroTipoSeletorProps {
  value: ModuloRegistroTipo | null;
  onChange: (tipo: ModuloRegistroTipo) => void;
}

export function RegistroTipoSeletor({
  value,
  onChange,
}: RegistroTipoSeletorProps) {
  const { hasPermission } = useAuth();
  const tipos = tiposRegistroPermitidos(hasPermission);
  return (
    <Select
      value={value ?? undefined}
      onValueChange={(v) => {
        if (v) onChange(v as ModuloRegistroTipo);
      }}
    >
      <SelectTrigger className="h-auto min-h-9 w-full max-w-xl bg-background py-2">
        <SelectValue
          className="whitespace-normal"
          placeholder="Selecione o tipo de registro"
        >
          {(selecionado: ModuloRegistroTipo | null) =>
            selecionado && isModuloRegistroTipo(selecionado)
              ? rotuloTipoRegistro(selecionado)
              : "Selecione o tipo de registro"
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} className="max-h-60">
        {tipos.map((tipo) => (
          <SelectItem key={tipo} value={tipo} label={rotuloTipoRegistro(tipo)}>
            {rotuloTipoRegistro(tipo)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
