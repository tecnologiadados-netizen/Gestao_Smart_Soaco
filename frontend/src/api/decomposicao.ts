import { apiFetch, apiJson } from './client';

export type SetorProducao = {
  id: number;
  nome: string;
};

export function nomeGrupo(grupo: string): string {
  if (grupo === 'gondolas') return 'GÔNDOLAS';
  if (grupo === 'porta_pallets') return 'PORTA-PALLETS';
  return grupo;
}

export type DecomposicaoPaiGrade = {
  id: number;
  grupo: string;
  codigo: string;
  nome: string;
  observacao: string | null;
  qtdFilhos: number;
  qtdePedida: number | null;
  pendente: number | null;
  sugestao: number | null;
};

export type DecomposicaoFilhoDetalhe = {
  id: number;
  codigoNomus: string;
  descricao: string;
  quantidade: number;
  qtdePedida: number | null;
  pendente: number | null;
  paisImplicados: number | null;
};

export type DecomposicaoDetalhe = {
  id: number;
  grupo: string;
  codigo: string;
  nome: string;
  observacao: string | null;
  qtdePedida: number | null;
  pendente: number | null;
  sugestao: number | null;
  filhos: DecomposicaoFilhoDetalhe[];
};

export type DecomposicaoFilhoCadastro = {
  codigoNomus: string;
  descricao: string;
  quantidade: number;
  materiaPrimaCodigo?: string | null;
  materiaPrimaDescricao?: string | null;
};

export type MateriaPrimaPp = {
  codigoFilho: string;
  codigo: string;
  descricao: string;
};

export type DecomposicaoPaiCadastro = {
  id: number;
  grupo: string;
  codigo: string;
  nome: string;
  observacao: string | null;
  filhos: DecomposicaoFilhoCadastro[];
};

export type ProdutoNomusOpcao = {
  codigo: string;
  descricao: string;
};

async function lerErro(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({ error: res.statusText }));
  throw new Error((err as { error?: string }).error ?? fallback);
}

export async function listarSetoresProducao(): Promise<SetorProducao[]> {
  const data = await apiJson<{ setores: SetorProducao[] }>('/api/pcp/decomposicao/setores');
  return data.setores ?? [];
}

export async function criarSetorProducao(nome: string): Promise<SetorProducao> {
  const res = await apiFetch('/api/pcp/decomposicao/setores', { method: 'POST', body: { nome } });
  if (!res.ok) await lerErro(res, 'Não foi possível cadastrar o setor.');
  const data = (await res.json()) as { setor: SetorProducao };
  return data.setor;
}

export async function excluirSetorProducao(id: number): Promise<void> {
  const res = await apiFetch(`/api/pcp/decomposicao/setores/${id}`, { method: 'DELETE' });
  if (!res.ok) await lerErro(res, 'Não foi possível excluir o setor.');
}

export async function listarDecomposicao(): Promise<{
  carteiraDisponivel: boolean;
  carteiraErro?: string;
  pais: DecomposicaoPaiGrade[];
}> {
  return apiJson('/api/pcp/decomposicao');
}

export async function detalharDecomposicao(id: number): Promise<{
  carteiraDisponivel: boolean;
  carteiraErro?: string;
  pai: DecomposicaoDetalhe;
}> {
  return apiJson(`/api/pcp/decomposicao/${id}/detalhe`);
}

export type DecomposicaoCadastroResumo = {
  id: number;
  grupo: string;
  codigo: string;
  nome: string;
  observacao: string | null;
  filhos: DecomposicaoFilhoCadastro[];
};

export async function listarCadastrosDecomposicao(): Promise<DecomposicaoCadastroResumo[]> {
  const data = await apiJson<{ pais: DecomposicaoCadastroResumo[] }>('/api/pcp/decomposicao/cadastros');
  return data.pais ?? [];
}

export async function obterDecomposicaoPai(id: number): Promise<DecomposicaoPaiCadastro> {
  const data = await apiJson<{ pai: DecomposicaoPaiCadastro & { filhos: DecomposicaoFilhoCadastro[] } }>(
    `/api/pcp/decomposicao/${id}`
  );
  return data.pai;
}

export async function buscarMateriasPrimasPp(codigos: string[]): Promise<MateriaPrimaPp[]> {
  const params = new URLSearchParams();
  for (const codigo of codigos) {
    const limpo = codigo.trim();
    if (limpo) params.append('codigo', limpo);
  }
  if (!params.has('codigo')) return [];
  const res = await apiFetch(`/api/pcp/decomposicao/materias-primas-pp?${params.toString()}`);
  if (!res.ok) await lerErro(res, 'Não foi possível ler a lista de materiais dos filhos.');
  const data = (await res.json()) as { materiais: MateriaPrimaPp[] };
  return data.materiais ?? [];
}

export async function buscarProdutosNomusDecomposicao(q: string): Promise<ProdutoNomusOpcao[]> {
  const params = new URLSearchParams({ q });
  const res = await apiFetch(`/api/pcp/decomposicao/produtos-nomus?${params.toString()}`);
  if (!res.ok) await lerErro(res, 'Não foi possível buscar produtos no NOMUS.');
  const data = (await res.json()) as { produtos: ProdutoNomusOpcao[] };
  return data.produtos ?? [];
}

export async function salvarDecomposicaoPai(
  id: number | null,
  body: {
    grupo: string;
    codigo: string;
    nome: string;
    observacao: string;
    filhos: DecomposicaoFilhoCadastro[];
  }
): Promise<void> {
  const res = await apiFetch(id == null ? '/api/pcp/decomposicao' : `/api/pcp/decomposicao/${id}`, {
    method: id == null ? 'POST' : 'PUT',
    body,
  });
  if (!res.ok) await lerErro(res, 'Não foi possível gravar o produto pai.');
}

export type OrdemProducaoItem = {
  id: number;
  codigoNomus: string;
  descricao: string;
  quantidadeNoPai: number;
  quantidadeTotal: number;
  materiaPrimaCodigo: string | null;
  materiaPrimaDescricao: string | null;
  qtdePedida: number | null;
};

export type OrdemProducao = {
  id: number;
  numero: string;
  paiId: number | null;
  grupo: string;
  codigoPai: string;
  nomePai: string;
  quantidade: number;
  observacao: string | null;
  criadoPorLogin: string | null;
  createdAt: string;
  itens: OrdemProducaoItem[];
};

export async function listarOrdensProducao(): Promise<OrdemProducao[]> {
  const data = await apiJson<{ ordens: OrdemProducao[] }>('/api/pcp/decomposicao/ordens');
  return data.ordens ?? [];
}

export async function emitirOrdemProducao(body: {
  paiId: number;
  quantidade: number;
  observacao: string;
}): Promise<OrdemProducao> {
  const res = await apiFetch('/api/pcp/decomposicao/ordens', { method: 'POST', body });
  if (!res.ok) await lerErro(res, 'Não foi possível gerar a ordem.');
  const data = (await res.json()) as { ordem: OrdemProducao };
  return data.ordem;
}

export async function excluirDecomposicaoPai(id: number): Promise<void> {
  const res = await apiFetch(`/api/pcp/decomposicao/${id}`, { method: 'DELETE' });
  if (!res.ok) await lerErro(res, 'Não foi possível excluir o produto pai.');
}
