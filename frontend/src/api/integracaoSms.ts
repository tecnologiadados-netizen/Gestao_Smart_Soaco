import { apiFetch, apiJson } from './client';

export type FonteMensagem = 'evento' | 'sql_template' | 'codigo';
export type ModoDisparo = 'evento' | 'cron';

export interface WhatsappNotificacaoTipo {
  id: number;
  code: string;
  label: string;
  descricao: string | null;
  ativo: boolean;
  sortOrder: number;
  fonteMensagem: FonteMensagem;
  modoDisparo: ModoDisparo;
  cronExpressao: string | null;
  sqlNomus: string | null;
  templateMensagem: string | null;
  builderCode: string | null;
  destinatarioIds: number[];
}

export interface WhatsappNotificacaoTipoSave {
  id?: number;
  code: string;
  label: string;
  descricao?: string | null;
  ativo: boolean;
  sortOrder: number;
  fonteMensagem: FonteMensagem;
  modoDisparo: ModoDisparo;
  cronExpressao?: string | null;
  sqlNomus?: string | null;
  templateMensagem?: string | null;
  builderCode?: string | null;
}

export interface UsuarioDestinatario {
  id: number;
  login: string;
  nome: string | null;
  telefone: string | null;
  ativo: boolean;
}

export interface SmsTiposResponse {
  tipos: WhatsappNotificacaoTipo[];
  nomusEnabled: boolean;
  evolutionConfigured: boolean;
}

export async function getSmsTipos(): Promise<SmsTiposResponse> {
  return apiJson<SmsTiposResponse>('/api/integracao/sms/tipos');
}

export async function saveSmsTipos(tipos: WhatsappNotificacaoTipoSave[]): Promise<{ tipos: WhatsappNotificacaoTipo[] }> {
  const res = await apiFetch('/api/integracao/sms/tipos', {
    method: 'PUT',
    body: { tipos },
  } as { method: string; body: unknown });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? 'Erro ao salvar tipos.');
  }
  return res.json();
}

export async function saveSmsDestinatarios(
  tipoId: number,
  usuarioIds: number[]
): Promise<{ tipos: WhatsappNotificacaoTipo[] }> {
  const res = await apiFetch(`/api/integracao/sms/tipos/${tipoId}/destinatarios`, {
    method: 'PUT',
    body: { usuarioIds },
  } as { method: string; body: unknown });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? 'Erro ao salvar destinatários.');
  }
  return res.json();
}

export async function getSmsUsuarios(): Promise<UsuarioDestinatario[]> {
  return apiJson<UsuarioDestinatario[]>('/api/integracao/sms/usuarios');
}

export async function previewSmsTipo(tipoId: number): Promise<{
  mensagem: string;
  colunas: string[];
  linhasPreview: Record<string, unknown>[];
}> {
  const res = await apiFetch(`/api/integracao/sms/tipos/${tipoId}/preview`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? 'Erro ao gerar preview.');
  }
  return res.json();
}

export async function testarSmsTipo(tipoId: number, usuarioId: number): Promise<void> {
  const res = await apiFetch(`/api/integracao/sms/tipos/${tipoId}/testar`, {
    method: 'POST',
    body: { usuarioId },
  } as { method: string; body: unknown });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? 'Erro ao testar envio.');
  }
}
