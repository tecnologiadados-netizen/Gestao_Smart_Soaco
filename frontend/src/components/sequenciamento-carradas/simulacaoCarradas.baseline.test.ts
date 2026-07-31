import { describe, it, expect } from 'vitest';
import {
  chavePedidoItemCanon,
  computarBaselines,
  computarItensDataProducao,
  expandirPedidosEntregaComLinhasVivas,
  detectarExcessoQtdeRomaneadaCanon,
  listarCarradasSemDatasUnificadas,
  mensagemBloqueioCarradasSemDatasUnificadas,
  mesclarCarradasSemDatasUnificadas,
  linhaCarradaKey,
  type SimEntry,
} from './simulacaoCarradas';

const CARRADA = 'ROTA TESTE - LIBERADA';
const COD = '01688';
const CARRADA_B = 'ROTA OUTRA - LIBERADA';
const COD_B = '01689';

function linha(id: string, dataProducao: string | null): Record<string, unknown> {
  return {
    RM: COD,
    Observacoes: CARRADA,
    idChave: id,
    id_pedido: id,
    data_producao: dataProducao,
    previsao_entrega_atualizada: '2026-07-14',
  };
}

function linhaCarrada(
  id: string,
  cod: string,
  carrada: string,
  dataProducao: string | null,
  extras?: Partial<Record<string, unknown>>
): Record<string, unknown> {
  return {
    RM: cod,
    Observacoes: carrada,
    idChave: id,
    id_pedido: id,
    PD: extras?.PD ?? 'PD 48112',
    Cod: extras?.Cod ?? 'PA 5894',
    data_producao: dataProducao,
    previsao_entrega_atualizada: '2026-07-14',
    'Qtde Romaneada': extras?.['Qtde Romaneada'] ?? 0,
    Pendente: extras?.Pendente ?? 0,
    ...extras,
  };
}

describe('computarBaselines — data de produção', () => {
  it('usa data única quando algumas linhas estão vazias', () => {
    const linhas = [linha('a', '2026-07-14'), linha('b', null)];
    const baseline = computarBaselines(linhas);
    const key = linhaCarradaKey(linhas[0]!);
    expect(baseline.get(key)?.dataProducao).toBe('2026-07-14');
    expect(baseline.get(key)?.dataProducaoDivergente).toBe(false);
  });

  it('marca divergente quando há duas datas distintas preenchidas', () => {
    const linhas = [linha('a', '2026-07-14'), linha('b', '2026-07-15')];
    const baseline = computarBaselines(linhas);
    const key = linhaCarradaKey(linhas[0]!);
    expect(baseline.get(key)?.dataProducao).toBe('');
    expect(baseline.get(key)?.dataProducaoDivergente).toBe(true);
  });
});

describe('chavePedidoItemCanon', () => {
  it('ignora o prefixo do romaneio', () => {
    expect(chavePedidoItemCanon('188240-48121-26250')).toBe('48121-26250');
    expect(chavePedidoItemCanon('186495-48121-26250')).toBe('48121-26250');
  });
});

