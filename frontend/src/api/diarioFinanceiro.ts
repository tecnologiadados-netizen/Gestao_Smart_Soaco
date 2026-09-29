import { apiFetch } from './client';

export type DiarioContaPagarStatus = 'Em aberto' | 'Baixado';

export interface DiarioContaPagarLinha {
  origem: 'Shop9' | 'Nomus';
  codigo: number;
  status: DiarioContaPagarStatus;
  dataVencimento: string | null;
  dataBaixa: string | null;
  fornecedor: string | null;
  empresa: string | null;
  filial: string | null;
  planoContas: string | null;
  descricao: string | null;
  observacao: string | null;
  formaPagamento: string | null;
  contaBancaria: string | null;
  valor: number;
  valorBaixado: number;
  saldo: number;
  /** Nomus: id de agendamentofinanceiro. Nulo quando o lançamento não tem agendamento. */
  idAgendamento: number | null;
}

export interface DiarioContasPagarResponse {
  dataInicio: string;
  dataFim: string;
  linhas: DiarioContaPagarLinha[];
  erroShop9?: string;
  erroNomus?: string;
  error?: string;
}

export async function fetchDiarioContasPagar(params: {
  dataInicio: string;
  dataFim: string;
}): Promise<DiarioContasPagarResponse> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  const res = await apiFetch(`/api/financeiro/diario/contas-pagar?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as DiarioContasPagarResponse;
  if (!res.ok) {
    throw new Error(body.error || `Erro ao carregar contas a pagar (${res.status})`);
  }
  return {
    ...body,
    linhas: Array.isArray(body.linhas) ? body.linhas : [],
  };
}

export interface ReprogramarContasPagarItem {
  origem: 'Nomus' | 'Shop9';
  id: number;
}

export interface ReprogramarContasPagarIgnorado {
  origem: 'Nomus' | 'Shop9';
  id: number;
  motivo: string;
}

export interface ReprogramarContasPagarResponse {
  dataVencimento: string;
  atualizados: number;
  ignorados: ReprogramarContasPagarIgnorado[];
  erroNomus?: string;
  erroShop9?: string;
  error?: string;
}

export async function reprogramarDiarioContasPagar(params: {
  dataVencimento: string;
  itens: ReprogramarContasPagarItem[];
}): Promise<ReprogramarContasPagarResponse> {
  const res = await apiFetch('/api/financeiro/diario/contas-pagar/reprogramar', {
    method: 'POST',
    body: params,
  });
  const body = (await res.json().catch(() => ({}))) as ReprogramarContasPagarResponse;
  if (!res.ok) {
    throw new Error(body.error || `Erro ao reprogramar vencimento (${res.status})`);
  }
  return {
    ...body,
    atualizados: Number(body.atualizados) || 0,
    ignorados: Array.isArray(body.ignorados) ? body.ignorados : [],
  };
}
