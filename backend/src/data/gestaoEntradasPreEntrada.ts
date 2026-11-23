/**
 * Gestão entradas — grade das pré-entradas (tipo 173) e da comunicação Otimiza
 * que permanece depois que o documento sai da pré-entrada.
 */

import { RECEBIMENTO_ID_TIPO_PRE_ENTRADA } from './recebimentoNomusRepository.js';
import { regimeConferenciaPorDataEntrada } from '../services/doubleCheckInConferenciaPeriodo.js';

export type SituacaoPreEntrada = 'pre_entrada' | 'efetivada';
export type ConferenciaDoubleCheckPreEntrada = 'pendente' | 'conferida' | 'nao_aplicada';
export type StatusOtimizaPreEntrada = 'in_progress' | 'completed' | 'cancelled' | null;

export type DocPreEntradaBruto = {
  idDocumento: number;
  numeroDocumentoFiscal: string | null;
  numeroNfe: string | null;
  nomeParceiro: string | null;
  dataEmissao: string | null;
  dataEntrada: string | null;
  idTipoMovimentacao: number;
  nomeTipo: string | null;
  /** Usuário do Nomus na última gravação do documento. O Nomus não guarda o criador original. */
  usuarioAlteracao: string | null;
};

export type PedidoPreEntrada = {
  idPedido: number;
  nome: string;
};

export type VinculoPedidoPreEntrada = {
  idDocumento: number;
  idPedido: number;
  nome: string;
};

export type ComunicacaoOtimizaPreEntrada = {
  idDocumentoEstoque: number;
  idItemPedidoCompra: number;
  numero: number;
  status: StatusOtimizaPreEntrada;
};

export type ApontamentoPedidoPreEntrada = {
  idDocumentoEstoque: number;
  idItemPedidoCompra: number;
  idPedidoCompra: number;
  nomePedidoCompra: string;
};

export type ComunicacaoPreEntrada = {
  numero: number;
  status: StatusOtimizaPreEntrada;
};

export type LinhaPreEntrada = {
  idDocumento: number;
  numeroDocumentoFiscal: string | null;
  numeroNfe: string | null;
  nomeParceiro: string | null;
  dataEmissao: string | null;
  dataEntrada: string | null;
  situacao: SituacaoPreEntrada;
  nomeTipo: string | null;
  pedidos: PedidoPreEntrada[];
  conferencia: ConferenciaDoubleCheckPreEntrada;
  /** Nome de quem confirmou a conferência vigente no Double Check. */
  usuarioConferencia: string | null;
  comunicacoes: ComunicacaoPreEntrada[];
  /**
   * Chamados em andamento no Otimiza para o documento.
   * null = a consulta não respondeu; [] = consultou e não há chamado aberto.
   */
  chamadosAbertos: number[] | null;
};

export type GradePreEntrada = {
  dataInicio: string | null;
  dataFim: string | null;
  /** false quando a consulta em lote ao Otimiza não respondeu. A grade segue sem o número. */
  chamadoOtimizaOk: boolean;
  linhas: LinhaPreEntrada[];
};

function nomePedido(idPedido: number, nome: string | null | undefined): string {
  const texto = String(nome ?? '').trim();
  return texto || `Pedido ${idPedido}`;
}

function rankStatus(status: StatusOtimizaPreEntrada): number {
  if (status === 'in_progress') return 3;
  if (status == null) return 2;
  if (status === 'completed') return 1;
  return 0;
}

function noPeriodo(
  dataEntrada: string | null,
  dataInicio: string | null,
  dataFim: string | null,
): boolean {
  if (!dataInicio && !dataFim) return true;
  if (!dataEntrada) return true;
  if (dataInicio && dataEntrada < dataInicio) return false;
  if (dataFim && dataEntrada > dataFim) return false;
  return true;
}

function conferenciaDe(
  dataEntrada: string | null,
  idDocumento: number,
  idsConferidos: ReadonlySet<number>,
): ConferenciaDoubleCheckPreEntrada {
  if (dataEntrada && regimeConferenciaPorDataEntrada(dataEntrada) === 'nao_aplicada') {
    return 'nao_aplicada';
  }
  return idsConferidos.has(idDocumento) ? 'conferida' : 'pendente';
}

function adicionarPedido(map: Map<number, PedidoPreEntrada>, idPedido: number, nome: string | null | undefined) {
  if (idPedido <= 0) return;
  const rotulo = nomePedido(idPedido, nome);
  const atual = map.get(idPedido);
  if (!atual || (atual.nome.startsWith('Pedido ') && !rotulo.startsWith('Pedido '))) {
    map.set(idPedido, { idPedido, nome: rotulo });
  }
}

