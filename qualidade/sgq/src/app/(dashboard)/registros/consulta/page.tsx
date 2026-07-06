import { Suspense } from "react";
import RegistrosConsultaContent from "./consulta-content";

export default function RegistrosConsultaPage() {
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
