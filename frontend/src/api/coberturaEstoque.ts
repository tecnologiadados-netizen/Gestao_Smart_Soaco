import { apiFetch } from './client';
import type { ConsultaEstoqueLinha, FiltrosConsultaEstoquePayload } from './consultaEstoque';

export type StatusCoberturaEstoque =
  | 'ruptura_projetada'
  | 'zerado_projetado'
  | 'cobertura_fragil'
  | 'nivelado'
  | 'excesso_parado';

export const STATUS_COBERTURA_ORDEM: StatusCoberturaEstoque[] = [
  'ruptura_projetada',
  'zerado_projetado',
  'cobertura_fragil',
  'nivelado',
  'excesso_parado',
];

export const LABELS_STATUS_COBERTURA: Record<StatusCoberturaEstoque, string> = {
  ruptura_projetada: 'Ruptura projetada',
  zerado_projetado: 'Zerado projetado',
  cobertura_fragil: 'Cobertura frágil',
  nivelado: 'Nivelado',
  excesso_parado: 'Excesso / parado',
};

export const DESCRICOES_STATUS_COBERTURA: Record<StatusCoberturaEstoque, string> = {
  ruptura_projetada: 'Saldo projetado menor que zero — o empenho consome o estoque antes das entradas.',
  zerado_projetado: 'Saldo projetado igual a zero.',
  cobertura_fragil: 'Projetado maior que zero, mas o estoque físico não cobre o empenho.',
  nivelado: 'O estoque físico cobre o empenho, com razão saldo/empenho até 3.',
  excesso_parado: 'Razão saldo/empenho maior que 3 (estoque sobra em relação ao empenho).',
};

/** Status operacional do painel v2 (coluna Status + KPIs). */
export type StatusPainelCobertura =
  | 'aguardando_pc'
  | 'ruptura'
  | 'sem_giro'
  | 'sem_historico'
  | 'critico'
  | 'atencao'
  | 'saudavel'
  | 'excesso';

export const STATUS_PAINEL_KPI_ORDEM: StatusPainelCobertura[] = [
  'ruptura',
  'aguardando_pc',
  'critico',
  'atencao',
  'saudavel',
  'excesso',
];

export const STATUS_PAINEL_SORT_ORDEM: StatusPainelCobertura[] = [
  'ruptura',
  'aguardando_pc',
  'critico',
  'atencao',
  'excesso',
  'saudavel',
  'sem_giro',
  'sem_historico',
];

export const LABELS_STATUS_PAINEL: Record<StatusPainelCobertura, string> = {
  aguardando_pc: 'Aguardando PC',
  ruptura: 'Ruptura',
  sem_giro: 'Sem giro',
  sem_historico: 'Sem histórico',
  critico: 'Crítico',
  atencao: 'Atenção',
  saudavel: 'Saudável',
  excesso: 'Excesso',
};

export const SUBTITULOS_STATUS_PAINEL: Record<StatusPainelCobertura, string> = {
  aguardando_pc: 'PC cobre o faltante',
  ruptura: 'estoque < empenho',
  sem_giro: 'CM 0 e sem empenho',
  sem_historico: 'CM 0 com empenho/estoque',
  critico: '0 a 0,5 mês',
  atencao: '0,5 a 1 mês',
  saudavel: '1 a 3 meses',
  excesso: 'acima de 3 meses',
};

export type ClasseAtendimento = 'descoberto' | 'parcial' | 'atendido';

export const LABELS_CLASSE_ATENDIMENTO: Record<ClasseAtendimento, string> = {
  descoberto: 'Descoberto',
  parcial: 'Parcial',
  atendido: 'Atendido',
};

export type BarraFirme = 'lt0' | '0_05' | '05_1' | '1_2' | '2_3' | '3_6' | 'gt6';

export const BARRAS_FIRME_ORDEM: BarraFirme[] = [
  'lt0',
  '0_05',
  '05_1',
  '1_2',
  '2_3',
  '3_6',
  'gt6',
];

export const LABELS_BARRA_FIRME: Record<BarraFirme, string> = {
  lt0: '< 0',
  '0_05': '0 - 0,5',
  '05_1': '0,5 - 1',
  '1_2': '1 - 2',
  '2_3': '2 - 3',
  '3_6': '3 - 6',
  gt6: '> 6',
};

/** Alias de StatusPainelCobertura para imports existentes. */
export type KpiFirme = StatusPainelCobertura;

export const KPIS_FIRME_ORDEM: StatusPainelCobertura[] = STATUS_PAINEL_KPI_ORDEM;