function pedidosDaLinha(
  idDocumento: number,
  vinculos: VinculoPedidoPreEntrada[],
  comunicacoes: ComunicacaoOtimizaPreEntrada[],
  pedidosPorItem: ReadonlyMap<number, PedidoPreEntrada>,
  apontamentoPorChave: ReadonlyMap<string, ApontamentoPedidoPreEntrada>,
): PedidoPreEntrada[] {
  const map = new Map<number, PedidoPreEntrada>();
  for (const vinculo of vinculos) {
    adicionarPedido(map, vinculo.idPedido, vinculo.nome);
  }
  for (const comunicacao of comunicacoes) {
    const peloItem = pedidosPorItem.get(comunicacao.idItemPedidoCompra);
    if (peloItem) {
      adicionarPedido(map, peloItem.idPedido, peloItem.nome);
      continue;
    }
    const apontado = apontamentoPorChave.get(`${idDocumento}|${comunicacao.idItemPedidoCompra}`);
    if (apontado) adicionarPedido(map, apontado.idPedidoCompra, apontado.nomePedidoCompra);
  }
  return [...map.values()].sort(
    (a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.idPedido - b.idPedido,
  );
}

function comunicacoesDaLinha(comunicacoes: ComunicacaoOtimizaPreEntrada[]): ComunicacaoPreEntrada[] {
  const porNumero = new Map<number, StatusOtimizaPreEntrada>();
  for (const comunicacao of comunicacoes) {
    if (comunicacao.numero <= 0) continue;
    const atual = porNumero.get(comunicacao.numero);
    if (atual === undefined || rankStatus(comunicacao.status) > rankStatus(atual)) {
      porNumero.set(comunicacao.numero, comunicacao.status);
    }
  }
  return [...porNumero.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([numero, status]) => ({ numero, status }));
}

function linhaDe(
  doc: DocPreEntradaBruto,
  situacao: SituacaoPreEntrada,
  params: {
    vinculosPorDoc: ReadonlyMap<number, VinculoPedidoPreEntrada[]>;
    comunicacoesPorDoc: ReadonlyMap<number, ComunicacaoOtimizaPreEntrada[]>;
    pedidosPorItem: ReadonlyMap<number, PedidoPreEntrada>;
    apontamentoPorChave: ReadonlyMap<string, ApontamentoPedidoPreEntrada>;
    idsConferidos: ReadonlySet<number>;
    usuariosConferencia: ReadonlyMap<number, string>;
  },
): LinhaPreEntrada {
  const comunicacoes = params.comunicacoesPorDoc.get(doc.idDocumento) ?? [];
  const conferencia = conferenciaDe(doc.dataEntrada, doc.idDocumento, params.idsConferidos);
  return {
    idDocumento: doc.idDocumento,
    numeroDocumentoFiscal: doc.numeroDocumentoFiscal,
    numeroNfe: doc.numeroNfe,
    nomeParceiro: doc.nomeParceiro,
    dataEmissao: doc.dataEmissao,
    dataEntrada: doc.dataEntrada,
    situacao,
    nomeTipo: doc.nomeTipo,
    usuarioAlteracao: doc.usuarioAlteracao,
    pedidos: pedidosDaLinha(
      doc.idDocumento,
      params.vinculosPorDoc.get(doc.idDocumento) ?? [],
      comunicacoes,
      params.pedidosPorItem,
      params.apontamentoPorChave,
    ),
    conferencia,
    usuarioConferencia:
      conferencia === 'conferida'
        ? (params.usuariosConferencia.get(doc.idDocumento) ?? null)
        : null,
    comunicacoes: comunicacoesDaLinha(comunicacoes),
    chamadosAbertos: null,
  };
}

/** Documento fiscal e NF-e, quando longos o bastante para não casar texto solto. */
export function palavrasChaveChamadoOtimiza(
  linha: Pick<LinhaPreEntrada, 'numeroDocumentoFiscal' | 'numeroNfe'>,
): string[] {
  const chaves: string[] = [];
  const vistos = new Set<string>();
  for (const bruto of [linha.numeroDocumentoFiscal, linha.numeroNfe]) {
    const texto = String(bruto ?? '').trim();
    if (texto.length < 4 || texto.length > 80) continue;
    const chave = texto.toUpperCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    chaves.push(texto);
  }
  return chaves;
}

/**
 * Preenche o chamado aberto com a resposta do Otimiza.
 * mapa null marca a consulta como indisponível e deixa a coluna em branco.
 */
export function aplicarChamadosAbertosOtimiza(
  grade: GradePreEntrada,
  porPalavra: ReadonlyMap<string, number[]> | null,
): GradePreEntrada {
  return {
    ...grade,
    chamadoOtimizaOk: porPalavra != null,
    linhas: grade.linhas.map((linha) => {
      if (porPalavra == null) return { ...linha, chamadosAbertos: null };
      const numeros = new Set<number>();
      for (const palavra of palavrasChaveChamadoOtimiza(linha)) {
        for (const numero of porPalavra.get(palavra.toUpperCase()) ?? []) numeros.add(numero);
      }
      return { ...linha, chamadosAbertos: [...numeros].sort((a, b) => a - b) };
    }),
  };
}

/**
 * Pré-entrada atual entra sempre. Documento que já saiu do tipo 173 permanece
 * quando passou pela Gestão Mesa e tem comunicação do Otimiza gravada.
 */
export function montarGradePreEntradas(params: {
  atuais: DocPreEntradaBruto[];
  demais: DocPreEntradaBruto[];
  idsMesa: ReadonlySet<number>;
  comunicacoes: ComunicacaoOtimizaPreEntrada[];
  vinculos: VinculoPedidoPreEntrada[];
  pedidosPorItem: ReadonlyMap<number, PedidoPreEntrada>;
  apontamentos: ApontamentoPedidoPreEntrada[];
  idsConferidos: ReadonlySet<number>;
  usuariosConferencia?: ReadonlyMap<number, string>;
  dataInicio?: string | null;
  dataFim?: string | null;
}): GradePreEntrada {
  const dataInicio = params.dataInicio ?? null;
  const dataFim = params.dataFim ?? null;
  const atuaisIds = new Set<number>();
  const vinculosPorDoc = new Map<number, VinculoPedidoPreEntrada[]>();
  for (const vinculo of params.vinculos) {
    const lista = vinculosPorDoc.get(vinculo.idDocumento) ?? [];
    lista.push(vinculo);
    vinculosPorDoc.set(vinculo.idDocumento, lista);
  }
  const comunicacoesPorDoc = new Map<number, ComunicacaoOtimizaPreEntrada[]>();
  for (const comunicacao of params.comunicacoes) {
    const lista = comunicacoesPorDoc.get(comunicacao.idDocumentoEstoque) ?? [];
    lista.push(comunicacao);
    comunicacoesPorDoc.set(comunicacao.idDocumentoEstoque, lista);
  }
  const apontamentoPorChave = new Map<string, ApontamentoPedidoPreEntrada>();
  for (const apontamento of params.apontamentos) {
    apontamentoPorChave.set(
      `${apontamento.idDocumentoEstoque}|${apontamento.idItemPedidoCompra}`,
      apontamento,
    );
  }
  const contexto = {
    vinculosPorDoc,
    comunicacoesPorDoc,
    pedidosPorItem: params.pedidosPorItem,
    apontamentoPorChave,
    idsConferidos: params.idsConferidos,
    usuariosConferencia: params.usuariosConferencia ?? new Map(),
  };

  const linhas: LinhaPreEntrada[] = [];
  for (const doc of params.atuais) {
    if (doc.idTipoMovimentacao !== RECEBIMENTO_ID_TIPO_PRE_ENTRADA) continue;
    if (atuaisIds.has(doc.idDocumento)) continue;
    if (!noPeriodo(doc.dataEntrada, dataInicio, dataFim)) continue;
    atuaisIds.add(doc.idDocumento);
    linhas.push(linhaDe(doc, 'pre_entrada', contexto));
  }
  const demaisVistos = new Set<number>();
  for (const doc of params.demais) {
    if (atuaisIds.has(doc.idDocumento) || demaisVistos.has(doc.idDocumento)) continue;
    if (doc.idTipoMovimentacao === RECEBIMENTO_ID_TIPO_PRE_ENTRADA) continue;
    if (!params.idsMesa.has(doc.idDocumento)) continue;
    if ((comunicacoesPorDoc.get(doc.idDocumento) ?? []).length === 0) continue;
    if (!noPeriodo(doc.dataEntrada, dataInicio, dataFim)) continue;
    demaisVistos.add(doc.idDocumento);
    linhas.push(linhaDe(doc, 'efetivada', contexto));
  }

  linhas.sort((a, b) => {
    if (a.situacao !== b.situacao) return a.situacao === 'pre_entrada' ? -1 : 1;
    const dataA = a.dataEntrada ?? '';
    const dataB = b.dataEntrada ?? '';
    if (dataA !== dataB) return dataB.localeCompare(dataA);
    return b.idDocumento - a.idDocumento;
  });

  return { dataInicio, dataFim, chamadoOtimizaOk: false, linhas };
}
