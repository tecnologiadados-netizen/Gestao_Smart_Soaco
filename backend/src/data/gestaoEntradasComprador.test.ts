import { describe, expect, it } from 'vitest';
import type { RelatoConferencia } from '../services/doubleCheckInConferenciaRelato.js';
import {
  agregarRankingComprador,
  filtrarLinhasComprador,
  montarLinhasComprador,
  resolverNaturezaAceita,
  type AceiteCompradorOrigem,
  type DocCompradorGestao,
  type SnapshotDivergenciaApontada,
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

function snap(
  idDocumento: number,
  idItem: number,
  idPedido: number,
  nomeComprador: string,
  campo: string,
  natureza: 'real' | 'benigna' = 'real'
): SnapshotDivergenciaApontada {
  return {
    idDocumentoEstoque: idDocumento,
    idItemDocumentoEstoque: idItem,
    idItemPedidoCompra: idItem + 10,
    idPedidoCompra: idPedido,
    nomePedidoCompra: `PC ${idPedido}`,
    nomeComprador,
    campo,
    natureza,
  };
}

function aceite(
  idDocumento: number,
  idItem: number,
  idPedido: number,
  nomeComprador: string,
  campo: string
): AceiteCompradorOrigem {
  return { ...snap(idDocumento, idItem, idPedido, nomeComprador, campo), natureza: 'real' };
}

describe('montarLinhasComprador', () => {
  const docs = [doc(1), doc(2), doc(3)];

  it('aceita traz só a nota conferida que ainda diverge no campo aceito', () => {
    const linhas = montarLinhasComprador({
      escopo: 'reais',
      docs,
      snapshots: [],
      aceites: [aceite(1, 11, 10, 'Ana', 'qtde'), aceite(2, 12, 20, 'Ana', 'qtde'), aceite(3, 13, 30, 'Ana', 'qtde')],
      chavesAtuais: new Map([
        [1, new Set(['11:21:qtde'])],
        [3, new Set(['13:23:qtde'])],
      ]),
      idsDivergeAgora: new Set([1, 3]),
      idsConferidasDivergentes: new Set([1]),
    });
    const aceitas = filtrarLinhasComprador(linhas, 'aceita', 'Ana');
    expect(aceitas.map((linha) => linha.idDocumento)).toEqual([1]);
    expect(aceitas[0]).toMatchObject({ situacao: 'aceita', campos: ['Quantidade'] });
    const apontadas = filtrarLinhasComprador(linhas, 'apontada', 'Ana');
    expect(apontadas.map((linha) => linha.idDocumento)).toEqual([2]);
  });

  it('não leva para aceita o campo aceito que já deixou de divergir', () => {
    const linhas = montarLinhasComprador({
      escopo: 'reais',
      docs,
      snapshots: [],
      aceites: [aceite(1, 11, 10, 'Ana', 'qtde'), aceite(1, 14, 40, 'Bia', 'ipi')],
      chavesAtuais: new Map([[1, new Set(['11:21:qtde'])]]),
      idsDivergeAgora: new Set([1]),
      idsConferidasDivergentes: new Set([1]),
    });
    expect(agregarRankingComprador(linhas.filter((l) => l.mundo === 'aceita'))).toEqual([
      { nomeComprador: 'Ana', documentos: 1, pedidos: 1, ajustados: 0 },
    ]);
    expect(linhas.filter((l) => l.mundo === 'apontada')).toEqual([]);
  });

  it('apontada traz a nota que divergiu e hoje não diverge mais', () => {
    const linhas = montarLinhasComprador({
      escopo: 'reais',
      docs,
      snapshots: [
        snap(1, 11, 10, 'Ana', 'qtde'),
        snap(2, 12, 20, 'Ana', 'qtde'),
        snap(3, 13, 30, 'Ana', 'valor_unitario', 'benigna'),
      ],
      aceites: [],
      chavesAtuais: new Map([[2, new Set(['12:22:qtde'])]]),
      idsDivergeAgora: new Set([2]),
      idsConferidasDivergentes: new Set([2]),
    });
    const apontadas = filtrarLinhasComprador(linhas, 'apontada', 'Ana');
    expect(apontadas).toHaveLength(1);
    expect(apontadas[0]).toMatchObject({
      idDocumento: 1,
      situacao: 'vinculo_ajustado',
      campos: ['Quantidade'],
    });
  });

  it('conta a nota regularizada uma vez, mesmo com dois pedidos e com aceite', () => {
    const linhas = montarLinhasComprador({
      escopo: 'reais',
      docs,
      snapshots: [snap(1, 11, 10, 'Bia', 'qtde')],
      aceites: [aceite(1, 13, 30, 'Bia', 'ipi')],
      chavesAtuais: new Map(),
      idsDivergeAgora: new Set(),
      idsConferidasDivergentes: new Set(),
    });
    expect(agregarRankingComprador(filtrarLinhasComprador(linhas, 'apontada', 'Bia'))).toEqual([
      { nomeComprador: 'Bia', documentos: 1, pedidos: 2, ajustados: 1 },
    ]);
    expect(filtrarLinhasComprador(linhas, 'aceita', 'Bia')).toEqual([]);
  });
});
