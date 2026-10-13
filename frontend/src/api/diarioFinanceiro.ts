import { apiFetch } from './client';

export type DiarioContaPagarStatus = 'Em aberto' | 'Baixado';

export interface DiarioContaPagarItem {
  codigo: string | null;
  produto: string | null;
  descricao: string | null;
  qtde: number | null;
  valorUnitario: number | null;
  valorTotal: number | null;
  valorDesconto: number | null;
  valorTotalComDesconto: number | null;
}

export interface DiarioContaPagarLinha {
  origem: 'Shop9' | 'Nomus';
  codigo: number;
  status: DiarioContaPagarStatus;
  dataVencimento: string | null;
  dataBaixa: string | null;
  fornecedor: string | null;
  empresa: string | null;
  filial: string | null;
  codigoClassificacao: number | null;
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
  idEmpresa: number | null;
  idContaFinanceiro: number | null;
  tipoRef: 'A' | 'L' | 'S' | null;
  idRef: number | null;
  pedidoCompra: string | null;
  notaFiscal: string | null;
  anotacao: string | null;
  itens: DiarioContaPagarItem[];
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

export interface ContaBancariaOpcao {
  id: number;
  nome: string;
}

export async function fetchDiarioContasBancarias(origem: 'Nomus' | 'Shop9'): Promise<ContaBancariaOpcao[]> {
  const res = await apiFetch(`/api/financeiro/diario/contas-bancarias?origem=${origem}`);
  const body = (await res.json().catch(() => ({}))) as { contas?: ContaBancariaOpcao[]; error?: string };
  if (!res.ok) throw new Error(body.error || `Erro ao listar contas bancárias (${res.status})`);
  return Array.isArray(body.contas) ? body.contas : [];
}

export interface DefinirContaBancariaResponse {
  origem: 'Nomus' | 'Shop9';
  idContaBancaria: number;
  nomeConta: string;
  atualizados: number;
  ignorados: ReprogramarContasPagarIgnorado[];
  erro?: string;
  error?: string;
}

export async function definirContaBancariaDiario(params: {
  idContaBancaria: number;
  itens: ReprogramarContasPagarItem[];
}): Promise<DefinirContaBancariaResponse> {
  const res = await apiFetch('/api/financeiro/diario/contas-pagar/conta-bancaria', {
    method: 'POST',
    body: params,
  });
  const body = (await res.json().catch(() => ({}))) as DefinirContaBancariaResponse;
  if (!res.ok) throw new Error(body.error || body.erro || `Erro ao definir conta bancária (${res.status})`);
  return {
    ...body,
    atualizados: Number(body.atualizados) || 0,
    ignorados: Array.isArray(body.ignorados) ? body.ignorados : [],
  };
}

export interface FormaPagamentoOpcao {
  id: string;
  nome: string;
}

export async function fetchDiarioFormasPagamento(origem: 'Nomus' | 'Shop9'): Promise<FormaPagamentoOpcao[]> {
  const res = await apiFetch(`/api/financeiro/diario/formas-pagamento?origem=${origem}`);
  const body = (await res.json().catch(() => ({}))) as { formas?: FormaPagamentoOpcao[]; error?: string };
  if (!res.ok) throw new Error(body.error || `Erro ao listar formas de pagamento (${res.status})`);
  return Array.isArray(body.formas) ? body.formas : [];
}

export interface DefinirFormaPagamentoResponse {
  origem: 'Nomus' | 'Shop9';
  idFormaPagamento: string;
  nomeForma: string;
  atualizados: number;
  ignorados: ReprogramarContasPagarIgnorado[];
  erro?: string;
  error?: string;
}

export async function definirFormaPagamentoDiario(params: {
  idFormaPagamento: string;
  itens: ReprogramarContasPagarItem[];
}): Promise<DefinirFormaPagamentoResponse> {
  const res = await apiFetch('/api/financeiro/diario/contas-pagar/forma-pagamento', {
    method: 'POST',
    body: params,
  });
  const body = (await res.json().catch(() => ({}))) as DefinirFormaPagamentoResponse;
  if (!res.ok) throw new Error(body.error || body.erro || `Erro ao definir forma de pagamento (${res.status})`);
  return {
    ...body,
    atualizados: Number(body.atualizados) || 0,
    ignorados: Array.isArray(body.ignorados) ? body.ignorados : [],
  };
}

export async function salvarAnotacaoDiario(params: {
  origem: 'Nomus' | 'Shop9';
  codigo: number;
  texto: string;
}): Promise<string | null> {
  const res = await apiFetch('/api/financeiro/diario/contas-pagar/anotacao', {
    method: 'POST',
    body: params,
  });
  const body = (await res.json().catch(() => ({}))) as { texto?: string | null; error?: string };
  if (!res.ok) throw new Error(body.error || `Erro ao gravar observação (${res.status})`);
  const texto = body.texto?.trim();
  return texto || null;
}

export interface ImportacaoAnotacaoResultado {
  gravados: number;
  ignoradosVazios: number;
  semCorrespondencia: number;
  ambiguos: number;
  amostrasSem: string[];
  error?: string;
}

export async function importarAnotacoesDiario(matriz: string[][]): Promise<ImportacaoAnotacaoResultado> {
  const res = await apiFetch('/api/financeiro/diario/contas-pagar/anotacoes/importar', {
    method: 'POST',
    body: { matriz },
  });
  const body = (await res.json().catch(() => ({}))) as ImportacaoAnotacaoResultado;
  if (!res.ok) throw new Error(body.error || `Erro ao importar observações (${res.status})`);
  return {
    gravados: Number(body.gravados) || 0,
    ignoradosVazios: Number(body.ignoradosVazios) || 0,
    semCorrespondencia: Number(body.semCorrespondencia) || 0,
    ambiguos: Number(body.ambiguos) || 0,
    amostrasSem: Array.isArray(body.amostrasSem) ? body.amostrasSem : [],
  };
}
