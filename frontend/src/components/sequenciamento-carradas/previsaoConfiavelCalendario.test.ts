import { describe, it, expect } from 'vitest';
import {
  agregarStatusConfiavel,
  linhaPassaFiltroConfiavel,
  mapaStatusConfiavelPorId,
  statusConfiavelDaLinha,
  statusConfiavelDoDetalhe,
  statusConfiavelEfetivo,
} from './previsaoConfiavelCalendario';

describe('statusConfiavelEfetivo', () => {
  it('prioriza override do rascunho sobre o snapshot', () => {
    expect(statusConfiavelEfetivo('a', { a: false }, true)).toBe('nao');
    expect(statusConfiavelEfetivo('a', { a: true }, false)).toBe('sim');
  });

  it('usa snapshot quando não há override', () => {
    expect(statusConfiavelEfetivo('a', {}, true)).toBe('sim');
    expect(statusConfiavelEfetivo('a', {}, false)).toBe('nao');
    expect(statusConfiavelEfetivo('a', { a: null }, true)).toBe('sim');
  });

  it('fica em branco sem override nem snapshot', () => {
    expect(statusConfiavelEfetivo(undefined, {}, null)).toBe('branco');
    expect(statusConfiavelEfetivo('a', {}, null)).toBe('branco');
    expect(statusConfiavelEfetivo('a', {}, undefined)).toBe('branco');
  });
});

describe('statusConfiavelDaLinha / mapa', () => {
  it('lê previsao_atual_confiavel da linha', () => {
    const row: Record<string, unknown> = {
      id_pedido: '100-1',
      previsao_atual_confiavel: true,
    };
    expect(statusConfiavelDaLinha(row, {})).toBe('sim');
    expect(statusConfiavelDaLinha(row, { '100-1': false })).toBe('nao');
  });

  it('mapaStatusConfiavelPorId cobre todas as linhas com id', () => {
    const linhas: Record<string, unknown>[] = [
      { id_pedido: 'a', previsao_atual_confiavel: true },
      { id_pedido: 'b', previsao_atual_confiavel: false },
      { id_pedido: 'c' },
      { PD: 'sem-id' },
    ];
    const map = mapaStatusConfiavelPorId(linhas, { c: true });
    expect(map.get('a')).toBe('sim');
    expect(map.get('b')).toBe('nao');
    expect(map.get('c')).toBe('sim');
    expect(map.size).toBe(3);
  });
});

describe('agregarStatusConfiavel', () => {
  it('retorna só sim quando todos são confiáveis', () => {
    expect(agregarStatusConfiavel(['sim', 'sim'])).toEqual(['sim']);
  });

  it('mostra todos os presentes em mistura Não confiável + em branco', () => {
    expect(agregarStatusConfiavel(['nao', 'branco', 'nao'])).toEqual(['nao', 'branco']);
  });

  it('ordena sim → nao → branco', () => {
    expect(agregarStatusConfiavel(['branco', 'sim', 'nao'])).toEqual(['sim', 'nao', 'branco']);
  });
});

describe('linhaPassaFiltroConfiavel', () => {
  it('vazio = Todos', () => {
    expect(linhaPassaFiltroConfiavel('sim', [])).toBe(true);
    expect(linhaPassaFiltroConfiavel('branco', [])).toBe(true);
  });

  it('filtra por seleção', () => {
    expect(linhaPassaFiltroConfiavel('sim', ['sim'])).toBe(true);
    expect(linhaPassaFiltroConfiavel('nao', ['sim'])).toBe(false);
    expect(linhaPassaFiltroConfiavel('branco', ['nao', 'branco'])).toBe(true);
  });
});

describe('statusConfiavelDoDetalhe', () => {
  it('sem idPedido = em branco; com id usa o mapa', () => {
    const map = new Map([
      ['a', 'sim' as const],
      ['b', 'nao' as const],
    ]);
    expect(statusConfiavelDoDetalhe(undefined, map)).toBe('branco');
    expect(statusConfiavelDoDetalhe('a', map)).toBe('sim');
    expect(statusConfiavelDoDetalhe('inexistente', map)).toBe('branco');
  });
});
