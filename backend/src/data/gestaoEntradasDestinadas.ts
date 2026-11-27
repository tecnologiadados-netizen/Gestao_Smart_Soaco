/**
 * Gestão entradas — situação de cada NF destinada à Só Aço.
 * A grade nasce da nota destinada. Documento, Otimiza, Double Check e Mesa
 * entram em cima dela, com a mesma regra nos cards e nas linhas.
 */

import { regimeConferenciaPorDataEntrada } from '../services/doubleCheckInConferenciaPeriodo.js';
import { RECEBIMENTO_ID_TIPO_PRE_ENTRADA } from './recebimentoNomusRepository.js';

export const DESTINADAS_PERIODO_MAX_DIAS = 62;

export const DESTINADAS_TIPOS_EFETIVOS = [11, 35, 111, 112, 113, 114, 115, 116] as const;

const TIPOS_EFETIVOS = new Set<number>(DESTINADAS_TIPOS_EFETIVOS);

export const SITUACOES_DESTINADA = [
  'aguardando_confirmacao',
  'em_confirmacao',
  'confirmada_sem_documento',
  'nao_e_compra',
  'pre_entrada_pendente',
  'divergencia_responsavel',
  'aguardando_mesa',
  'em_conferencia_fisica',
  'documento_lancado',
] as const;

export type SituacaoDestinada = (typeof SITUACOES_DESTINADA)[number];

export type StatusChamadoDestinada = 'in_progress' | 'completed' | 'cancelled' | null;

export type ChamadoDestinada = {
  numero: number;
  status: StatusChamadoDestinada;
  responsavel: string | null;
  processo: string | null;
};

export type ConferenciaDoubleCheckDestinada = 'sem_documento' | 'pendente' | 'conferida' | 'nao_aplicada';

export type ConferenciaFisicaDestinada =
  | 'sem_registro'
  | 'aguardando_double_check'
  | 'aguardando_conferente'
  | 'em_conferencia'
  | 'divergencia'
  | 'tratamento_compras'
  | 'aguardando_devolucao'
  | 'devolucao_vinculada'
  | 'aguardando_movimentacao'
  | 'finalizada'
  | 'cancelada';

const FISICA_EM_ANDAMENTO = new Set<ConferenciaFisicaDestinada>([
  'aguardando_conferente',
  'em_conferencia',
  'divergencia',
  'tratamento_compras',
  'aguardando_devolucao',
  'devolucao_vinculada',
]);

export type DocDestinadaOrigem = {
  idDocumento: number | null;
  numeroDocumentoFiscal: string | null;
  idTipoMovimentacao: number | null;
  nomeTipo: string | null;
  dataEntrada: string | null;
  idParceiro: number | null;
};

export type DocDestinadaEfetivado = {
  idDocumento: number;
  numeroDocumentoFiscal: string | null;
  idTipoMovimentacao: number;
  nomeTipo: string | null;
  dataEntrada: string | null;
  idParceiro: number | null;
};

export type DocumentoExibidoDestinada = DocDestinadaOrigem & {
  efetivado: boolean;
};

export type PedidoDestinada = {
  idPedido: number;
  nome: string;
};

export type LinhaDestinada = {
  idDestinada: number;
  numero: string;
  serie: string | null;
  nomeFornecedor: string | null;
  dataEmissao: string | null;
  valor: number | null;
  statusNomus: number | null;
  manifestacao: number | null;
  finalidade: number | null;
  idDocumento: number | null;
  numeroDocumento: string | null;
  idTipoMovimentacao: number | null;
  nomeTipo: string | null;
  dataEntrada: string | null;
  pedidos: PedidoDestinada[];
  conferencia: ConferenciaDoubleCheckDestinada;
  conferidoPor: string | null;
  fisica: ConferenciaFisicaDestinada;
  chamados: ChamadoDestinada[];
  situacao: SituacaoDestinada;
};

export type GradeDestinadas = {
  dataInicio: string;
  dataFim: string;
  otimizaIndisponivel: boolean;
  linhas: LinhaDestinada[];
};

export function erroPeriodoDestinadas(dataInicio: string, dataFim: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(dataFim)) {
    return 'Informe dataInicio e dataFim (YYYY-MM-DD).';
  }
  if (dataFim < dataInicio) return 'dataFim deve ser >= dataInicio.';
  const inicio = Date.parse(`${dataInicio}T00:00:00Z`);
  const fim = Date.parse(`${dataFim}T00:00:00Z`);
  const dias = Math.round((fim - inicio) / 86_400_000) + 1;
  if (dias > DESTINADAS_PERIODO_MAX_DIAS) {
    return `O período pode ter no máximo ${DESTINADAS_PERIODO_MAX_DIAS} dias.`;
  }
  return null;
}

