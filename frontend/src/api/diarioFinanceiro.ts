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
  anotacaoCor: string | null;
  /** Vencimento original da reprogramação, quando já estiver gravado. */
  reprogramado: string | null;
  /** Apontamento local: título em cartório. */
  emCartorio: boolean;
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
  itens?: boolean;
}): Promise<DiarioContasPagarResponse> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  if (params.itens === false) sp.set('itens', '0');
  const res = await apiFetch(`/api/financeiro/diario/contas-pagar?${sp.toString()}`);
  const body = (await res.json().catch(() => ({}))) as DiarioContasPagarResponse;
  if (!res.ok) {
    throw new Error(body.error || `Erro ao carregar contas a pagar (${res.status})`);
  }
  return {
    ...body,
    linhas: (Array.isArray(body.linhas) ? body.linhas : []).map((l) => ({
      ...l,
      emCartorio: Boolean(l.emCartorio),
    })),
  };
}

export async function fetchDiarioVencidosReprogramados(): Promise<DiarioContasPagarResponse> {
  const res = await apiFetch('/api/financeiro/diario/contas-pagar/vencidos');
  const body = (await res.json().catch(() => ({}))) as DiarioContasPagarResponse;
  if (!res.ok) {
    throw new Error(body.error || `Erro ao carregar vencidos/reprogramados (${res.status})`);
  }
  return {
    ...body,
    linhas: (Array.isArray(body.linhas) ? body.linhas : []).map((l) => ({
      ...l,
      emCartorio: Boolean(l.emCartorio),
    })),
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
  dataProcesso: string;
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
  dataProcesso: string;
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
  dataProcesso: string;
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
  cor: string | null;
  dataProcesso: string;
}): Promise<{ texto: string | null; cor: string | null }> {
  const res = await apiFetch('/api/financeiro/diario/contas-pagar/anotacao', {
    method: 'POST',
    body: params,
  });
  const body = (await res.json().catch(() => ({}))) as { texto?: string | null; cor?: string | null; error?: string };
  if (!res.ok) throw new Error(body.error || `Erro ao gravar observação (${res.status})`);
  const texto = body.texto?.trim();
  return { texto: texto || null, cor: body.cor?.trim() || null };
}

export async function aplicarCorAnotacoesDiario(params: {
  itens: { origem: 'Nomus' | 'Shop9'; codigo: number }[];
  cor: string | null;
  dataProcesso: string;
}): Promise<{ atualizados: number; cor: string | null }> {
  const res = await apiFetch('/api/financeiro/diario/contas-pagar/anotacoes/cor', {
    method: 'POST',
    body: params,
  });
  const body = (await res.json().catch(() => ({}))) as { atualizados?: number; cor?: string | null; error?: string };
  if (!res.ok) throw new Error(body.error || `Erro ao aplicar a cor (${res.status})`);
  return { atualizados: Number(body.atualizados) || 0, cor: body.cor?.trim() || null };
}

export interface ImportacaoAnotacaoResultado {
  gravados: number;
  ignoradosVazios: number;
  semCorrespondencia: number;
  ambiguos: number;
  amostrasSem: string[];
  error?: string;
}

