import { apiFetch, apiJson } from './client';

export type RecebimentoStatusCodigo =
  | 'AGUARDANDO_CONFERENTE'
  | 'EM_CONFERENCIA'
  | 'CONFERIDO'
  | 'DIVERGENCIA'
  | 'FINALIZADO';

export type RecebimentoDocumentoGrade = {
  idDocumento: number;
  numeroDocumentoFiscal: string | null;
  numeroNfe: string | null;
  dataEmissao: string | null;
  dataEntrada: string | null;
  idParceiro: number | null;
  nomeParceiro: string | null;
  idTipoMovimentacao: number;
  tipoMovimentacao: string | null;
  qtdeItens: number;
  qtdeTotal: number;
  valorTotal: number;
  status: RecebimentoStatusCodigo;
  statusLabel: string;
  conferenteUsuarioId: number | null;
  conferenteLogin: string | null;
  conferenteNome: string | null;
  atribuidoEm: string | null;
};

export type RecebimentoDocumentoItem = {
  idItem: number;
  idProduto: number;
  codigoProduto: string | null;
  descricaoProduto: string | null;
  unidadeMedida: string | null;
  qtde: number;
  valorUnitario: number;
  valorTotal: number;
};

export type RecebimentoConferenteOpcao = {
  id: number;
  login: string;
  nome: string | null;
};

export type RecebimentoDetalhe = {
  itens: RecebimentoDocumentoItem[];
  status: RecebimentoStatusCodigo;
  statusLabel: string;
  conferenteUsuarioId: number | null;
  conferenteLogin: string | null;
  conferenteNome: string | null;
  atribuidoEm: string | null;
};

export async function fetchRecebimentoMesaDocumentos(): Promise<{
  documentos: RecebimentoDocumentoGrade[];
  erro?: string;
}> {
  const res = await apiFetch('/api/recebimento/mesa/documentos');
  const body = (await res.json().catch(() => ({}))) as {
    documentos?: RecebimentoDocumentoGrade[];
    error?: string;
    erro?: string;
  };
  if (!res.ok) {
    return {
      documentos: body.documentos ?? [],
      erro: body.error ?? body.erro ?? res.statusText,
    };
  }
  return {
    documentos: body.documentos ?? [],
    erro: body.erro,
  };
}

export async function fetchRecebimentoMesaItens(idDocumento: number): Promise<RecebimentoDetalhe> {
  return apiJson<RecebimentoDetalhe>(`/api/recebimento/mesa/documentos/${idDocumento}/itens`);
}

export async function fetchRecebimentoMesaConferentes(): Promise<RecebimentoConferenteOpcao[]> {
  const r = await apiJson<{ conferentes: RecebimentoConferenteOpcao[] }>(
    '/api/recebimento/mesa/conferentes'
  );
  return r.conferentes ?? [];
}

export async function postRecebimentoMesaDeliberar(params: {
  idDocumento: number;
  conferenteUsuarioId: number;
  numeroDocumento?: string | null;
}): Promise<{
  ok: boolean;
  status: RecebimentoStatusCodigo;
  statusLabel: string;
  conferenteUsuarioId: number | null;
  conferenteLogin: string | null;
  conferenteNome: string | null;
  atribuidoEm: string | null;
  error?: string;
}> {
  const res = await apiFetch(`/api/recebimento/mesa/documentos/${params.idDocumento}/deliberar`, {
    method: 'POST',
    body: {
      conferenteUsuarioId: params.conferenteUsuarioId,
      numeroDocumento: params.numeroDocumento ?? null,
    },
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    status?: RecebimentoStatusCodigo;
    statusLabel?: string;
    conferenteUsuarioId?: number | null;
    conferenteLogin?: string | null;
    conferenteNome?: string | null;
    atribuidoEm?: string | null;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error ?? res.statusText);
  }
  return {
    ok: true,
    status: body.status ?? 'EM_CONFERENCIA',
    statusLabel: body.statusLabel ?? 'Em conferência',
    conferenteUsuarioId: body.conferenteUsuarioId ?? null,
    conferenteLogin: body.conferenteLogin ?? null,
    conferenteNome: body.conferenteNome ?? null,
    atribuidoEm: body.atribuidoEm ?? null,
  };
}
