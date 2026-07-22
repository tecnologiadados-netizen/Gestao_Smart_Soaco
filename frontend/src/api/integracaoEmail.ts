import { apiFetch, apiJson } from './client';

export type FonteMensagemEmail = 'codigo';
export type ModoDisparoEmail = 'cron';

export interface EmailNotificacaoTipo {
  id: number;
  code: string;
  label: string;
  descricao: string | null;
  ativo: boolean;
  sortOrder: number;
  fonteMensagem: FonteMensagemEmail;
  modoDisparo: ModoDisparoEmail;
  cronExpressao: string | null;
  builderCode: string | null;
  destinatarioIds: number[];
}

export interface EmailNotificacaoTipoSave {
  id?: number;
  code: string;
  label: string;
  descricao?: string | null;
  ativo: boolean;
  sortOrder: number;
  fonteMensagem: FonteMensagemEmail;
  modoDisparo: ModoDisparoEmail;
  cronExpressao?: string | null;
  builderCode?: string | null;
}

export interface UsuarioDestinatarioEmail {
  id: number;
  login: string;
  nome: string | null;
  email: string | null;
  ativo: boolean;
}

export interface EmailTiposResponse {
  tipos: EmailNotificacaoTipo[];
  nomusEnabled: boolean;
  emailConfigured: boolean;
}

export async function getEmailTipos(): Promise<EmailTiposResponse> {
  return apiJson<EmailTiposResponse>('/api/integracao/email/tipos');
}

export async function saveEmailTipos(
  tipos: EmailNotificacaoTipoSave[]
): Promise<{ tipos: EmailNotificacaoTipo[] }> {
  const res = await apiFetch('/api/integracao/email/tipos', {
    method: 'PUT',
    body: { tipos },
  } as { method: string; body: unknown });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? 'Erro ao salvar tipos.');
  }
  return res.json();
}

export async function saveEmailDestinatarios(
  tipoId: number,
  usuarioIds: number[]
): Promise<{ tipos: EmailNotificacaoTipo[] }> {
  const res = await apiFetch(`/api/integracao/email/tipos/${tipoId}/destinatarios`, {
    method: 'PUT',
    body: { usuarioIds },
  } as { method: string; body: unknown });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? 'Erro ao salvar destinatários.');
  }
  return res.json();
}

export async function getEmailUsuarios(): Promise<UsuarioDestinatarioEmail[]> {
  return apiJson<UsuarioDestinatarioEmail[]>('/api/integracao/email/usuarios');
}

export async function previewEmailTipo(tipoId: number): Promise<{
  subject: string;
  html: string;
  resumo: string;
  quantidadeAlertas: number;
}> {
  const res = await apiFetch(`/api/integracao/email/tipos/${tipoId}/preview`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? 'Erro ao gerar preview.');
  }
  return res.json();
}

export async function testarEmailTipo(tipoId: number, usuarioId: number): Promise<void> {
  const res = await apiFetch(`/api/integracao/email/tipos/${tipoId}/testar`, {
    method: 'POST',
    body: { usuarioId },
  } as { method: string; body: unknown });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? 'Erro ao testar envio.');
  }
}

export type NotificacaoExecucaoStatus =
  | 'running'
  | 'success'
  | 'skipped'
  | 'failed'
  | 'partial';

export interface NotificacaoTentativaHistorico {
  id: number;
  canal: string;
  destinatario: string;
  usuarioId: number | null;
  ok: boolean;
  dryRun: boolean;
  erro: string | null;
  enviadoEm: string;
}

export interface NotificacaoExecucaoHistorico {
  id: number;
  canal: 'whatsapp' | 'email';
  tipoCode: string;
  tipoId: number | null;
  origem: string;
  status: NotificacaoExecucaoStatus;
  iniciadoEm: string;
  finalizadoEm: string | null;
  resumo: string | null;
  erroMensagem: string | null;
  metadados: Record<string, unknown> | null;
  tentativas: NotificacaoTentativaHistorico[];
}

export async function getEmailHistorico(
  tipoId: number,
  limit = 50
): Promise<NotificacaoExecucaoHistorico[]> {
  const data = await apiJson<{ historico: NotificacaoExecucaoHistorico[] }>(
    `/api/integracao/email/tipos/${tipoId}/historico?limit=${limit}`
  );
  return data.historico;
}
