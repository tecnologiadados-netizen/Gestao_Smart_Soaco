import { describe, expect, it } from 'vitest';
import { categoriaParadaCamasi, isMotivoJornadaCamasi } from './camasiMotivoJornada.js';

describe('isMotivoJornadaCamasi', () => {
  it('reconhece início e fim de jornada', () => {
    expect(isMotivoJornadaCamasi('INÍCIO JORNADA')).toBe(true);
    expect(isMotivoJornadaCamasi('INICIO JORNADA')).toBe(true);
    expect(isMotivoJornadaCamasi('FIM JORNADA')).toBe(true);
    expect(isMotivoJornadaCamasi('Fim de jornada')).toBe(true);
  });

  it('não classifica setup ou ajuste como jornada', () => {
    expect(isMotivoJornadaCamasi('SET UP PRODUTO')).toBe(false);
    expect(isMotivoJornadaCamasi('AJUSTE OPERACIONAL')).toBe(false);
    expect(isMotivoJornadaCamasi('INÍCIO SETUP')).toBe(false);
  });

  it('categoriaParadaCamasi', () => {
    expect(categoriaParadaCamasi('FIM JORNADA')).toBe('jornada');
    expect(categoriaParadaCamasi('MANUTENCAO MECANICA')).toBe('operacional');
  });
});
