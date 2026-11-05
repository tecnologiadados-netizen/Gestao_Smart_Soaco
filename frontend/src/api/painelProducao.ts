import { apiFetch, resolveUploadUrl } from './client';

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
  meta_bronze?: number | null;
  meta_prata?: number | null;
  meta_aco?: number | null;
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
  considerar_penalizacoes?: boolean;
}

export interface PainelProducaoFaixaDesconto {
  id?: number;
  media_min: number;
  media_max: number | null;
  percentual_desconto: number;
  ordem: number;
}

export type PainelProducaoApuracaoArea = 'montagem' | 'producao';

export interface PainelProducaoApuracaoRow {
  area: PainelProducaoApuracaoArea;
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
  cadastro_niveis_completo: boolean;
  setores_atingiram_meta?: number;
  distribuicao_niveis?: { Bronze: number; Prata: number; Aço: number };
  valor_bruto?: number;
  parcelas_penalizadas?: number;
  elegivel_minimo_setores?: boolean;
  considerar_penalizacoes?: boolean;
  /** Montagem: responsável do Cadastro de Metas; produção: colaboradores vinculados na apuração. */
  responsaveis?: PainelProducaoResponsavel[];
  /** Mês (YYYY-MM) em que a definição vigente foi gravada; null = nunca definido. */
  responsaveis_definidos_em?: string | null;
}

export type PainelProducaoResponsavelArea = 'montagem' | 'producao';

export interface PainelProducaoResponsavel {
  organico_id: string;
  nome: string;
  cargo: string;
}

export interface PainelProducaoResponsaveisSetor {
  area: PainelProducaoResponsavelArea;
  setor: string;
  responsaveis: PainelProducaoResponsavel[];
  definido_em: string | null;
}

export interface PainelProducaoColaboradorOrganico {
  id: string;
  nome: string;
  cargo: string;
  setor: string;
  matricula: string;
  tem_foto: boolean;
}

/** Foto do colaborador do orgânico (imagem servida pelo painel; 404 = sem foto). */
export function urlFotoColaboradorOrganico(organicoId: string): string {
  return resolveUploadUrl(`/api/painel-producao/organico-foto/${encodeURIComponent(organicoId)}`);
}

export type PainelProducaoApuracaoDetalheTipo =
  | 'pedidos_encerrados'
  | 'pedidos_com_alteracao'
  | 'alteracoes'
  | 'alteracoes_ruptura'
  | 'memorial_producao'
  | 'producao_realizada';

export interface PainelProducaoApuracaoDetalheLinha {
  pedido: string;
  cliente: string;
  codigo_produto: string;
  descricao: string;
  quantidade?: number | null;
  status?: string;
  data_encerramento?: string | null;
  data_alteracao?: string | null;
  motivo?: string;
  usuario?: string;
  anexo_assinatura_path?: string | null;
  anexo_assinatura_nome?: string | null;
  data_movimento?: string | null;
  movimento?: string;
}

export interface PainelProducaoApuracaoParcelaProducao {
  setor_montagem: string;
  nivel: string | null;
  valor_base: number;
  pedidos_com_ruptura: number;
  alteracoes_ruptura: number;
  media_ruptura: number;
  percentual_herdado: number;
  impacto_producao: boolean;
  desconto: number;
  parcela_final: number;
}

