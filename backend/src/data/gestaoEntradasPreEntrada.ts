/**
 * Gestão entradas — grade das pré-entradas que ainda estão no Nomus (tipo 173)
 * e da comunicação do Otimiza em andamento gravada nelas.
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
  /** Só comunicação gravada que ainda está em andamento. Concluída e cancelada ficam de fora. */
  comunicacoes: ComunicacaoPreEntrada[];
};

export type GradePreEntrada = {
  dataInicio: string | null;
  dataFim: string | null;
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

export function preEntradaNoPeriodo(
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
    .map(([numero, status]) => ({ numero, status }))
    .filter((item) => item.status === 'in_progress');
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
  };
}

/** Só entra documento que ainda está como pré-entrada (tipo 173). */
export function montarGradePreEntradas(params: {
  atuais: DocPreEntradaBruto[];
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
    if (!preEntradaNoPeriodo(doc.dataEntrada, dataInicio, dataFim)) continue;
    atuaisIds.add(doc.idDocumento);
    linhas.push(linhaDe(doc, 'pre_entrada', contexto));
  }

  linhas.sort((a, b) => {
    const dataA = a.dataEntrada ?? '';
    const dataB = b.dataEntrada ?? '';
    if (dataA !== dataB) return dataB.localeCompare(dataA);
    return b.idDocumento - a.idDocumento;
  });

  return { dataInicio, dataFim, linhas };
}

export const NOME_SEM_PEDIDO_PRE_ENTRADA = 'Sem pedido vinculado';
export const NOME_SEM_FORNECEDOR_PRE_ENTRADA = 'Sem fornecedor';

export type ItemImpressaoPreEntradaBruto = {
  idDocumento: number;
  idItem: number;
  codigo: string | null;
  descricao: string | null;
  unidade: string | null;
  qtde: number;
  idPedido: number;
  nomePedido: string | null;
  /** Data de entrega do item do pedido de compra. Null sem pedido. */
  dataEntrega: string | null;
};

export type MaterialImpressaoPreEntrada = {
  idDocumento: number;
  idItem: number;
  codigo: string | null;
  descricao: string | null;
  unidade: string | null;
  /** null quando o documento não tem item. */
  qtde: number | null;
  /** Data de entrega do item no pedido. Null quando não há pedido. */
  dataEntrega: string | null;
  numeroDocumento: string;
  numeroNfe: string | null;
  dataEntrada: string | null;
};

export type PedidoImpressaoPreEntrada = {
  idPedido: number;
  nome: string;
  materiais: MaterialImpressaoPreEntrada[];
};

export type FornecedorImpressaoPreEntrada = {
  nome: string;
  pedidos: PedidoImpressaoPreEntrada[];
};

export type ImpressaoPreEntrada = {
  dataInicio: string | null;
  dataFim: string | null;
  fornecedores: FornecedorImpressaoPreEntrada[];
};

function rotuloDocumento(doc: Pick<DocPreEntradaBruto, 'idDocumento' | 'numeroDocumentoFiscal' | 'numeroNfe'>): string {
  return doc.numeroDocumentoFiscal?.trim() || doc.numeroNfe?.trim() || `Documento ${doc.idDocumento}`;
}

function nomeFornecedorImpressao(nome: string | null): string {
  const texto = String(nome ?? '').replace(/\s+/g, ' ').trim();
  return texto || NOME_SEM_FORNECEDOR_PRE_ENTRADA;
}

