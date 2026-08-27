import { describe, expect, it } from 'vitest';
import {
  compararLinhasConclusao,
  computarIdsConfiavelSo,
  datasEfetivasPedidoAlterado,
  linhaConclusaoPronta,
  montarLinhasConclusao,
} from './confirmacaoLinhasConclusao';
import {
  aplicarProducaoComSyncEntrega,
  entregaAposEditarProducao,
} from './syncProducaoEntregaSequenciamento';
import {
  carradaKey,
  simItemKey,
  type CarradaDataInvalida,
  type PedidoAlterado,
  type SimEntry,
} from './simulacaoCarradas';
import { isCarradaOrdemFinal } from './sequenciamentoCarradasUtils';

function pedidoAlterado(
  partial: Partial<PedidoAlterado> & Pick<PedidoAlterado, 'idPedido' | 'pd' | 'chaveSim'>
): PedidoAlterado {
  return {
    rota: 'ROTA A',
    cliente: 'Cliente',
    cod: 'PA 1',
    descricao: 'Produto',
    qtdePendenteReal: 1,
    previsaoAnterior: '2026-07-01',
    previsaoNova: '2027-08-01',
    ...partial,
  };
}

describe('montarLinhasConclusao', () => {
  it('une invalida com pedido por idPedido e inclui só-motivo', () => {
    const invalidas: CarradaDataInvalida[] = [
      {
        key: 'item:1',
        cod: 'PA 1',
        carrada: '5-Requisicao',
        dataProducao: '2027-07-31',
        dataEntrega: '2027-07-31',
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
    const chave2 = simItemKey('2');
    const pedidos: PedidoAlterado[] = [
      pedidoAlterado({
        idPedido: '1',
        chaveSim: simItemKey('1'),
        rota: '5-Requisicao',
        pd: 'PD 1',
        cliente: 'Cliente A',
        cod: 'PA 1',
        descricao: 'Item A',
        qtdePendenteReal: 10,
        previsaoAnterior: '2026-06-30',
        previsaoNova: '2027-07-31',
      }),
      pedidoAlterado({
        idPedido: '2',
        chaveSim: chave2,
        rota: '5-Requisicao',
        pd: 'PD 2',
        cliente: 'Cliente B',
        cod: 'PA 2',
        descricao: 'Item B',
        qtdePendenteReal: 5,
        previsaoAnterior: '2026-07-01',
        previsaoNova: '2027-08-01',
      }),
    ];
    const sim = new Map<string, SimEntry>([
      [chave2, { dataProducao: '2027-07-28', dataEntrega: '2027-08-01' }],
    ]);

    const linhas = montarLinhasConclusao(invalidas, pedidos, [], { sim });
    expect(linhas).toHaveLength(2);
    expect(linhas[0]!.idPedido).toBe('1');
    expect(linhas[0]!.exigeMotivo).toBe(true);
    expect(linhas[0]!.qtdePendenteReal).toBe(10);
    expect(linhas[1]!.idPedido).toBe('2');
    expect(linhas[1]!.datasOk).toBe(true);
    expect(linhas[1]!.dataEntrega).toBe('2027-08-01');
  });

  it('só-motivo recebe datas efetivas da simulação (item especial)', () => {
    const chave = simItemKey('2');
    const pedidos: PedidoAlterado[] = [
      pedidoAlterado({
        idPedido: '2',
        chaveSim: chave,
        rota: '5-Requisicao',
        pd: 'PD 2',
        cliente: 'Cliente B',
        cod: 'PA 2',
        descricao: 'Item B',
        qtdePendenteReal: 5,
        previsaoAnterior: '2026-07-01',
        previsaoNova: '2027-08-01',
      }),
    ];
    const sim = new Map<string, SimEntry>([
      [chave, { dataProducao: '2027-07-28', dataEntrega: '2027-08-01' }],
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
    expect(linhas[0]!.dataProducao).toBe('2027-07-28');
    expect(linhas[0]!.dataEntrega).toBe('2027-08-01');
    expect(linhas[0]!.dataEmissao).toBe('2026-06-15');
    expect(linhas[0]!.key).toBe(chave);
  });

  it('só-motivo de carrada ROTA usa chave RM+carrada (não Cod produto)', () => {
    const key = carradaKey('01748', 'ROTA PIAUI');
    const pedidos: PedidoAlterado[] = [
      pedidoAlterado({
        idPedido: '10',
        chaveSim: key,
        rota: 'ROTA PIAUI',
        pd: 'PD 10',
        cliente: 'Cliente A',
        cod: '5445',
        descricao: 'Item 1',
        qtdePendenteReal: 3,
        previsaoAnterior: '2026-07-01',
        previsaoNova: '2027-08-10',
      }),
    ];
    const sim = new Map<string, SimEntry>([
      [key, { dataProducao: '2027-08-05', dataEntrega: '2027-08-10' }],
    ]);
    const linhas = montarLinhasConclusao([], pedidos, [], { sim });
    expect(linhas[0]!.dataProducao).toBe('2027-08-05');
    expect(linhas[0]!.dataEntrega).toBe('2027-08-10');
    expect(linhas[0]!.key).toBe(key);
  });

  it('Belém: Cod produto 5445 e RM 01741 — modal lê sim da carrada', () => {
    const key = carradaKey('01741', 'ROTA BELEM 09 - LIBERADA');
    const pedidos: PedidoAlterado[] = [
      pedidoAlterado({
        idPedido: '48249',
        chaveSim: key,
        rota: 'ROTA BELEM 09 - LIBERADA',
        pd: 'PD 48249',
        cliente: 'NORTE REFRIGERACAO',
        cod: '5445',
        descricao: 'Armário',
        qtdePendenteReal: 40,
        previsaoAnterior: '2026-08-03',
        previsaoNova: '2027-09-03',
      }),
    ];
    const sim = new Map<string, SimEntry>([
      [key, { dataProducao: '2027-09-01', dataEntrega: '2027-09-03' }],
    ]);
    const linhas = montarLinhasConclusao([], pedidos, [], { sim });
    expect(linhas[0]!.dataProducao).toBe('2027-09-01');
    expect(linhas[0]!.dataEntrega).toBe('2027-09-03');
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
        dataProducao: '2027-07-29',
        dataEntrega: '2027-07-30',
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
        dataProducao: '2027-07-29',
        dataEntrega: '2027-07-29',
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

describe('compararLinhasConclusao', () => {
  it('ordena por produção, carrada, pedido e descrição', () => {
    const a = {
      key: 'a',
      pedido: 'PD 2',
      cliente: '',
      codigo: '',
      descricao: 'B',
      carrada: 'ROTA B',
      dataProducao: '2027-09-01',
      dataEntrega: '',
      producaoPassada: false,
      entregaPassada: false,
      datasOk: true,
      qtdePendenteReal: 1,
      exigeMotivo: true,
    };
    const b = {
      key: 'b',
      pedido: 'PD 1',
      cliente: '',
      codigo: '',
      descricao: 'A',
      carrada: 'ROTA A',
      dataProducao: '2027-09-01',
      dataEntrega: '',
      producaoPassada: false,
      entregaPassada: false,
      datasOk: true,
      qtdePendenteReal: 1,
      exigeMotivo: true,
    };
    const c = {
      key: 'c',
      pedido: 'PD 3',
      cliente: '',
      codigo: '',
      descricao: 'C',
      carrada: 'ROTA A',
      dataProducao: '2027-08-01',
      dataEntrega: '',
      producaoPassada: false,
      entregaPassada: false,
      datasOk: true,
      qtdePendenteReal: 1,
      exigeMotivo: true,
    };
    const sorted = [a, b, c].sort(compararLinhasConclusao);
    expect(sorted.map((l) => l.pedido)).toEqual(['PD 3', 'PD 1', 'PD 2']);
  });
});

describe('datasEfetivasPedidoAlterado', () => {
  it('usa simItemKey para especiais', () => {
    const chave = simItemKey('7');
    const ped: PedidoAlterado = pedidoAlterado({
      idPedido: '7',
      chaveSim: chave,
      rota: '5-Requisicao',
      pd: 'PD 7',
      cliente: 'C',
      cod: 'X',
      descricao: '',
      qtdePendenteReal: 1,
      previsaoAnterior: '2026-01-01',
      previsaoNova: '2027-09-01',
    });
    expect(isCarradaOrdemFinal(ped.rota)).toBe(true);
    const sim = new Map<string, SimEntry>([
      [chave, { dataProducao: '2027-08-20', dataEntrega: '2027-08-25' }],
    ]);
    const d = datasEfetivasPedidoAlterado(ped, [], sim);
    expect(d.dataProducao).toBe('2027-08-20');
    expect(d.dataEntrega).toBe('2027-08-25');
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
    dataProducao: '2027-08-01',
    dataEntrega: '2027-08-02',
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

describe('computarIdsConfiavelSo', () => {
  const key = carradaKey('01741', 'ROTA BELEM 09 - LIBERADA');
  const snapshot = [
    {
      id_pedido: 'normal-1',
      PD: 'PD 100',
      RM: '01741',
      Observacoes: 'ROTA BELEM 09 - LIBERADA',
      previsao_atual_confiavel: false,
      previsao_entrega_atualizada: '2026-08-03',
      data_producao: '2026-08-01',
    },
    {
      id_pedido: 'formacao-1',
      PD: 'PD 200',
      RM: '01750',
      Observacoes: 'ROTA BELEM 01 - CONSTRUÇÃO',
      previsao_atual_confiavel: false,
      previsao_entrega_atualizada: '2026-08-30',
      data_producao: '2026-10-18',
    },
    {
      id_pedido: 'especial-1',
      PD: 'PD 300',
      Observacoes: '5-Requisicao',
      previsao_atual_confiavel: false,
      previsao_entrega_atualizada: '2026-08-10',
      data_producao: '2026-08-05',
    },
  ];

  it('exclui carradas em formação', () => {
    const itens = computarIdsConfiavelSo(
      { 'formacao-1': true },
      new Set<string>(),
      snapshot,
      new Map<string, SimEntry>(),
      new Map()
    );
    expect(itens).toEqual([]);
  });

  it('carrada normal usa a data efetiva da carrada (sim), não a previsão antiga da linha', () => {
    const sim = new Map<string, SimEntry>([
      [key, { dataProducao: '2026-09-01', dataEntrega: '2026-09-03' }],
    ]);
    const itens = computarIdsConfiavelSo({ 'normal-1': true }, new Set<string>(), snapshot, sim, new Map());
    expect(itens).toHaveLength(1);
    expect(itens[0]!.previsao).toBe('2026-09-03');
    expect(itens[0]!.rota).toBe('ROTA BELEM 09 - LIBERADA');
    expect(itens[0]!.pd).toBe('PD 100');
  });

  it('carrada normal sem sim cai na previsão atual da linha', () => {
    const itens = computarIdsConfiavelSo(
      { 'normal-1': true },
      new Set<string>(),
      snapshot,
      new Map<string, SimEntry>(),
      new Map()
    );
    expect(itens).toHaveLength(1);
    expect(itens[0]!.previsao).toBe('2026-08-03');
  });

  it('carrada especial usa a data efetiva do item', () => {
    const sim = new Map<string, SimEntry>([
      [simItemKey('especial-1'), { dataEntrega: '2026-09-15' }],
    ]);
    const itens = computarIdsConfiavelSo(
      { 'especial-1': true },
      new Set<string>(),
      snapshot,
      sim,
      new Map()
    );
    expect(itens).toHaveLength(1);
    expect(itens[0]!.previsao).toBe('2026-09-15');
    expect(itens[0]!.confiavel).toBe(true);
  });

  it('ignora ids em pedidosEntrega e escolhas iguais ao snapshot', () => {
    const itens = computarIdsConfiavelSo(
      { 'normal-1': true, 'especial-1': false },
      new Set<string>(['normal-1']),
      [
        ...snapshot.slice(0, 2),
        { ...snapshot[2]!, previsao_atual_confiavel: false },
      ],
      new Map<string, SimEntry>(),
      new Map()
    );
    expect(itens).toEqual([]);
  });
});

describe('sync produção × entrega', () => {
  it('entregaAposEditarProducao mantém entrega quando produção <= entrega', () => {
    expect(entregaAposEditarProducao('2027-09-01', '2027-09-03')).toBeNull();
    expect(entregaAposEditarProducao('2027-09-03', '2027-09-03')).toBeNull();
  });

  it('entregaAposEditarProducao eleva entrega quando produção > entrega', () => {
    expect(entregaAposEditarProducao('2027-09-05', '2027-09-03')).toBe('2027-09-05');
  });

  it('aplicarProducaoComSyncEntrega não puxa entrega para baixo', () => {
    const calls: Array<{ campo: string; value: string }> = [];
    const editar = (_key: string, campo: 'dataProducao' | 'dataEntrega', value: string) => {
      calls.push({ campo, value });
    };
    aplicarProducaoComSyncEntrega(editar, 'k', '2027-09-01', '2027-09-03');
    expect(calls).toEqual([{ campo: 'dataProducao', value: '2027-09-01' }]);
  });

  it('aplicarProducaoComSyncEntrega eleva entrega quando produção > entrega', () => {
    const calls: Array<{ campo: string; value: string }> = [];
    const editar = (_key: string, campo: 'dataProducao' | 'dataEntrega', value: string) => {
      calls.push({ campo, value });
    };
    aplicarProducaoComSyncEntrega(editar, 'k', '2027-09-10', '2027-09-03');
    expect(calls).toEqual([
      { campo: 'dataProducao', value: '2027-09-10' },
      { campo: 'dataEntrega', value: '2027-09-10' },
    ]);
  });
});
