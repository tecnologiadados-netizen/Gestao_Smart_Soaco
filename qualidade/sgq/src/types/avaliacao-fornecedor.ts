import type { CriterioId } from "@/lib/avaliacao-fornecedor/criterios";

export interface Fornecedor {
  id: string;
  nome: string;
  documento?: string;
}

export interface AvaliacaoFornecedor {
  id: string;
  fornecedorId: string;
  fornecedorNome: string;
  avaliadorId: string;
  dataReferencia?: string;
  dataAvaliacao?: string;
  /** @deprecated Use dataAvaliacao — mantido para registros antigos */
  data?: string;
  numeroDocumento?: string;
  fornecedorAprovado?: boolean;
  rncNumero?: string;
  notas: Partial<Record<CriterioId, number>> & Record<string, number>;
  media: number;
  observacoes?: string;
}

export interface AvaliacaoMetadadosInput {
  dataReferencia: string;
  dataAvaliacao: string;
  numeroDocumento: string;
  fornecedorAprovado: boolean | "";
  rncNumero?: string;
}

export interface SalvarAvaliacaoInput {
  fornecedorId: string;
  fornecedorNome: string;
  avaliadorId: string;
  dataReferencia: string;
  dataAvaliacao: string;
  numeroDocumento: string;
  fornecedorAprovado: boolean;
  rncNumero?: string;
  notas: Record<CriterioId, number>;
  observacoes?: string;
}

export function getDataAvaliacao(avaliacao: AvaliacaoFornecedor): string {
  return avaliacao.dataAvaliacao ?? avaliacao.data ?? "";
}

export function criarMetadadosVazios(): AvaliacaoMetadadosInput {
  return {
    dataReferencia: "",
    dataAvaliacao: new Date().toISOString().slice(0, 10),
    numeroDocumento: "",
    fornecedorAprovado: "",
    rncNumero: "",
  };
}
