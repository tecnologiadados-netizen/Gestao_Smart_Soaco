"use client";

import { Badge } from "@/components/ui/badge";
import { ORIGEM_NOMUS_LABEL } from "@/lib/registros/constants";
import type { Registro } from "@/types/registro";
import { getRegistroCodigoDocumento } from "@/types/registro";

interface CodigoDocumentoCellProps {
  registro: Registro;
}

export function CodigoDocumentoCell({ registro }: CodigoDocumentoCellProps) {
  return (
    <div className="space-y-0.5">
      <span className="font-medium text-primary">
        {getRegistroCodigoDocumento(registro)}
      </span>
      {registro.origemNomus ? (
        <p className="text-[11px] leading-tight text-muted-foreground">
          {ORIGEM_NOMUS_LABEL}
        </p>
      ) : null}
    </div>
  );
}

export function CodigoDocumentoBadge({ registro }: CodigoDocumentoCellProps) {
  if (!registro.origemNomus) return null;
  return (
    <Badge variant="outline" className="text-[10px] font-normal">
      {ORIGEM_NOMUS_LABEL}
    </Badge>
  );
}