describe('computarItensDataProducao', () => {
  it('inclui linhas sem data_producao quando sim define data da carrada', () => {
    const linhas = [linha('item-a', null), linha('item-b', '2026-07-14')];
    const baseline = computarBaselines(linhas);
    const key = linhaCarradaKey(linhas[0]!);
    const sim = new Map<string, SimEntry>([[key, { dataProducao: '2026-07-14' }]]);
    const payload = computarItensDataProducao(linhas, sim, baseline);
    expect(payload).toHaveLength(1);
    expect(payload[0]?.id_pedido).toBe('item-a');
    expect(payload[0]?.data_producao).toBe('2026-07-14');
    expect(payload[0]?.rota).toBe(CARRADA);
  });

  it('persiste todos os itens quando baseline parcial tem data única e sim vazio', () => {
    const linhas = [linha('item-a', null), linha('item-b', null)];
    const baselineComData = computarBaselines([
      linha('item-a', '2026-07-14'),
      linha('item-b', null),
    ]);
    const sim = new Map<string, SimEntry>();
    const payload = computarItensDataProducao(linhas, sim, baselineComData);
    expect(payload).toHaveLength(2);
    expect(payload.every((p) => p.data_producao === '2026-07-14')).toBe(true);
  });

  it('emite um item por rota quando o mesmo canon aparece em duas carradas com a mesma data', () => {
    const idA = '188240-48121-26250';
    const idB = '186495-48121-26250';
    const linhas = [
      linhaCarrada(idA, COD, CARRADA, null),
      linhaCarrada(idB, COD_B, CARRADA_B, null),
    ];
    const baseline = computarBaselines(linhas);
    const keyA = linhaCarradaKey(linhas[0]!);
    const keyB = linhaCarradaKey(linhas[1]!);
    const sim = new Map<string, SimEntry>([
      [keyA, { dataProducao: '2026-07-16' }],
      [keyB, { dataProducao: '2026-07-16' }],
    ]);
    const payload = computarItensDataProducao(linhas, sim, baseline);
    expect(payload).toHaveLength(2);
    expect(payload.every((p) => chavePedidoItemCanon(p.id_pedido) === '48121-26250')).toBe(true);
    expect(payload.every((p) => p.data_producao === '2026-07-16')).toBe(true);
    const rotas = new Set(payload.map((p) => p.rota));
    expect(rotas.has(CARRADA)).toBe(true);
    expect(rotas.has(CARRADA_B)).toBe(true);
  });

  it('emite duas datas distintas para o mesmo canon em carradas diferentes', () => {
    const idA = '188240-48131-5430';
    const idB = '186495-48131-5430';
    const linhas = [
      linhaCarrada(idA, COD, 'ROTA BELEM ABAETETUBA - LIBERADA', null, {
        PD: 'PD 48131',
        Cod: 'PA 5430',
      }),
      linhaCarrada(idB, COD_B, 'ROTA BELEM 07 - LIBERADA', null, {
        PD: 'PD 48131',
        Cod: 'PA 5430',
      }),
    ];
    const baseline = computarBaselines(linhas);
    const keyA = linhaCarradaKey(linhas[0]!);
    const keyB = linhaCarradaKey(linhas[1]!);
    const sim = new Map<string, SimEntry>([
      [keyA, { dataProducao: '2026-07-28' }],
      [keyB, { dataProducao: '2026-07-31' }],
    ]);
    const payload = computarItensDataProducao(linhas, sim, baseline);
    expect(payload).toHaveLength(2);
    const porRota = new Map(payload.map((p) => [p.rota, p.data_producao]));
    expect(porRota.get('ROTA BELEM ABAETETUBA - LIBERADA')).toBe('2026-07-28');
    expect(porRota.get('ROTA BELEM 07 - LIBERADA')).toBe('2026-07-31');
  });
});

