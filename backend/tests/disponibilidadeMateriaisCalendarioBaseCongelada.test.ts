import { describe, expect, it } from 'vitest';
import {
  obterHorizonteItem,
  obterMateriaisDoDia,
  type BaseMateriaisCongelada,
  type DemandaCalendarioLinha,
} from '../src/services/disponibilidadeMateriaisCalendarioService.js';

/**
 * Base congelada mínima: 1 PA (id 10) que consome 2 un do componente COMP-1 (id 100),
 * saldo inicial 5 no almox secundário e 1 PC de 4 un para 25/07.
 */
const BASE: BaseMateriaisCongelada = {
  version: 1,
  capturadoEm: '2026-07-24T12:00:00.000Z',
  hoje: '2026-07-24',
  idPorCodigoPa: { 'PA-1': 10 },
  bom: [{ idPa: 10, idComp: 100, cod: 'COMP-1', desc: 'Componente 1', qtdePorPa: 2 }],
  saldoPorIdComp: { '100': 5 },
  pcLinhas: [
    { idProduto: 100, pedidoCompra: 'PC-1', dataEntrega: '2026-07-25', qtde: 4 },
    { idProduto: 100, pedidoCompra: 'PC-2', dataEntrega: '2026-07-25', qtde: 1 },
  ],
};

const DEMANDA: DemandaCalendarioLinha[] = [
  { codigoPa: 'PA-1', qtde: 3, dataIso: '2026-07-24', pd: '100', setor: 'Solda', carrada: 'ROTA A' },
  { codigoPa: 'PA-1', qtde: 1, dataIso: '2026-07-24', pd: '101', setor: 'Solda', carrada: 'ROTA A' },
  { codigoPa: 'PA-1', qtde: 2, dataIso: '2026-07-25', pd: '102', setor: 'Pintura', carrada: 'ROTA B' },
];

describe('motor de disponibilidade com base congelada', () => {
  it('calcula sem pool (ERP fora do ar) usando BOM, saldo e PC do snapshot', async () => {
    const r = await obterMateriaisDoDia(null, DEMANDA, '2026-07-24', BASE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const [material] = r.data.materiais;
    expect(material).toBeDefined();
    expect(material!.codigo).toBe('COMP-1');
    // 4 PA no dia × 2 un por PA
    expect(material!.consumoDia).toBe(8);
    expect(material!.saldoInicio).toBe(5);
    expect(material!.entradaDia).toBe(0);
    expect(material!.falta).toBe(3);
    // consultadoEm é o instante da captura, não o "agora"
    expect(r.data.consultadoEm).toBe(BASE.capturadoEm);
  });

  it('agrega entradas de PC do mesmo dia (grade == soma das linhas congeladas)', async () => {
    const r = await obterHorizonteItem(null, DEMANDA, 'COMP-1', BASE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const dia25 = r.data.dias.find((d) => d.data === '2026-07-25');
    expect(dia25?.entrada).toBe(5);
    expect(dia25?.consumo).toBe(4);
  });

  it('origem do consumo compacta por (data, carrada, pd)', async () => {
    const r = await obterHorizonteItem(null, DEMANDA, 'COMP-1', BASE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.data.origens).toEqual([
      { dataIso: '2026-07-24', carrada: 'ROTA A', pd: '100', qtdeComponente: 6 },
      { dataIso: '2026-07-24', carrada: 'ROTA A', pd: '101', qtdeComponente: 2 },
      { dataIso: '2026-07-25', carrada: 'ROTA B', pd: '102', qtdeComponente: 4 },
    ]);
  });

  it('materiais do dia devolvem só as origens daquela data — grade == modal', async () => {
    const r = await obterMateriaisDoDia(null, DEMANDA, '2026-07-24', BASE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const material = r.data.materiais[0]!;
    const somaModal = material.origens.reduce((s, o) => s + o.qtdeComponente, 0);
    expect(material.origens.every((o) => o.dataIso === '2026-07-24')).toBe(true);
    expect(somaModal).toBe(material.consumoDia);
  });

  it('soma as linhas de mesma carrada e PD em uma única origem', async () => {
    const demanda: DemandaCalendarioLinha[] = [
      { codigoPa: 'PA-1', qtde: 1, dataIso: '2026-07-24', pd: '100', carrada: 'ROTA A' },
      { codigoPa: 'PA-1', qtde: 2, dataIso: '2026-07-24', pd: '100', carrada: 'ROTA A' },
    ];
    const r = await obterHorizonteItem(null, demanda, 'COMP-1', BASE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.data.origens).toEqual([
      { dataIso: '2026-07-24', carrada: 'ROTA A', pd: '100', qtdeComponente: 6 },
    ]);
  });

  it('sem base e sem pool devolve erro em vez de consultar o ERP', async () => {
    const r = await obterMateriaisDoDia(null, DEMANDA, '2026-07-24', null);
    expect(r.ok).toBe(false);
  });
});