export interface PainelProducaoApuracaoDetalhe {
  mes: string;
  setor: string;
  tipo: PainelProducaoApuracaoDetalheTipo;
  /** "movimentos_producao": lançamentos de produção do Realizado em "un"; total em unidades. */
  formato?: 'movimentos_producao';
  unidade?: string;
  titulo: string;
  total: number;
  linhas: PainelProducaoApuracaoDetalheLinha[];
  parcelas?: PainelProducaoApuracaoParcelaProducao[];
  valor_bruto?: number;
  valor_a_pagar?: number;
  elegivel_minimo_setores?: boolean;
  min_setores?: number;
  setores_atingiram_meta?: number;
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

export interface PainelProducaoAlcancadoSetor {
  setor: string;
  producao: number;
  unidade: string;
}

export async function fetchPainelProducaoAlcancado(
  mes: string,
): Promise<PainelProducaoAlcancadoSetor[]> {
  const res = await apiFetch(
    `/api/painel-producao/targets/alcancado?mes=${encodeURIComponent(mes)}`,
  );
  return parseJson(res);
}

export async function fetchPainelProducaoFaixasDesconto(
  mes: string,
): Promise<PainelProducaoFaixaDesconto[]> {
  const res = await apiFetch(
    `/api/painel-producao/faixas-desconto?mes=${encodeURIComponent(mes)}`,
  );
  return parseJson(res);
}

export async function fetchPainelProducaoApuracao(
  mes: string,
  opts?: { refresh?: boolean },
): Promise<PainelProducaoApuracaoRow[]> {
  const params = new URLSearchParams({ mes });
  if (opts?.refresh) params.set('refresh', '1');
  const res = await apiFetch(`/api/painel-producao/apuracao?${params}`);
  return parseJson(res);
}

export async function fetchPainelProducaoApuracaoDetalhe(
  mes: string,
  tipo: PainelProducaoApuracaoDetalheTipo,
  setor: string,
): Promise<PainelProducaoApuracaoDetalhe> {
  const params = new URLSearchParams({ mes, tipo, setor });
  const res = await apiFetch(`/api/painel-producao/apuracao/detalhe?${params}`);
  return parseJson(res);
}

export async function fetchPainelProducaoResponsaveis(
  mes: string,
): Promise<PainelProducaoResponsaveisSetor[]> {
  const res = await apiFetch(`/api/painel-producao/responsaveis?mes=${encodeURIComponent(mes)}`);
  return parseJson(res);
}

export async function savePainelProducaoResponsaveis(payload: {
  mes: string;
  area: PainelProducaoResponsavelArea;
  setor: string;
  organico_ids: string[];
}): Promise<PainelProducaoResponsaveisSetor> {
  const res = await apiFetch('/api/painel-producao/responsaveis', {
    method: 'PUT',
    body: payload,
  });
  return parseJson(res);
}

let colaboradoresOrganicoCache: Promise<PainelProducaoColaboradorOrganico[]> | null = null;

/** Colaboradores ativos do orgânico (cache da sessão; recarrega após falha). */
export function fetchPainelProducaoColaboradoresOrganico(): Promise<
  PainelProducaoColaboradorOrganico[]
> {
  if (!colaboradoresOrganicoCache) {
    colaboradoresOrganicoCache = apiFetch('/api/painel-producao/organico-colaboradores')
      .then((res) => parseJson<{ colaboradores: PainelProducaoColaboradorOrganico[] }>(res))
      .then((data) => data.colaboradores ?? [])
      .catch((err: unknown) => {
        colaboradoresOrganicoCache = null;
        throw err;
      });
  }
  return colaboradoresOrganicoCache;
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

export async function savePainelProducaoSetorPenalizacao(payload: {
  mes: string;
  setor: string;
  considerar_penalizacoes: boolean;
}): Promise<{ mes: string; setor: string; considerar_penalizacoes: boolean }> {
  const res = await apiFetch('/api/painel-producao/setor-penalizacao', {
    method: 'PUT',
    body: payload,
  });
  return parseJson(res);
}

export async function savePainelProducaoFaixasDesconto(payload: {
  mes: string;
  faixas: Array<{
    media_min: number;
    media_max: number | null;
    percentual_desconto: number;
  }>;
}): Promise<PainelProducaoFaixaDesconto[]> {
  const res = await apiFetch('/api/painel-producao/faixas-desconto', {
    method: 'PUT',
    body: payload,
  });
  return parseJson(res);
}

export interface FaturamentoValores {
  faturado: number;
  desconto: number;
  devolvido: number;
  liquido: number;
}

export interface FaturamentoDia extends FaturamentoValores {
  dia: string;
}

export interface FaturamentoMesResumo extends FaturamentoValores {
  mes: string;
}

export interface FaturamentoConsulta {
  mes: string;
  ini: string;
  fim: string;
  disponivel: { ini: string; fim: string };
  dias: FaturamentoDia[];
  meses: FaturamentoMesResumo[];
  totais: FaturamentoValores;
}

export interface FaturamentoDocumento extends FaturamentoValores {
  tipo: 'faturamento' | 'devolucao';
  numero: string;
  documento: string;
  pedido: string;
}

export async function fetchPainelFaturamento(ini: string, fim: string): Promise<FaturamentoConsulta> {
  const res = await apiFetch(
    `/api/painel-producao/faturamento?ini=${encodeURIComponent(ini)}&fim=${encodeURIComponent(fim)}`
  );
  return parseJson(res);
}

export interface FaturamentoLinha extends FaturamentoValores {
  dataEmissao: string;
  nf: string;
  documento: string;
  idTipoMovimentacao: number;
  tipoMovimentacao: string;
  numeroPedido: string;
  codigoProduto: string;
  produto: string;
}

export async function fetchPainelFaturamentoLinhas(
  ini: string,
  fim: string
): Promise<{ ini: string; fim: string; linhas: FaturamentoLinha[] }> {
  const res = await apiFetch(
    `/api/painel-producao/faturamento/linhas?ini=${encodeURIComponent(ini)}&fim=${encodeURIComponent(fim)}`
  );
  return parseJson(res);
}

export async function fetchPainelFaturamentoDia(
  dia: string
): Promise<{ dia: string; documentos: FaturamentoDocumento[] }> {
  const res = await apiFetch(`/api/painel-producao/faturamento/dia?dia=${encodeURIComponent(dia)}`);
  return parseJson(res);
}

export async function insertPainelProducaoMes(): Promise<{ mes: string; meses: string[] }> {
  const res = await apiFetch('/api/painel-producao/meses', { method: 'POST' });
  return parseJson(res);
}
