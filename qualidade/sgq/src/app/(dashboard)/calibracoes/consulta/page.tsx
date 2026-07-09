import { Suspense } from "react";
import CalibracoesConsultaPage from "./consulta-content";

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando...</p>}>
      <CalibracoesConsultaPage />
    </Suspense>
  );
}