/** Mesmo fornecedor com diferença só de maiúscula, acento ou espaço entra no mesmo grupo. */
function chaveFornecedorImpressao(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function nomePedidoImpressao(idPedido: number, nome: string | null): string {
  if (idPedido <= 0) return NOME_SEM_PEDIDO_PRE_ENTRADA;
  const texto = String(nome ?? '').trim();
  return texto || `Pedido ${idPedido}`;
}

function dataEntregaMaisCedo(atual: string | null, nova: string | null): string | null {
  if (!atual) return nova;
  if (!nova) return atual;
  return atual <= nova ? atual : nova;
}

function compararComUltimo(a: string, b: string, ultimo: string): number {
  if (a === ultimo && b !== ultimo) return 1;
  if (b === ultimo && a !== ultimo) return -1;
  return a.localeCompare(b, 'pt-BR');
}

/**
 * Relação para impressão: fornecedor, depois pedido, depois material,
 * sempre com o documento de entrada da pré-entrada.
 */
export function montarImpressaoPreEntradas(params: {
  documentos: DocPreEntradaBruto[];
  itens: ItemImpressaoPreEntradaBruto[];
  dataInicio?: string | null;
  dataFim?: string | null;
}): ImpressaoPreEntrada {
  const dataInicio = params.dataInicio ?? null;
  const dataFim = params.dataFim ?? null;
  const itensPorDoc = new Map<number, ItemImpressaoPreEntradaBruto[]>();
  for (const item of params.itens) {
    if (item.idDocumento <= 0 || item.idItem <= 0) continue;
    const lista = itensPorDoc.get(item.idDocumento) ?? [];
    lista.push(item);
    itensPorDoc.set(item.idDocumento, lista);
  }

  const porFornecedor = new Map<
    string,
    { nome: string; pedidos: Map<number, { nome: string; materiais: Map<number, MaterialImpressaoPreEntrada> }> }
  >();
  const garantirPedido = (fornecedor: string, idPedido: number, nome: string) => {
    const chave = chaveFornecedorImpressao(fornecedor);
    let grupo = porFornecedor.get(chave);
    if (!grupo) {
      grupo = { nome: fornecedor, pedidos: new Map() };
      porFornecedor.set(chave, grupo);
    }
    let pedido = grupo.pedidos.get(idPedido);
    if (!pedido) {
      pedido = { nome, materiais: new Map() };
      grupo.pedidos.set(idPedido, pedido);
    } else if (idPedido > 0 && pedido.nome.startsWith('Pedido ') && !nome.startsWith('Pedido ')) {
      pedido.nome = nome;
    }
    return pedido;
  };

  const vistos = new Set<number>();
  for (const doc of params.documentos) {
    if (doc.idTipoMovimentacao !== RECEBIMENTO_ID_TIPO_PRE_ENTRADA) continue;
    if (doc.idDocumento <= 0 || vistos.has(doc.idDocumento)) continue;
    if (!preEntradaNoPeriodo(doc.dataEntrada, dataInicio, dataFim)) continue;
    vistos.add(doc.idDocumento);
    const fornecedor = nomeFornecedorImpressao(doc.nomeParceiro);
    const materialBase = {
      idDocumento: doc.idDocumento,
      numeroDocumento: rotuloDocumento(doc),
      numeroNfe: doc.numeroNfe,
      dataEntrada: doc.dataEntrada,
    };
    const itens = itensPorDoc.get(doc.idDocumento) ?? [];
    if (itens.length === 0) {
      garantirPedido(fornecedor, 0, NOME_SEM_PEDIDO_PRE_ENTRADA).materiais.set(-doc.idDocumento, {
        idItem: 0,
        codigo: null,
        descricao: null,
        unidade: null,
        qtde: null,
        dataEntrega: null,
        ...materialBase,
      });
      continue;
    }
    const porItem = new Map<number, ItemImpressaoPreEntradaBruto[]>();
    for (const item of itens) {
      const lista = porItem.get(item.idItem) ?? [];
      lista.push(item);
      porItem.set(item.idItem, lista);
    }
    for (const lista of porItem.values()) {
      const comPedido = lista.filter((item) => item.idPedido > 0);
      const usar = comPedido.length > 0 ? comPedido : lista;
      const pedidosDoItem = new Set<number>();
      for (const item of usar) {
        const idPedido = item.idPedido > 0 ? item.idPedido : 0;
        const dataEntrega = idPedido > 0 ? (item.dataEntrega ?? null) : null;
        const pedido = garantirPedido(fornecedor, idPedido, nomePedidoImpressao(idPedido, item.nomePedido));
        if (pedidosDoItem.has(idPedido)) {
          const gravado = pedido.materiais.get(item.idItem);
          if (gravado) gravado.dataEntrega = dataEntregaMaisCedo(gravado.dataEntrega, dataEntrega);
          continue;
        }
        pedidosDoItem.add(idPedido);
        pedido.materiais.set(item.idItem, {
          idItem: item.idItem,
          codigo: item.codigo,
          descricao: item.descricao,
          unidade: item.unidade,
          qtde: item.qtde,
          dataEntrega,
          ...materialBase,
        });
      }
    }
  }

  const fornecedores = [...porFornecedor.values()]
    .sort((a, b) => compararComUltimo(a.nome, b.nome, NOME_SEM_FORNECEDOR_PRE_ENTRADA))
    .map((grupo) => ({
      nome: grupo.nome,
      pedidos: [...grupo.pedidos.entries()]
        .sort((a, b) => compararComUltimo(a[1].nome, b[1].nome, NOME_SEM_PEDIDO_PRE_ENTRADA))
        .map(([idPedido, pedido]) => ({
          idPedido,
          nome: pedido.nome,
          materiais: [...pedido.materiais.values()].sort(
            (a, b) =>
              a.numeroDocumento.localeCompare(b.numeroDocumento, 'pt-BR') ||
              (a.codigo ?? '').localeCompare(b.codigo ?? '', 'pt-BR') ||
              a.idItem - b.idItem,
          ),
        })),
    }));

  return { dataInicio, dataFim, fornecedores };
}
