import { describe, expect, it } from 'vitest';
import type { DreEstruturaNo } from './ArvoreContasDre';
import type { DreRateioConfig } from './dreRateioEmpresas';
import { aplicarRateioNasSaidas } from './dreRateioSaidas';

const SALARIOS: DreEstruturaNo = {
  pathKey: 'D/10/0/0',
  id: 37,
  nome: 'Salários',
  tipo: 'A',
  macro: 'DESP_ADM',
  codigo: '13.1.1',
  sinal: -1,
  children: [],
};

const config: DreRateioConfig = {
  regras: [
    {
      id: 'paulo',
      origem: {
        tipo: 'fornecedores',
        codigoConta: '13.1.1',
        pathKeyConta: 'D/10/0/0',
        nomeConta: 'Salários',
        nomes: ['PAULO CEZAR SOARES DO BONFIM'],
      },
      percentuais: { 1: 0, 2: 0, 3: 100, 4: 0 },
    },
    {
      id: 'grupo',
      origem: {
        tipo: 'fornecedores',
        codigoConta: '13.1.1',
        pathKeyConta: 'D/10/0/0',
        nomeConta: 'Salários',
        nomes: ['LUISA FRANCISCA DA SILVA'],
      },
      percentuais: { 1: 70, 2: 15, 3: 5, 4: 10 },
    },
  ],
};

function celula(idEmpresas: number[], filtroGrupo: number, poolGrupo: number): number {
  const saidas = new Map<string, Record<string, number>>([['D/10/0/0', { '2026-09': -98828.42 }]]);
  const out = aplicarRateioNasSaidas(
    saidas,
    [SALARIOS],
    ['2026-09'],
    config,
    idEmpresas,
    { paulo: { '2026-09': 2411.17 }, grupo: { '2026-09': poolGrupo } },
    { paulo: { '2026-09': 2411.17 }, grupo: { '2026-09': filtroGrupo } },
  );
  return out.get('D/10/0/0')?.['2026-09'] ?? 0;
}

describe('rateio de fornecedor em linha única', () => {
  it('com todas as empresas, a célula fica no físico mesmo se o filtro omitir uma pessoa', () => {
    expect(celula([1, 2, 3, 4], 7491.4, 8996.24)).toBe(-98828.42);
  });

  it('com totais iguais, a célula também fica no físico', () => {
    expect(celula([1, 2, 3, 4], 8996.24, 8996.24)).toBe(-98828.42);
  });

  it('com uma empresa, tira o físico rateado e recoloca só a fatia', () => {
    const saidas = new Map<string, Record<string, number>>([['D/10/0/0', { '2026-09': -1000 }]]);
    const parcial: DreRateioConfig = {
      regras: [config.regras[1]!],
    };
    const out = aplicarRateioNasSaidas(
      saidas,
      [SALARIOS],
      ['2026-09'],
      parcial,
      [1],
      { grupo: { '2026-09': 2000 } },
      { grupo: { '2026-09': 700 } },
    );
    // 300 fora do rateio + 70% de 2.000
    expect(out.get('D/10/0/0')?.['2026-09']).toBe(-1700);
  });
});
