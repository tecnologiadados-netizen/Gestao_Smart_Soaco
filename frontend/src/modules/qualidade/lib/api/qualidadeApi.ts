import { apiFetch } from '@/api/client';

export interface QualidadeBootstrap {
  departments: Array<{ id: string; nome: string; sigla: string }>;
  documentTypes: Array<{ id: string; nome: string; sigla: string }>;
  documents: unknown[];
  versions: unknown[];
  revalidacoes: unknown[];
  validadeAlertas: unknown[];
  registros: unknown[];
  equipment: unknown[];
  calibrationRecords: unknown[];
  verificationRecords: unknown[];
  avaliacoes: unknown[];
  tasks: unknown[];
  opcoesLista: Record<string, string[]>;
}

export async function fetchQualidadeBootstrap(): Promise<QualidadeBootstrap> {
  const res = await apiFetch('/api/qualidade/bootstrap');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Falha ao carregar módulo Qualidade.');
  }
  return res.json() as Promise<QualidadeBootstrap>;
}

export async function fetchQualidadeResponsaveis(): Promise<
  Array<{ id: string; nome: string; email: string; ativo: boolean }>
> {
  const res = await apiFetch('/api/qualidade/responsaveis');
  if (!res.ok) throw new Error('Falha ao carregar responsáveis.');
  const data = (await res.json()) as { users: Array<{ id: string; nome: string; email: string; ativo: boolean }> };
  return data.users;
}

async function putJson(path: string, body: unknown) {
  const res = await apiFetch(path, {
    method: 'PUT',
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Falha ao salvar (${path}).`);
  }
}

export async function syncQualidadeConfig(payload: {
  departments: unknown[];
  documentTypes: unknown[];
}) {
  await putJson('/api/qualidade/sync/config', payload);
}

export async function syncQualidadeRegistros(registros: unknown[]) {
  await putJson('/api/qualidade/sync/registros', { registros });
}

export async function syncQualidadeDocuments(payload: {
  documents: unknown[];
  versions: unknown[];
  tasks: unknown[];
  validadeAlertas: unknown[];
  revalidacoes: unknown[];
}) {
  await putJson('/api/qualidade/sync/documentos', payload);
}

export async function syncQualidadeCalibrations(payload: {
  equipment: unknown[];
  calibrationRecords: unknown[];
  verificationRecords: unknown[];
  tasks: unknown[];
}) {
  await putJson('/api/qualidade/sync/calibracoes', payload);
}

export async function syncQualidadeAvaliacoes(avaliacoes: unknown[]) {
  await putJson('/api/qualidade/sync/avaliacoes', { avaliacoes });
}

export async function syncQualidadeOpcoesLista(opcoes: Record<string, string[]>) {
  await putJson('/api/qualidade/sync/opcoes-lista', { opcoes });
}

export async function importQualidadeRegistros(registros: unknown[]) {
  const res = await apiFetch('/api/qualidade/registros/import', {
    method: 'POST',
    body: { registros },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Falha ao importar registros.');
  }
  return res.json() as Promise<{ inseridos: number; ignorados: number }>;
}
