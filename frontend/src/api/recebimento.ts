import { apiFetch, apiJson } from './client';

export type RecebimentoStatusCodigo =
  | 'AGUARDANDO_CONFERENTE'
  | 'EM_CONFERENCIA'
  | 'CONFERIDO'
  | 'DIVERGENCIA'
  | 'TRATAMENTO_COMPRAS'
  | 'AGUARDANDO_DEVOLUCAO'
  | 'DEVOLUCAO_VINCULADA'
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

export type RecebimentoHistoricoConferenciaItem = {
  idItem: number | null;
  codigoProduto: string | null;
  descricaoProduto: string | null;
  unidadeMedida: string | null;
  qtdeDocumento: number | null;
  qtdeInformada: number;
  tentativas: number;
  conferido: boolean;
};

export type RecebimentoHistoricoConferencia = {
  status: RecebimentoStatusCodigo;
  statusLabel: string;
  retornadoEm: string | null;
  itens: RecebimentoHistoricoConferenciaItem[];
};

export type RecebimentoDetalhe = {
  itens: RecebimentoDocumentoItem[];
  status: RecebimentoStatusCodigo;
  statusLabel: string;
  conferenteUsuarioId: number | null;
  conferenteLogin: string | null;
  conferenteNome: string | null;
  atribuidoEm: string | null;
  mesaUltimaAcao: string | null;
  mesaAcaoEm: string | null;
  mesaAcaoPorLogin: string | null;
  devolucao: RecebimentoDocumentoDevolucao | null;
  historicoConferencia: RecebimentoHistoricoConferencia | null;
};

export type RecebimentoDocumentoDevolucao = {
  idDocumento: number;
  numeroDocumentoFiscal: string | null;
  numeroNfe: string | null;
  vinculadaEm: string | null;
};

export type RecebimentoMesaAcao =
  | 'TRATAMENTO_COMPRAS'
  | 'REENVIAR_CONFERENCIA'
  | 'DEVOLVER_MATERIAL';

export type RecebimentoMesaAcaoResultado = {
  ok: boolean;
  status: RecebimentoStatusCodigo;
  statusLabel: string;
  mesaUltimaAcao: string | null;
  mesaAcaoEm: string | null;
  mesaAcaoPorLogin: string | null;
  conferenteUsuarioId: number | null;
  conferenteLogin: string | null;
  conferenteNome: string | null;
  atribuidoEm: string | null;
  devolucao: RecebimentoDocumentoDevolucao | null;
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

export async function postRecebimentoMesaAcao(params: {
  idDocumento: number;
  acao: RecebimentoMesaAcao;
  conferenteUsuarioId?: number | null;
}): Promise<RecebimentoMesaAcaoResultado> {
  const res = await apiFetch(`/api/recebimento/mesa/documentos/${params.idDocumento}/acao`, {
    method: 'POST',
    body: {
      acao: params.acao,
      conferenteUsuarioId: params.conferenteUsuarioId ?? null,
    },
  });
  const body = (await res.json().catch(() => ({}))) as Partial<RecebimentoMesaAcaoResultado> & {
    error?: string;
  };
  if (!res.ok || !body.status || !body.statusLabel) {
    throw new Error(body.error ?? res.statusText);
  }
  return {
    ok: true,
    status: body.status,
    statusLabel: body.statusLabel,
    mesaUltimaAcao: body.mesaUltimaAcao ?? null,
    mesaAcaoEm: body.mesaAcaoEm ?? null,
    mesaAcaoPorLogin: body.mesaAcaoPorLogin ?? null,
    conferenteUsuarioId: body.conferenteUsuarioId ?? null,
    conferenteLogin: body.conferenteLogin ?? null,
    conferenteNome: body.conferenteNome ?? null,
    atribuidoEm: body.atribuidoEm ?? null,
    devolucao: body.devolucao ?? null,
  };
}

export type RecebimentoPendenciaConferente = {
  idDocumento: number;
  numeroDocumentoFiscal: string | null;
  numeroNfe: string | null;
  dataEmissao: string | null;
  dataEntrada: string | null;
  nomeParceiro: string | null;
  tipoMovimentacao: string | null;
  status: RecebimentoStatusCodigo;
  statusLabel: string;
  atribuidoEm: string | null;
};

export type RecebimentoProdutoConferente = {
  idItem: number;
  idProduto: number;
  codigoProduto: string | null;
  descricaoProduto: string | null;
  unidadeMedida: string | null;
  tentativasUsadas: number;
  tentativasMax: number;
  conferido: boolean;
  qtdeInformada: number | null;
};

export type RecebimentoDigitacaoDetalhe = RecebimentoPendenciaConferente & {
  produtos: RecebimentoProdutoConferente[];
};

export type RecebimentoTentativaResultado = {
  acertou: boolean;
  tentativasUsadas: number;
  tentativasRestantes: number;
  conferido: boolean;
  esgotado: boolean;
  retornouMesa: boolean;
  status: RecebimentoStatusCodigo;
  statusLabel: string;
  produto: RecebimentoProdutoConferente;
};

export async function fetchRecebimentoDigitacaoPendencias(): Promise<{
  pendencias: RecebimentoPendenciaConferente[];
  erro?: string;
}> {
  const res = await apiFetch('/api/recebimento/digitacao/pendencias');
  const body = (await res.json().catch(() => ({}))) as {
    pendencias?: RecebimentoPendenciaConferente[];
    error?: string;
    erro?: string;
  };
  if (!res.ok) {
    return {
      pendencias: body.pendencias ?? [],
      erro: body.error ?? body.erro ?? res.statusText,
    };
  }
  return {
    pendencias: body.pendencias ?? [],
    erro: body.erro,
  };
}

export async function fetchRecebimentoDigitacaoDocumento(
  idDocumento: number
): Promise<RecebimentoDigitacaoDetalhe> {
  return apiJson<RecebimentoDigitacaoDetalhe>(`/api/recebimento/digitacao/documentos/${idDocumento}`);
}

export async function postRecebimentoDigitacaoItem(params: {
  idDocumento: number;
  idItem: number;
  qtde: number;
}): Promise<RecebimentoTentativaResultado> {
  const res = await apiFetch(`/api/recebimento/digitacao/documentos/${params.idDocumento}/itens`, {
    method: 'POST',
    body: { idItem: params.idItem, qtde: params.qtde },
  });
  const body = (await res.json().catch(() => ({}))) as RecebimentoTentativaResultado & {
    error?: string;
  };
  if (!res.ok || !body.produto) {
    throw new Error(body.error ?? res.statusText);
  }
  return {
    acertou: body.acertou === true,
    tentativasUsadas: body.tentativasUsadas ?? 0,
    tentativasRestantes: body.tentativasRestantes ?? 0,
    conferido: body.conferido === true,
    esgotado: body.esgotado === true,
    retornouMesa: body.retornouMesa === true,
    status: body.status ?? 'EM_CONFERENCIA',
    statusLabel: body.statusLabel ?? '',
    produto: body.produto,
  };
}

export async function postRecebimentoDigitacaoDevolver(idDocumento: number): Promise<{
  status: RecebimentoStatusCodigo;
  statusLabel: string;
}> {
  const res = await apiFetch(`/api/recebimento/digitacao/documentos/${idDocumento}/devolver`, {
    method: 'POST',
    body: {},
  });
  const body = (await res.json().catch(() => ({}))) as {
    status?: RecebimentoStatusCodigo;
    statusLabel?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error ?? res.statusText);
  }
  return {
    status: body.status ?? 'CONFERIDO',
    statusLabel: body.statusLabel ?? 'Conferido — aguardando Mesa',
  };
}
