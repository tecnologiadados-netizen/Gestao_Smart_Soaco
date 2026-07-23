import { describe, expect, it } from 'vitest';
import {
  abaterSaldoEstoquePorDataAsc,
  montarQtdeLiquidaCalendario,
  montarQtdeLiquidaDoSnapshot,
  parseDataBaseProgramacao,
  processarPlanningComEstoque,
  qtdeLiquidaPorLinhaSnapshot,
} from './abaterSaldoEstoqueProgramacao';

describe('parseDataBaseProgramacao', () => {
  it('aceita dd/MM/yyyy e yyyy-MM-dd', () => {
    expect(parseDataBaseProgramacao('23/07/2026').getFullYear()).toBe(2026);
    expect(parseDataBaseProgramacao('2026-07-23').getMonth()).toBe(6);
  });
});

describe('abaterSaldoEstoquePorDataAsc', () => {
  it('consome saldo dia a dia: A60 B50 C30 saldo100 → 0 / 10 / 30', () => {
    const items = [
      { id: 'A', Cod: 'PA-1', DataBase: '01/07/2026', 'Qtde Pendente Real': 60 },
      { id: 'B', Cod: 'PA-1', DataBase: '02/07/2026', 'Qtde Pendente Real': 50 },
      { id: 'C', Cod: 'PA-1', DataBase: '03/07/2026', 'Qtde Pendente Real': 30 },
    ];
    const { items: out, stockRemaining } = abaterSaldoEstoquePorDataAsc(items, { 'PA-1': 100 }, {
      getCod: (i) => i.Cod,
      getRequestedQty: (i) => i['Qtde Pendente Real'],
      getSortTime: (i) => parseDataBaseProgramacao(i.DataBase).getTime(),
    });

    expect(out.map((x) => x.qtyToProduce)).toEqual([0, 10, 30]);
    expect(out.map((x) => x.fulfilledByStock)).toEqual([60, 40, 0]);
    expect(stockRemaining['PA-1']).toBe(0);
  });

  it('preserva ordem de entrada em empate de data', () => {
    const items = [
      { id: 'A', Cod: 'X', DataBase: '01/07/2026', 'Qtde Pendente Real': 40 },
      { id: 'B', Cod: 'X', DataBase: '01/07/2026', 'Qtde Pendente Real': 40 },
    ];
    const { items: out } = abaterSaldoEstoquePorDataAsc(items, { X: 50 }, {
      getCod: (i) => i.Cod,
      getRequestedQty: (i) => i['Qtde Pendente Real'],
      getSortTime: (i) => parseDataBaseProgramacao(i.DataBase).getTime(),
    });
    expect(out[0].id).toBe('A');
    expect(out[0].qtyToProduce).toBe(0);
    expect(out[0].fulfilledByStock).toBe(40);
    expect(out[1].qtyToProduce).toBe(30);
    expect(out[1].fulfilledByStock).toBe(10);
  });

  it('aplica Math.ceil no residual fracionário', () => {
    const items = [{ Cod: 'Y', DataBase: '01/07/2026', 'Qtde Pendente Real': 10.2 }];
    const { items: out } = abaterSaldoEstoquePorDataAsc(items, { Y: 5 }, {
      getCod: (i) => i.Cod,
      getRequestedQty: (i) => i['Qtde Pendente Real'],
      getSortTime: (i) => parseDataBaseProgramacao(i.DataBase).getTime(),
    });
    expect(out[0].fulfilledByStock).toBe(5);
    expect(out[0].qtyToProduce).toBe(6); // ceil(5.2)
  });
});

