import { apiFetch, apiJson } from './client';

export type Veiculo = {
  id: number;
  placa: string;
  modelo: string | null;
  alturaMm: number | null;
  larguraMm: number | null;
  profundidadeMm: number | null;
  capacidadePesoKg: number | null;
  taraKg: number | null;
  pbtKg: number | null;
  alturaEmpilhamentoMm: number | null;
  aberturas: string | null;
  fatorAproveitamento: number;
  ano: number | null;
  motoristaPadrao: string | null;
  ativo: boolean;
  status: 'dimensionado' | 'pendente';
  createdAt: string;
  updatedAt: string;
};

export type VolumeCubagem = {
  id?: number;
  ordem: number;
  descricao: string | null;
  alturaMm: number | null;
  larguraMm: number | null;
  profundidadeMm: number | null;
  pesoKg: number | null;
};

export type CubagemProduto = {
  id: number;
  idProduto: number;
  codigoProduto: string;
  descricaoProduto: string;
  pesoKg: number | null;
  alturaMm: number | null;
  larguraMm: number | null;
  profundidadeMm: number | null;
  numVolumes: number;
  empilhavel: boolean;
  pesoMaxTopoKg: number | null;
  podeDeitar: boolean;
  podeVirar: boolean;
  esteLadoParaCima: boolean;
  fragilNaoSobrepor: boolean;
  status: 'dimensionado' | 'pendente';
  volumes: VolumeCubagem[];
};

export type ProdutoCubagemListItem = {
  idProduto: number;
  codigoProduto: string;
  descricaoProduto: string;
  idTipoProduto: number;
  tipoProduto: string;
  status: 'dimensionado' | 'pendente';
  cubagem: Omit<CubagemProduto, 'idProduto' | 'codigoProduto' | 'descricaoProduto' | 'status'> | null;
};

export type VeiculoInput = {
  placa: string;
  modelo?: string | null;
  alturaMm?: number | null;
  larguraMm?: number | null;
  profundidadeMm?: number | null;
  capacidadePesoKg?: number | null;
  taraKg?: number | null;
  pbtKg?: number | null;
  alturaEmpilhamentoMm?: number | null;
  aberturas?: string | null;
  fatorAproveitamento?: number;
  ano?: number | null;
  motoristaPadrao?: string | null;
  ativo?: boolean;
};

export type ProdutoCubagemInput = {
  pesoKg?: number | null;
  alturaMm?: number | null;
  larguraMm?: number | null;
  profundidadeMm?: number | null;
  numVolumes?: number;
  empilhavel?: boolean;
  pesoMaxTopoKg?: number | null;
  podeDeitar?: boolean;
  podeVirar?: boolean;
  esteLadoParaCima?: boolean;
  fragilNaoSobrepor?: boolean;
  volumes?: VolumeCubagem[];
};

async function handleError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({}));
  throw new Error((err as { error?: string }).error ?? fallback);
}

export async function listarVeiculos(apenasAtivos = false): Promise<Veiculo[]> {
  const qs = apenasAtivos ? '?apenasAtivos=true' : '';
  const r = await apiJson<{ data: Veiculo[] }>(`/api/logistica/cubagem/veiculos${qs}`);
  return r.data ?? [];
}

export async function criarVeiculo(body: VeiculoInput): Promise<Veiculo> {
  const res = await apiFetch('/api/logistica/cubagem/veiculos', { method: 'POST', body: body as unknown });
  if (!res.ok) await handleError(res, 'Erro ao criar veículo.');
  const r = (await res.json()) as { data: Veiculo };
  return r.data;
}

export async function atualizarVeiculo(id: number, body: VeiculoInput): Promise<Veiculo> {
  const res = await apiFetch(`/api/logistica/cubagem/veiculos/${id}`, { method: 'PUT', body: body as unknown });
  if (!res.ok) await handleError(res, 'Erro ao atualizar veículo.');
  const r = (await res.json()) as { data: Veiculo };
  return r.data;
}

export async function excluirVeiculo(id: number): Promise<void> {
  const res = await apiFetch(`/api/logistica/cubagem/veiculos/${id}`, { method: 'DELETE' });
  if (!res.ok) await handleError(res, 'Erro ao excluir veículo.');
}

export type FiltrosProdutosCubagem = {
  busca?: string;
  tipo?: 'acabado' | 'intermediario' | 'todos';
  status?: 'dimensionado' | 'pendente' | 'todos';
};