export async function importarAnotacoesDiario(
  matriz: string[][],
  dataProcesso: string,
): Promise<ImportacaoAnotacaoResultado> {
  const res = await apiFetch('/api/financeiro/diario/contas-pagar/anotacoes/importar', {
    method: 'POST',
    body: { matriz, dataProcesso },
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

export async function aplicarCartorioDiario(params: {
  itens: { origem: 'Nomus' | 'Shop9'; codigo: number }[];
  emCartorio: boolean;
  dataProcesso: string;
}): Promise<{ atualizados: number; emCartorio: boolean }> {
  const res = await apiFetch('/api/financeiro/diario/contas-pagar/cartorio', {
    method: 'POST',
    body: params,
  });
  const body = (await res.json().catch(() => ({}))) as {
    atualizados?: number;
    emCartorio?: boolean;
    error?: string;
  };
  if (!res.ok) throw new Error(body.error || `Erro ao apontar cartório (${res.status})`);
  return {
    atualizados: Number(body.atualizados) || 0,
    emCartorio: Boolean(body.emCartorio),
  };
}

export interface DiarioSubclassificacaoItem {
  nome: string;
  classificacao: string;
}

export async function fetchDiarioSubclassificacoes(): Promise<DiarioSubclassificacaoItem[]> {
  const res = await apiFetch('/api/financeiro/diario/subclassificacoes');
  const body = (await res.json().catch(() => ({}))) as
    | DiarioSubclassificacaoItem[]
    | { itens?: DiarioSubclassificacaoItem[]; error?: string };
  if (!res.ok) {
    const erro = !Array.isArray(body) ? body.error : undefined;
    throw new Error(erro || `Erro ao carregar subclassificações (${res.status})`);
  }
  if (Array.isArray(body)) return body;
  return Array.isArray(body.itens) ? body.itens : [];
}

export async function fetchDiarioSubclassificacaoNomes(): Promise<string[]> {
  const res = await apiFetch('/api/financeiro/diario/subclassificacoes');
  const body = (await res.json().catch(() => ({}))) as { nomes?: string[]; error?: string };
  if (!res.ok) throw new Error(body.error || `Erro ao carregar subclassificações (${res.status})`);
  return Array.isArray(body.nomes) ? body.nomes : [];
}

export async function cadastrarDiarioSubclassificacao(params: {
  nome: string;
}): Promise<{ nome: string }> {
  const res = await apiFetch('/api/financeiro/diario/subclassificacoes', {
    method: 'POST',
    body: params,
  });
  const body = (await res.json().catch(() => ({}))) as { nome?: string; error?: string };
  if (!res.ok) throw new Error(body.error || `Erro ao cadastrar subclassificação (${res.status})`);
  return { nome: body.nome ?? params.nome };
}

export interface DiarioSubclassificacaoConflito {
  classificacao: string;
  atual: string;
}

export async function alocarDiarioSubclassificacao(params: {
  classificacoes: string[];
  nome: string;
  confirmarTroca?: boolean;
}): Promise<{ atualizados: number; precisaConfirmar?: boolean; conflitos?: DiarioSubclassificacaoConflito[] }> {
  const res = await apiFetch('/api/financeiro/diario/subclassificacoes/alocar', {
    method: 'POST',
    body: params,
  });
  const body = (await res.json().catch(() => ({}))) as {
    atualizados?: number;
    precisaConfirmar?: boolean;
    conflitos?: DiarioSubclassificacaoConflito[];
    error?: string;
  };
  if (res.status === 409 && body.precisaConfirmar) {
    return {
      atualizados: 0,
      precisaConfirmar: true,
      conflitos: Array.isArray(body.conflitos) ? body.conflitos : [],
    };
  }
  if (!res.ok) throw new Error(body.error || `Erro ao relacionar subclassificação (${res.status})`);
  return { atualizados: Number(body.atualizados) || 0 };
}

export type StatusProcessoDiario = 'rascunho' | 'em_aprovacao' | 'aprovado' | 'em_correcao';

export interface DiarioProcesso {
  id: number;
  codigo: number;
  dataVencimento: string;
  descricao: string;
  usuario: string;
  status: StatusProcessoDiario;
  motivoDevolucao: string | null;
  aprovadoPor: string | null;
  aprovadoEm: string | null;
  enviadoEm: string | null;
  criadoEm: string;
  editavel: boolean;
}

async function lerErro(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error || fallback;
}

export async function listarProcessosDiario(): Promise<DiarioProcesso[]> {
  const res = await apiFetch('/api/financeiro/diario/processos');
  if (!res.ok) throw new Error(await lerErro(res, `Erro ao listar processos (${res.status})`));
  const body = (await res.json()) as { processos?: DiarioProcesso[] };
  return Array.isArray(body.processos) ? body.processos : [];
}

export async function iniciarProcessoDiario(params: {
  dataVencimento: string;
  descricao: string;
}): Promise<{ processo: DiarioProcesso; existente: boolean }> {
  const res = await apiFetch('/api/financeiro/diario/processos', { method: 'POST', body: params });
  if (!res.ok) throw new Error(await lerErro(res, `Erro ao iniciar o contas a pagar (${res.status})`));
  return (await res.json()) as { processo: DiarioProcesso; existente: boolean };
}

export async function atualizarDescricaoProcessoDiario(id: number, descricao: string): Promise<DiarioProcesso> {
  const res = await apiFetch(`/api/financeiro/diario/processos/${id}`, {
    method: 'PATCH',
    body: { descricao },
  });
  if (!res.ok) throw new Error(await lerErro(res, `Erro ao gravar a descrição (${res.status})`));
  const body = (await res.json()) as { processo: DiarioProcesso };
  return body.processo;
}

export async function enviarProcessoDiario(id: number): Promise<DiarioProcesso> {
  const res = await apiFetch(`/api/financeiro/diario/processos/${id}/enviar`, { method: 'POST', body: {} });
  if (!res.ok) throw new Error(await lerErro(res, `Erro ao enviar para aprovação (${res.status})`));
  const body = (await res.json()) as { processo: DiarioProcesso };
  return body.processo;
}

export async function aprovarProcessoDiario(id: number, senha: string): Promise<DiarioProcesso> {
  const res = await apiFetch(`/api/financeiro/diario/processos/${id}/aprovar`, {
    method: 'POST',
    body: { senha },
  });
  if (!res.ok) throw new Error(await lerErro(res, `Erro ao aprovar (${res.status})`));
  const body = (await res.json()) as { processo: DiarioProcesso };
  return body.processo;
}

export async function devolverProcessoDiario(id: number, motivo: string): Promise<DiarioProcesso> {
  const res = await apiFetch(`/api/financeiro/diario/processos/${id}/devolver`, {
    method: 'POST',
    body: { motivo },
  });
  if (!res.ok) throw new Error(await lerErro(res, `Erro ao devolver para correção (${res.status})`));
  const body = (await res.json()) as { processo: DiarioProcesso };
  return body.processo;
}
