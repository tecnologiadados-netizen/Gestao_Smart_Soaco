"use client";

import { Label } from "@/components/ui/label";
import { StarRating } from "@/components/avaliacao-fornecedor/star-rating";
import {
  CRITERIOS_AVALIACAO,
  NOTA_MAX,
  type CriterioId,
} from "@/lib/avaliacao-fornecedor/criterios";

interface AvaliacaoCriteriosFormProps {
  notas: Record<CriterioId, number | "">;
  onChange: (criterioId: CriterioId, nota: number | "") => void;
  disabled?: boolean;
}

export function AvaliacaoCriteriosForm({
  notas,
  onChange,
  disabled = false,
}: AvaliacaoCriteriosFormProps) {
  return (
    <fieldset className="brand-fieldset space-y-4">
      <legend>Classificação por estrelas (1 a {NOTA_MAX})</legend>
      <div className="grid gap-5 sm:grid-cols-1">
        {CRITERIOS_AVALIACAO.map((criterio) => (
          <div
            key={criterio.id}
            className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/15 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <Label
              htmlFor={`nota-${criterio.id}`}
              className="text-sm font-medium leading-snug"
            >
              {criterio.label}
            </Label>
            <StarRating
              id={`nota-${criterio.id}`}
              value={notas[criterio.id]}
              onChange={(nota) => onChange(criterio.id, nota)}
              disabled={disabled}
              size="md"
              showValue
              aria-label={`${criterio.label}: classificação por estrelas`}
            />
          </div>
        ))}
      </div>
    </fieldset>
  );
}
