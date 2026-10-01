import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@qualidade/components/ui/button";
import { Input } from "@qualidade/components/ui/input";
import { Label } from "@qualidade/components/ui/label";
import { cn } from "@qualidade/lib/utils";

interface CampoClienteLapisProps {
  id: string;
  label: string;
  value: string;
  /** Travado com o valor do cadastro até o lápis abrir a edição. */
  bloqueado: boolean;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  ocultarRotulo?: boolean;
  compacto?: boolean;
  onChange: (valor: string) => void;
}

/** Campo do cliente: o lápis abre a edição, com salvar ou cancelar para voltar ao valor anterior. */
export function CampoClienteLapis({
  id,
  label,
  value,
  bloqueado,
  disabled = false,
  placeholder,
  maxLength,
  ocultarRotulo = false,
  compacto = false,
  onChange,
}: CampoClienteLapisProps) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(value);

  useEffect(() => {
    if (!editando) setRascunho(value);
  }, [value, editando]);

  function iniciar() {
    setRascunho(value);
    setEditando(true);
  }

  function cancelar() {
    setRascunho(value);
    setEditando(false);
  }

  function salvar() {
    onChange(rascunho);
    setEditando(false);
  }

  const travado = (bloqueado && !editando) || disabled;

  return (
    <div className="space-y-2">
      {ocultarRotulo ? null : <Label htmlFor={id}>{label}</Label>}
      <div className={cn("flex gap-1", compacto ? "flex-col items-stretch" : "items-start")}>
        <Input
          id={id}
          value={editando ? rascunho : value}
          readOnly={travado}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={maxLength}
          title={travado && value.trim() ? value : undefined}
          className={travado ? "campo-copiavel bg-muted/40" : undefined}
          onChange={(e) => {
            if (editando) setRascunho(e.target.value);
            else if (!bloqueado) onChange(e.target.value);
          }}
        />
        {bloqueado && !disabled && !editando ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label={`Editar ${label}`}
            title="Corrigir só nesta RCC"
            onClick={iniciar}
          >
            <Pencil />
          </Button>
        ) : null}
        {editando ? (
          <div className="flex shrink-0 gap-1">
            <Button type="button" size="sm" onClick={salvar}>
              Salvar
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={cancelar}>
              Cancelar
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
