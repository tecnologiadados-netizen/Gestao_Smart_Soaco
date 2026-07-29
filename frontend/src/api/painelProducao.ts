import { apiFetch } from './client';

export interface PainelProducaoFilters {
  setores: string[];
  meses: string[];
  default_setor?: string;
  default_mes?: string;
  nomus_enabled?: boolean;
}

export interface PainelProducaoRankingItem {
  ranking: number;
  setor: string;
  producao: number;
  percentual_meta: number;
}

export interface PainelProducaoPedidoDetalheItem {
  codigo: string;
  descricao: string;
}

export interface PainelProducaoPedidoDetalhe {
  codigo_pedido: string;
  cliente: string;
  itens: PainelProducaoPedidoDetalheItem[];
}

export interface PainelProducaoDashboard {
  titulo?: string;
  mes_label?: string;
  setor: string;
  mes: string;
  producao: number;
  meta: number;
  sem_meta?: boolean;
  percentual_meta: number;
  cor_target?: string;
  unidade?: string;
  pedidos_detalhe?: PainelProducaoPedidoDetalhe[];
  ranking: PainelProducaoRankingItem[];
  por_mes: Array<{ label: string; valor?: number; producao?: number; meta?: number | null }>;
  por_dia: Array<{ label: string; valor?: number; producao?: number }>;
}

export interface PainelProducaoTargetRow {
  id?: number;
  setor: string;
  mes_ano: string;
  target: number;
  sem_meta?: boolean;
  meta_bronze?: number | null;
  meta_prata?: number | null;
  meta_aco?: number | null;
  valor_bronze?: number | null;
  valor_prata?: number | null;
  valor_aco?: number | null;
}

export interface PainelProducaoApuracaoRow {
  setor: string;
  mes: string;
  pedidos_encerrados: number;
  pedidos_com_alteracao_nao_abonada: number;
  alteracoes_nao_abonadas: number;
  media_alteracoes_por_pedido: number;
  meta_quantitativa: number;
  producao_realizada: number;
  unidade: string;
  percentual_meta_quantitativa: number;
  percentual_penalizacao_qualitativa: number;
  meta_atingida: string;
  meta_nivel_atingido: number | null;
  valor_nivel: number;
  valor_a_pagar: number;
  niveis: Array<{ nivel: string; meta: number | null; valor: number | null; atingido: boolean }>;
  motivo_nao_abonado: string;
}

export type PainelProducaoApuracaoDetalheTipo =
  | 'pedidos_encerrados'
  | 'pedidos_com_alteracao'
  | 'alteracoes';

export interface PainelProducaoApuracaoDetalheLinha {
  pedido: string;
  cliente: string;
  codigo_produto: string;
  descricao: string;
  status?: string;
  data_encerramento?: string | null;
  data_alteracao?: string | null;
  motivo?: string;
  usuario?: string;
}

export interface PainelProducaoApuracaoDetalhe {
  mes: string;
  setor: string;
  tipo: PainelProducaoApuracaoDetalheTipo;
  titulo: string;
  total: number;
  linhas: PainelProducaoApuracaoDetalheLinha[];
}

async function parseJson<T>(res: Response): Promise<T> {
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
      throw new Error(
        'O servidor retornou HTML em vez de JSON. Reinicie o backend (npm run dev:start) para carregar as rotas do Painel Metas.',
      );
    }
    throw new Error(text.slice(0, 200) || `Resposta inválida (${res.status})`);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = (body as { error?: string; detail?: string }).error
      ?? (body as { detail?: string }).detail
      ?? `Erro ${res.status}`;
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export async function fetchPainelProducaoFilters(): Promise<PainelProducaoFilters> {
  const res = await apiFetch('/api/painel-producao/filters');
  return parseJson(res);
}

export async function fetchPainelProducaoDashboard(
  setor: string,
  mes: string,
): Promise<PainelProducaoDashboard> {
  const params = new URLSearchParams({ setor, mes });
  const res = await apiFetch(`/api/painel-producao/dashboard?${params}`);
  return parseJson(res);
}

export async function fetchPainelProducaoTargets(mes: string): Promise<PainelProducaoTargetRow[]> {
  const res = await apiFetch(`/api/painel-producao/targets?mes=${encodeURIComponent(mes)}`);
  return parseJson(res);
}

export async function fetchPainelProducaoApuracao(
  mes: string,
): Promise<PainelProducaoApuracaoRow[]> {
  const res = await apiFetch(`/api/painel-producao/apuracao?mes=${encodeURIComponent(mes)}`);
  return parseJson(res);
}

export async function fetchPainelProducaoApuracaoDetalhe(
  mes: string,
  tipo: PainelProducaoApuracaoDetalheTipo,
): Promise<PainelProducaoApuracaoDetalhe> {
  const params = new URLSearchParams({ mes, tipo });
  const res = await apiFetch(`/api/painel-producao/apuracao/detalhe?${params}`);
  return parseJson(res);
}

export async function savePainelProducaoTarget(payload: {
  setor: string;
  mes_ano: string;
  target: number;
  sem_meta: boolean;
  meta_bronze?: number | null;
  meta_prata?: number | null;
  meta_aco?: number | null;
  valor_bronze?: number | null;
  valor_prata?: number | null;
  valor_aco?: number | null;
}): Promise<PainelProducaoTargetRow> {
  const res = await apiFetch('/api/painel-producao/targets', {
    method: 'POST',
    body: payload,
  });
  return parseJson(res);
}

export async function insertPainelProducaoMes(): Promise<{ mes: string; meses: string[] }> {
  const res = await apiFetch('/api/painel-producao/meses', { method: 'POST' });
  return parseJson(res);
}
