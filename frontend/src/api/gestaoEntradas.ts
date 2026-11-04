import { apiFetch, apiJson } from './client';
import type { RecebimentoHistoricoEnvioDetalhe } from './recebimento';

export type GestaoEntradasPainel = {
  dataInicio: string;
  dataFim: string;
  escopo: 'reais' | 'geral';
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
  porCampo: Array<{
    campo: string;
    label: string;
    qtde: number;
    aceitas: number;
    recusas: number;
    documentos: number;
  }>;
  porJustificativa: Array<{ codigo: string; label: string; qtde: number; documentos: number }>;
  porTipo: Array<{
    idTipoMovimentacao: number;
    nomeTipo: string;
    notas: number;
    itens: number;
    divergencias: number;
  }>;
  compradoresApontados: RankingCompradorGestao[];
  compradoresAceitos: RankingCompradorGestao[];
};

export type RankingCompradorGestao = {
  nomeComprador: string;
  documentos: number;
  pedidos: number;
  ajustados: number;
};

export type MundoCompradorGestao = 'apontada' | 'aceita';

export type GestaoEntradasCompradorLinha = {
  mundo: MundoCompradorGestao;
  nomeComprador: string;
  idDocumento: number;
  dataEntrada: string;
  numeroDocumentoFiscal: string | null;
  numeroNfe: string | null;
  nomeParceiro: string | null;
  idPedidoCompra: number;
  nomePedidoCompra: string;
  campos: string[];
  situacao: 'vinculo_ajustado' | 'aceita';
};

export type GestaoEntradasCompradorDetalhe = {
  mundo: MundoCompradorGestao;
  nomeComprador: string;
  documentos: number;
  pedidos: number;
  ajustados: number;
  linhas: GestaoEntradasCompradorLinha[];
  notas: GestaoEntradasNotaDia[];
};

export async function fetchGestaoEntradasPainel(params: {
  dataInicio: string;
  dataFim: string;
  escopo?: 'reais' | 'geral';
}): Promise<{ data?: GestaoEntradasPainel; erro?: string }> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  sp.set('escopo', params.escopo ?? 'reais');
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
  justificativaCodigo: string | null;
  justificativaLabel: string | null;
  observacaoNatureza?: string | null;
  observacoes: GestaoEntradasObs[];
};

export type GestaoEntradasNotaDia = {
  idDocumento: number;
  dataEntrada: string;
  idTipoMovimentacao: number;
  numeroDocumentoFiscal: string | null;
  numeroNfe: string | null;
  nomeParceiro: string | null;
  itens: number;
  status: 'pendente' | 'limpa' | 'aceita' | 'recusa' | 'nao_aplicada';
  divergeAtual: boolean;
  divergencias: GestaoEntradasDivergencia[];
};

export type GestaoEntradasDia = {
  dataInicio: string;
  dataFim: string;
  escopo: 'reais' | 'geral';
  notas: GestaoEntradasNotaDia[];
};

export async function fetchGestaoEntradasComprador(params: {
  dataInicio: string;
  dataFim: string;
  escopo?: 'reais' | 'geral';
  mundo: MundoCompradorGestao;
  comprador: string;
}): Promise<{ data?: GestaoEntradasCompradorDetalhe; erro?: string }> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  sp.set('escopo', params.escopo ?? 'reais');
  sp.set('mundo', params.mundo);
  sp.set('comprador', params.comprador);
  const res = await apiFetch(`/api/compras/gestao-entradas/comprador?${sp}`);
  const body = (await res.json().catch(() => ({}))) as GestaoEntradasCompradorDetalhe & {
    error?: string;
    erro?: string;
  };
  if (!res.ok) {
    return { erro: body.erro ?? body.error ?? res.statusText };
  }
  return { data: body };
}

export type ResultadoVoltaFisica = 'em_conferencia' | 'conferida' | 'divergencia';

export type VoltaConferenciaFisica = {
  chave: string;
  idDocumentoEstoque: number;
  numeroDocumento: string | null;
  conferenteNome: string | null;
  conferenteLogin: string | null;
  conferente: string;
  atribuidoEm: string;
  atribuidoDia: string;
  finalizadoEm: string | null;
  leadTimeHoras: number | null;
  resultado: ResultadoVoltaFisica;
  voltaNumero: number;
  itens: number;
  itensConferidos: number;
};

