import { describe, expect, it } from 'vitest';
import type { RelatoConferencia } from '../services/doubleCheckInConferenciaRelato.js';
import {
  agregarRankingComprador,
  filtrarLinhasComprador,
  montarLinhasComprador,
  resolverNaturezaAceita,
  type DocCompradorGestao,
} from './gestaoEntradasComprador.js';

function doc(id: number): DocCompradorGestao {
  return {
    idDocumento: id,
    dataEntrada: '2026-10-01',
    numeroDocumentoFiscal: String(id),
    numeroNfe: null,
    nomeParceiro: 'Fornecedor',
  };
}

function relato(parcial: Partial<RelatoConferencia> = {}): RelatoConferencia {
  return {
    numeroNfe: '1',
    numeroDocumentoFiscal: '1',
    nomeParceiro: 'Fornecedor',
    conferidoPor: 'ana',
    conferidoEm: null,
    totalProdutos: 1,
    totalDivergencias: 1,
    totalDivergenciasReais: 1,
    totalDivergenciasBenignas: 0,
    aceitas: 1,
    recusadas: 0,
    pagamentoComum: null,
    produtos: [
      {
        codigo: 'ABC',
        pedido: 'PC 10',
        campos: [
          {
            campo: 'qtde',
            natureza: 'real',
            titulo: 'Quantidade',
            nf: '2',
            pc: '1',
            diferenca: '+1',
            sinal: 'pos',
            decisao: 'aceita',
            justificativa: 'Acordo',
            observacao: null,
            detalhe: null,
            descontoWhatsApp: null,
          },
        ],
      },
    ],
    ...parcial,
  };
}

describe('resolverNaturezaAceita', () => {
  it('prefere a divergência que ainda está no vínculo', () => {
    expect(
      resolverNaturezaAceita({
        campo: 'qtde',
        nomePedido: 'PC 10',
        naturezaAtual: 'benigna',
        relato: relato(),
        divergenciaRealHistorica: true,
      })
    ).toBe('benigna');
  });

  it('usa o retrato da conferência quando o vínculo já foi corrigido', () => {
    expect(
      resolverNaturezaAceita({
        campo: 'qtde',
        nomePedido: 'PC 10',
        naturezaAtual: null,
        relato: relato(),
        divergenciaRealHistorica: false,
      })
    ).toBe('real');
  });

  it('cai na marca histórica quando não há retrato do campo', () => {
    expect(
      resolverNaturezaAceita({
        campo: 'ipi',
        nomePedido: 'PC 10',
        naturezaAtual: null,
        relato: null,
        divergenciaRealHistorica: true,
      })
    ).toBe('real');
  });
});

describe('montarLinhasComprador', () => {
  const docs = [doc(1), doc(2)];

  it('separa apontada de aceita e marca o vínculo que deixou de divergir', () => {
    const linhas = montarLinhasComprador({
      escopo: 'reais',
      docs,
      snapshots: [
        {
          idDocumentoEstoque: 1,
          idItemDocumentoEstoque: 11,
          idItemPedidoCompra: 21,
          idPedidoCompra: 10,
          nomePedidoCompra: 'PC 10',
          nomeComprador: 'Ana',
          campo: 'qtde',
          natureza: 'real',
        },
        {
          idDocumentoEstoque: 2,
          idItemDocumentoEstoque: 12,
          idItemPedidoCompra: 22,
          idPedidoCompra: 20,
          nomePedidoCompra: 'PC 20',
          nomeComprador: 'Ana',
          campo: 'qtde',
          natureza: 'real',
        },
        {
          idDocumentoEstoque: 2,
          idItemDocumentoEstoque: 12,
          idItemPedidoCompra: 22,
          idPedidoCompra: 20,
          nomePedidoCompra: 'PC 20',
          nomeComprador: 'Ana',
          campo: 'valor_unitario',
          natureza: 'benigna',
        },
      ],
      aceites: [
        {
          idDocumentoEstoque: 1,
          idItemDocumentoEstoque: 11,
          idItemPedidoCompra: 21,
          idPedidoCompra: 10,
          nomePedidoCompra: 'PC 10',
          nomeComprador: 'Ana',
          campo: 'qtde',
          natureza: 'real',
        },
      ],
      chavesAtuais: new Map([[2, new Set(['12:22:qtde'])]]),
      chavesAceitas: new Set(['1:11:21:qtde']),
    });

    const apontadas = filtrarLinhasComprador(linhas, 'apontada', 'Ana');
    const aceitas = filtrarLinhasComprador(linhas, 'aceita', 'Ana');
    expect(apontadas).toHaveLength(1);
    expect(apontadas[0]).toMatchObject({
      idDocumento: 2,
      situacao: 'ainda_divergente',
      campos: ['Quantidade'],
    });
    expect(aceitas).toHaveLength(1);
    expect(aceitas[0]).toMatchObject({ idDocumento: 1, situacao: 'aceita', campos: ['Quantidade'] });
  });

  it('conta a nota ajustada uma vez, mesmo com dois pedidos', () => {
    const linhas = montarLinhasComprador({
      escopo: 'reais',
      docs,
      snapshots: [
        {
          idDocumentoEstoque: 1,
          idItemDocumentoEstoque: 11,
          idItemPedidoCompra: 21,
          idPedidoCompra: 10,
          nomePedidoCompra: 'PC 10',
          nomeComprador: 'Bia',
          campo: 'qtde',
          natureza: 'real',
        },
        {
          idDocumentoEstoque: 1,
          idItemDocumentoEstoque: 13,
          idItemPedidoCompra: 23,
          idPedidoCompra: 30,
          nomePedidoCompra: 'PC 30',
          nomeComprador: 'Bia',
          campo: 'ipi',
          natureza: 'real',
        },
      ],
      aceites: [],
      chavesAtuais: new Map(),
      chavesAceitas: new Set(),
    });
    const ranking = agregarRankingComprador(filtrarLinhasComprador(linhas, 'apontada', 'Bia'));
    expect(ranking).toEqual([
      { nomeComprador: 'Bia', documentos: 1, pedidos: 2, ajustados: 1 },
    ]);
  });

  it('não marca ajustada a nota que ainda tem um pedido divergente', () => {
    const linhas = montarLinhasComprador({
      escopo: 'geral',
      docs: [doc(1)],
      snapshots: [
        {
          idDocumentoEstoque: 1,
          idItemDocumentoEstoque: 11,
          idItemPedidoCompra: 21,
          idPedidoCompra: 10,
          nomePedidoCompra: 'PC 10',
          nomeComprador: 'Bia',
          campo: 'qtde',
          natureza: 'real',
        },
        {
          idDocumentoEstoque: 1,
          idItemDocumentoEstoque: 13,
          idItemPedidoCompra: 23,
          idPedidoCompra: 30,
          nomePedidoCompra: 'PC 30',
          nomeComprador: 'Bia',
          campo: 'valor_unitario',
          natureza: 'benigna',
        },
      ],
      aceites: [],
      chavesAtuais: new Map([[1, new Set(['11:21:qtde'])]]),
      chavesAceitas: new Set(),
    });
    expect(agregarRankingComprador(linhas)[0]?.ajustados).toBe(0);
  });
});
