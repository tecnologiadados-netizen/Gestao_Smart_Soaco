import { apiFetch } from './client';

export type AssistenteConversa = {
  id: string;
  titulo: string;
  createdAt: string;
  updatedAt: string;
};

export type AssistenteMensagem = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  /** Agradecimento / meta pós-feedback — sem 👍/Alucinou. */
  meta?: boolean;
};

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Resposta inválida do servidor.');
  }
}

export async function listarConversasAssistente(): Promise<AssistenteConversa[]> {
  const res = await apiFetch('/api/assistente/conversas');
  const data = await readJson<{ data?: AssistenteConversa[]; error?: string }>(res);
  if (!res.ok) throw new Error(data.error ?? 'Erro ao listar conversas');
  return data.data ?? [];
}

export async function criarConversaAssistente(): Promise<AssistenteConversa> {
  const res = await apiFetch('/api/assistente/conversas', { method: 'POST' });
  const data = await readJson<AssistenteConversa & { error?: string }>(res);
  if (!res.ok) throw new Error(data.error ?? 'Erro ao criar conversa');
  return data;
}

export async function renomearConversaAssistente(
  id: string,
  titulo: string
): Promise<AssistenteConversa> {
  const res = await apiFetch(`/api/assistente/conversas/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { titulo },
  });
  const data = await readJson<AssistenteConversa & { error?: string }>(res);
  if (!res.ok) throw new Error(data.error ?? 'Erro ao renomear');
  return data;
}

export async function excluirConversaAssistente(id: string): Promise<void> {
  const res = await apiFetch(`/api/assistente/conversas/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await readJson<{ error?: string }>(res);
  if (!res.ok) throw new Error(data.error ?? 'Erro ao excluir');
}

export async function listarMensagensAssistente(
  id: string
): Promise<{ conversa: AssistenteConversa; data: AssistenteMensagem[] }> {
  const res = await apiFetch(`/api/assistente/conversas/${encodeURIComponent(id)}/mensagens`);
  const data = await readJson<{
    conversa?: AssistenteConversa;
    data?: AssistenteMensagem[];
    error?: string;
  }>(res);
  if (!res.ok || !data.conversa) throw new Error(data.error ?? 'Erro ao carregar mensagens');
  return { conversa: data.conversa, data: data.data ?? [] };
}

export async function perguntarAssistente(input: {
  conversaId?: string | null;
  mensagem: string;
  pathname?: string | null;
}): Promise<{
  conversaId: string;
  titulo: string;
  mensagem: AssistenteMensagem;
  fontes?: { tela: string; titulo: string }[];
}> {
  const res = await apiFetch('/api/assistente/perguntar', {
    method: 'POST',
    body: input,
  });
  const data = await readJson<{
    conversaId?: string;
    titulo?: string;
    mensagem?: AssistenteMensagem;
    fontes?: { tela: string; titulo: string }[];
    error?: string;
    code?: string;
  }>(res);
  if (!res.ok || !data.conversaId || !data.mensagem) {
    const err = new Error(data.error ?? 'Erro ao perguntar') as Error & { code?: string };
    err.code = data.code;
    throw err;
  }
  return {
    conversaId: data.conversaId,
    titulo: data.titulo ?? 'Conversa',
    mensagem: data.mensagem,
    fontes: data.fontes,
  };
}

export type TipoFeedbackAmigaco = 'positivo' | 'alucinou';

export async function listarFeedbacksConversa(
  conversaId: string
): Promise<Record<string, TipoFeedbackAmigaco>> {
  const res = await apiFetch(
    `/api/assistente/conversas/${encodeURIComponent(conversaId)}/feedbacks`
  );
  const data = await readJson<{ data?: Record<string, string>; error?: string }>(res);
  if (!res.ok) throw new Error(data.error ?? 'Erro ao carregar feedbacks');
  const out: Record<string, TipoFeedbackAmigaco> = {};
  for (const [k, v] of Object.entries(data.data ?? {})) {
    if (v === 'positivo' || v === 'alucinou') out[k] = v;
  }
  return out;
}

export async function registrarFeedbackAssistente(input: {
  mensagemId: string;
  tipo: TipoFeedbackAmigaco;
  pathname?: string | null;
}): Promise<{
  ok: true;
  mensagemFollowUp: AssistenteMensagem | null;
}> {
  const res = await apiFetch('/api/assistente/feedback', {
    method: 'POST',
    body: input,
  });
  const data = await readJson<{
    error?: string;
    mensagemFollowUp?: (AssistenteMensagem & { meta?: boolean }) | null;
  }>(res);
  if (!res.ok) throw new Error(data.error ?? 'Erro ao registrar feedback');
  return {
    ok: true,
    mensagemFollowUp: data.mensagemFollowUp
      ? { ...data.mensagemFollowUp, meta: true }
      : null,
  };
}

export type AmigacoAlucinacao = {
  id: string;
  usuarioId: number;
  usuarioLogin: string;
  usuarioNome: string | null;
  conversaId: string;
  mensagemId: string;
  perguntaUsuario: string | null;
  respostaAssistente: string;
  pathname: string | null;
  tituloConversa: string;
  resolvido: boolean;
  resolvidoEm: string | null;
  notaInterna: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function listarAlucinacoesAmigaco(params?: {
  resolvido?: 'pendentes' | 'resolvidos' | 'todos';
  q?: string;
}): Promise<AmigacoAlucinacao[]> {
  const qs = new URLSearchParams();
  if (params?.resolvido) qs.set('resolvido', params.resolvido);
  if (params?.q?.trim()) qs.set('q', params.q.trim());
  const suffix = qs.toString() ? `?${qs}` : '';
  const res = await apiFetch(`/api/assistente/alucinacoes${suffix}`);
  const data = await readJson<{ data?: AmigacoAlucinacao[]; error?: string }>(res);
  if (!res.ok) throw new Error(data.error ?? 'Erro ao listar alucinações');
  return data.data ?? [];
}

export async function atualizarAlucinacaoAmigaco(
  id: string,
  body: { resolvido: boolean; notaInterna?: string | null }
): Promise<AmigacoAlucinacao> {
  const res = await apiFetch(`/api/assistente/alucinacoes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
  });
  const data = await readJson<{ data?: AmigacoAlucinacao; error?: string }>(res);
  if (!res.ok || !data.data) throw new Error(data.error ?? 'Erro ao atualizar');
  return data.data;
}