export function palavrasDaNota(numeroNf: string | null, numerosDocumento: Array<string | null>): string[] {
  const saida: string[] = [];
  const vistos = new Set<string>();
  for (const bruto of [numeroNf, ...numerosDocumento]) {
    const texto = String(bruto ?? '').trim();
    if (texto.length < 4 || texto.length > 80) continue;
    const chave = texto.toUpperCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push(texto);
  }
  return saida;
}

/**
 * Chamado que a busca encontra em mais de um número do período cita várias notas.
 * Ele não entra como "criado com o nome" de nenhuma delas.
 */
export function chamadosExclusivosPorPalavra<T extends { numero: number }>(
  mapa: Map<string, T[]>
): Map<string, T[]> {
  const palavrasDoNumero = new Map<number, Set<string>>();
  for (const [palavra, lista] of mapa) {
    for (const chamado of lista) {
      const palavras = palavrasDoNumero.get(chamado.numero) ?? new Set<string>();
      palavras.add(palavra);
      palavrasDoNumero.set(chamado.numero, palavras);
    }
  }
  const saida = new Map<string, T[]>();
  for (const [palavra, lista] of mapa) {
    const exclusivos: T[] = [];
    const vistos = new Set<number>();
    for (const chamado of lista) {
      if (vistos.has(chamado.numero)) continue;
      vistos.add(chamado.numero);
      if ((palavrasDoNumero.get(chamado.numero)?.size ?? 0) === 1) exclusivos.push(chamado);
    }
    saida.set(palavra, exclusivos);
  }
  return saida;
}

function rankStatus(status: StatusChamadoDestinada): number {
  if (status === 'in_progress') return 0;
  if (status == null) return 1;
  if (status === 'completed') return 2;
  return 3;
}

export function fundirChamadosDestinada(
  porNome: ChamadoDestinada[],
  gravados: ChamadoDestinada[]
): ChamadoDestinada[] {
  const porNumero = new Map<number, ChamadoDestinada>();
  for (const chamado of porNome) {
    if (chamado.numero <= 0) continue;
    porNumero.set(chamado.numero, { ...chamado });
  }
  for (const gravado of gravados) {
    if (gravado.numero <= 0) continue;
    const atual = porNumero.get(gravado.numero);
    if (!atual) {
      porNumero.set(gravado.numero, { ...gravado });
      continue;
    }
    if (atual.status == null && gravado.status != null) atual.status = gravado.status;
    if (!atual.responsavel && gravado.responsavel) atual.responsavel = gravado.responsavel;
    if (!atual.processo && gravado.processo) atual.processo = gravado.processo;
  }
  return [...porNumero.values()].sort(
    (a, b) => rankStatus(a.status) - rankStatus(b.status) || a.numero - b.numero
  );
}

export function documentoExibidoDestinada(
  origem: DocDestinadaOrigem,
  irmao: DocDestinadaEfetivado | null
): DocumentoExibidoDestinada {
  if (irmao && irmao.idDocumento > 0 && TIPOS_EFETIVOS.has(irmao.idTipoMovimentacao)) {
    return { ...irmao, efetivado: true };
  }
  const idTipo = origem.idTipoMovimentacao;
  const efetivado =
    origem.idDocumento != null &&
    origem.idDocumento > 0 &&
    idTipo != null &&
    idTipo !== RECEBIMENTO_ID_TIPO_PRE_ENTRADA;
  return { ...origem, efetivado };
}

export function conferenciaDoubleCheckDestinada(params: {
  idDocumento: number | null;
  dataEntrada: string | null;
  conferido: boolean;
}): ConferenciaDoubleCheckDestinada {
  if (params.idDocumento == null || params.idDocumento <= 0) return 'sem_documento';
  if (params.dataEntrada && regimeConferenciaPorDataEntrada(params.dataEntrada) === 'nao_aplicada') {
    return 'nao_aplicada';
  }
  return params.conferido ? 'conferida' : 'pendente';
}