export async function listarProdutosCubagem(
  filtros: FiltrosProdutosCubagem = {}
): Promise<ProdutoCubagemListItem[]> {
  const params = new URLSearchParams();
  if (filtros.busca) params.set('busca', filtros.busca);
  if (filtros.tipo && filtros.tipo !== 'todos') params.set('tipo', filtros.tipo);
  if (filtros.status && filtros.status !== 'todos') params.set('status', filtros.status);
  const qs = params.toString();
  const res = await apiFetch(`/api/logistica/cubagem/produtos${qs ? `?${qs}` : ''}`);
  if (!res.ok) await handleError(res, 'Erro ao listar produtos.');
  const r = (await res.json()) as { data: ProdutoCubagemListItem[] };
  return r.data ?? [];
}

export async function obterProdutoCubagem(idProduto: number): Promise<ProdutoCubagemListItem> {
  const res = await apiFetch(`/api/logistica/cubagem/produtos/${idProduto}`);
  if (!res.ok) await handleError(res, 'Erro ao obter produto.');
  const r = (await res.json()) as { data: ProdutoCubagemListItem };
  return r.data;
}

export async function salvarProdutoCubagem(
  idProduto: number,
  body: ProdutoCubagemInput
): Promise<CubagemProduto> {
  const res = await apiFetch(`/api/logistica/cubagem/produtos/${idProduto}`, { method: 'PUT', body: body as unknown });
  if (!res.ok) await handleError(res, 'Erro ao salvar cubagem do produto.');
  const r = (await res.json()) as { data: CubagemProduto };
  return r.data;
}

export async function excluirProdutoCubagem(idProduto: number): Promise<void> {
  const res = await apiFetch(`/api/logistica/cubagem/produtos/${idProduto}`, { method: 'DELETE' });
  if (!res.ok) await handleError(res, 'Erro ao excluir cubagem do produto.');
}

// --- Simulação de cubagem ---

export type ItemPedidoCubagem = {
  idChave: string;
  pd: string;
  codigo: string;
  descricao: string;
  idProduto: number;
  qtdePendenteReal: number;
  valorPendenteReal: number;
  valorUnitario: number;
  statusCubagem: 'dimensionado' | 'pendente';
  cubagem: Omit<CubagemProduto, 'id' | 'idProduto' | 'codigoProduto' | 'descricaoProduto' | 'status'> | null;
};

export type ItemSimulacaoPayload = {
  idProduto: number;
  quantidade: number;
  idChave?: string;
  pd?: string;
  sequencia?: number;
  valorUnitario?: number;
};

export type RetanguloLayout2D = {
  id: string;
  codigoProduto: string;
  x: number;
  y: number;
  w: number;
  h: number;
  overflow: boolean;
  cor: string;
};

export type Layout2D = {
  superior: RetanguloLayout2D[];
  lateral: RetanguloLayout2D[];
};

export type IndicadoresSimulacao = {
  volumeTotalMm3: number;
  capacidadeVolumeMm3: number;
  pctVolume: number;
  pesoTotalKg: number | null;
  capacidadePesoKg: number | null;
  pctPeso: number | null;
  numVolumes: number;
  numItens: number;
  valorTotal: number;
  limitante: 'volume' | 'peso' | null;
  pesoDisponivel: boolean;
  aproveitamentoAbaixoAlvo: boolean;
};

export type ResultadoSimulacaoCubagem = {
  veiculo: Veiculo;
  indicadores: IndicadoresSimulacao;
  excessos: { volume: boolean; peso: boolean };
  avisos: Array<{ tipo: string; mensagem: string }>;
  layout2D: Layout2D;
};

export async function buscarItensPedidoCubagem(pd: string): Promise<ItemPedidoCubagem[]> {
  const encoded = encodeURIComponent(pd.trim());
  const res = await apiFetch(`/api/logistica/cubagem/pedidos/${encoded}/itens`);
  if (!res.ok) await handleError(res, 'Erro ao buscar itens do pedido.');
  const r = (await res.json()) as { data: ItemPedidoCubagem[] };
  return r.data ?? [];
}

export async function calcularSimulacaoCubagem(payload: {
  veiculoId: number;
  itens: ItemSimulacaoPayload[];
}): Promise<ResultadoSimulacaoCubagem> {
  const res = await apiFetch('/api/logistica/cubagem/simulacao/calcular', {
    method: 'POST',
    body: payload as unknown,
  });
  if (!res.ok) await handleError(res, 'Erro ao calcular simulação.');
  const r = (await res.json()) as { data: ResultadoSimulacaoCubagem };
  return r.data;
}
