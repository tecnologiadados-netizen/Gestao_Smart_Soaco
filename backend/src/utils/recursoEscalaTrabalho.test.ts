import { describe, expect, it } from 'vitest';
import {
  ESCALA_PERFILADEIRA_PADRAO,
  anexarExcecoes,
  horasEscalaNoDia,
  horasEscalaNoPeriodo,
  horasDosIntervalos,
  janelasEscalaNoDia,
  subtrairIntervalos,
  diaTemHorarioPontualSubstituir,
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

  it('zera feriado nacional sem pontualidade', () => {
    expect(horasEscalaNoDia('2026-09-07', semanal)).toBe(0); // Independência
  });

  it('aceita horário especial em feriado', () => {
    const escala = com([
      {
        id: 'ind',
        dataIni: '2026-09-07',
        dataFim: '2026-09-07',
        tipo: 'substituir',
        faixas: [{ inicio: '07:00', fim: '11:00' }],
      },
    ]);
    expect(horasEscalaNoDia('2026-09-07', escala)).toBe(4);
  });

  it('soma o período respeitando folga, feriado e extra', () => {
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
    // 07/09 Independência 0 + 08 folga 0 + 09 8.75 + 10 8.75 + 11 8.75 + 12 sáb 4
    expect(horasEscalaNoPeriodo('2026-09-07', '2026-09-12', escala)).toBe(30.25);
  });
});

describe('subtrairIntervalos / janelas pontuais', () => {
  it('isola o gap inicial da escala pontual antes do primeiro registro', () => {
    const escala = com([
      {
        id: 'sab',
        dataIni: '2026-09-05',
        dataFim: '2026-09-05',
        tipo: 'substituir',
        faixas: [{ inicio: '06:00', fim: '14:00' }],
      },
    ]);
    const janelas = janelasEscalaNoDia('2026-09-05', escala);
    expect(horasDosIntervalos(janelas)).toBe(8);

    const [y, mo, d] = [2026, 8, 5];
    const coberto = [
      {
        startMs: new Date(y, mo, d, 6, 29, 0).getTime(),
        endMs: new Date(y, mo, d, 14, 0, 0).getTime(),
      },
    ];
    const gaps = subtrairIntervalos(janelas, coberto);
    expect(gaps).toHaveLength(1);
    expect(new Date(gaps[0]!.startMs).getHours()).toBe(6);
    expect(new Date(gaps[0]!.startMs).getMinutes()).toBe(0);
    expect(new Date(gaps[0]!.endMs).getHours()).toBe(6);
    expect(new Date(gaps[0]!.endMs).getMinutes()).toBe(29);
    expect(diaTemHorarioPontualSubstituir('2026-09-05', escala)).toBe(true);
    expect(diaTemHorarioPontualSubstituir('2026-09-08', escala)).toBe(false);
  });
});
