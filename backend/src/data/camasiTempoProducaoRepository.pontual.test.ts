import { describe, expect, it } from 'vitest';
import {
  ESCALA_PERFILADEIRA_PADRAO,
  anexarExcecoes,
} from '../utils/recursoEscalaTrabalho.js';
import {
  CAMASI_AGUARDANDO_JUSTIFICATIVA,
  CAMASI_EM_PRODUCAO,
  CAMASI_FIM_JORNADA_LABEL,
  CAMASI_INICIO_JORNADA_LABEL,
  CAMASI_OBS_FIM_ESCALA,
  CAMASI_OBS_INICIO_ESCALA,
  CAMASI_OBS_PARADA_INFERIDA,
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

    const sem = resumo.paradasValidas.find(
      (p) => p.justificativa === CAMASI_PARADA_SEM_JUSTIFICATIVA && p.observacao === CAMASI_OBS_INICIO_ESCALA
    );
    expect(sem?.inicioParado).toBe('07:05:00');
    expect(sem?.fimParado).toBe('08:43:00');
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

describe('carência de 5 min no fim da jornada', () => {
  it('parte FIM JORNADA longo em sem justificativa + carência final', () => {
    const rows: TempoProducaoRow[] = [
      row({
        id: 1,
        data: '2026-09-11',
        inicioProducao: '08:43:00',
        fimProducao: '08:57:00',
        nomeOperador: 'FUNDO DO ROUPEIRO',
        horasProducao: 14 / 60,
      }),
      row({
        id: 2,
        data: '2026-09-11',
        inicioParado: '08:57:00',
        fimParado: '17:15:00',
        nomeMotivo: 'FIM JORNADA',
        nomeOperador: 'FUNDO DO ROUPEIRO',
        horasParado: (17 * 60 + 15 - (8 * 60 + 57)) / 60,
      }),
    ];

    const resumo = buildDashboardResumo(rows, {
      escala: ESCALA_PERFILADEIRA_PADRAO,
      horasEscala: 8.75,
    });

    const sems = resumo.paradasValidas
      .filter(
        (p) =>
          p.justificativa === CAMASI_PARADA_SEM_JUSTIFICATIVA &&
          p.observacao === CAMASI_OBS_FIM_ESCALA
      )
      .sort((a, b) => a.inicioParado.localeCompare(b.inicioParado));
    expect(sems.map((p) => [p.inicioParado, p.fimParado])).toEqual([
      ['08:57:00', '11:30:00'],
      ['13:00:00', '17:10:00'],
    ]);
    expect(sems.reduce((s, p) => s + p.minutos, 0)).toBe(2 * 60 + 33 + 4 * 60 + 10);

    const fim = resumo.paradasValidas.find(
      (p) => p.justificativa === CAMASI_FIM_JORNADA_LABEL && p.inicioParado === '17:10:00'
    );
    expect(fim?.fimParado).toBe('17:15:00');
    expect(fim?.minutos).toBe(5);
    expect(fim?.categoria).toBe('jornada');
    expect(
      resumo.paradasValidas.some(
        (p) => p.justificativa === CAMASI_FIM_JORNADA_LABEL && p.inicioParado < '17:10:00'
      )
    ).toBe(false);
    expect(resumo.resumoDias[0]?.paradoHoras ?? 0).toBeLessThanOrEqual(8.75);
  });

  it('não corta se o FIM JORNADA já estiver só na carência final', () => {
    const rows: TempoProducaoRow[] = [
      row({
        id: 1,
        data: '2026-09-11',
        inicioProducao: '07:10:00',
        fimProducao: '17:12:00',
        horasProducao: (17 * 60 + 12 - (7 * 60 + 10)) / 60,
      }),
      row({
        id: 2,
        data: '2026-09-11',
        inicioParado: '17:12:00',
        fimParado: '17:15:00',
        nomeMotivo: 'FIM JORNADA',
        horasParado: 3 / 60,
      }),
    ];

    const resumo = buildDashboardResumo(rows, {
      escala: ESCALA_PERFILADEIRA_PADRAO,
      horasEscala: 8.75,
    });

    expect(
      resumo.paradasValidas.some(
        (p) => p.justificativa === CAMASI_PARADA_SEM_JUSTIFICATIVA && p.observacao === CAMASI_OBS_FIM_ESCALA
      )
    ).toBe(false);
    const fim = resumo.paradasValidas.find((p) => p.justificativa === 'FIM JORNADA');
    expect(fim?.inicioParado).toBe('17:12:00');
    expect(fim?.fimParado).toBe('17:15:00');
  });

  it('FIM JORNADA cobrindo a escala vira 07:00–07:05 + SEM até 17:10 + FIM 17:10–17:15', () => {
    const escalaContinua = {
      ...ESCALA_PERFILADEIRA_PADRAO,
      faixas: [{ inicio: '07:00', fim: '17:15' }],
    };
    const rows: TempoProducaoRow[] = [
      row({
        id: 1,
        data: '2025-10-10',
        inicioParado: '07:00:00',
        fimParado: '09:36:58',
        nomeMotivo: 'INÍCIO JORNADA',
        horasParado: (9 * 60 + 36 + 58 / 60 - 7 * 60) / 60,
      }),
      row({
        id: 2,
        data: '2025-10-10',
        inicioParado: '00:59:00',
        fimParado: '17:15:00',
        nomeMotivo: 'FIM JORNADA',
        nomeOperador: 'LATERAL DIREITA DE 40 CM',
        horasParado: (17 * 60 + 15 - 59) / 60,
      }),
    ];

    const resumo = buildDashboardResumo(rows, {
      escala: escalaContinua,
      horasEscala: 10.25,
    });

    const inicio = resumo.paradasValidas.find(
      (p) => p.justificativa === CAMASI_INICIO_JORNADA_LABEL && p.inicioParado === '07:00:00'
    );
    expect(inicio?.fimParado).toBe('07:05:00');
    expect(inicio?.minutos).toBe(5);

    const sem = resumo.paradasValidas.find(
      (p) =>
        p.justificativa === CAMASI_PARADA_SEM_JUSTIFICATIVA &&
        p.inicioParado === '07:05:00' &&
        p.observacao === CAMASI_OBS_INICIO_ESCALA
    );
    expect(sem?.fimParado).toBe('17:10:00');

    const fim = resumo.paradasValidas.find((p) => p.justificativa === CAMASI_FIM_JORNADA_LABEL);
    expect(fim?.inicioParado).toBe('17:10:00');
    expect(fim?.fimParado).toBe('17:15:00');
    expect(fim?.minutos).toBe(5);

    expect(
      resumo.paradasValidas.some(
        (p) => p.justificativa === CAMASI_FIM_JORNADA_LABEL && p.inicioParado === '07:00:00'
      )
    ).toBe(false);

    const dia = resumo.resumoDias.find((d) => d.data === '2025-10-10');
    expect(dia?.paradoHoras).toBeCloseTo(10.25, 5);
    expect(dia?.paradoHoras ?? 0).toBeLessThanOrEqual(10.25);
    expect((dia?.producaoHoras ?? 0) + (dia?.paradoHoras ?? 0)).toBeCloseTo(10.25, 5);
  });

  it('FIM JORNADA longo não apaga produção real no meio da jornada', () => {
    const escalaContinua = {
      ...ESCALA_PERFILADEIRA_PADRAO,
      faixas: [{ inicio: '07:00', fim: '17:15' }],
    };
    const rows: TempoProducaoRow[] = [
      row({
        id: 1,
        data: '2025-10-10',
        inicioParado: '07:00:00',
        fimParado: '09:36:00',
        nomeMotivo: 'INÍCIO JORNADA',
        horasParado: (9 * 60 + 36 - 7 * 60) / 60,
      }),
      row({
        id: 2,
        data: '2025-10-10',
        inicioProducao: '09:36:00',
        fimProducao: '16:00:00',
        nomeOperador: 'LATERAL DIREITA DE 40 CM',
        horasProducao: (16 * 60 - (9 * 60 + 36)) / 60,
      }),
      row({
        id: 3,
        data: '2025-10-10',
        inicioParado: '07:00:00',
        fimParado: '17:15:00',
        nomeMotivo: 'FIM JORNADA',
        nomeOperador: 'LATERAL DIREITA DE 40 CM',
        horasParado: 10.25,
      }),
    ];

    const resumo = buildDashboardResumo(rows, {
      escala: escalaContinua,
      horasEscala: 10.25,
    });

    expect(
      resumo.paradasValidas.some(
        (p) => p.justificativa === CAMASI_FIM_JORNADA_LABEL && p.inicioParado < '17:10:00'
      )
    ).toBe(false);
    expect(
      resumo.producaoValidas.some((p) => p.inicioProducao === '09:36:00' && p.fimProducao === '16:00:00')
    ).toBe(true);
    const semFim = resumo.paradasValidas.find(
      (p) =>
        p.justificativa === CAMASI_PARADA_SEM_JUSTIFICATIVA &&
        p.inicioParado === '16:00:00' &&
        p.observacao === CAMASI_OBS_FIM_ESCALA
    );
    expect(semFim?.fimParado).toBe('17:10:00');
    const dia = resumo.resumoDias.find((d) => d.data === '2025-10-10');
    expect((dia?.producaoHoras ?? 0) + (dia?.paradoHoras ?? 0)).toBeCloseTo(10.25, 5);
  });

  it('produção na tabela não atravessa AJUSTE/SET UP no mesmo dia', () => {
    const escalaContinua = {
      ...ESCALA_PERFILADEIRA_PADRAO,
      faixas: [{ inicio: '07:00', fim: '17:15' }],
    };
    const rows: TempoProducaoRow[] = [
      row({
        id: 1,
        data: '2025-09-24',
        inicioParado: '07:00:00',
        fimParado: '07:13:54',
        nomeMotivo: 'INÍCIO JORNADA',
        horasParado: (7 * 60 + 13 + 54 / 60 - 7 * 60) / 60,
      }),
      row({
        id: 2,
        data: '2025-09-24',
        inicioProducao: '07:13:54',
        fimProducao: '07:15:31',
        inicioParado: '07:15:31',
        fimParado: '07:18:50',
        nomeMotivo: 'AJUSTE OPERACIONAL',
        nomeOperador: 'LATERAL DE 30 CM',
        horasProducao: (7 * 60 + 15 + 31 / 60 - (7 * 60 + 13 + 54 / 60)) / 60,
        horasParado: (7 * 60 + 18 + 50 / 60 - (7 * 60 + 15 + 31 / 60)) / 60,
      }),
      row({
        id: 3,
        data: '2025-09-24',
        inicioProducao: '07:18:50',
        fimProducao: '13:12:49',
        inicioParado: '13:12:49',
        fimParado: '14:54:39',
        nomeMotivo: 'SET UP',
        nomeOperador: 'LATERAL DE 30 CM',
        horasProducao: (13 * 60 + 12 + 49 / 60 - (7 * 60 + 18 + 50 / 60)) / 60,
        horasParado: (14 * 60 + 54 + 39 / 60 - (13 * 60 + 12 + 49 / 60)) / 60,
      }),
      row({
        id: 4,
        data: '2025-09-24',
        inicioProducao: '14:54:39',
        fimProducao: '01:54:08',
        inicioParado: '01:54:08',
        fimParado: '17:15:00',
        nomeMotivo: 'FIM JORNADA',
        nomeOperador: 'PORTA DIREITA DE 40CM',
        horasProducao: 11,
        horasParado: 15.35,
      }),
    ];

    const resumo = buildDashboardResumo(rows, {
      escala: escalaContinua,
      horasEscala: 10.25,
    });

    const ajuste = resumo.paradasValidas.find((p) => p.justificativa === 'AJUSTE OPERACIONAL');
    const setup = resumo.paradasValidas.find((p) => p.justificativa === 'SET UP');
    expect(ajuste?.inicioParado).toBe('07:15:31');
    expect(setup?.inicioParado).toBe('13:12:49');

    const prodBlocoUnico = resumo.producaoValidas.find(
      (p) => p.inicioProducao === '07:13:54' && p.fimProducao >= '13:00:00'
    );
    expect(prodBlocoUnico).toBeUndefined();

    for (const prod of resumo.producaoValidas.filter((p) => p.data === '2025-09-24')) {
      expect(prod.fimProducao <= '07:15:31' || prod.inicioProducao >= '07:18:50').toBe(true);
      expect(prod.fimProducao <= '13:12:49' || prod.inicioProducao >= '14:54:39').toBe(true);
    }

    const ultimaProd = resumo.producaoValidas
      .filter((p) => p.data === '2025-09-24')
      .sort((a, b) => a.inicioProducao.localeCompare(b.inicioProducao))
      .at(-1);
    expect(ultimaProd?.inicioProducao).toBe('14:54:39');
    expect(ultimaProd?.fimProducao).toBe('17:15:00');
    expect(ultimaProd?.peca).toBe('PORTA DIREITA DE 40CM');
    expect(
      resumo.paradasValidas.some(
        (p) => p.justificativa === CAMASI_FIM_JORNADA_LABEL && p.inicioParado === '17:10:00'
      )
    ).toBe(false);

    const dia = resumo.resumoDias.find((d) => d.data === '2025-09-24');
    expect((dia?.producaoHoras ?? 0) + (dia?.paradoHoras ?? 0)).toBeCloseTo(10.25, 5);
  });
});

describe('dia corrente — linha aberta Camasi (FIM_PRODUCAO vivo vs congelado)', () => {
  const escalaContinua = {
    ...ESCALA_PERFILADEIRA_PADRAO,
    faixas: [{ inicio: '07:00', fim: '17:15' }],
  };

  it('FIM_PRODUCAO congelado → Aguardando justificativa até agora; KPI usa previsto até agora', () => {
    const agoraMs = new Date(2026, 8, 14, 12, 30, 0, 0).getTime();
    const rows: TempoProducaoRow[] = [
      row({
        id: 1,
        data: '2026-09-14',
        inicioProducao: '09:41:00',
        fimProducao: '09:42:00',
        inicioParado: '09:42:00',
        fimParado: '10:00:00',
        nomeMotivo: 'AJUSTE OPERACIONAL',
        nomeOperador: 'FUNDO DO ROUPEIRO',
        horasProducao: 1 / 60,
        horasParado: 18 / 60,
      }),
      row({
        id: 2,
        data: '2026-09-14',
        inicioProducao: '10:00:00',
        fimProducao: '10:00:05',
        nomeOperador: 'FUNDO DO ROUPEIRO',
        horasProducao: 5 / 3600,
      }),
    ];

    const resumo = buildDashboardResumo(rows, {
      escala: escalaContinua,
      horasEscala: 10.25,
      agoraMs,
    });

    expect(
      resumo.paradasValidas.some(
        (p) => p.justificativa === CAMASI_FIM_JORNADA_LABEL || p.observacao === CAMASI_OBS_FIM_ESCALA
      )
    ).toBe(false);

    const aguardando = resumo.paradasValidas.find(
      (p) => p.justificativa === CAMASI_AGUARDANDO_JUSTIFICATIVA && p.inicioParado === '10:00:05'
    );
    expect(aguardando?.fimParado).toBe('12:30:00');
    expect(aguardando?.observacao).toBe(CAMASI_OBS_PARADA_INFERIDA);

    expect(resumo.kpis.horasEscalaDecorrida).toBe(5.5);
    expect(resumo.kpis.horasProducao).toBeCloseTo(5.5 - resumo.kpis.horasParado, 5);
    expect(resumo.kpis.horasEscala).toBe(10.25);
  });

  it('remove FIM JORNADA projetado quando a jornada ainda não terminou', () => {
    const agoraMs = new Date(2026, 8, 14, 12, 30, 0, 0).getTime();
    const rows: TempoProducaoRow[] = [
      row({
        id: 1,
        data: '2026-09-14',
        inicioProducao: '09:41:00',
        fimProducao: '09:42:00',
        inicioParado: '09:42:00',
        fimParado: '10:15:00',
        nomeMotivo: 'FIM JORNADA',
        nomeOperador: 'FUNDO DO ROUPEIRO',
        horasProducao: 1 / 60,
        horasParado: (10 * 60 + 15 - (9 * 60 + 42)) / 60,
      }),
    ];

    const resumo = buildDashboardResumo(rows, {
      escala: ESCALA_PERFILADEIRA_PADRAO,
      horasEscala: 8.75,
      agoraMs,
    });

    expect(resumo.paradasValidas.some((p) => p.justificativa === CAMASI_FIM_JORNADA_LABEL)).toBe(
      false
    );
  });

  it('FIM_PRODUCAO vivo (próximo de agora) → Em produção até agora', () => {
    const agoraMs = new Date(2026, 8, 14, 12, 30, 0, 0).getTime();
    const rows: TempoProducaoRow[] = [
      row({
        id: 1,
        data: '2026-09-14',
        inicioProducao: '09:00:00',
        fimProducao: '09:30:00',
        inicioParado: '09:30:00',
        fimParado: '10:00:00',
        nomeMotivo: 'AJUSTE OPERACIONAL',
        horasProducao: 0.5,
        horasParado: 0.5,
      }),
      row({
        id: 2,
        data: '2026-09-14',
        inicioProducao: '10:00:00',
        fimProducao: '12:29:50', // vivo (< 30s de 12:30)
        nomeOperador: 'FUNDO DO ROUPEIRO',
        horasProducao: (2 * 60 + 29.833) / 60,
      }),
    ];

    const resumo = buildDashboardResumo(rows, {
      escala: escalaContinua,
      horasEscala: 10.25,
      agoraMs,
    });

    expect(resumo.paradasValidas.some((p) => p.justificativa === CAMASI_AGUARDANDO_JUSTIFICATIVA)).toBe(
      false
    );
    const emProd = resumo.producaoValidas.find((p) => p.justificativa === CAMASI_EM_PRODUCAO);
    expect(emProd).toBeTruthy();
    expect(emProd?.fimProducao).toBe('12:30:00');
    expect(resumo.kpis.horasEscalaDecorrida).toBe(5.5);
  });

  it('parada aberta sem produção na linha é ignorada; só FIM_PRODUCAO define o ciclo vivo', () => {
    const agoraMs = new Date(2026, 8, 14, 12, 30, 0, 0).getTime();
    const rows: TempoProducaoRow[] = [
      row({
        id: 1,
        data: '2026-09-14',
        inicioProducao: '09:00:00',
        fimProducao: '09:30:00',
        inicioParado: '09:30:00',
        fimParado: '09:45:00',
        nomeMotivo: 'AJUSTE OPERACIONAL',
        horasProducao: 0.5,
        horasParado: 0.25,
      }),
      row({
        id: 2,
        data: '2026-09-14',
        inicioParado: '09:45:00',
        fimParado: null,
        nomeMotivo: null,
        horasParado: 0,
      }),
    ];

    const resumo = buildDashboardResumo(rows, {
      escala: escalaContinua,
      horasEscala: 10.25,
      agoraMs,
    });

    expect(resumo.paradasValidas.some((p) => p.inicioParado === '09:45:00')).toBe(false);
    const ajuste = resumo.paradasValidas.find((p) => p.justificativa === 'AJUSTE OPERACIONAL');
    expect(ajuste?.fimParado).toBe('09:45:00');
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

  it('aplica carência no início e no fim da escala pontual', () => {
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

    const semInicio = resumo.paradasValidas.find(
      (p) =>
        p.justificativa === CAMASI_PARADA_SEM_JUSTIFICATIVA &&
        p.inicioParado === '06:05:00' &&
        p.observacao === CAMASI_OBS_INICIO_ESCALA
    );
    expect(semInicio?.fimParado).toBe('06:29:00');
    expect(semInicio?.minutos).toBe(24);

    const semFim = resumo.paradasValidas.find(
      (p) =>
        p.justificativa === CAMASI_PARADA_SEM_JUSTIFICATIVA &&
        p.inicioParado === '12:36:00' &&
        p.observacao === CAMASI_OBS_FIM_ESCALA
    );
    expect(semFim?.fimParado).toBe('13:55:00');

    const fimJornada = resumo.paradasValidas.find(
      (p) => p.justificativa === CAMASI_FIM_JORNADA_LABEL && p.inicioParado === '13:55:00'
    );
    expect(fimJornada?.fimParado).toBe('14:00:00');
    expect(fimJornada?.minutos).toBe(5);

    const prodEntre = resumo.producaoValidas.find(
      (p) => p.inicioProducao === '06:31:00' && p.fimProducao === '12:36:00'
    );
    expect(prodEntre).toBeTruthy();
  });

  it('previsto do KPI usa horasEscala do período filtrado (não só dias com evento)', () => {
    const rows: TempoProducaoRow[] = [
      row({
        id: 1,
        data: '2026-09-05',
        inicioParado: '06:29:00',
        fimParado: '06:31:00',
        nomeMotivo: 'AJUSTE OPERACIONAL',
        horasParado: 2 / 60,
      }),
    ];
    // Período maior que o único dia com evento Camasi (ex.: mês inteiro).
    const resumo = buildDashboardResumo(rows, {
      escala,
      horasEscala: 223.25,
    });
    expect(resumo.kpis.horasEscala).toBe(223.25);
    expect(resumo.resumoDias.reduce((s, d) => s + d.escalaHoras, 0)).toBe(8);
  });
});

describe('dias do período até hoje sem Camasi', () => {
  it('contam como produção (escala − parado) para o recorte fechar até o restante de hoje', () => {
    const resumo = buildDashboardResumo([], {
      escala: ESCALA_PERFILADEIRA_PADRAO,
      dataIni: '2026-09-14',
      dataFim: '2026-09-15',
      agoraMs: new Date(2026, 8, 16, 12, 0, 0).getTime(),
    });
    const porDia = new Map(resumo.resumoDias.map((d) => [d.data, d]));
    expect(porDia.get('2026-09-14')?.paradoHoras).toBe(0);
    expect(porDia.get('2026-09-14')?.producaoHoras).toBe(8.75);
    expect(porDia.get('2026-09-15')?.paradoHoras).toBe(0);
    expect(porDia.get('2026-09-15')?.producaoHoras).toBe(8.75);
    expect(resumo.kpis.horasParado).toBe(0);
    expect(resumo.kpis.horasProducao).toBe(17.5);
    expect(resumo.producaoValidas.some((p) => p.data === '2026-09-14')).toBe(true);
  });
});
