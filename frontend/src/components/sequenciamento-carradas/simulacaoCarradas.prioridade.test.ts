import { describe, it, expect } from 'vitest';
import {
  ordenarChavesPorPrioridade,
  sincronizarPrioridadesComOrdem,
  filtrarPrioridadesSeed,
  indiceBasePrioridadeParaAutopreencher,
  autopreencherPrioridadesSequenciais,
} from './simulacaoCarradas';

describe('ordenarChavesPorPrioridade', () => {
  it('ordena do maior para o menor quando há prioridades preenchidas', () => {
    const keys = ['a', 'b', 'c', 'd'];
    const prioridades = { a: 10, b: 30, c: 20 };
    expect(ordenarChavesPorPrioridade(keys, prioridades)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('mantém ordem original quando nenhuma prioridade preenchida', () => {
    const keys = ['a', 'b', 'c'];
    expect(ordenarChavesPorPrioridade(keys, {})).toEqual(['a', 'b', 'c']);
  });

  it('ordena ascendente quando dir=asc', () => {
    const keys = ['a', 'b', 'c'];
    const prioridades = { a: 10, b: 30, c: 20 };
    expect(ordenarChavesPorPrioridade(keys, prioridades, 'asc')).toEqual(['a', 'c', 'b']);
  });
});

describe('sincronizarPrioridadesComOrdem', () => {
  it('atribui números decrescentes conforme posição visual', () => {
    const keys = ['x', 'y', 'z'];
    expect(sincronizarPrioridadesComOrdem(keys)).toEqual({ x: 3, y: 2, z: 1 });
  });
});

describe('filtrarPrioridadesSeed', () => {
  it('mantém só chaves presentes na consulta atual', () => {
    const keys = new Set(['a', 'b']);
    expect(filtrarPrioridadesSeed({ a: 5, b: 3, c: 9 }, keys)).toEqual({ a: 5, b: 3 });
  });
});

describe('indiceBasePrioridadeParaAutopreencher', () => {
  it('usa a chave preferida quando ela tem Seq. preenchida', () => {
    const keys = ['a', 'b', 'c'];
    expect(indiceBasePrioridadeParaAutopreencher(keys, { a: 1, b: 2 }, 'b')).toBe(1);
  });

  it('cai na primeira Seq. do topo quando a preferida está vazia', () => {
    const keys = ['a', 'b', 'c'];
    expect(indiceBasePrioridadeParaAutopreencher(keys, { b: 5 }, 'a')).toBe(1);
  });
});

describe('autopreencherPrioridadesSequenciais', () => {
  it('preenche abaixo da base com +1 sobrescrevendo valores existentes', () => {
    const keys = ['a', 'b', 'c', 'd'];
    const prioridades = { a: 1, b: 2, c: 6, d: 4 };
    expect(autopreencherPrioridadesSequenciais(keys, prioridades, 1)).toEqual({
      a: 1,
      b: 2,
      c: 3,
      d: 4,
    });
  });

  it('não altera nada sem base válida', () => {
    const keys = ['a', 'b'];
    const prioridades = { a: 1 };
    expect(autopreencherPrioridadesSequenciais(keys, prioridades, -1)).toEqual({ a: 1 });
  });
});
