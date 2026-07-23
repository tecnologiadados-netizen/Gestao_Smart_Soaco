import { apiFetch } from './client';
import type {
  ColunaIndicador,
  ContaFinanceira,
  DashboardDetalhesData,
  DashboardGlobalData,
  EmpresaOption,
  GrupoPessoaOption,
  PessoaOption,
  Recebimento,
} from '../pages/financeiro/crm/lib/types';
import type { SaudeClienteResult } from '../pages/financeiro/crm/lib/saude-cliente';

export type { SaudeClienteResult };

export interface ResumoDetalheModal {
  quantidadeTotal: number;
  valorTotal: number;
  quantidadeCarregada: number;
  limite: number;
}

export type IndicadorDetalheResponse =
  | { modo: 'contas'; dados: ContaFinanceira[]; resumo?: ResumoDetalheModal }
  | {
      modo: 'recebimentos';
      dados: Recebimento[];
      resumo?: ResumoDetalheModal;
    };

function buildParams(
  params: Record<string, string | number | null | undefined>,
): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== '') {
      sp.set(key, String(value));
    }
  }
  const q = sp.toString();
  return q ? `?${q}` : '';
}

export async function fetchCrmDashboard(params: {
  pessoa?: string | null;
  grupoId?: number | null;
  empresaId?: number | null;
  refresh?: boolean;
}): Promise<DashboardGlobalData | DashboardDetalhesData> {
  const res = await apiFetch(
    `/api/financeiro/crm/dashboard${buildParams({
      pessoa: params.pessoa ?? undefined,
      grupoId: params.grupoId ?? undefined,
      empresa: params.empresaId ?? undefined,
      refresh: params.refresh ? '1' : undefined,
    })}`,
  );
  const body = (await res.json().catch(() => ({}))) as
    | DashboardGlobalData
    | DashboardDetalhesData
    | { error?: string };
  if (!res.ok) {
    throw new Error(
      (body as { error?: string }).error ?? 'Falha ao carregar indicadores',
    );
  }
  return body as DashboardGlobalData | DashboardDetalhesData;
}

export async function fetchCrmSaudeEmpresa(params: {
  empresaId?: number | null;
  refresh?: boolean;
}): Promise<SaudeClienteResult> {
  const res = await apiFetch(
    `/api/financeiro/crm/saude-empresa${buildParams({
      empresa: params.empresaId ?? undefined,
      refresh: params.refresh ? '1' : undefined,
    })}`,
  );
  const body = (await res.json().catch(() => ({}))) as
    | SaudeClienteResult
    | { error?: string };
  if (!res.ok) {
    throw new Error(
      (body as { error?: string }).error ?? 'Falha ao carregar saúde da empresa',
    );
  }
  return body as SaudeClienteResult;
}

export async function fetchCrmDetalhe(params: {
  tipo: 'receber' | 'pagar';
  coluna: ColunaIndicador;
  classificacao?: string | null;
  pessoa?: string | null;
  grupoId?: number | null;
  empresaId?: number | null;
}): Promise<IndicadorDetalheResponse> {
  const res = await apiFetch(
    `/api/financeiro/crm/detalhe${buildParams({
      tipo: params.tipo,
      coluna: params.coluna,
      classificacao: params.classificacao ?? undefined,
      pessoa: params.pessoa ?? undefined,
      grupoId: params.grupoId ?? undefined,
      empresa: params.empresaId ?? undefined,
    })}`,
  );
  const body = (await res.json().catch(() => ({}))) as
    | IndicadorDetalheResponse
    | { error?: string };
  if (!res.ok) {
    throw new Error(
      (body as { error?: string }).error ?? 'Falha ao carregar registros',
    );
  }
  return body as IndicadorDetalheResponse;
}

export async function fetchCrmPessoas(params: {
  q?: string;
  empresaId?: number | null;
}): Promise<{
  pessoas: PessoaOption[];
  grupos: GrupoPessoaOption[];
}> {
  const res = await apiFetch(
    `/api/financeiro/crm/pessoas${buildParams({
      q: params.q ?? undefined,
      empresa: params.empresaId ?? undefined,
    })}`,
  );
  const body = (await res.json().catch(() => ({}))) as
    | {
        pessoas: PessoaOption[];
        grupos: GrupoPessoaOption[];
      }
    | PessoaOption[]
    | { error?: string };
  if (!res.ok) {
    return { pessoas: [], grupos: [] };
  }
  // Compat: resposta antiga era só array de pessoas
  if (Array.isArray(body)) {
    return { pessoas: body, grupos: [] };
  }
  return {
    pessoas: Array.isArray(body.pessoas) ? body.pessoas : [],
    grupos: Array.isArray(body.grupos) ? body.grupos : [],
  };
}

