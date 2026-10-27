import { apiFetch } from './client';

const BASE = '/api/compras/materiais-a-chegar';

export type EtapaAcompanhamento = 'solicitado' | 'comprado' | 'pre_entrada';

export type LinhaAcompanhamento = {
  idProduto: number;
  codigo: string;
  descricao: string;
  unidadeMedida: string;
  qtdeSolicitado: number;
  qtdeComprado: number;
  qtdePreEntrada: number;
  emissaoSolicitacao: string | null;
  necessidadeSolicitacao: string | null;
  emissaoPedido: string | null;
  emissaoPreEntrada: string | null;
  /** Um número por linha. Vazios quando a etapa não tem o documento. */
  solicitacoes?: string;
  pedidos?: string;
  documentos?: string;
};

export type LinhaDetalheSolicitado = {
  idSolicitacao: number;
  usuario: string | null;
  dataEmissao: string | null;
  dataNecessidade: string | null;
  qtde: number;
};

export type RefDocumento = { id: number; numero: string };

export type LinhaDetalheComprado = {
  idItem: number;
  solicitacoes: string | null;
  idPedido: number;
  pedido: string;
  fornecedor: string | null;
  dataEntrega: string | null;
  qtde: number;
};

export type LinhaDetalhePreEntrada = {
  idItem: number;
  idDocumento: number;
  numeroDocumento: string | null;
  numeroNfe: string | null;
  solicitacoes: string | null;
  fornecedor: string | null;
  dataEmissao: string | null;
  pedidos: string | null;
  pedidosRef: RefDocumento[];
  qtde: number;
  situacao: 'Pré-entrada';
};

export type TipoDocumentoAcompanhamento = 'pedido' | 'pre_entrada';
export type EscopoDocumentoAcompanhamento = 'completo' | 'datas_entrega';

export type StatusItemDocumento =
  | 'comprado'
  | 'pre_entrada'
  | 'aberto_fora_grade'
  | 'pre_entrada_fora_grade'
  | 'encerrado'
  | 'recebido'
  | 'cancelado';

export type ItemDocumentoAcompanhamento = {
  idItem: number;
  idProduto: number;
  codigo: string;
  descricao: string;
  unidadeMedida: string;
  qtde: number;
  qtdeAtendida: number | null;
  saldo: number | null;
  dataEntrega: string | null;
  dataEntregaYmd: string | null;
  /** Dias até a entrega (negativo = atrasada). Null sem data. */
  diasEntrega: number | null;
  alertaDataEntrega: boolean;
  status: StatusItemDocumento;
  /** Quantidade que o item soma na etapa da grade (0 quando fora da grade). */
  qtdeCaminho: number;
  solicitacoes: string | null;
  pedidos: RefDocumento[];
  preEntradas: RefDocumento[];
};

export type DocumentoAcompanhamento = {
  tipo: TipoDocumentoAcompanhamento;
  id: number;
  numero: string;
  fornecedor: string | null;
  dataEmissao: string | null;
  numeroNfe: string | null;
  efetivado: boolean;
  itens: ItemDocumentoAcompanhamento[];
};

export type DetalheAcompanhamento =
  | { etapa: 'solicitado'; linhas: LinhaDetalheSolicitado[] }
  | { etapa: 'comprado'; linhas: LinhaDetalheComprado[] }
  | { etapa: 'pre_entrada'; linhas: LinhaDetalhePreEntrada[] };

export async function obterPipelineAcompanhamento(): Promise<{
  linhas: LinhaAcompanhamento[];
  error?: string;
}> {
  const res = await apiFetch(BASE);
  const body = (await res.json().catch(() => ({}))) as { linhas?: LinhaAcompanhamento[]; error?: string };
  if (!res.ok) return { linhas: [], error: body.error ?? res.statusText };
  return { linhas: Array.isArray(body.linhas) ? body.linhas : [] };
}

export async function obterDetalheAcompanhamento(
  idProduto: number,
  etapa: EtapaAcompanhamento
): Promise<{ detalhe: DetalheAcompanhamento | null; error?: string }> {
  const qs = new URLSearchParams({ idProduto: String(idProduto), etapa });
  const res = await apiFetch(`${BASE}/detalhe?${qs.toString()}`);
  const body = (await res.json().catch(() => ({}))) as DetalheAcompanhamento & { error?: string };
  if (!res.ok) return { detalhe: null, error: body.error ?? res.statusText };
  if (body.etapa === 'solicitado' || body.etapa === 'comprado' || body.etapa === 'pre_entrada') {
    return { detalhe: { etapa: body.etapa, linhas: body.linhas ?? [] } as DetalheAcompanhamento };
  }
  return { detalhe: null, error: 'Resposta inválida do detalhe.' };
}

export type PedidoDataEntregaAtualizar = {
  idPedido: number;
  pedido: string;
  fornecedor: string | null;
  dataEmissao: string | null;
  itens: number;
  liberados: number;
  parciais: number;
  preEntradas: number;
  semData: number;
  /** Menor prazo entre os itens com data (negativo = atrasado). */
  menorDias: number | null;
  /** Data de entrega mais antiga entre os itens com data (dd/mm/aaaa). */
  menorDataEntrega: string | null;
};

export async function listarDatasEntregaAtualizar(): Promise<{
  pedidos: PedidoDataEntregaAtualizar[];
  error?: string;
}> {
  const res = await apiFetch(`${BASE}/datas-entrega`);
  const body = (await res.json().catch(() => ({}))) as { pedidos?: PedidoDataEntregaAtualizar[]; error?: string };
  if (!res.ok) return { pedidos: [], error: body.error ?? res.statusText };
  return { pedidos: Array.isArray(body.pedidos) ? body.pedidos : [] };
}

export async function obterDocumentoAcompanhamento(
  tipo: TipoDocumentoAcompanhamento,
  id: number,
  escopo: EscopoDocumentoAcompanhamento = 'completo'
): Promise<{ documento: DocumentoAcompanhamento | null; error?: string }> {
  const qs = new URLSearchParams({ tipo, id: String(id), escopo });
  const res = await apiFetch(`${BASE}/documento?${qs.toString()}`);
  const body = (await res.json().catch(() => ({}))) as Partial<DocumentoAcompanhamento> & { error?: string };
  if (!res.ok) return { documento: null, error: body.error ?? res.statusText };
  if (body.tipo !== tipo || !Array.isArray(body.itens)) {
    return { documento: null, error: 'Resposta inválida do documento.' };
  }
  return { documento: body as DocumentoAcompanhamento };
}

/** Mesma gravação da Integração (Nomus + histórico), pela permissão de Materiais a chegar. */
export async function alterarDataEntregaMateriaisAChegar(
  idItemPedidoCompra: number,
  payload: { dataEntrega: string; dataEntregaAnterior?: string; motivo: string; observacao?: string | null }
): Promise<void> {
  const res = await apiFetch(`${BASE}/data-entrega/item/${idItemPedidoCompra}`, {
    method: 'PATCH',
    body: { ...payload, observacao: payload.observacao ?? undefined },
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Erro ${res.status}`);
  }
}