export function fisicaDeStatus(status: string | null | undefined): ConferenciaFisicaDestinada {
  switch (status) {
    case 'AGUARDANDO_DOUBLE_CHECK':
      return 'aguardando_double_check';
    case 'AGUARDANDO_CONFERENTE':
      return 'aguardando_conferente';
    case 'EM_CONFERENCIA':
      return 'em_conferencia';
    case 'DIVERGENCIA':
      return 'divergencia';
    case 'TRATAMENTO_COMPRAS':
      return 'tratamento_compras';
    case 'AGUARDANDO_DEVOLUCAO':
      return 'aguardando_devolucao';
    case 'DEVOLUCAO_VINCULADA':
      return 'devolucao_vinculada';
    case 'CONFERIDO':
      return 'aguardando_movimentacao';
    case 'FINALIZADO':
      return 'finalizada';
    case 'CANCELADO':
      return 'cancelada';
    default:
      return 'sem_registro';
  }
}

export function preferirFisicaDestinada(
  origem: ConferenciaFisicaDestinada,
  atual: ConferenciaFisicaDestinada
): ConferenciaFisicaDestinada {
  if (origem !== 'sem_registro' && origem !== 'cancelada') return origem;
  if (atual !== 'sem_registro') return atual;
  return origem;
}

function chamadoEmAndamento(chamado: ChamadoDestinada): boolean {
  return chamado.status === 'in_progress' || chamado.status == null;
}

export function situacaoNotaDestinada(params: {
  idDocumento: number | null;
  efetivado: boolean;
  conferencia: ConferenciaDoubleCheckDestinada;
  fisica: ConferenciaFisicaDestinada;
  manifestacao: number | null;
  chamados: ChamadoDestinada[];
}): SituacaoDestinada {
  if (params.efetivado) return 'documento_lancado';
  if (params.idDocumento != null && params.idDocumento > 0) {
    if (FISICA_EM_ANDAMENTO.has(params.fisica)) return 'em_conferencia_fisica';
    if (params.fisica === 'aguardando_movimentacao' || params.fisica === 'finalizada') {
      return 'aguardando_mesa';
    }
    if (params.conferencia === 'conferida') return 'aguardando_mesa';
    if (params.chamados.some(chamadoEmAndamento)) return 'divergencia_responsavel';
    return 'pre_entrada_pendente';
  }
  if (params.manifestacao === 3 || params.manifestacao === 4) return 'nao_e_compra';
  if (params.chamados.some(chamadoEmAndamento)) return 'em_confirmacao';
  if (params.chamados.some((chamado) => chamado.status === 'completed')) return 'confirmada_sem_documento';
  if (params.chamados.some((chamado) => chamado.status === 'cancelled')) return 'nao_e_compra';
  return 'aguardando_confirmacao';
}

export function montarLinhaDestinada(params: {
  idDestinada: number;
  numero: string;
  serie: string | null;
  nomeFornecedor: string | null;
  dataEmissao: string | null;
  valor: number | null;
  statusNomus: number | null;
  manifestacao: number | null;
  finalidade: number | null;
  origem: DocDestinadaOrigem;
  irmao: DocDestinadaEfetivado | null;
  pedidosOrigem: PedidoDestinada[];
  pedidosAtual: PedidoDestinada[];
  conferido: boolean;
  conferidoPor: string | null;
  fisica: ConferenciaFisicaDestinada;
  chamados: ChamadoDestinada[];
}): LinhaDestinada {
  const exibido = documentoExibidoDestinada(params.origem, params.irmao);
  const conferencia = conferenciaDoubleCheckDestinada({
    idDocumento: exibido.idDocumento,
    dataEntrada: exibido.dataEntrada,
    conferido: params.conferido,
  });
  const pedidos =
    params.pedidosAtual.length > 0 ? params.pedidosAtual : params.pedidosOrigem;
  const chamados = fundirChamadosDestinada(params.chamados, []);
  return {
    idDestinada: params.idDestinada,
    numero: params.numero,
    serie: params.serie,
    nomeFornecedor: params.nomeFornecedor,
    dataEmissao: params.dataEmissao,
    valor: params.valor,
    statusNomus: params.statusNomus,
    manifestacao: params.manifestacao,
    finalidade: params.finalidade,
    idDocumento: exibido.idDocumento,
    numeroDocumento: exibido.numeroDocumentoFiscal,
    idTipoMovimentacao: exibido.idTipoMovimentacao,
    nomeTipo: exibido.nomeTipo,
    dataEntrada: exibido.dataEntrada,
    pedidos,
    conferencia,
    conferidoPor: params.conferido ? params.conferidoPor : null,
    fisica: params.fisica,
    chamados,
    situacao: situacaoNotaDestinada({
      idDocumento: exibido.idDocumento,
      efetivado: exibido.efetivado,
      conferencia,
      fisica: params.fisica,
      manifestacao: params.manifestacao,
      chamados,
    }),
  };
}
