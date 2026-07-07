import { syncQualidadeConfig } from '@qualidade/lib/api/qualidadeApi';
import type { Department, DocumentType } from '@qualidade/types/user';

let hydrating = false;

export function setQualidadeConfigHydrating(value: boolean) {
  hydrating = value;
}

export function isQualidadeConfigHydrating(): boolean {
  return hydrating;
}

export async function persistConfigToServer(snapshot?: {
  departments: Department[];
  documentTypes: DocumentType[];
}): Promise<void> {
  if (hydrating || !snapshot) return;
  await syncQualidadeConfig({
    departments: snapshot.departments,
    documentTypes: snapshot.documentTypes,
  });
}