describe('detectarExcessoQtdeRomaneadaCanon', () => {
  it('não bloqueia quando 50+50 = 100 (datas diferentes são irrelevantes)', () => {
    const idA = '188240-48131-5430';
    const idB = '186495-48131-5430';
    const linhas = [
      linhaCarrada(idA, COD, 'ROTA BELEM ABAETETUBA - LIBERADA', '2026-07-28', {
        PD: 'PD 48131',
        Cod: 'PA 5430',
        'Qtde Romaneada': 50,
        Pendente: 100,
      }),
      linhaCarrada(idB, COD_B, 'ROTA BELEM 07 - LIBERADA', '2026-07-31', {
        PD: 'PD 48131',
        Cod: 'PA 5430',
        'Qtde Romaneada': 50,
        Pendente: 100,
      }),
    ];
    expect(detectarExcessoQtdeRomaneadaCanon(linhas)).toHaveLength(0);
  });

  it('bloqueia quando a soma romaneada excede o Pendente', () => {
    const idA = '188240-48131-5430';
    const idB = '186495-48131-5430';
    const linhas = [
      linhaCarrada(idA, COD, CARRADA, '2026-07-28', {
        PD: 'PD 48131',
        Cod: 'PA 5430',
        'Qtde Romaneada': 60,
        Pendente: 100,
      }),
      linhaCarrada(idB, COD_B, CARRADA_B, '2026-07-31', {
        PD: 'PD 48131',
        Cod: 'PA 5430',
        'Qtde Romaneada': 50,
        Pendente: 100,
      }),
    ];
    const conflitos = detectarExcessoQtdeRomaneadaCanon(linhas);
    expect(conflitos).toHaveLength(1);
    expect(conflitos[0]?.canon).toBe('48131-5430');
    expect(conflitos[0]?.somaRomaneada).toBe(110);
    expect(conflitos[0]?.pendente).toBe(100);
  });

  it('não reporta conflito quando as datas efetivas diferem mas a quantidade está ok', () => {
    const idA = '188240-48121-26250';
    const idB = '186495-48121-26250';
    const linhas = [
      linhaCarrada(idA, COD, CARRADA, '2026-07-16', {
        'Qtde Romaneada': 10,
        Pendente: 20,
      }),
      linhaCarrada(idB, COD_B, CARRADA_B, '2026-07-20', {
        'Qtde Romaneada': 10,
        Pendente: 20,
      }),
    ];
    expect(detectarExcessoQtdeRomaneadaCanon(linhas)).toHaveLength(0);
  });
});