export const LABELS_KPI_FIRME = LABELS_STATUS_PAINEL;
export const SUBTITULOS_KPI_FIRME = SUBTITULOS_STATUS_PAINEL;

export const BARRA_PARA_KPI: Record<BarraFirme, StatusPainelCobertura> = {
  lt0: 'ruptura',
  '0_05': 'critico',
  '05_1': 'atencao',
  '1_2': 'saudavel',
  '2_3': 'saudavel',
  '3_6': 'excesso',
  gt6: 'excesso',
};

export const KPI_PARA_BARRAS: Partial<Record<StatusPainelCobertura, BarraFirme[]>> = {
  ruptura: ['lt0'],
  critico: ['0_05'],
  atencao: ['05_1'],
  saudavel: ['1_2', '2_3'],
  excesso: ['3_6', 'gt6'],
};

export type PrioridadeAcaoCobertura = 'urgente' | 'atencao' | 'ok';

export type ChaveAcaoCobertura =
  | 'cobrar_pc'
  | 'acelerar_sc_agpag'
  | 'comprar_agora'
  | 'converter_sc'
  | 'abrir_sc_urgente'
  | 'programar_sc'
  | 'suspender_compra'
  | 'bloquear_reposicao'
  | 'avaliar_descarte'
  | 'validar_cadastro'
  | 'sem_acao'
  | 'urgenciar_sc'
  | 'urgenciar_cotacao'
  | 'complementar_compra'
  | 'gerar_sc'
  | 'acelerar_cotacao'
  | 'converter_cotacao'
  | 'antecipar_pc'
  | 'operacao_normal'
  | 'monitorar_projetada_negativa'
  | 'evitar_compra'
  | 'revisar_pipeline';

export type AcaoSugeridaCobertura = {
  chave: ChaveAcaoCobertura;
  texto: string;
  prioridade: PrioridadeAcaoCobertura;
};

export type CoberturaEstoqueLinha = ConsultaEstoqueLinha & {
  status: StatusCoberturaEstoque;
  consumoMedio: number;
  /** Cobertura em meses; null se CM ≤ 0. */
  cobertura: number | null;
  coberturaFirme: number | null;
  coberturaProjetada?: number;
  faixaFirme: BarraFirme | null;
  kpiFirme: StatusPainelCobertura;
  statusPainel: StatusPainelCobertura;
  atendimento: number | null;
  atendimentoExibicao: number | null;
  classeAtendimento: ClasseAtendimento | null;
  faltante: number;
  valorFaltante: number | null;
  comprador: string;
  familiaProduto: string;
  precoUnitario: number | null;
  valorFirme: number | null;
  acaoSugerida: AcaoSugeridaCobertura;
};

export type TotaisFaixaFirme = {
  faixa: BarraFirme;
  label: string;
  itens: number;
  capital: number | null;
};

export type TotaisKpiFirme = {
  kpi: StatusPainelCobertura;
  label: string;
  subtitulo: string;
  itens: number;
  capital: number | null;
};

export type TotaisCompradorCobertura = {
  comprador: string;
  itens: number;
  ruptura: number;
  aguardandoPc: number;
  critico: number;
  atencao: number;
};

export type PainelCoberturaEstoqueData = {
  totalItens: number;
  kpisFirme: TotaisKpiFirme[];
  barrasFirme: TotaisFaixaFirme[];
  porComprador: TotaisCompradorCobertura[];
  itens: CoberturaEstoqueLinha[];
  /** Famílias com ao menos um item no universo atual (antes do filtro de família). */
  familiasDisponiveis?: string[];
};

export type VisaoGradeCobertura = 'atende_venda' | 'cobertura' | 'sem_giro';

export async function obterPainelCoberturaEstoque(params: {
  filtros: FiltrosConsultaEstoquePayload;
  considerarRequisicoes: boolean;
  status?: StatusCoberturaEstoque | null;
  topN?: number;
}): Promise<{ data: PainelCoberturaEstoqueData | null; error?: string }> {
  const res = await apiFetch('/api/pcp/cobertura-estoque/painel', {
    method: 'POST',
    body: params,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      data: null,
      error: (j as { error?: string }).error ?? res.statusText,
    };
  }
  return { data: (j as { data: PainelCoberturaEstoqueData | null }).data ?? null };
}

export async function obterFamiliasCoberturaEstoque(): Promise<{
  data: string[];
  error?: string;
}> {
  const res = await apiFetch('/api/pcp/cobertura-estoque/familias');
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      data: [],
      error: (j as { error?: string }).error ?? res.statusText,
    };
  }
  const data = (j as { data?: string[] }).data;
  return { data: Array.isArray(data) ? data : [] };
}
