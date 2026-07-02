import { apiFetch, apiJson } from './client';
import type {
  DadosProgramacaoProducaoV1,
  EstoqueSetorDetalhe,
  ExplosaoPaDetalhe,
  OrdemNomusOpcao,
  ProgramacaoProducaoGradeRowApi,
  ProgramacaoProducaoListItem,
  ProgramacaoProducaoRecurso,
  ProgramacaoProducaoSalva,
} from '../components/programacao-producao/types';

export async function listProgramacoesProducao(): Promise<ProgramacaoProducaoListItem[]> {
  const r = await apiJson<{ data: ProgramacaoProducaoListItem[] }>('/api/programacao-producao');
  return r.data ?? [];
}

export async function getProgramacaoProducao(id: string): Promise<ProgramacaoProducaoSalva> {
  const r = await apiJson<{ data: ProgramacaoProducaoSalva }>(
    `/api/programacao-producao/${encodeURIComponent(id)}`
  );
  if (!r.data) throw new Error('Programação não encontrada.');
  return r.data;
}

export type ProgramacaoProducaoCatalogo = {
  bobinas: Record<string, { codigo_mp?: string; alternativas: string[] }>;
  descricoes: Record<string, string>;
  recursos?: ProgramacaoProducaoRecurso[];
};

export async function fetchProgramacaoProducaoCatalogo(): Promise<ProgramacaoProducaoCatalogo> {
  const r = await apiJson<{ data: ProgramacaoProducaoCatalogo }>('/api/programacao-producao/catalogo');
  return r.data ?? { bobinas: {}, descricoes: {}, recursos: [] };
}

export async function listProgramacaoProducaoRecursos(): Promise<ProgramacaoProducaoRecurso[]> {
  const r = await apiJson<{ data: ProgramacaoProducaoRecurso[] }>('/api/programacao-producao/recursos');
  return r.data ?? [];
}

