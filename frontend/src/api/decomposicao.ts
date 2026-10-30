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
  qtdPecas: number;
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

export type DecomposicaoPecaCadastro = {
  descricao: string;
  quantidade: number;
  medidaL: string;
  medidaA: string;
  materiaPrima: string;
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
  pecas: DecomposicaoPecaCadastro[];
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
  pecas: DecomposicaoPecaCadastro[];
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
    pecas: DecomposicaoPecaCadastro[];
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
  pecas: OrdemProducaoPeca[];
};

export type OrdemProducaoPeca = {
  id: number;
  descricao: string;
  quantidadeNoPai: number;
  quantidadeTotal: number;
  medidaL: string;
  medidaA: string;
  materiaPrima: string;
  medidaCorte?: string;
  observacao?: string;
  /** Quando false, a peça não entra no PDF. Ausente ou true: imprime. */
  imprimir?: boolean;
};

export type AnotacaoPecaOrdem = {
  medidaCorte: string;
  observacao: string;
  imprimir: boolean;
};

export async function listarOrdensProducao(): Promise<OrdemProducao[]> {
  const data = await apiJson<{ ordens: OrdemProducao[] }>('/api/pcp/decomposicao/ordens');
  return data.ordens ?? [];
}

export type AlocacaoPedido = {
  idItem: number;
  idPedido: number;
  numeroPedido: string;
  cliente: string;
  codigoFilho: string;
  descricaoFilho: string;
  statusItem: number;
  statusNome: string;
  qtdePedida: number;
  saldo: number;
  apareceNaProxima?: boolean;
};

export async function preverAlocacoesPai(paiId: number): Promise<{ alocacoes: AlocacaoPedido[]; saldo: number }> {
  const res = await apiFetch(`/api/pcp/decomposicao/${paiId}/alocacoes-previa`);
  if (!res.ok) await lerErro(res, 'Não foi possível ler os pedidos dos filhos.');
  const data = (await res.json()) as { alocacoes: AlocacaoPedido[]; saldo: number };
  return { alocacoes: data.alocacoes ?? [], saldo: Number(data.saldo) || 0 };
}

export async function listarAlocacoesOrdem(ordemId: number): Promise<{ alocacoes: AlocacaoPedido[]; saldo: number }> {
  const res = await apiFetch(`/api/pcp/decomposicao/ordens/${ordemId}/alocacoes`);
  if (!res.ok) await lerErro(res, 'Não foi possível ler os pedidos dos filhos.');
  const data = (await res.json()) as { alocacoes: AlocacaoPedido[]; saldo: number };
  return { alocacoes: data.alocacoes ?? [], saldo: Number(data.saldo) || 0 };
}

export async function marcarAlocacaoNaProximaOrdem(
  ordemId: number,
  idItem: number,
  apareceNaProxima: boolean
): Promise<void> {
  const res = await apiFetch(`/api/pcp/decomposicao/ordens/${ordemId}/alocacoes/${idItem}`, {
    method: 'PUT',
    body: { apareceNaProxima },
  });
  if (!res.ok) await lerErro(res, 'Não foi possível gravar a opção da próxima ordem.');
}

export async function atualizarQuantidadeOrdem(ordemId: number, quantidade: number): Promise<OrdemProducao> {
  const res = await apiFetch(`/api/pcp/decomposicao/ordens/${ordemId}`, {
    method: 'PUT',
    body: { quantidade },
  });
  if (!res.ok) await lerErro(res, 'Não foi possível gravar a quantidade a produzir.');
  const data = (await res.json()) as { ordem: OrdemProducao };
  return data.ordem;
}

export async function emitirOrdemProducao(body: {
  paiId: number;
  quantidade: number;
  observacao: string;
  numero?: string;
  pecas?: AnotacaoPecaOrdem[];
  alocacoes?: AlocacaoPedido[];
}): Promise<OrdemProducao> {
  const res = await apiFetch('/api/pcp/decomposicao/ordens', { method: 'POST', body });
  if (!res.ok) await lerErro(res, 'Não foi possível gerar a ordem.');
  const data = (await res.json()) as { ordem: OrdemProducao };
  return data.ordem;
}

export async function excluirOrdemProducao(id: number): Promise<void> {
  const res = await apiFetch(`/api/pcp/decomposicao/ordens/${id}`, { method: 'DELETE' });
  if (!res.ok) await lerErro(res, 'Não foi possível excluir a ordem.');
}

export async function excluirDecomposicaoPai(id: number): Promise<void> {
  const res = await apiFetch(`/api/pcp/decomposicao/${id}`, { method: 'DELETE' });
  if (!res.ok) await lerErro(res, 'Não foi possível excluir o produto pai.');
}
