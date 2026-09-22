import { describe, expect, it } from 'vitest';
import {
  agregarCelulasRecurso1000,
  agregarComponentesDiaRecurso1000,
  agregarConsumoRecurso1000,
  alocarFaltaRecurso1000,
  projetarSaldoRecurso1000,
  statusCelulasRecurso1000,
} from '../src/utils/calendarioRecurso1000Agregar.js';

const BOM = [
  {
    codigoPa: 'AR 0040',
    idComponente: 10,
    codigoComponente: 'PP 0107',
    descricaoComponente: 'Fundo armário',
    qtdePorPa: 1,
  },
  {
    codigoPa: 'AR 0040',
    idComponente: 11,
    codigoComponente: 'PP 0122',
    descricaoComponente: 'Tampa inferior',
    qtdePorPa: 1,
  },
  {
    codigoPa: 'FO 0001',
    idComponente: 10,
    codigoComponente: 'PP 0107',
    descricaoComponente: 'Fundo armário',
    qtdePorPa: 2,
  },
];

describe('agregarCelulasRecurso1000', () => {
  it('marca célula só quando o PA explode em componente 124', () => {
    const { celulas, datas } = agregarCelulasRecurso1000(BOM, [
      { codigoPa: 'AR 0040', qtde: 9, dataIso: '2026-08-18', setor: 'Móveis de aço' },
      { codigoPa: 'XX 9999', qtde: 5, dataIso: '2026-08-18', setor: 'Móveis de aço' },
      { codigoPa: 'FO 0001', qtde: 3, dataIso: '2026-08-19', setor: 'Fogões' },
    ]);
    expect(datas).toEqual(['2026-08-18', '2026-08-19']);
    expect(celulas).toEqual(
      expect.arrayContaining([
        { setor: 'Móveis de aço', data: '2026-08-18' },
        { setor: 'Fogões', data: '2026-08-19' },
      ])
    );
    expect(celulas).toHaveLength(2);
  });

  it('ignora qtde zerada', () => {
    const { celulas } = agregarCelulasRecurso1000(BOM, [
      { codigoPa: 'AR 0040', qtde: 0, dataIso: '2026-08-18', setor: 'Móveis de aço' },
    ]);
    expect(celulas).toEqual([]);
  });
});

describe('agregarComponentesDiaRecurso1000', () => {
  it('soma o mesmo componente de PAs distintos no setor/dia', () => {
    const rows = agregarComponentesDiaRecurso1000(
      BOM,
      [
        { codigoPa: 'AR 0040', qtde: 9, dataIso: '2026-08-18', setor: 'Móveis de aço' },
        { codigoPa: 'FO 0001', qtde: 3, dataIso: '2026-08-18', setor: 'Móveis de aço' },
        { codigoPa: 'AR 0040', qtde: 2, dataIso: '2026-08-19', setor: 'Móveis de aço' },
      ],
      '2026-08-18',
      'Móveis de aço'
    );
    expect(rows.map((r) => ({ codigo: r.codigo, qtde: r.qtde }))).toEqual([
      { codigo: 'PP 0107', qtde: 15 },
      { codigo: 'PP 0122', qtde: 9 },
    ]);
    const fundo = rows.find((r) => r.codigo === 'PP 0107');
    expect(fundo?.origens.reduce((s, o) => s + o.qtdeComponente, 0)).toBe(15);
  });

  it('sem setor retorna todos os setores do dia', () => {
    const rows = agregarComponentesDiaRecurso1000(
      BOM,
      [
        { codigoPa: 'AR 0040', qtde: 1, dataIso: '2026-08-18', setor: 'Móveis de aço' },
        { codigoPa: 'FO 0001', qtde: 1, dataIso: '2026-08-18', setor: 'Fogões' },
      ],
      '2026-08-18',
      null
    );
    const fundo = rows.find((r) => r.codigo === 'PP 0107');
    expect(fundo?.qtde).toBe(3);
  });

  it('acumula consumo e origens dos dias anteriores até a data', () => {
    const rows = agregarComponentesDiaRecurso1000(
      BOM,
      [
        {
          codigoPa: 'AR 0040',
          qtde: 3,
          dataIso: '2026-08-18',
          setor: 'Móveis de aço',
          pd: 'PD 1',
          carrada: '1',
        },
        {
          codigoPa: 'AR 0040',
          qtde: 7,
          dataIso: '2026-08-22',
          setor: 'Móveis de aço',
          pd: 'PD 50019',
          carrada: '5-Requisicao',
        },
      ],
      '2026-08-22',
      'Móveis de aço'
    );
    const fundo = rows.find((r) => r.codigo === 'PP 0107');
    expect(fundo?.qtde).toBe(10);
    expect(fundo?.origens).toEqual([
      {
        dataIso: '2026-08-18',
        carrada: '1',
        pd: 'PD 1',
        qtdeComponente: 3,
        setor: 'Móveis de aço',
      },
      {
        dataIso: '2026-08-22',
        carrada: '5-Requisicao',
        pd: 'PD 50019',
        qtdeComponente: 7,
        setor: 'Móveis de aço',
      },
    ]);
  });
});

