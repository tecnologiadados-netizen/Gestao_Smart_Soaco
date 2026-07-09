"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AvaliacaoMetadadosInput } from "@/types/avaliacao-fornecedor";

interface AvaliacaoMetadadosFormProps {
  metadados: AvaliacaoMetadadosInput;
  responsavelNome: string;
  onChange: (metadados: AvaliacaoMetadadosInput) => void;
  disabled?: boolean;
}

export function AvaliacaoMetadadosForm({
  metadados,
  responsavelNome,
  onChange,
  disabled = false,
}: AvaliacaoMetadadosFormProps) {
  function patch(partial: Partial<AvaliacaoMetadadosInput>) {
    onChange({ ...metadados, ...partial });
  }

  const aprovadoValue =
    metadados.fornecedorAprovado === ""
      ? undefined
      : metadados.fornecedorAprovado
        ? "sim"
        : "nao";

  return (
    <fieldset className="brand-fieldset space-y-4">
      <legend>Dados da avaliação</legend>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="av-data-referencia">
            Data de referência da avaliação *
          </Label>
          <Input
            id="av-data-referencia"
            type="date"
            value={metadados.dataReferencia}
            onChange={(e) => patch({ dataReferencia: e.target.value })}
            disabled={disabled}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="av-data-avaliacao">Data da avaliação *</Label>
          <Input
            id="av-data-avaliacao"
            type="date"
            value={metadados.dataAvaliacao}
            onChange={(e) => patch({ dataAvaliacao: e.target.value })}
            disabled={disabled}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="av-responsavel">Responsável pela avaliação</Label>
          <Input
            id="av-responsavel"
            value={responsavelNome}
            readOnly
            disabled
            className="bg-muted/40"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="av-numero-documento">
            Número do contrato / documento *
          </Label>
          <Input
            id="av-numero-documento"
            value={metadados.numeroDocumento}
            onChange={(e) => patch({ numeroDocumento: e.target.value })}
            placeholder="Ex.: DE38138"
            disabled={disabled}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="av-fornecedor-aprovado">Fornecedor aprovado? *</Label>
          <Select
            value={aprovadoValue}
            onValueChange={(v) => {
              if (v === "sim") patch({ fornecedorAprovado: true });
              else if (v === "nao") patch({ fornecedorAprovado: false });
            }}
            disabled={disabled}
          >
            <SelectTrigger id="av-fornecedor-aprovado" className="w-full">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sim">Sim</SelectItem>
              <SelectItem value="nao">Não</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="av-rnc">RNC Nº</Label>
          <Input
            id="av-rnc"
            value={metadados.rncNumero ?? ""}
            onChange={(e) => patch({ rncNumero: e.target.value })}
            placeholder="Opcional"
            disabled={disabled}
          />
        </div>
      </div>
    </fieldset>
  );
}
