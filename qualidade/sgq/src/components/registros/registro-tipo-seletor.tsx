"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MODULO_REGISTRO_TIPOS,
  moduloRegistroTipoLabels,
  type ModuloRegistroTipo,
} from "@/lib/registros/constants";

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
      value={value ?? ""}
      onValueChange={(v) => {
        if (v) onChange(v as ModuloRegistroTipo);
      }}
    >
      <SelectTrigger className="w-full max-w-xl">
        <SelectValue placeholder="Selecione o tipo de registro">
          {value ? moduloRegistroTipoLabels[value] : null}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {MODULO_REGISTRO_TIPOS.map((tipo) => (
          <SelectItem key={tipo} value={tipo}>
            {moduloRegistroTipoLabels[tipo]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
