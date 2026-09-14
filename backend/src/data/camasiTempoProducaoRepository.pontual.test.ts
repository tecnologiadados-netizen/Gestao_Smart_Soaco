import { describe, expect, it } from 'vitest';
import {
  ESCALA_PERFILADEIRA_PADRAO,
  anexarExcecoes,
} from '../utils/recursoEscalaTrabalho.js';
import {
  CAMASI_INICIO_JORNADA_LABEL,
  CAMASI_OBS_INICIO_ESCALA,
  CAMASI_PARADA_SEM_JUSTIFICATIVA,
  buildDashboardResumo,
  type TempoProducaoRow,
} from './camasiTempoProducaoRepository.js';

function row(partial: Partial<TempoProducaoRow> & Pick<TempoProducaoRow, 'id' | 'data'>): TempoProducaoRow {
  return {
    inicioProducao: null,
    fimProducao: null,
    inicioParado: null,
    fimParado: null,
    motivoParado: null,
    nomeMotivo: null,
    obsMotivo: null,
    operador: null,
    nomeOperador: 'PECA X',
    horasProducao: 0,
    horasParado: 0,
    ...partial,
  };
}

describe('carência de 5 min no início da jornada', () => {
  it('parte INÍCIO JORNADA longo em carência + sem justificativa', () => {
    const rows: TempoProducaoRow[] = [
      row({
        id: 1,
        data: '2026-09-14',
        inicioParado: '07:00:00',
        fimParado: '08:43:00',
        nomeMotivo: 'INÍCIO JORNADA',
        horasParado: (8 * 60 + 43 - 7 * 60) / 60,
      }),
      row({
        id: 2,
        data: '2026-09-14',
        inicioProducao: '08:43:00',
        fimProducao: '08:43:30',
        nomeOperador: 'FUNDO DO ROUPEIRO',
        horasProducao: 0.5 / 60,
      }),
    ];

    const resumo = buildDashboardResumo(rows, {
      escala: ESCALA_PERFILADEIRA_PADRAO,
      horasEscala: 8.75,
    });

    const inicio = resumo.paradasValidas.find(
      (p) => p.justificativa === CAMASI_INICIO_JORNADA_LABEL && p.inicioParado === '07:00:00'
    );
    expect(inicio?.fimParado).toBe('07:05:00');
    expect(inicio?.minutos).toBe(5);
    expect(inicio?.categoria).toBe('jornada');

    const sem = resumo.paradasValidas.find((p) => p.justificativa === CAMASI_PARADA_SEM_JUSTIFICATIVA);
    expect(sem?.inicioParado).toBe('07:05:00');
    expect(sem?.fimParado).toBe('08:43:00');
    expect(sem?.observacao).toBe(CAMASI_OBS_INICIO_ESCALA);
    expect(sem?.minutos).toBe(98);
  });

  it('não corta se houver registro dentro dos 5 minutos', () => {
    const rows: TempoProducaoRow[] = [
      row({
        id: 1,
        data: '2026-09-14',
        inicioParado: '07:00:00',
        fimParado: '07:03:00',
        nomeMotivo: 'INÍCIO JORNADA',
        horasParado: 3 / 60,
      }),
      row({
        id: 2,
        data: '2026-09-14',
        inicioProducao: '07:03:00',
        fimProducao: '07:10:00',
        horasProducao: 7 / 60,
      }),
    ];

    const resumo = buildDashboardResumo(rows, {
      escala: ESCALA_PERFILADEIRA_PADRAO,
      horasEscala: 8.75,
    });

    expect(resumo.paradasValidas.some((p) => p.justificativa === CAMASI_PARADA_SEM_JUSTIFICATIVA)).toBe(
      false
    );
    const inicio = resumo.paradasValidas.find((p) => p.justificativa === 'INÍCIO JORNADA');
    expect(inicio?.inicioParado).toBe('07:00:00');
    expect(inicio?.fimParado).toBe('07:03:00');
  });
});

describe('buildDashboardResumo com horário pontual', () => {
  const escala = anexarExcecoes(ESCALA_PERFILADEIRA_PADRAO, [
    {
      id: 'p1',
      dataIni: '2026-09-05',
      dataFim: '2026-09-05',
      tipo: 'substituir',
      faixas: [{ inicio: '06:00', fim: '14:00' }],
    },
  ])!;

  it('aplica carência 06:00–06:05 e sem justificativa até o 1º registro', () => {
    const rows: TempoProducaoRow[] = [
      row({
        id: 1,
        data: '2026-09-05',
        inicioParado: '06:29:00',
        fimParado: '06:31:00',
        nomeMotivo: 'AJUSTE OPERACIONAL',
        horasParado: 2 / 60,
      }),
      row({
        id: 2,
        data: '2026-09-05',
        inicioParado: '12:36:00',
        fimParado: '17:15:00',
        nomeMotivo: 'FIM JORNADA',
        horasParado: (14 * 60 - (12 * 60 + 36)) / 60,
      }),
    ];

    const resumo = buildDashboardResumo(rows, {
      escala,
      horasEscala: 8,
    });

    const inicio = resumo.paradasValidas.find(
      (p) => p.justificativa === CAMASI_INICIO_JORNADA_LABEL && p.inicioParado === '06:00:00'
    );
    expect(inicio?.fimParado).toBe('06:05:00');
    expect(inicio?.minutos).toBe(5);

    const sem = resumo.paradasValidas.find((p) => p.justificativa === CAMASI_PARADA_SEM_JUSTIFICATIVA);
    expect(sem?.inicioParado).toBe('06:05:00');
    expect(sem?.fimParado).toBe('06:29:00');
    expect(sem?.minutos).toBe(24);

    const fimJornada = resumo.paradasValidas.find((p) => p.justificativa === 'FIM JORNADA');
    expect(fimJornada?.fimParado).toBe('14:00:00');

    const prodEntre = resumo.producaoValidas.find(
      (p) => p.inicioProducao === '06:31:00' && p.fimProducao === '12:36:00'
    );
    expect(prodEntre).toBeTruthy();
  });
});