describe('projetarSaldoRecurso1000', () => {
  it('subtrai o consumo dos dias anteriores e falta só no dia que estoura', () => {
    const consumo = new Map([
      ['2026-08-18', 100],
      ['2026-08-19', 200],
    ]);
    const datas = ['2026-08-18', '2026-08-19'];
    const d1 = projetarSaldoRecurso1000(consumo, datas, 256, '2026-08-18');
    expect(d1).toEqual({
      saldoInicio: 256,
      consumidoAntes: 0,
      consumoDiaTotal: 100,
      consumoAcumTotal: 100,
      faltaAcum: 0,
    });
    const d2 = projetarSaldoRecurso1000(consumo, datas, 256, '2026-08-19');
    expect(d2).toEqual({
      saldoInicio: 156,
      consumidoAntes: 100,
      consumoDiaTotal: 200,
      consumoAcumTotal: 300,
      faltaAcum: 44,
    });
  });

  it('saldo não fica negativo após estouro', () => {
    const consumo = new Map([
      ['2026-08-18', 10],
      ['2026-08-19', 5],
    ]);
    const d2 = projetarSaldoRecurso1000(consumo, ['2026-08-18', '2026-08-19'], 8, '2026-08-19');
    expect(d2.saldoInicio).toBe(0);
    expect(d2.faltaAcum).toBe(7);
    expect(d2.consumidoAntes).toBe(10);
    expect(d2.consumoAcumTotal).toBe(15);
  });

  it('acumula a falta dos dias anteriores sem estoque', () => {
    const consumo = new Map([
      ['2026-08-18', 3],
      ['2026-08-22', 7],
    ]);
    const d22 = projetarSaldoRecurso1000(consumo, ['2026-08-18', '2026-08-22'], 0, '2026-08-22');
    expect(d22.saldoInicio).toBe(0);
    expect(d22.consumoDiaTotal).toBe(7);
    expect(d22.consumoAcumTotal).toBe(10);
    expect(d22.faltaAcum).toBe(10);
  });
});

describe('alocarFaltaRecurso1000', () => {
  it('reparte a falta do dia na proporção do consumo do setor', () => {
    expect(alocarFaltaRecurso1000(60, 80, 160)).toBe(30);
    expect(alocarFaltaRecurso1000(60, 160, 160)).toBe(60);
    expect(alocarFaltaRecurso1000(0, 80, 160)).toBe(0);
  });
});

describe('statusCelulasRecurso1000', () => {
  it('marca falta só nas células cujo dia já estourou o estoque', () => {
    const demanda = [
      { codigoPa: 'FO 0001', qtde: 100, dataIso: '2026-08-18', setor: 'Móveis de aço' },
      { codigoPa: 'FO 0001', qtde: 100, dataIso: '2026-08-19', setor: 'Fogões' },
    ];
    const agg = agregarConsumoRecurso1000(BOM, demanda);
    const saldo = new Map([[10, 250]]);
    const celulas = [
      { setor: 'Móveis de aço', data: '2026-08-18' },
      { setor: 'Fogões', data: '2026-08-19' },
    ];
    expect(statusCelulasRecurso1000(agg, saldo, celulas)).toEqual([
      { setor: 'Móveis de aço', data: '2026-08-18', status: 'ok' },
      { setor: 'Fogões', data: '2026-08-19', status: 'falta' },
    ]);
  });
});