export type PainelConferenciaFisica = {
  dataInicio: string;
  dataFim: string;
  kpis: {
    qtdeDestinacoes: number;
    qtdeFinalizadas: number;
    qtdeDivergencias: number;
    taxaDivergencia: number | null;
    qtdePrimeira: number;
    qtdeDivergenciaPrimeira: number;
    qtdeSegunda: number;
    qtdeDivergenciaSegunda: number;
    qtdeDemais: number;
    qtdeDivergenciaDemais: number;
    qtdeEmConferencia: number;
    leadTimeMedioHoras: number | null;
    leadTimeMedianoHoras: number | null;
    leadTimeMedianoPrimeiraHoras: number | null;
    leadTimeMedianoSegundaHoras: number | null;
    qtdeAmostraLeadTime: number;
  };
  serieDiaria: Array<{
    data: string;
    destinacoes: number;
    finalizadas: number;
    divergencias: number;
    leadTimeMedioHoras: number | null;
  }>;
  porConferente: Array<{
    nome: string;
    destinacoes: number;
    finalizadas: number;
    divergencias: number;
    taxaDivergencia: number | null;
    primeira: number;
    divergenciaPrimeira: number;
    segunda: number;
    divergenciaSegunda: number;
    acertosPorChance: Array<{ chance: 1 | 2 | 3; acertos: number }>;
    leadTimeMedianoHoras: number | null;
  }>;
};

export type RecorteConferenciaFisica =
  | {
      tipo:
        | 'destinacoes'
        | 'finalizadas'
        | 'divergencia'
        | 'divergencia_primeira'
        | 'divergencia_segunda'
        | 'sem_divergencia'
        | 'leadtime';
    }
  | { tipo: 'dia'; dia: string }
  | { tipo: 'conferente'; nome: string };

export type DetalheConferenciaFisica = {
  dataInicio: string;
  dataFim: string;
  recorte: RecorteConferenciaFisica['tipo'];
  voltas: VoltaConferenciaFisica[];
};

export async function fetchConferenciaFisicaPainel(params: {
  dataInicio: string;
  dataFim: string;
}): Promise<{ data?: PainelConferenciaFisica; erro?: string }> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  const res = await apiFetch(`/api/compras/gestao-entradas/conferencia-fisica?${sp}`);
  const body = (await res.json().catch(() => ({}))) as PainelConferenciaFisica & {
    error?: string;
    erro?: string;
  };
  if (!res.ok) return { erro: body.erro ?? body.error ?? res.statusText };
  return { data: body };
}

export async function fetchConferenciaFisicaDetalhe(params: {
  dataInicio: string;
  dataFim: string;
  recorte: RecorteConferenciaFisica;
}): Promise<{ data?: DetalheConferenciaFisica; erro?: string }> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  sp.set('recorte', params.recorte.tipo);
  if (params.recorte.tipo === 'dia') sp.set('dia', params.recorte.dia);
  if (params.recorte.tipo === 'conferente') sp.set('conferente', params.recorte.nome);
  const res = await apiFetch(`/api/compras/gestao-entradas/conferencia-fisica/detalhe?${sp}`);
  const body = (await res.json().catch(() => ({}))) as DetalheConferenciaFisica & {
    error?: string;
    erro?: string;
  };
  if (!res.ok) return { erro: body.erro ?? body.error ?? res.statusText };
  return { data: body };
}

export function fetchConferenciaFisicaDocumento(
  idDocumento: number,
): Promise<RecebimentoHistoricoEnvioDetalhe> {
  return apiJson<RecebimentoHistoricoEnvioDetalhe>(
    `/api/compras/gestao-entradas/conferencia-fisica/documento/${idDocumento}`,
  );
}

export async function fetchGestaoEntradasDia(params: {
  dataInicio: string;
  dataFim: string;
  escopo?: 'reais' | 'geral';
}): Promise<{ data?: GestaoEntradasDia; erro?: string }> {
  const sp = new URLSearchParams();
  sp.set('dataInicio', params.dataInicio);
  sp.set('dataFim', params.dataFim);
  sp.set('escopo', params.escopo ?? 'reais');
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
