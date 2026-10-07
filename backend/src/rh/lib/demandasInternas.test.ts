import { describe, expect, it } from 'vitest';
import {
  canEditRoute,
  canViewRoute,
  granularPermissionFallback,
  normalizeRhPermissions,
} from './rh-permissions.js';
import { inserirAntes, normalizarChecklists, normalizarCor, normalizarPrazo } from './demandasInternas.js';

describe('ordem dos cards', () => {
  it('insere o card antes de outro e tira a posição antiga', () => {
    expect(inserirAntes(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
    expect(inserirAntes(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'a', 'c']);
    expect(inserirAntes(['a', 'b', 'c'], 'b', null)).toEqual(['a', 'c', 'b']);
    expect(inserirAntes(['a', 'b'], 'a', 'b')).toEqual(['a', 'b']);
  });
});

describe('cor do post-it', () => {
  it('aceita a paleta e cai no branco quando vem vazio', () => {
    expect(normalizarCor('Vermelho')).toBe('vermelho');
    expect(normalizarCor('')).toBe('branco');
    expect(normalizarCor(undefined)).toBe('branco');
    expect(() => normalizarCor('preto')).toThrow(/cor do post-it/);
  });
});

describe('prazo do card', () => {
  it('aceita a data e limpa quando vem vazio', () => {
    expect(normalizarPrazo('2026-10-07')).toBe('2026-10-07');
    expect(normalizarPrazo('')).toBeNull();
    expect(normalizarPrazo(null)).toBeNull();
    expect(() => normalizarPrazo('07/10/2026')).toThrow(/prazo/);
    expect(() => normalizarPrazo('2026-02-31')).toThrow(/prazo/);
  });
});

describe('checklist do card', () => {
  it('descarta item vazio e preserva o que foi marcado', () => {
    const listas = normalizarChecklists([
      {
        id: 'checklist1',
        titulo: '  Entrevista  ',
        itens: [
          { id: 'item00001', texto: '  Assinatura  ', feito: true },
          { id: 'item00002', texto: '   ', feito: true },
        ],
      },
    ]);
    expect(listas).toEqual([
      {
        id: 'checklist1',
        titulo: 'Entrevista',
        itens: [{ id: 'item00001', texto: 'Assinatura', feito: true }],
      },
    ]);
  });
});

describe('permissão de demandas internas', () => {
  it('libera a rota a partir do bloco do módulo', () => {
    const permissoes = normalizeRhPermissions({
      demandasInternas: { view: true, edit: false },
    });
    expect(permissoes.demandasInternas).toEqual({ view: true, edit: false });
    expect(permissoes.routes.find((rota) => rota.url === '/demandas-internas')).toMatchObject({
      canView: true,
      canEdit: false,
    });
    expect(canViewRoute(permissoes, '/demandas-internas')).toBe(true);
    expect(canEditRoute(permissoes, '/demandas-internas')).toBe(false);
    expect(granularPermissionFallback(permissoes, '/demandas-internas', 'edit')).toBe(false);
  });
});