describe('montarQtdeLiquidaCalendario (universo planning)', () => {
  it('pedido fora do snapshot consome estoque e reduz qtde do snapshot', () => {
    const planning = [
      {
        idChave: '100',
        Cod: 'PA-1',
        Observacoes: 'ROTA A',
        DataBase: '01/07/2026',
        'Qtde Pendente Real': 80,
      },
      {
        idChave: '200',
        Cod: 'PA-1',
        Observacoes: 'ROTA B',
        DataBase: '02/07/2026',
        'Qtde Pendente Real': 50,
      },
    ];
    // Snapshot só tem o pedido 200
    const snapshot = [
      {
        row: {
          id_pedido: '200',
          Cod: 'PA-1',
          Observacoes: 'ROTA B',
          'Qtde Pendente Real': 50,
        },
        dataBaseSort: '2026-07-02',
      },
    ];
    const qty = montarQtdeLiquidaCalendario(planning, { 'PA-1': 100 }, snapshot);
    // Fora: 80 atendidos → saldo 20; snapshot: min(50,20)=20 → produzir 30
    expect(qty.get(0)).toBe(30);
  });

  it('linha só-snapshot usa saldo remanescente após planning', () => {
    const planning = [
      {
        idChave: '1',
        Cod: 'Z',
        Observacoes: 'R1',
        DataBase: '01/07/2026',
        'Qtde Pendente Real': 70,
      },
    ];
    const { filaQtyPorChave, stockRemaining } = processarPlanningComEstoque(planning, { Z: 100 });
    expect(stockRemaining.Z).toBe(30);

    const qty = qtdeLiquidaPorLinhaSnapshot(
      [
        {
          row: {
            id_pedido: '999',
            Cod: 'Z',
            Observacoes: 'SO-SNAP',
            'Qtde Pendente Real': 40,
          },
          dataBaseSort: '2026-07-05',
        },
      ],
      filaQtyPorChave,
      stockRemaining
    );
    expect(qty.get(0)).toBe(10); // 40 - 30
  });

  it('match planning→snapshot devolve qtyToProduce do planning', () => {
    const planning = [
      {
        idChave: '55',
        Cod: 'C1',
        Observacoes: 'OBS',
        DataBase: '10/07/2026',
        'Qtde Pendente Real': 25,
      },
    ];
    const qty = montarQtdeLiquidaCalendario(
      planning,
      { C1: 10 },
      [
        {
          row: {
            id_pedido: '55',
            Cod: 'C1',
            Observacoes: 'OBS',
            'Qtde Pendente Real': 25,
          },
          dataBaseSort: '2026-07-10',
        },
      ]
    );
    expect(qty.get(0)).toBe(15);
  });
});

describe('montarQtdeLiquidaDoSnapshot (estoque congelado)', () => {
  it('abate com estoque do snapshot sobre as próprias linhas', () => {
    const linhas: Record<string, unknown>[] = [
      {
        id_pedido: 'A',
        Cod: 'PA-1',
        Observacoes: 'R1',
        data_producao: '2026-07-01',
        'Qtde Pendente Real': 60,
      },
      {
        id_pedido: 'B',
        Cod: 'PA-1',
        Observacoes: 'R2',
        data_producao: '2026-07-02',
        'Qtde Pendente Real': 50,
      },
      {
        id_pedido: 'C',
        Cod: 'PA-1',
        Observacoes: 'R3',
        data_producao: '2026-07-03',
        'Qtde Pendente Real': 30,
      },
    ];
    const qty = montarQtdeLiquidaDoSnapshot(linhas, { 'PA-1': 100 });
    expect(qty.get(0)).toBe(0);
    expect(qty.get(1)).toBe(10);
    expect(qty.get(2)).toBe(30);
  });

  it('legado sem estoque (mapa vazio) = saldo 0 → qtde = pendente bruta', () => {
    const linhas: Record<string, unknown>[] = [
      {
        id_pedido: '1',
        Cod: 'Z',
        Observacoes: 'R',
        data_producao: '2026-07-01',
        'Qtde Pendente Real': 40,
      },
    ];
    const qty = montarQtdeLiquidaDoSnapshot(linhas, {});
    expect(qty.get(0)).toBe(40);
  });
});
