import { describe, expect, it } from 'vitest';
import {
  divergenciaCondicaoPorPrazos,
  ehCondicaoAVista,
} from '../data/doubleCheckInRepository.js';

describe('ehCondicaoAVista', () => {
  it('reconhece regra 0', () => {
    expect(ehCondicaoAVista({ condicao: 'X', regra: '0' })).toBe(true);
  });

  it('reconhece nome À Vista', () => {
    expect(ehCondicaoAVista({ condicao: 'À Vista.', regra: '1' })).toBe(true);
  });

  it('reconhece só prazos 0d', () => {
    expect(ehCondicaoAVista({ condicao: 'Outros', regra: '30', prazos: [0] })).toBe(true);
  });

  it('não marca 30/60/90', () => {
    expect(ehCondicaoAVista({ condicao: '30/60/90', regra: '30', prazos: [30, 60, 90] })).toBe(
      false
    );
  });
});

describe('divergenciaCondicaoPorPrazos — à vista', () => {
  it('ambos à vista: sem divergência mesmo com data base só no DE', () => {
    expect(
      divergenciaCondicaoPorPrazos({
        prazosNF: [0],
        prazosPC: [],
        condicaoNF: 'À Vista.',
        regraNF: '0',
        condicaoPC: 'À Vista.',
        regraPC: '0',
      })
    ).toBe(false);
  });

  it('ambos à vista com 0d: sem divergência', () => {
    expect(
      divergenciaCondicaoPorPrazos({
        prazosNF: [0],
        prazosPC: [0],
        condicaoNF: 'À Vista.',
        regraNF: '0',
        condicaoPC: 'À Vista.',
        regraPC: '0',
      })
    ).toBe(false);
  });

  it('à vista × 21d: divergente', () => {
    expect(
      divergenciaCondicaoPorPrazos({
        prazosNF: [0],
        prazosPC: [21],
        condicaoNF: 'À Vista.',
        regraNF: '0',
        condicaoPC: '21 dias',
        regraPC: '21',
      })
    ).toBe(true);
  });

  it('mesmos prazos parcelados: sem divergência', () => {
    expect(
      divergenciaCondicaoPorPrazos({
        prazosNF: [30, 60, 90],
        prazosPC: [30, 60, 90],
        condicaoNF: '30/60/90',
        regraNF: '1',
        condicaoPC: 'Não Existente',
        regraPC: '1',
      })
    ).toBe(false);
  });
});