export async function fetchCrmEmpresas(): Promise<EmpresaOption[]> {
  const res = await apiFetch('/api/financeiro/crm/empresas');
  const body = (await res.json().catch(() => ({}))) as
    | EmpresaOption[]
    | { error?: string };
  if (!res.ok) {
    return [];
  }
  return Array.isArray(body) ? body : [];
}

export type AcaoPendenciaCredito =
  | 'CANCELADO'
  | 'PAUSADO'
  | 'REALOCAR_MATERIAL'
  | 'SEGUIR_PRODUCAO';

export type SituacaoFilaPendencia =
  | 'INADIMPLENTES'
  | 'REGULARIZADOS'
  | 'FINALIZADOS';

export type PendenciaCreditoItem = {
  id: number;
  idPedido: number;
  numeroPedido: string;
  numeroPedidoExibicao: string;
  clienteNome: string;
  clienteChave: string;
  valorPedido: number | null;
  statusNomus: number | null;
  statusNomusLabel: string | null;
  acao: string | null;
  acaoLabel: string | null;
  observacao: string | null;
  pedidoDestino: string | null;
  qtdTitulosAtraso: number | null;
  totalAtraso: number | null;
  maiorAtrasoDias: number | null;
  alertaEm: string;
  acaoEm: string | null;
  acaoPorLogin: string | null;
  acaoPorNome: string | null;
  encerrada: boolean;
  aguardandoConfirmacaoNomus: boolean;
  instrucaoNomus: string | null;
  emailAcaoEnviado: boolean;
  emailAcaoEnviadoEm: string | null;
  prazoHorasSemAcao?: number;
  horasDecorridas?: number;
  horasRestantes?: number | null;
  slaEstourado?: boolean;
  emailSlaEnviado?: boolean;
  emailSlaEnviadoEm?: string | null;
  regularizacaoSituacao: string | null;
  regularizacaoSituacaoLabel: string | null;
  qtdTitulosMonitorPendentes: number | null;
  qtdTitulosMonitorTotal: number | null;
  contasAcompanhamento: Array<{
    codigoConta: number;
    dataVencimento: string | null;
    status: string;
    statusLabel: string;
  }>;
  situacaoFila: SituacaoFilaPendencia;
  situacaoFilaLabel: string;
  podeConfirmarLiberacao: boolean;
  qtdEmailsAlerta: number;
  qtdEmailsAcao: number;
  qtdEmailsTotal: number;
  qtdAcoesRegistradas: number;
  pdfAssinadoNome: string | null;
  pdfAssinadoEm: string | null;
  pdfAssinadoPorLogin: string | null;
  temPdfAssinado: boolean;
};

export type TituloRegularizacaoItem = {
  id: number;
  codigoConta: number;
  dataVencimento: string | null;
  valorReferencia: number;
  nfeOrigem: string | null;
  descricao: string | null;
  diasAtrasoSnap: number | null;
  status: string;
  statusLabel: string;
  regularizadoEm: string | null;
};

export type MonitorRegularizacaoCliente = {
  id: number;
  clienteNome: string;
  clienteChave: string;
  situacao: string;
  situacaoLabel: string;
  iniciadoEm: string;
  regularizadoEm: string | null;
  emailEnviadoEm: string | null;
  qtdTitulosPendentes: number;
  qtdTitulosRegularizados: number;
  qtdTitulosTotal: number;
  titulos: TituloRegularizacaoItem[];
};

export type HistoricoPendenciaEvento = {
  id: number;
  tipo: string;
  tipoLabel: string;
  detalhe: string | null;
  usuarioLogin: string | null;
  createdAt: string;
  pendenciaId: number;
  numeroPedido: string;
  numeroPedidoExibicao: string;
  acao: string | null;
  acaoLabel: string | null;
  observacao: string | null;
};

export type HistoricoPendenciaCliente = {
  clienteNome: string;
  clienteChave: string;
  eventos: HistoricoPendenciaEvento[];
};

