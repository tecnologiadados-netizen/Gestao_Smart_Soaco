import { Suspense } from "react";
import { RegistrosConsultaContent } from './RegistrosConsultaContent';

export function RegistrosConsultaPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-muted-foreground">Carregando...</p>
      }
    >
      <RegistrosConsultaContent />
    </Suspense>
  );
}
