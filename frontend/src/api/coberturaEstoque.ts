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

export type CoberturaEstoqueLinha = ConsultaEstoqueLinha & {
  status: StatusCoberturaEstoque;
};

export type TotaisStatusCobertura = {
  status: StatusCoberturaEstoque;
  label: string;
  itens: number;
  saldo: number;
  empenho: number;
  saldoProjetado: number;
};

export type DistribuicaoDimensao = {
  chave: string;
  itens: number;
  saldoProjetado: number;
};

export type PainelCoberturaEstoqueData = {
  totalItens: number;
  totais: TotaisStatusCobertura[];
  distribuicaoTipo: DistribuicaoDimensao[];
  topCriticos: CoberturaEstoqueLinha[];
  topExcesso: CoberturaEstoqueLinha[];
  itens: CoberturaEstoqueLinha[];
};

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