export type UsuarioDestinatarioPendencia = {
  id: number;
  login: string;
  nome: string | null;
  email: string | null;
  ativo: boolean;
};

export type PendenciasEmailConfig = {
  usuarioIdsTo: number[];
  usuarioIdsCc: number[];
  destinatariosTo: UsuarioDestinatarioPendencia[];
  destinatariosCc: UsuarioDestinatarioPendencia[];
  prazoHorasSemAcao: number;
  alertaPrazoAtivo: boolean;
  usuarioIdsGestorTo: number[];
  usuarioIdsGestorCc: number[];
  destinatariosGestorTo: UsuarioDestinatarioPendencia[];
  destinatariosGestorCc: UsuarioDestinatarioPendencia[];
  updatedAt?: string | null;
  updatedByLogin?: string | null;
};

export async function fetchCrmPendenciasCredito(params?: {
  cliente?: string | null;
  syncAlertas?: boolean;
  syncNomus?: boolean;
  situacao?: SituacaoFilaPendencia;
}): Promise<{
  itens: PendenciaCreditoItem[];
  contagens: Record<SituacaoFilaPendencia, number>;
  situacaoFila: SituacaoFilaPendencia;
}> {
  const res = await apiFetch(
    `/api/financeiro/crm/pendencias-credito${buildParams({
      cliente: params?.cliente ?? undefined,
      syncAlertas: params?.syncAlertas ? '1' : undefined,
      syncNomus: params?.syncNomus === false ? '0' : undefined,
      situacao: params?.situacao ?? 'INADIMPLENTES',
    })}`,
  );
  const body = (await res.json().catch(() => ({}))) as {
    itens?: PendenciaCreditoItem[];
    contagens?: Record<SituacaoFilaPendencia, number>;
    situacaoFila?: SituacaoFilaPendencia;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error ?? 'Falha ao carregar pendências');
  }
  return {
    itens: body.itens ?? [],
    contagens: body.contagens ?? {
      INADIMPLENTES: 0,
      REGULARIZADOS: 0,
      FINALIZADOS: 0,
    },
    situacaoFila: body.situacaoFila ?? params?.situacao ?? 'INADIMPLENTES',
  };
}

export async function salvarCrmPendenciaAcao(
  id: number,
  payload: {
    acao: AcaoPendenciaCredito;
    observacao?: string | null;
    pedidoDestino?: string | null;
  },
): Promise<{
  pendencia: PendenciaCreditoItem;
  instrucaoNomus: string | null;
  mensagem?: string;
  emailEnviado: boolean;
  aguardandoConfirmacaoNomus: boolean;
  email: { to: string[]; cc: string[] } | null;
}> {
  const res = await apiFetch(`/api/financeiro/crm/pendencias-credito/${id}/acao`, {
    method: 'POST',
    body: payload,
  });
  const body = (await res.json().catch(() => ({}))) as {
    pendencia?: PendenciaCreditoItem;
    instrucaoNomus?: string | null;
    mensagem?: string;
    emailEnviado?: boolean;
    aguardandoConfirmacaoNomus?: boolean;
    email?: { to: string[]; cc: string[] } | null;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error ?? 'Falha ao salvar ação');
  }
  return {
    pendencia: body.pendencia!,
    instrucaoNomus: body.instrucaoNomus ?? null,
    mensagem: body.mensagem,
    emailEnviado: Boolean(body.emailEnviado),
    aguardandoConfirmacaoNomus: Boolean(body.aguardandoConfirmacaoNomus),
    email: body.email ?? null,
  };
}

export async function confirmarCrmPendenciaLiberacao(id: number): Promise<{
  pendencia: PendenciaCreditoItem;
  instrucaoNomus: string | null;
  mensagem: string;
  aguardandoConfirmacaoNomus: boolean;
}> {
  const res = await apiFetch(
    `/api/financeiro/crm/pendencias-credito/${id}/confirmar-liberacao`,
    { method: 'POST', body: {} },
  );
  const body = (await res.json().catch(() => ({}))) as {
    pendencia?: PendenciaCreditoItem;
    instrucaoNomus?: string | null;
    mensagem?: string;
    aguardandoConfirmacaoNomus?: boolean;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error ?? 'Falha ao confirmar liberação');
  }
  return {
    pendencia: body.pendencia!,
    instrucaoNomus: body.instrucaoNomus ?? null,
    mensagem: body.mensagem ?? 'Liberação processada.',
    aguardandoConfirmacaoNomus: Boolean(body.aguardandoConfirmacaoNomus),
  };
}

