import { apiFetch } from './client';

export type GestaoEntradasPainel = {
  dataInicio: string;
  dataFim: string;
  kpis: {
    qtdeNotas: number;
    qtdeItens: number;
    qtdeConferidas: number;
    qtdePendentes: number;
    qtdeLimpas: number;
    qtdeAceitas: number;
    qtdeRecusas: number;
    pctLimpas: number | null;
    qtdeDecisoesAceitas: number;
    qtdeDecisoesRecusas: number;
    mediaNotasPorDia: number | null;
  };
  serieDiaria: Array<{
    data: string;
    notas: number;
    itens: number;
    limpas: number;
    aceitas: number;
    recusas: number;
    pendentes: number;
  }>;
  porCampo: Array<{ campo: string; label: string; qtde: number; aceitas: number; recusas: number }>;
  porJustificativa: Array<{ codigo: string; label: string; qtde: number }>;
  porTipo: Array<{
    idTipoMovimentacao: number;
    nomeTipo: string;
    notas: number;
    itens: number;
    divergencias: number;
  }>;
};

export async function fetchGestaoEntradasPainel(params: {
  dataInicio: string;
  dataFim: string;
}): Promise<{ data?: GestaoEntradasPainel; erro?: string }> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  const res = await apiFetch(`/api/compras/gestao-entradas?${sp}`);
  const body = (await res.json().catch(() => ({}))) as GestaoEntradasPainel & {
    error?: string;
    erro?: string;
  };
  if (!res.ok) {
    return { erro: body.erro ?? body.error ?? res.statusText };
  }
  return { data: body };
}

export type GestaoEntradasObs = {
  texto: string;
  usuarioLogin: string;
  criadoEm: string;
};

export type GestaoEntradasDivergencia = {
  codigoProduto: string | null;
  descricaoProduto: string | null;
  nomePedidoCompra: string | null;
  campo: string;
  campoLabel: string;
  natureza: 'benigna' | 'real';
  valorNf: string;
  valorPc: string;
  detalheNf: string | null;
  detalhePc: string | null;
  decisao: 'aceita' | 'recusa' | null;
  justificativaLabel: string | null;
  observacoes: GestaoEntradasObs[];
};

export type GestaoEntradasNotaDia = {
  idDocumento: number;
  numeroDocumentoFiscal: string | null;
  numeroNfe: string | null;
  nomeParceiro: string | null;
  itens: number;
  status: 'pendente' | 'limpa' | 'aceita' | 'recusa';
  divergencias: GestaoEntradasDivergencia[];
};

export type GestaoEntradasDia = {
  dataInicio: string;
  dataFim: string;
  notas: GestaoEntradasNotaDia[];
};

export async function fetchGestaoEntradasDia(params: {
  dataInicio: string;
  dataFim: string;
}): Promise<{ data?: GestaoEntradasDia; erro?: string }> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  const res = await apiFetch(`/api/compras/gestao-entradas/detalhe?${sp}`);
  const body = (await res.json().catch(() => ({}))) as GestaoEntradasDia & {
    error?: string;
    erro?: string;
  };
  if (!res.ok) {
    return { erro: body.erro ?? body.error ?? res.statusText };
  }
  return { data: body };
}
