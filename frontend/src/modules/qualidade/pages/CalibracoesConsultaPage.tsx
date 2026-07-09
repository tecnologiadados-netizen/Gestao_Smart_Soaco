import { Suspense } from 'react';
import { CalibracoesConsultaContent } from './CalibracoesConsultaContent';

export function CalibracoesConsultaPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando...</p>}>
      <CalibracoesConsultaContent />
    </Suspense>
  );
}
