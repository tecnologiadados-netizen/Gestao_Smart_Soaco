import { describe, expect, it } from 'vitest';
import {
  datasEfetivasPedidoAlterado,
  linhaConclusaoPronta,
  montarLinhasConclusao,
} from './confirmacaoLinhasConclusao';
import {
  carradaKey,
  simItemKey,
  type CarradaDataInvalida,
  type PedidoAlterado,
  type SimEntry,
} from './simulacaoCarradas';
import { isCarradaOrdemFinal } from './sequenciamentoCarradasUtils';

describe('montarLinhasConclusao', () => {
  it('une invalida com pedido por idPedido e inclui só-motivo', () => {
    const invalidas: CarradaDataInvalida[] = [
      {
        key: 'item:1',
        cod: 'PA 1',
        carrada: '5-Requisicao',
        dataProducao: '2026-07-31',
        dataEntrega: '2026-07-31',
        producaoPassada: false,
        entregaPassada: false,
        idPedido: '1',
        pedido: 'PD 1',
        cliente: 'Cliente A',
        codigoProduto: 'PA 1',
        descricaoProduto: 'Item A',
        concluida: true,
      },
    ];
    const pedidos: PedidoAlterado[] = [
      {
        idPedido: '1',
        rota: '5-Requisicao',
        pd: 'PD 1',
        cliente: 'Cliente A',
        cod: 'PA 1',
        descricao: 'Item A',
        qtdePendenteReal: 10,
        previsaoAnterior: '2026-06-30',
        previsaoNova: '2026-07-31',
      },
      {
        idPedido: '2',
        rota: '5-Requisicao',
        pd: 'PD 2',
        cliente: 'Cliente B',
        cod: 'PA 2',
        descricao: 'Item B',
        qtdePendenteReal: 5,
        previsaoAnterior: '2026-07-01',
        previsaoNova: '2026-08-01',
      },
    ];

    const linhas = montarLinhasConclusao(invalidas, pedidos);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]!.idPedido).toBe('1');
    expect(linhas[0]!.exigeMotivo).toBe(true);
    expect(linhas[0]!.qtdePendenteReal).toBe(10);
    expect(linhas[1]!.idPedido).toBe('2');
    expect(linhas[1]!.datasOk).toBe(true);
    expect(linhas[1]!.dataEntrega).toBe('2026-08-01');
  });

  it('só-motivo recebe datas efetivas da simulação (item especial)', () => {
    const pedidos: PedidoAlterado[] = [
      {
        idPedido: '2',
        rota: '5-Requisicao',
        pd: 'PD 2',
        cliente: 'Cliente B',
        cod: 'PA 2',
        descricao: 'Item B',
        qtdePendenteReal: 5,
        previsaoAnterior: '2026-07-01',
        previsaoNova: '2026-08-01',
      },
    ];
    const sim = new Map<string, SimEntry>([
      [simItemKey('2'), { dataProducao: '2026-07-28', dataEntrega: '2026-08-01' }],
    ]);
    const snapshot = [
      {
        id_pedido: '2',
        PD: 'PD 2',
        Observacoes: '5-Requisicao',
        Cod: 'PA 2',
        Emissao: '2026-06-15',
        data_producao: '2026-07-20',
      },
    ];
    const linhas = montarLinhasConclusao([], pedidos, snapshot, { sim });
    expect(linhas).toHaveLength(1);
    expect(linhas[0]!.dataProducao).toBe('2026-07-28');
    expect(linhas[0]!.dataEntrega).toBe('2026-08-01');
    expect(linhas[0]!.dataEmissao).toBe('2026-06-15');
    expect(linhas[0]!.key).toBe(simItemKey('2'));
  });

  it('só-motivo de carrada ROTA usa chave de carrada na simulação', () => {
    const pedidos: PedidoAlterado[] = [
      {
        idPedido: '10',
        rota: 'ROTA PIAUI',
        pd: 'PD 10',
        cliente: 'Cliente A',
        cod: '01748',
        descricao: 'Item 1',
        qtdePendenteReal: 3,
        previsaoAnterior: '2026-07-01',
        previsaoNova: '2026-08-10',
      },
    ];
    const key = carradaKey('01748', 'ROTA PIAUI');
    const sim = new Map<string, SimEntry>([
      [key, { dataProducao: '2026-08-05', dataEntrega: '2026-08-10' }],
    ]);
    const linhas = montarLinhasConclusao([], pedidos, [], { sim });
    expect(linhas[0]!.dataProducao).toBe('2026-08-05');
    expect(linhas[0]!.dataEntrega).toBe('2026-08-10');
    expect(linhas[0]!.key).toBe(key);
  });

  it('carrada sem idPedido e sem snapshot permanece agregada sem motivo', () => {
    const invalidas: CarradaDataInvalida[] = [
      {
        key: 'RM1\x1eROTA X',
        cod: 'RM1',
        carrada: 'ROTA X',
        dataProducao: '2026-07-20',
        dataEntrega: '2026-07-20',
        producaoPassada: true,
        entregaPassada: true,
        concluida: false,
      },
    ];
    const linhas = montarLinhasConclusao(invalidas, []);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]!.exigeMotivo).toBe(false);
    expect(linhas[0]!.datasOk).toBe(false);
  });

  it('carrada agregada expande nos pedidos do snapshot com qtde e motivo', () => {
    const key = '01748\x1eROTA PIAUI';
    const invalidas: CarradaDataInvalida[] = [
      {
        key,
        cod: '01748',
        carrada: 'ROTA PIAUI',
        dataProducao: '2026-07-29',
        dataEntrega: '2026-07-30',
        producaoPassada: false,
        entregaPassada: false,
        concluida: true,
      },
    ];
    const snapshot = [
      {
        RM: '01748',
        Observacoes: 'ROTA PIAUI',
        id_pedido: '10',
        PD: 'PD 10',
        Cliente: 'Cliente A',
        Cod: 'PA 1',
        'Descricao do produto': 'Item 1',
        'Qtde Pendente Real': 3,
        Emissao: '2026-05-01',
      },
      {
        RM: '01748',
        Observacoes: 'ROTA PIAUI',
        id_pedido: '11',
        PD: 'PD 11',
        Cliente: 'Cliente B',
        Cod: 'PA 2',
        'Descricao do produto': 'Item 2',
        'Qtde Pendente Real': 5,
      },
    ];
    const linhas = montarLinhasConclusao(invalidas, [], snapshot);
    expect(linhas).toHaveLength(2);
    expect(linhas.every((l) => l.exigeMotivo)).toBe(true);
    expect(linhas.map((l) => l.idPedido).sort()).toEqual(['10', '11']);
    expect(linhas.find((l) => l.idPedido === '10')!.qtdePendenteReal).toBe(3);
    expect(linhas.find((l) => l.idPedido === '10')!.dataEmissao).toBe('2026-05-01');
    expect(linhas.find((l) => l.idPedido === '11')!.qtdePendenteReal).toBe(5);
    expect(linhas.every((l) => l.key === key)).toBe(true);
  });

  it('invalida com idPedido sem pedidosEntrega exige motivo e usa qtde da invalida', () => {
    const invalidas: CarradaDataInvalida[] = [
      {
        key: 'item:99',
        cod: 'PA 99',
        carrada: '1-Retirada na So Aço',
        dataProducao: '2026-07-29',
        dataEntrega: '2026-07-29',
        producaoPassada: false,
        entregaPassada: false,
        previsaoPassada: true,
        previsaoAtual: '2026-06-30',
        idPedido: '99',
        pedido: 'PD 99',
        cliente: 'Cliente Z',
        codigoProduto: 'PA 99',
        descricaoProduto: 'Item Z',
        qtdePendenteReal: 12,
        concluida: false,
      },
    ];
    const linhas = montarLinhasConclusao(invalidas, []);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]!.exigeMotivo).toBe(true);
    expect(linhas[0]!.qtdePendenteReal).toBe(12);
    expect(linhas[0]!.idPedido).toBe('99');
  });
});

