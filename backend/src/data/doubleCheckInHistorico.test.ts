import { describe, expect, it } from 'vitest';
import {
  montarEventosHistorico,
  type EntradaHistoricoDoubleCheck,
  type LinhaAtualHistorico,
} from './doubleCheckInHistorico.js';
import type { RelatoConferencia } from '../services/doubleCheckInConferenciaRelato.js';

function base(): EntradaHistoricoDoubleCheck {
  return {
    documento: {
      idDocumento: 10,
      numeroDocumentoFiscal: 'DE1',
      numeroNfe: '100',
      dataEmissao: '2026-10-10',
      dataEntrada: '2026-10-14',
      nomeParceiro: 'Ferro Norte',
      idTipoMovimentacao: 11,
      tipoMovimentacao: 'Entrada',
      dataCriacao: '2026-10-14T12:00:00.000Z',
      nomeUsuarioCriacao: 'Luisa',
    },
    itens: [
      {
        idItemDocumentoEstoque: 11,
        codigoProduto: 'A1',
        descricaoProduto: 'Chapa',
        idItemPedidoCompra: null,
        idPedidoCompra: null,
        nomePedidoCompra: null,
        nomeComprador: null,
        qtdeNF: 2,
        qtdePC: null,
        valorUnitarioNF: 10,
        valorUnitarioPC: null,
      },
    ],
    snapshots: [
      {
        idItemDocumentoEstoque: 11,
        idItemPedidoCompra: 21,
        idPedidoCompra: 30,
        nomePedidoCompra: 'PC 30',
        nomeComprador: 'Marcilia',
        campo: 'qtde',
        natureza: 'real',
        apontadoEm: '2026-10-14T15:00:00.000Z',
      },
    ],
    retratosPrimeiraLeitura: [linha({ divergQtde: true, qtdePC: 1 })],
    linhasAtuais: [],
    decisoes: [],
    conferencia: null,
    relato: null,
    recebimento: null,
    alerta: null,
    lidoEm: '2026-10-20T12:00:00.000Z',
  };
}

function linha(parcial: Partial<LinhaAtualHistorico> = {}): LinhaAtualHistorico {
  return {
    idItemDocumentoEstoque: 11,
    idItemPedidoCompra: 21,
    nomePedidoCompra: 'PC 30',
    codigoProduto: 'A1',
    descricaoProduto: 'Chapa',
    qtdeNF: 2,
    umNF: 'UN',
    qtdePC: 2,
    umPC: 'UN',
    valorUnitarioNF: 10,
    valorUnitarioPC: 10,
    valorIpiNF: 0,
    valorIpiPC: 0,
    condicaoPagamentoNF: null,
    condicaoPagamentoPC: null,
    divergValorUnitario: false,
    divergQtde: false,
    divergIpi: false,
    divergCondicaoPagamento: false,
    ...parcial,
  };
}

function ligar(entrada: EntradaHistoricoDoubleCheck, idItemPedidoCompra: number, idPedido: number, nome: string) {
  entrada.itens[0] = {
    ...entrada.itens[0]!,
    idItemPedidoCompra,
    idPedidoCompra: idPedido,
    nomePedidoCompra: nome,
    nomeComprador: 'Marcilia',
    qtdePC: 2,
    valorUnitarioPC: 10,
  };
}