async function fileToPdfBase64(file: File): Promise<{
  fileName: string;
  mimeType: string;
  contentBase64: string;
}> {
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) throw new Error('Envie apenas PDF assinado (.pdf).');
  if (file.size > 15 * 1024 * 1024) throw new Error('PDF excede 15MB.');
  const contentBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error(`Falha ao ler ${file.name}.`));
    reader.readAsDataURL(file);
  });
  return {
    fileName: file.name,
    mimeType: file.type || 'application/pdf',
    contentBase64,
  };
}

export async function anexarCrmPendenciaPdfAssinado(
  id: number,
  file: File,
): Promise<PendenciaCreditoItem> {
  const payload = await fileToPdfBase64(file);
  const res = await apiFetch(`/api/financeiro/crm/pendencias-credito/${id}/pdf-assinado`, {
    method: 'POST',
    body: payload,
  });
  const body = (await res.json().catch(() => ({}))) as {
    pendencia?: PendenciaCreditoItem;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error ?? 'Falha ao anexar PDF assinado');
  }
  return body.pendencia!;
}

export async function removerCrmPendenciaPdfAssinado(
  id: number,
): Promise<PendenciaCreditoItem> {
  const res = await apiFetch(`/api/financeiro/crm/pendencias-credito/${id}/pdf-assinado`, {
    method: 'DELETE',
  });
  const body = (await res.json().catch(() => ({}))) as {
    pendencia?: PendenciaCreditoItem;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error ?? 'Falha ao remover PDF assinado');
  }
  return body.pendencia!;
}

export async function baixarCrmPendenciaPdfAssinado(
  id: number,
  fileName?: string | null,
): Promise<void> {
  const res = await apiFetch(`/api/financeiro/crm/pendencias-credito/${id}/pdf-assinado`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? 'Falha ao baixar PDF assinado');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName?.trim() || 'aprovacao-assinada.pdf';
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function fetchCrmPendenciasEmailConfig(): Promise<PendenciasEmailConfig> {
  const res = await apiFetch('/api/financeiro/crm/pendencias-credito/email-config');
  const body = (await res.json().catch(() => ({}))) as
    | PendenciasEmailConfig
    | { error?: string };
  if (!res.ok) {
    throw new Error(
      (body as { error?: string }).error ?? 'Falha ao carregar destinatários',
    );
  }
  return body as PendenciasEmailConfig;
}

export async function salvarCrmPendenciasEmailConfig(payload: {
  usuarioIdsTo: number[];
  usuarioIdsCc: number[];
  prazoHorasSemAcao: number;
  alertaPrazoAtivo: boolean;
  usuarioIdsGestorTo: number[];
  usuarioIdsGestorCc: number[];
}): Promise<PendenciasEmailConfig> {
  const res = await apiFetch('/api/financeiro/crm/pendencias-credito/email-config', {
    method: 'PUT',
    body: payload,
  });
  const body = (await res.json().catch(() => ({}))) as
    | PendenciasEmailConfig
    | { error?: string };
  if (!res.ok) {
    throw new Error(
      (body as { error?: string }).error ?? 'Falha ao salvar destinatários',
    );
  }
  return body as PendenciasEmailConfig;
}

export async function fetchCrmPendenciasUsuarios(): Promise<UsuarioDestinatarioPendencia[]> {
  const res = await apiFetch('/api/financeiro/crm/pendencias-credito/usuarios');
  const body = (await res.json().catch(() => ({}))) as
    | UsuarioDestinatarioPendencia[]
    | { error?: string };
  if (!res.ok) {
    throw new Error(
      (body as { error?: string }).error ?? 'Falha ao carregar usuários',
    );
  }
  return Array.isArray(body) ? body : [];
}

export async function fetchCrmPendenciasHistorico(
  cliente: string,
): Promise<HistoricoPendenciaCliente> {
  const res = await apiFetch(
    `/api/financeiro/crm/pendencias-credito/historico${buildParams({ cliente })}`,
  );
  const body = (await res.json().catch(() => ({}))) as
    | HistoricoPendenciaCliente
    | { error?: string };
  if (!res.ok) {
    throw new Error(
      (body as { error?: string }).error ?? 'Falha ao carregar histórico',
    );
  }
  return body as HistoricoPendenciaCliente;
}

export async function fetchCrmPendenciasContasCliente(
  cliente: string,
): Promise<{ monitor: MonitorRegularizacaoCliente | null; clienteNome: string }> {
  const res = await apiFetch(
    `/api/financeiro/crm/pendencias-credito/contas${buildParams({ cliente })}`,
  );
  const body = (await res.json().catch(() => ({}))) as {
    monitor?: MonitorRegularizacaoCliente | null;
    clienteNome?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error ?? 'Falha ao carregar contas do cliente');
  }
  return {
    monitor: body.monitor ?? null,
    clienteNome: body.clienteNome ?? cliente,
  };
}

