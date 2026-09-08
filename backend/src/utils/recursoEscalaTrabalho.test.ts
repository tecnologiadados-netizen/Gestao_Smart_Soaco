import { describe, expect, it } from 'vitest';
import {
  ESCALA_PERFILADEIRA_PADRAO,
  anexarExcecoes,
  horasEscalaNoDia,
  horasEscalaNoPeriodo,
  type RecursoEscalaExcecao,
} from './recursoEscalaTrabalho.js';

const semanal = ESCALA_PERFILADEIRA_PADRAO; // seg–sex 07:00–11:30 / 13:00–17:15 = 8.75h

function com(excecoes: RecursoEscalaExcecao[]) {
  return anexarExcecoes(semanal, excecoes)!;
}

describe('horasEscalaNoDia com exceções pontuais', () => {
  it('mantém a escala semanal em dia útil sem exceção', () => {
    expect(horasEscalaNoDia('2026-09-08', semanal)).toBe(8.75); // terça
  });

  it('zera folga em dia que seria útil', () => {
    const escala = com([
      { id: 'f1', dataIni: '2026-09-08', dataFim: '2026-09-08', tipo: 'folga' },
    ]);
    expect(horasEscalaNoDia('2026-09-08', escala)).toBe(0);
    expect(horasEscalaNoDia('2026-09-09', escala)).toBe(8.75);
  });

  it('aplica horário especial (hora extra) no mesmo dia útil', () => {
    const escala = com([
      {
        id: 'he',
        dataIni: '2026-09-08',
        dataFim: '2026-09-08',
        tipo: 'substituir',
        faixas: [
          { inicio: '07:00', fim: '11:30' },
          { inicio: '13:00', fim: '20:00' },
        ],
      },
    ]);
    expect(horasEscalaNoDia('2026-09-08', escala)).toBe(11.5);
  });

  it('conta sábado com horário especial mesmo fora da semana padrão', () => {
    const escala = com([
      {
        id: 'sab',
        dataIni: '2026-09-12',
        dataFim: '2026-09-12',
        tipo: 'substituir',
        faixas: [{ inicio: '07:00', fim: '12:00' }],
      },
    ]);
    expect(horasEscalaNoDia('2026-09-12', escala)).toBe(5); // sábado
    expect(horasEscalaNoDia('2026-09-11', escala)).toBe(8.75); // sexta
  });

  it('a última exceção que cobre o dia prevalece', () => {
    const escala = com([
      { id: 'a', dataIni: '2026-09-07', dataFim: '2026-09-11', tipo: 'folga' },
      {
        id: 'b',
        dataIni: '2026-09-08',
        dataFim: '2026-09-08',
        tipo: 'substituir',
        faixas: [{ inicio: '08:00', fim: '12:00' }],
      },
    ]);
    expect(horasEscalaNoDia('2026-09-07', escala)).toBe(0);
    expect(horasEscalaNoDia('2026-09-08', escala)).toBe(4);
    expect(horasEscalaNoDia('2026-09-09', escala)).toBe(0);
  });

  it('soma o período respeitando folga e extra', () => {
    const escala = com([
      { id: 'f', dataIni: '2026-09-08', dataFim: '2026-09-08', tipo: 'folga' },
      {
        id: 's',
        dataIni: '2026-09-12',
        dataFim: '2026-09-12',
        tipo: 'substituir',
        faixas: [{ inicio: '08:00', fim: '12:00' }],
      },
    ]);
    // 07/09 seg 8.75 + 08 folga 0 + 09 8.75 + 10 8.75 + 11 8.75 + 12 sáb 4
    expect(horasEscalaNoPeriodo('2026-09-07', '2026-09-12', escala)).toBe(39);
  });
});