describe('listarCarradasSemDatasUnificadas', () => {
  const keyFn = (c: { cod: string; carrada: string }) => `${c.cod}\x1e${c.carrada}`;

  it('bloqueia carrada normal com datas de entrega divergentes', () => {
    const linhas = [
      {
        RM: COD,
        Observacoes: CARRADA,
        id_pedido: '1',
        previsao_entrega_atualizada: '2026-07-31',
        data_producao: '2026-07-30',
      },
      {
        RM: COD,
        Observacoes: CARRADA,
        id_pedido: '2',
        previsao_entrega_atualizada: '2026-08-05',
        data_producao: '2026-07-30',
      },
    ];
    const bl = computarBaselines(linhas);
    const key = linhaCarradaKey(linhas[0]!);
    expect(bl.get(key)?.dataEntregaDivergente).toBe(true);
    const sem = listarCarradasSemDatasUnificadas([{ cod: COD, carrada: CARRADA }], new Map(), bl, keyFn);
    expect(sem).toHaveLength(1);
    expect(sem[0]?.faltaEntrega).toBe(true);
    expect(sem[0]?.faltaProducao).toBe(false);
    expect(sem[0]?.carrada).toBe(CARRADA);
  });

  it('bloqueia carrada normal com datas de produção divergentes', () => {
    const linhas = [
      {
        RM: COD,
        Observacoes: CARRADA,
        id_pedido: '1',
        previsao_entrega_atualizada: '2026-08-05',
        data_producao: '2026-07-30',
      },
      {
        RM: COD,
        Observacoes: CARRADA,
        id_pedido: '2',
        previsao_entrega_atualizada: '2026-08-05',
        data_producao: '2026-08-01',
      },
    ];
    const bl = computarBaselines(linhas);
    const sem = listarCarradasSemDatasUnificadas([{ cod: COD, carrada: CARRADA }], new Map(), bl, keyFn);
    expect(sem).toHaveLength(1);
    expect(sem[0]?.faltaProducao).toBe(true);
    expect(sem[0]?.faltaEntrega).toBe(false);
  });

  it('libera quando a simulação unifica produção e entrega', () => {
    const linhas = [
      {
        RM: COD,
        Observacoes: CARRADA,
        id_pedido: '1',
        previsao_entrega_atualizada: '2026-07-31',
        data_producao: '2026-07-30',
      },
      {
        RM: COD,
        Observacoes: CARRADA,
        id_pedido: '2',
        previsao_entrega_atualizada: '2026-08-05',
        data_producao: '2026-08-01',
      },
    ];
    const bl = computarBaselines(linhas);
    const key = linhaCarradaKey(linhas[0]!);
    const sim = new Map<string, SimEntry>([
      [key, { dataEntrega: '2026-08-05', dataProducao: '2026-08-01' }],
    ]);
    expect(listarCarradasSemDatasUnificadas([{ cod: COD, carrada: CARRADA }], sim, bl, keyFn)).toHaveLength(
      0
    );
  });

  it('ignora especiais e em formação', () => {
    const especiais = [
      { cod: '—', carrada: '1-Retirada na So Aço' },
      { cod: '—', carrada: '3-Entrega em Grande Teresina' },
      { cod: '—', carrada: '4-Inserir em Romaneio' },
      { cod: '—', carrada: '5-Requisicao' },
      { cod: '01600', carrada: 'ROTA EM CONSTRUCAO' },
    ];
    const bl = new Map();
    expect(listarCarradasSemDatasUnificadas(especiais, new Map(), bl, keyFn)).toHaveLength(0);
  });

  it('monta mensagem listando as carradas', () => {
    const msg = mensagemBloqueioCarradasSemDatasUnificadas([
      { key: 'a', cod: COD, carrada: CARRADA, faltaProducao: false, faltaEntrega: true },
    ]);
    expect(msg).toContain(CARRADA);
    expect(msg).toContain('entrega');
    expect(msg).toContain('Preencha as datas');
  });

  it('mescla listas sem duplicar chave e une flags', () => {
    const a = [{ key: 'k1', cod: '1', carrada: 'A', faltaProducao: true, faltaEntrega: false }];
    const b = [
      { key: 'k1', cod: '1', carrada: 'A', faltaProducao: false, faltaEntrega: true },
      { key: 'k2', cod: '2', carrada: 'B', faltaProducao: false, faltaEntrega: true },
    ];
    expect(mesclarCarradasSemDatasUnificadas(a, b)).toEqual([
      { key: 'k1', cod: '1', carrada: 'A', faltaProducao: true, faltaEntrega: true },
      { key: 'k2', cod: '2', carrada: 'B', faltaProducao: false, faltaEntrega: true },
    ]);
  });
});

describe('expandirPedidosEntregaComLinhasVivas', () => {
  it('inclui pedido vivo cuja previsão difere da data efetiva da carrada', () => {
    const linhasVivas = [
      {
        RM: COD,
        Observacoes: CARRADA,
        id_pedido: '10',
        PD: '49600',
        Cliente: 'A',
        Cod: 'PA1',
        'Descricao do produto': 'X',
        'Qtde Pendente Real': 1,
        previsao_entrega_atualizada: '2026-07-31',
      },
      {
        RM: COD,
        Observacoes: CARRADA,
        id_pedido: '20',
        PD: '49649',
        Cliente: 'B',
        Cod: 'PA2',
        'Descricao do produto': 'Y',
        'Qtde Pendente Real': 2,
        previsao_entrega_atualizada: '2026-08-10',
      },
    ];
    // Baseline do snapshot antigo (ainda unificado); pedido 20 entrou depois no ERP.
    const blSnap = new Map([
      [
        `${COD}\x1e${CARRADA}`,
        {
          dataEntrega: '2026-07-31',
          dataProducao: '',
          dataEntregaDivergente: false,
          dataProducaoDivergente: false,
        },
      ],
    ]);
    const alterados = expandirPedidosEntregaComLinhasVivas([], linhasVivas, new Map(), blSnap);
    expect(alterados.map((p) => p.idPedido)).toEqual(['20']);
    expect(alterados[0]?.previsaoNova).toBe('2026-07-31');
  });
});
