import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  pedidoPermiteAlterarDatasCalendario,
  pedidoPermiteAlterarDatasNoSequenciamentoCalendario,
  rotaPermiteAlterarDatasCalendario,
  rotaPermiteAlterarDatasNoSequenciamentoCalendario,
  validarDatasReprogramacao,
} from './canalReprogramacaoDatas';

describe('rotaPermiteAlterarDatasNoSequenciamentoCalendario', () => {
  it('libera especiais e carradas', () => {
    expect(rotaPermiteAlterarDatasNoSequenciamentoCalendario('5-Requisicao')).toBe(true);
    expect(rotaPermiteAlterarDatasNoSequenciamentoCalendario('1-Retirada na So Aço')).toBe(true);
    expect(rotaPermiteAlterarDatasNoSequenciamentoCalendario('3-Entrega em Grande Teresina')).toBe(
      true
    );
    expect(rotaPermiteAlterarDatasNoSequenciamentoCalendario('4-Inserir em Romaneio')).toBe(true);
    expect(rotaPermiteAlterarDatasNoSequenciamentoCalendario('ROTA BELEM - LIBERADA')).toBe(true);
  });

  it('não altera o helper legado (especiais bloqueados no calendário genérico)', () => {
    expect(rotaPermiteAlterarDatasCalendario('5-Requisicao')).toBe(false);
    expect(rotaPermiteAlterarDatasCalendario('1-Retirada na So Aço')).toBe(false);
    expect(rotaPermiteAlterarDatasCalendario('3-Entrega em Grande Teresina')).toBe(false);
    expect(rotaPermiteAlterarDatasCalendario('ROTA BELEM - LIBERADA')).toBe(true);
  });
});

describe('pedidoPermiteAlterarDatasNoSequenciamentoCalendario', () => {
  it('libera requisição / retirada / entrega GT no sequenciamento', () => {
    expect(
      pedidoPermiteAlterarDatasNoSequenciamentoCalendario({
        TipoF: 'Requisição',
        Observacoes: '5-Requisicao',
      })
    ).toBe(true);
    expect(
      pedidoPermiteAlterarDatasNoSequenciamentoCalendario({
        TipoF: 'Retirada',
        Observacoes: '1-Retirada na So Aço',
      })
    ).toBe(true);
    expect(
      pedidoPermiteAlterarDatasNoSequenciamentoCalendario({
        TipoF: 'Entrega',
        Observacoes: '3-Entrega em Grande Teresina',
      })
    ).toBe(true);
  });

  it('mantém legado do calendário genérico bloqueando especiais', () => {
    expect(
      pedidoPermiteAlterarDatasCalendario({
        TipoF: 'Requisição',
        Observacoes: '5-Requisicao',
      })
    ).toBe(false);
  });
});

describe('validarDatasReprogramacao', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('aceita produção e previsão futuras quando hoje é o dia anterior', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 30, 12, 0, 0)); // 30/07/2026 local
    expect(
      validarDatasReprogramacao({
        previsaoIso: '2026-08-06',
        producaoIso: '2026-07-31',
      })
    ).toBeNull();
  });

  it('não bloqueia reprogramação de previsão quando a produção atual já está no passado', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 30, 12, 0, 0));
    expect(
      validarDatasReprogramacao({
        previsaoIso: '2026-08-06',
        producaoIso: '2026-07-29', // produção já gravada
        exigirProducaoNaoAnteriorHoje: false,
      })
    ).toBeNull();
  });

  it('bloqueia nova produção anterior a hoje', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 30, 12, 0, 0));
    expect(
      validarDatasReprogramacao({
        producaoIso: '2026-07-29',
      })
    ).toBe('A data de produção não pode ser anterior à data de hoje.');
  });
});
