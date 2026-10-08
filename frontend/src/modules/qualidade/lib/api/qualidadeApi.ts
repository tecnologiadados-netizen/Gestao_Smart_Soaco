import { apiFetch } from '@/api/client';

export interface QualidadeBootstrap {
  departments: Array<{ id: string; nome: string }>;
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

/** Persiste um único registro (criação/edição) sem reenviar todo o histórico. */
export async function syncQualidadeRegistro(
  registro: unknown,
): Promise<{ numeros?: Record<string, string> }> {
  const res = await apiFetch('/api/qualidade/sync/registros', {
    method: 'PUT',
    body: { registros: [registro] },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = (err as { error?: string }).error ?? '';
    throw new Error(
      message && !/prisma|Unique constraint|Invalid `/i.test(message)
        ? message
        : 'Não foi possível salvar o registro. Tente novamente.',
    );
  }
  return (await res.json().catch(() => ({}))) as { numeros?: Record<string, string> };
}

export async function deleteQualidadeRegistro(registroId: string): Promise<void> {
  const res = await apiFetch(
    `/api/qualidade/registros/${encodeURIComponent(registroId)}`,
    { method: 'DELETE' }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Falha ao excluir registro.');
  }
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

export async function deleteQualidadeDocument(documentId: string): Promise<void> {
  const res = await apiFetch(
    `/api/qualidade/documentos/${encodeURIComponent(documentId)}`,
    { method: 'DELETE' }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Falha ao excluir documento.');
  }
}

export async function syncQualidadeCalibrations(payload: {
  equipment: unknown[];
  calibrationRecords: unknown[];
  verificationRecords: unknown[];
  tasks: unknown[];
}) {
  await putJson('/api/qualidade/sync/calibracoes', payload);
}

export async function deleteQualidadeEquipamento(equipmentId: string): Promise<void> {
  const res = await apiFetch(
    `/api/qualidade/equipamentos/${encodeURIComponent(equipmentId)}`,
    { method: 'DELETE' }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Falha ao excluir equipamento.');
  }
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

export async function fetchQualidadeArquivoPreviewUrl(storagePath: string): Promise<string> {
  const res = await apiFetch(
    `/api/qualidade/arquivos/preview?src=${encodeURIComponent(storagePath)}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error ?? 'Falha ao abrir a visualização do documento.'
    );
  }
  const data = (await res.json()) as { url?: string };
  if (!data.url?.startsWith('/uploads/')) {
    throw new Error('Visualização indisponível.');
  }
  return data.url;
}

export interface ProdutoSetorProducao {
  codigo: string;
  descricao: string;
  setorProducao: string;
  tipoProduto: string;
}

/** Setor de produção, ou o tipo de produto do Nomus quando o item comprado não tem setor. */
export function classificacaoCatalogoProduto(produto: ProdutoSetorProducao | null | undefined): {
  origem: "setor" | "tipo" | "";
  valor: string;
} {
  const setor = produto?.setorProducao?.trim() ?? "";
  if (setor) return { origem: "setor", valor: setor };
  const tipo = produto?.tipoProduto?.trim() ?? "";
  if (tipo) return { origem: "tipo", valor: tipo };
  return { origem: "", valor: "" };
}

export interface ReclamacaoProdutoExemplo {
  codigo: string;
  descricao: string;
}

export interface SolucaoCausa {
  descricao: string;
  servico: string;
}

export interface ReclamacaoProdutoCadastro {
  id: string;
  descricao: string;
  setorProducao: string;
  exemplos: ReclamacaoProdutoExemplo[];
  solucoes?: SolucaoCausa[];
}

async function lerErro(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({}));
  throw new Error((err as { error?: string }).error ?? fallback);
}

export async function buscarSetorProducaoProduto(q: string): Promise<ProdutoSetorProducao[]> {
  const res = await apiFetch(
    `/api/qualidade/produtos/setor-producao?q=${encodeURIComponent(q)}`
  );
  if (!res.ok) await lerErro(res, 'Falha ao buscar o setor de produção.');
  const data = (await res.json()) as {
    produtos?: ProdutoSetorProducao[];
    source?: string;
  };
  if (data.source === 'indisponivel') {
    throw new Error('Consulta ao ERP indisponível.');
  }
  return data.produtos ?? [];
}

export async function listarReclamacoesProduto(): Promise<ReclamacaoProdutoCadastro[]> {
  const res = await apiFetch('/api/qualidade/reclamacoes-produto');
  if (!res.ok) await lerErro(res, 'Falha ao carregar as reclamações.');
  const data = (await res.json()) as { reclamacoes?: ReclamacaoProdutoCadastro[] };
  return (data.reclamacoes ?? []).map((item) => ({
    ...item,
    exemplos: item.exemplos ?? [],
  }));
}

export async function criarReclamacaoProduto(input: {
  descricao: string;
  setorProducao: string;
  exemplo?: ReclamacaoProdutoExemplo | null;
}): Promise<ReclamacaoProdutoCadastro> {
  const res = await apiFetch('/api/qualidade/reclamacoes-produto', {
    method: 'POST',
    body: input,
  });
  if (!res.ok) await lerErro(res, 'Falha ao cadastrar a reclamação.');
  const data = (await res.json()) as { reclamacao: ReclamacaoProdutoCadastro };
  return data.reclamacao;
}

export async function atualizarReclamacaoProduto(
  id: string,
  input: {
    descricao: string;
    setorProducao: string;
    exemplo?: ReclamacaoProdutoExemplo | null;
  }
): Promise<ReclamacaoProdutoCadastro> {
  const res = await apiFetch(`/api/qualidade/reclamacoes-produto/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: input,
  });
  if (!res.ok) await lerErro(res, 'Falha ao atualizar a reclamação.');
  const data = (await res.json()) as { reclamacao: ReclamacaoProdutoCadastro };
  return data.reclamacao;
}

export async function excluirReclamacaoProduto(id: string): Promise<void> {
  const res = await apiFetch(`/api/qualidade/reclamacoes-produto/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) await lerErro(res, 'Falha ao excluir a reclamação.');
}

function normalizarSolucoes(raw: unknown): SolucaoCausa[] {
  if (!Array.isArray(raw)) return [];
  const solucoes: SolucaoCausa[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const descricao = item.trim();
      if (descricao) solucoes.push({ descricao, servico: '' });
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const linha = item as { descricao?: unknown; servico?: unknown };
    const descricao = String(linha.descricao ?? '').trim();
    if (!descricao) continue;
    solucoes.push({ descricao, servico: String(linha.servico ?? '').trim() });
  }
  return solucoes;
}

export async function listarCausasProblema(): Promise<ReclamacaoProdutoCadastro[]> {
  const res = await apiFetch('/api/qualidade/causas-problema');
  if (!res.ok) await lerErro(res, 'Falha ao carregar as causas do problema.');
  const data = (await res.json()) as { causas?: ReclamacaoProdutoCadastro[] };
  return (data.causas ?? []).map((item) => ({
    ...item,
    exemplos: item.exemplos ?? [],
    solucoes: normalizarSolucoes(item.solucoes),
  }));
}

export async function criarCausaProblema(input: {
  descricao: string;
  setorProducao: string;
  exemplo?: ReclamacaoProdutoExemplo | null;
  solucoes?: SolucaoCausa[];
}): Promise<ReclamacaoProdutoCadastro> {
  const res = await apiFetch('/api/qualidade/causas-problema', {
    method: 'POST',
    body: input,
  });
  if (!res.ok) await lerErro(res, 'Falha ao cadastrar a causa do problema.');
  const data = (await res.json()) as { causa: ReclamacaoProdutoCadastro };
  return data.causa;
}

export async function atualizarCausaProblema(
  id: string,
  input: {
    descricao: string;
    setorProducao: string;
    exemplo?: ReclamacaoProdutoExemplo | null;
    solucoes?: SolucaoCausa[];
  }
): Promise<ReclamacaoProdutoCadastro> {
  const res = await apiFetch(`/api/qualidade/causas-problema/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: input,
  });
  if (!res.ok) await lerErro(res, 'Falha ao atualizar a causa do problema.');
  const data = (await res.json()) as { causa: ReclamacaoProdutoCadastro };
  return data.causa;
}

export async function excluirCausaProblema(id: string): Promise<void> {
  const res = await apiFetch(`/api/qualidade/causas-problema/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) await lerErro(res, 'Falha ao excluir a causa do problema.');
}

export async function listarServicosRealizados(): Promise<ReclamacaoProdutoCadastro[]> {
  const res = await apiFetch('/api/qualidade/servicos-realizados');
  if (!res.ok) await lerErro(res, 'Falha ao carregar os serviços realizados.');
  const data = (await res.json()) as { servicos?: ReclamacaoProdutoCadastro[] };
  return (data.servicos ?? []).map((item) => ({
    ...item,
    exemplos: item.exemplos ?? [],
  }));
}

export async function criarServicoRealizado(input: {
  descricao: string;
  setorProducao: string;
  exemplo?: ReclamacaoProdutoExemplo | null;
}): Promise<ReclamacaoProdutoCadastro> {
  const res = await apiFetch('/api/qualidade/servicos-realizados', {
    method: 'POST',
    body: input,
  });
  if (!res.ok) await lerErro(res, 'Falha ao cadastrar o serviço realizado.');
  const data = (await res.json()) as { servico: ReclamacaoProdutoCadastro };
  return data.servico;
}

export async function atualizarServicoRealizado(
  id: string,
  input: {
    descricao: string;
    setorProducao: string;
    exemplo?: ReclamacaoProdutoExemplo | null;
  }
): Promise<ReclamacaoProdutoCadastro> {
  const res = await apiFetch(`/api/qualidade/servicos-realizados/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: input,
  });
  if (!res.ok) await lerErro(res, 'Falha ao atualizar o serviço realizado.');
  const data = (await res.json()) as { servico: ReclamacaoProdutoCadastro };
  return data.servico;
}

export async function excluirServicoRealizado(id: string): Promise<void> {
  const res = await apiFetch(`/api/qualidade/servicos-realizados/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) await lerErro(res, 'Falha ao excluir o serviço realizado.');
}