export type PedidoDestinoOpcao = {
  idPedido: number;
  numeroPedido: string;
  numeroPedidoExibicao: string;
  clienteNome: string;
  statusItem: number;
  statusLabel: string;
  rotuloDestino: string;
};

export async function fetchCrmPendenciasPedidosDestino(params: {
  busca: string;
  excluirIdPedido?: number | null;
  excluirCliente?: string | null;
}): Promise<PedidoDestinoOpcao[]> {
  const res = await apiFetch(
    `/api/financeiro/crm/pendencias-credito/pedidos-destino${buildParams({
      busca: params.busca,
      excluirIdPedido:
        params.excluirIdPedido != null ? String(params.excluirIdPedido) : undefined,
      excluirCliente: params.excluirCliente ?? undefined,
    })}`,
  );
  const body = (await res.json().catch(() => ({}))) as {
    pedidos?: PedidoDestinoOpcao[];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error ?? 'Falha ao buscar pedidos destino');
  }
  return body.pedidos ?? [];
}

export type RegistroInadimplente = {
  id: number;
  vencimento: string | null;
  pagamento: string | null;
  empresa: string | null;
  banco: string | null;
  tipo: string | null;
  cliente: string;
  status: string | null;
  serasa: string | null;
  vendedor: string | null;
  total: number | null;
  nfPd: string | null;
  parcela: string | null;
  obs: string | null;
  origemImport: boolean;
  criadoPorLogin: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RegistroInadimplenteInput = {
  vencimento?: string | null;
  pagamento?: string | null;
  empresa?: string | null;
  banco?: string | null;
  tipo?: string | null;
  cliente: string;
  status?: string | null;
  serasa?: string | null;
  vendedor?: string | null;
  total?: number | null;
  nfPd?: string | null;
  parcela?: string | null;
  obs?: string | null;
};

export async function fetchCrmRegistroInadimplentes(params?: {
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  data: RegistroInadimplente[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const res = await apiFetch(
    `/api/financeiro/crm/registro-inadimplentes${buildParams({
      q: params?.q,
      page: params?.page,
      pageSize: params?.pageSize,
    })}`,
  );
  const body = (await res.json().catch(() => ({}))) as {
    data?: RegistroInadimplente[];
    total?: number;
    page?: number;
    pageSize?: number;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error ?? 'Falha ao carregar registro de inadimplentes');
  }
  return {
    data: body.data ?? [],
    total: body.total ?? 0,
    page: body.page ?? 1,
    pageSize: body.pageSize ?? 50,
  };
}

export async function createCrmRegistroInadimplente(
  payload: RegistroInadimplenteInput,
): Promise<RegistroInadimplente> {
  const res = await apiFetch('/api/financeiro/crm/registro-inadimplentes', {
    method: 'POST',
    body: payload,
  });
  const body = (await res.json().catch(() => ({}))) as RegistroInadimplente & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error ?? 'Falha ao cadastrar registro');
  }
  return body;
}

export async function updateCrmRegistroInadimplente(
  id: number,
  payload: RegistroInadimplenteInput,
): Promise<RegistroInadimplente> {
  const res = await apiFetch(`/api/financeiro/crm/registro-inadimplentes/${id}`, {
    method: 'PUT',
    body: payload,
  });
  const body = (await res.json().catch(() => ({}))) as RegistroInadimplente & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error ?? 'Falha ao atualizar registro');
  }
  return body;
}

export async function deleteCrmRegistroInadimplente(id: number): Promise<void> {
  const res = await apiFetch(`/api/financeiro/crm/registro-inadimplentes/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? 'Falha ao excluir registro');
  }
}