describe('datasEfetivasPedidoAlterado', () => {
  it('usa simItemKey para especiais', () => {
    const ped: PedidoAlterado = {
      idPedido: '7',
      rota: '5-Requisicao',
      pd: 'PD 7',
      cliente: 'C',
      cod: 'X',
      descricao: '',
      qtdePendenteReal: 1,
      previsaoAnterior: '2026-01-01',
      previsaoNova: '2026-09-01',
    };
    expect(isCarradaOrdemFinal(ped.rota)).toBe(true);
    const sim = new Map<string, SimEntry>([
      [simItemKey('7'), { dataProducao: '2026-08-20', dataEntrega: '2026-08-25' }],
    ]);
    const d = datasEfetivasPedidoAlterado(ped, [], sim);
    expect(d.dataProducao).toBe('2026-08-20');
    expect(d.dataEntrega).toBe('2026-08-25');
  });
});

describe('linhaConclusaoPronta', () => {
  const base = {
    key: 'k',
    idPedido: '1',
    pedido: 'PD 1',
    cliente: 'A',
    codigo: 'C',
    descricao: '',
    carrada: 'ROTA X',
    dataProducao: '2026-08-01',
    dataEntrega: '2026-08-02',
    producaoPassada: false,
    entregaPassada: false,
    datasOk: true,
    qtdePendenteReal: 1,
    exigeMotivo: true,
  };

  it('pendente sem motivo ou confiável; concluído com ambos', () => {
    expect(linhaConclusaoPronta(base, {}, {})).toBe(false);
    expect(linhaConclusaoPronta(base, { '1': 'Atraso' }, {})).toBe(false);
    expect(linhaConclusaoPronta(base, { '1': 'Atraso' }, { '1': true })).toBe(true);
    expect(linhaConclusaoPronta({ ...base, datasOk: false }, { '1': 'Atraso' }, { '1': true })).toBe(
      false
    );
  });
});

describe('produção anterior à entrega (regra de sync)', () => {
  it('quando produção < entrega, a entrega deve receber a produção', () => {
    const producao = '2026-08-10';
    const entrega = '2026-08-20';
    const calls: Array<{ campo: string; value: string }> = [];
    const editar = (_key: string, campo: 'dataProducao' | 'dataEntrega', value: string) => {
      calls.push({ campo, value });
    };
    editar('k', 'dataProducao', producao);
    if (producao && entrega && producao < entrega) {
      editar('k', 'dataEntrega', producao);
    }
    expect(calls).toEqual([
      { campo: 'dataProducao', value: '2026-08-10' },
      { campo: 'dataEntrega', value: '2026-08-10' },
    ]);
  });

  it('quando produção >= entrega, não força entrega para trás neste sync', () => {
    const producao = '2026-08-20';
    const entrega = '2026-08-10';
    const calls: Array<{ campo: string; value: string }> = [];
    const editar = (_key: string, campo: 'dataProducao' | 'dataEntrega', value: string) => {
      calls.push({ campo, value });
    };
    editar('k', 'dataProducao', producao);
    if (producao && entrega && producao < entrega) {
      editar('k', 'dataEntrega', producao);
    }
    expect(calls).toEqual([{ campo: 'dataProducao', value: '2026-08-20' }]);
  });
});