describe('montarEventosHistorico', () => {
  it('mostra a divergência da primeira leitura com os valores e a desvinculação sem novo vínculo', () => {
    const eventos = montarEventosHistorico(base());
    expect(eventos.map((e) => e.id)).toEqual([
      'criado',
      'divergencias-iniciais',
      'desvinculo',
      'sem-novo-vinculo',
      'situacao-atual',
    ]);
    const iniciais = eventos[1]!;
    expect(iniciais.titulo).toBe('Divergências identificadas no vínculo com o pedido');
    expect(iniciais.detalhe).toContain('foi identificada 1 divergência');
    expect(iniciais.detalhe).toContain('A1 — Chapa · PC 30 · Quantidade: nota 2 UN | pedido 1 UN');
    expect(eventos[2]).toMatchObject({ titulo: 'Desvinculação do pedido', precisao: 'sem_data', em: null });
    expect(eventos[2]!.detalhe).toContain('com o pedido PC 30 (comprador: Marcilia) foi desfeito');
    expect(eventos[3]!.detalhe).toContain('não foi vinculado novamente');
    expect(eventos[4]!.detalhe).toContain('nenhum item do documento está vinculado');
  });

  it('mostra o novo vínculo do item desvinculado e a situação atual', () => {
    const entrada = base();
    ligar(entrada, 99, 40, 'PC 40');
    entrada.linhasAtuais = [linha({ idItemPedidoCompra: 99, nomePedidoCompra: 'PC 40' })];
    const eventos = montarEventosHistorico(entrada);
    expect(eventos.map((e) => e.id)).toEqual([
      'criado',
      'divergencias-iniciais',
      'desvinculo',
      'novo-vinculo',
      'situacao-atual',
    ]);
    expect(eventos[3]!.detalhe).toContain('A1 — Chapa foi vinculado novamente ao pedido PC 40');
    expect(eventos[4]).toMatchObject({ tom: 'ok', titulo: 'Situação atual', precisao: 'instante' });
    expect(eventos[4]!.detalhe).toContain('conforme o pedido de compra em todos os campos');
  });

  it('não chama de novo vínculo o item que já estava ligado sem divergência', () => {
    const entrada = base();
    ligar(entrada, 21, 30, 'PC 30');
    entrada.itens.push({
      ...entrada.itens[0]!,
      idItemDocumentoEstoque: 12,
      codigoProduto: 'B2',
      idItemPedidoCompra: 22,
    });
    entrada.linhasAtuais = [linha({ divergQtde: true, qtdePC: 1 })];
    const ids = montarEventosHistorico(entrada).map((e) => e.id);
    expect(ids).toContain('sem-desvinculo');
    expect(ids).not.toContain('novo-vinculo');
  });

  it('separa o que ainda diverge do que foi regularizado e lista as tratativas', () => {
    const entrada = base();
    ligar(entrada, 21, 30, 'PC 30');
    entrada.snapshots.push({ ...entrada.snapshots[0]!, campo: 'valor_unitario' });
    entrada.retratosPrimeiraLeitura = [linha({ divergQtde: true, qtdePC: 1, divergValorUnitario: true, valorUnitarioPC: 8 })];
    entrada.linhasAtuais = [linha({ divergValorUnitario: true, valorUnitarioPC: 8 })];
    entrada.decisoes = [
      {
        idItemDocumentoEstoque: 11,
        idItemPedidoCompra: 21,
        campo: 'qtde',
        decisao: 'aceita',
        justificativaLabel: 'Acordo comercial',
        usuarioLogin: 'ana',
        atualizadoEm: '2026-10-14T16:00:00.000Z',
        vigente: true,
        observacoes: [],
      },
    ];
    entrada.conferencia = {
      conferidoEm: '2026-10-14T17:00:00.000Z',
      usuarioLogin: 'ana',
      reabertoEm: null,
      reabertoPorLogin: null,
      totalDivergenciasReaisHistorica: 2,
      totalDivergenciasBenignasHist: 0,
    };
    const eventos = montarEventosHistorico(entrada);
    expect(eventos.map((e) => e.id)).toEqual([
      'criado',
      'divergencias-iniciais',
      'sem-desvinculo',
      'tratativas',
      'situacao-atual',
    ]);
    expect(eventos[1]!.detalhe).toContain('foram identificadas 2 divergências');
    expect(eventos[2]!.detalhe).toContain('Não houve desvinculação');
    expect(eventos[3]!.detalhe).toContain('Divergência de Quantidade em A1 — Chapa · PC 30 aceita por ana');
    const situacao = eventos[4]!;
    expect(situacao.tom).toBe('atencao');
    expect(situacao.detalhe).toContain('A nota diverge do pedido de compra em 1 campo');
    expect(situacao.detalhe).toMatch(/Valor unitário: nota R\$\s10,00 \| pedido R\$\s8,00/);
    expect(situacao.detalhe).toContain('Divergências regularizadas no Nomus desde o registro inicial');
    expect(situacao.detalhe).toContain('Quantidade: registrado nota 2 UN | pedido 1 UN; atual nota 2 UN | pedido 2 UN');
    expect(situacao.detalhe).toContain('Conferência realizada por ana');
  });

  it('usa o relato da conferência quando não há primeira leitura gravada', () => {
    const entrada = base();
    ligar(entrada, 21, 30, 'PC 30');
    entrada.snapshots = [];
    entrada.retratosPrimeiraLeitura = [];
    entrada.documento.dataCriacao = '2026-10-01T12:00:00.000Z';
    entrada.linhasAtuais = [linha()];
    entrada.conferencia = {
      conferidoEm: '2026-10-05T11:00:00.000Z',
      usuarioLogin: 'Luisa',
      reabertoEm: null,
      reabertoPorLogin: null,
      totalDivergenciasReaisHistorica: 1,
      totalDivergenciasBenignasHist: 0,
    };
    entrada.relato = {
      numeroNfe: '100',
      numeroDocumentoFiscal: 'DE1',
      nomeParceiro: 'Ferro Norte',
      conferidoPor: 'Luisa',
      conferidoEm: null,
      totalProdutos: 1,
      totalDivergencias: 1,
      totalDivergenciasReais: 1,
      totalDivergenciasBenignas: 0,
      aceitas: 1,
      recusadas: 0,
      pagamentoComum: {
        campo: 'condicao_pagamento',
        natureza: 'real',
        titulo: 'Pagamento',
        nf: '(1x) 30 (0d)',
        pc: '(1x) 30 (30d)',
        diferenca: null,
        sinal: null,
        decisao: 'aceita',
        justificativa: 'Outros',
        observacao: null,
        detalhe: null,
        descontoWhatsApp: null,
      },
      produtos: [{ codigo: 'A1', pedido: 'PC 30', campos: [] }],
    } as RelatoConferencia;
    const eventos = montarEventosHistorico(entrada);
    expect(eventos.map((e) => e.id)).toEqual([
      'criado',
      'divergencias-iniciais',
      'vinculo-sem-leitura',
      'tratativas',
      'situacao-atual',
    ]);
    expect(eventos[1]!.titulo).toBe('Divergências registradas na conferência');
    expect(eventos[1]!.detalhe).toContain('Condição de pagamento: nota (1x) 30 (0d) | pedido (1x) 30 (30d)');
    expect(eventos[2]!.detalhe).toContain('o registro teve início em 09/10/2026');
    expect(eventos[4]!.detalhe).toContain('Divergências regularizadas no Nomus');
  });
});