export async function createProgramacaoProducaoRecurso(nome: string): Promise<ProgramacaoProducaoRecurso> {
  const res = await apiFetch('/api/programacao-producao/recursos', { method: 'POST', body: { nome } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Erro ao criar recurso.');
  }
  const r = (await res.json()) as { data: ProgramacaoProducaoRecurso };
  return r.data;
}

export async function updateProgramacaoProducaoRecurso(
  cod: string,
  nome: string
): Promise<ProgramacaoProducaoRecurso> {
  const res = await apiFetch(`/api/programacao-producao/recursos/${encodeURIComponent(cod)}`, {
    method: 'PUT',
    body: { nome },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Erro ao atualizar recurso.');
  }
  const r = (await res.json()) as { data: ProgramacaoProducaoRecurso };
  return r.data;
}

export async function deleteProgramacaoProducaoRecurso(cod: string): Promise<void> {
  const res = await apiFetch(`/api/programacao-producao/recursos/${encodeURIComponent(cod)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Erro ao excluir recurso.');
  }
}

export async function saveCatalogoDescricaoProgramacao(
  codComponente: string,
  descricao: string | null
): Promise<Record<string, string>> {
  const res = await apiFetch('/api/programacao-producao/catalogo/descricao', {
    method: 'PUT',
    body: { codComponente, descricao },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Erro ao gravar descrição no catálogo.');
  }
  const r = (await res.json()) as { data: { descricoes: Record<string, string> } };
  return r.data.descricoes;
}

export async function saveCatalogoBobinasProgramacao(
  codComponente: string,
  entry: { codigo_mp?: string; alternativas: string[] }
): Promise<Record<string, { codigo_mp?: string; alternativas: string[] }>> {
  const res = await apiFetch('/api/programacao-producao/catalogo/bobinas', {
    method: 'PUT',
    body: { codComponente, ...entry },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Erro ao gravar bobinas no catálogo.');
  }
  const r = (await res.json()) as {
    data: { bobinas: Record<string, { codigo_mp?: string; alternativas: string[] }> };
  };
  return r.data.bobinas;
}

export async function fetchProgramacaoProducaoGrade(): Promise<{
  data: ProgramacaoProducaoGradeRowApi[];
  erro?: string;
}> {
  const r = await apiJson<{ data: ProgramacaoProducaoGradeRowApi[]; erro?: string }>(
    '/api/programacao-producao/grade'
  );
  return { data: r.data ?? [], erro: r.erro };
}

export type BobinaProgramacaoBusca = {
  id: number;
  codigo: string;
  descricao: string | null;
};

export async function fetchBobinasProgramacaoBusca(params?: {
  q?: string;
  limit?: number;
}): Promise<{ data: BobinaProgramacaoBusca[]; erro?: string }> {
  const sp = new URLSearchParams();
  if (params?.q?.trim()) sp.set('q', params.q.trim());
  if (params?.limit != null) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  const r = await apiJson<{ data: BobinaProgramacaoBusca[]; erro?: string }>(
    `/api/programacao-producao/bobinas-busca${qs ? `?${qs}` : ''}`
  );
  return { data: r.data ?? [], erro: r.erro };
}

export async function fetchBobinasProgramacaoPorCodigos(
  codigos: string[]
): Promise<{ data: BobinaProgramacaoBusca[]; erro?: string }> {
  const uniq = [...new Set(codigos.map((c) => c.trim()).filter(Boolean))];
  if (!uniq.length) return { data: [] };
  const sp = new URLSearchParams({ codigos: uniq.join(',') });
  const r = await apiJson<{ data: BobinaProgramacaoBusca[]; erro?: string }>(
    `/api/programacao-producao/bobinas-por-codigos?${sp}`
  );
  return { data: r.data ?? [], erro: r.erro };
}

export async function fetchOrdensNomusPorComponente(idComponente: number): Promise<{
  data: OrdemNomusOpcao[];
  erro?: string;
}> {
  const sp = new URLSearchParams({
    idComponente: String(idComponente),
    _t: String(Date.now()),
  });
  const r = await apiJson<{ data: OrdemNomusOpcao[]; erro?: string }>(
    `/api/programacao-producao/ordens-nomus?${sp}`,
    { cache: 'no-store' }
  );
  return { data: r.data ?? [], erro: r.erro };
}

export async function fetchEstoqueBobinaSetores(idBobina: number): Promise<{
  setores: EstoqueSetorDetalhe[];
  erro?: string;
}> {
  const r = await apiJson<{ setores: EstoqueSetorDetalhe[]; erro?: string }>(
    `/api/programacao-producao/estoque-bobina/${idBobina}`
  );
  return { setores: r.setores ?? [], erro: r.erro };
}

export async function fetchEstoqueComponenteDetalhe(idComponente: number): Promise<{
  setores: EstoqueSetorDetalhe[];
  explosaoPa: ExplosaoPaDetalhe[];
  erro?: string;
}> {
  const r = await apiJson<{
    setores: EstoqueSetorDetalhe[];
    explosaoPa: ExplosaoPaDetalhe[];
    erro?: string;
  }>(`/api/programacao-producao/estoque-componente/${idComponente}`);
  return {
    setores: r.setores ?? [],
    explosaoPa: r.explosaoPa ?? [],
    erro: r.erro,
  };
}

export async function createProgramacaoProducao(payload: {
  name: string;
  description?: string;
  dados?: DadosProgramacaoProducaoV1;
}): Promise<ProgramacaoProducaoSalva> {
  const res = await apiFetch('/api/programacao-producao', { method: 'POST', body: payload });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Erro ao salvar programação.');
  }
  const r = (await res.json()) as { data: ProgramacaoProducaoSalva };
  return r.data;
}

export async function updateProgramacaoProducao(
  id: string,
  payload: {
    name: string;
    description?: string;
    dados?: DadosProgramacaoProducaoV1;
  }
): Promise<ProgramacaoProducaoSalva> {
  const res = await apiFetch(`/api/programacao-producao/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: payload,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Erro ao salvar programação.');
  }
  const r = (await res.json()) as { data: ProgramacaoProducaoSalva };
  return r.data;
}

export async function processarProgramacaoProducao(id: string): Promise<void> {
  const res = await apiFetch(`/api/programacao-producao/${encodeURIComponent(id)}/processar`, {
    method: 'PATCH',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Erro ao processar programação.');
  }
}

export async function concluirProgramacaoProducao(id: string): Promise<void> {
  const res = await apiFetch(`/api/programacao-producao/${encodeURIComponent(id)}/concluir`, {
    method: 'PATCH',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Erro ao concluir programação.');
  }
}

export async function deleteProgramacaoProducao(id: string): Promise<void> {
  const res = await apiFetch(`/api/programacao-producao/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Erro ao excluir programação.');
  }
}

export async function duplicateProgramacaoProducao(
  sourceId: string,
  name?: string
): Promise<ProgramacaoProducaoSalva> {
  const orig = await getProgramacaoProducao(sourceId);
  const base = orig.name.trim() || 'Programação';
  return createProgramacaoProducao({
    dados: orig.dados,
  });
}
