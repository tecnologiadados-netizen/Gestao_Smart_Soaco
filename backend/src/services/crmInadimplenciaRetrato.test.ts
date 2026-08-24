import { describe, expect, it } from 'vitest';
import {
  aplicarRetratoNaSerie,
  decidirFechamentoMesAnterior,
  limitesMes,
  mesAnteriorDe,
  type RetratoMensal,
} from './crmInadimplenciaRetrato.js';

describe('mesAnteriorDe / limitesMes', () => {
  it('volta um mês e cruza o ano', () => {
    expect(mesAnteriorDe('2026-08')).toBe('2026-07');
    expect(mesAnteriorDe('2026-01')).toBe('2025-12');
  });

  it('fecha o intervalo civil do mês', () => {
    expect(limitesMes('2026-02')).toEqual({ de: '2026-02-01', ate: '2026-02-28' });
    expect(limitesMes('2024-02')).toEqual({ de: '2024-02-01', ate: '2024-02-29' });
  });
});

describe('decidirFechamentoMesAnterior', () => {
  it('não mexe em retrato já oficial', () => {
    expect(
      decidirFechamentoMesAnterior({ existe: true, oficial: true, diaDoMesAtual: 1 }),
    ).toEqual({ acao: 'ignorar', motivo: 'ja_oficial' });
  });

  it('promove a foto de trabalho na virada', () => {
    expect(
      decidirFechamentoMesAnterior({ existe: true, oficial: false, diaDoMesAtual: 15 }),
    ).toEqual({ acao: 'promover' });
  });

  it('captura ao vivo só na janela dos 3 primeiros dias', () => {
    expect(
      decidirFechamentoMesAnterior({ existe: false, oficial: false, diaDoMesAtual: 1 }),
    ).toEqual({ acao: 'capturar_vivo', atrasado: false });
    expect(
      decidirFechamentoMesAnterior({ existe: false, oficial: false, diaDoMesAtual: 3 }),
    ).toEqual({ acao: 'capturar_vivo', atrasado: true });
    expect(
      decidirFechamentoMesAnterior({ existe: false, oficial: false, diaDoMesAtual: 24 }),
    ).toEqual({ acao: 'adiar', motivo: 'sem_trabalho_e_fora_da_janela' });
  });
});

describe('aplicarRetratoNaSerie', () => {
  const ponto = {
    mes: '2026-07',
    valorVencido: 1000,
    qtdVencido: 10,
    valorAtraso: 200,
    qtdAtraso: 2,
    valorAberto: 50,
    qtdAberto: 1,
    pctAtraso: 20,
    pctInadimplente: 5,
  };

  const retrato: RetratoMensal = {
    mes: '2026-07',
    valorVencido: 1000,
    qtdVencido: 10,
    valorAberto: 180,
    qtdAberto: 3,
    pctInadimplente: 18,
    valorAtraso: 200,
    qtdAtraso: 2,
    pctAtraso: 20,
    oficial: true,
    atrasado: false,
    capturadoEm: new Date('2026-08-01T03:10:00.000Z'),
  };

  it('congela aberto/% inadimplente de mês fechado e deixa atraso ao vivo', () => {
    const [out] = aplicarRetratoNaSerie([ponto], new Map([['2026-07', retrato]]), '2026-08');
    expect(out.fonteInadimplente).toBe('retrato');
    expect(out.pctInadimplente).toBe(18);
    expect(out.valorAberto).toBe(180);
    expect(out.qtdAberto).toBe(3);
    expect(out.pctAtraso).toBe(20);
    expect(out.valorAtraso).toBe(200);
  });

  it('não aplica retrato no mês corrente', () => {
    const [out] = aplicarRetratoNaSerie([ponto], new Map([['2026-07', retrato]]), '2026-07');
    expect(out.fonteInadimplente).toBe('ao_vivo');
    expect(out.pctInadimplente).toBe(5);
    expect(out.valorAberto).toBe(50);
  });

  it('ignora foto de trabalho (não oficial)', () => {
    const [out] = aplicarRetratoNaSerie(
      [ponto],
      new Map([['2026-07', { ...retrato, oficial: false }]]),
      '2026-08',
    );
    expect(out.fonteInadimplente).toBe('ao_vivo');
    expect(out.pctInadimplente).toBe(5);
  });
});
