import { describe, expect, it } from 'vitest';
import { horasEscalaNoDia } from './recursoEscalaHoras';
import type { RecursoEscala } from '../components/programacao-producao/types';

const semanal: RecursoEscala = {
  diasSemana: [1, 2, 3, 4, 5],
  faixas: [
    { inicio: '07:00', fim: '11:30' },
    { inicio: '13:00', fim: '17:15' },
  ],
};

describe('horasEscalaNoDia (frontend)', () => {
  it('usa a escala semanal', () => {
    expect(horasEscalaNoDia('2026-09-08', semanal)).toBe(8.75);
  });

  it('zera folga pontual', () => {
    expect(
      horasEscalaNoDia('2026-09-08', {
        ...semanal,
        excecoes: [{ id: '1', dataIni: '2026-09-08', dataFim: '2026-09-08', tipo: 'folga' }],
      })
    ).toBe(0);
  });

  it('conta sábado com horário especial', () => {
    expect(
      horasEscalaNoDia('2026-09-12', {
        ...semanal,
        excecoes: [
          {
            id: '2',
            dataIni: '2026-09-12',
            dataFim: '2026-09-12',
            tipo: 'substituir',
            faixas: [{ inicio: '07:00', fim: '12:00' }],
          },
        ],
      })
    ).toBe(5);
  });
});
