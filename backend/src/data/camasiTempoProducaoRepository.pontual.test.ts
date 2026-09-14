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

    const sem = resumo.paradasValidas.find(
      (p) =>
        p.justificativa === CAMASI_PARADA_SEM_JUSTIFICATIVA &&
        p.inicioParado === '08:57:00' &&
        p.observacao === CAMASI_OBS_FIM_ESCALA
    );
    expect(sem?.fimParado).toBe('17:10:00');
    expect(sem?.minutos).toBe(8 * 60 + 13);

    const fim = resumo.paradasValidas.find(
      (p) => p.justificativa === CAMASI_FIM_JORNADA_LABEL && p.inicioParado === '17:10:00'
    );
    expect(fim?.fimParado).toBe('17:15:00');
    expect(fim?.minutos).toBe(5);
    expect(fim?.categoria).toBe('jornada');
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
});

describe('dia corrente incompleto', () => {
  it('não projeta FIM JORNADA; infere parada desde o último fim de produção até agora', () => {
    // Escala contínua (Perfiladeira 1000 em produção): 07:00–17:15
    const escalaContinua = {
      ...ESCALA_PERFILADEIRA_PADRAO,
      faixas: [{ inicio: '07:00', fim: '17:15' }],
    };
    // 14/09/2026 12:30
    const agoraMs = new Date(2026, 8, 14, 12, 30, 0, 0).getTime();
    const rows: TempoProducaoRow[] = [
      row({
        id: 1,
        data: '2026-09-14',
        inicioProducao: '09:41:00',
        fimProducao: '09:42:00',
        nomeOperador: 'FUNDO DO ROUPEIRO',
        horasProducao: 1 / 60,
      }),
      row({
        id: 2,
        data: '2026-09-14',
        inicioParado: '09:42:00',
        fimParado: '17:15:00',
        nomeMotivo: 'FIM JORNADA',
        horasParado: (17 * 60 + 15 - (9 * 60 + 42)) / 60,
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
      (p) => p.justificativa === CAMASI_AGUARDANDO_JUSTIFICATIVA && p.inicioParado === '09:42:00'
    );
    expect(aguardando?.fimParado).toBe('12:30:00');
    expect(aguardando?.observacao).toBe(CAMASI_OBS_PARADA_INFERIDA);
    // Previsto = jornada cheia (07:00–17:15 = 10h15), não cortado ao "agora".
    expect(resumo.kpis.horasEscala).toBe(10.25);
  });

  it('remove FIM JORNADA já recortado à faixa da manhã e infere parada até agora', () => {
    // 14/09/2026 12:30 — horário padrão com intervalo
    const agoraMs = new Date(2026, 8, 14, 12, 30, 0, 0).getTime();
    const rows: TempoProducaoRow[] = [
      row({
        id: 1,
        data: '2026-09-14',
        inicioProducao: '09:41:00',
        fimProducao: '09:42:00',
        nomeOperador: 'FUNDO DO ROUPEIRO',
        horasProducao: 1 / 60,
      }),
      row({
        id: 2,
        data: '2026-09-14',
        inicioParado: '09:42:00',
        fimParado: '17:15:00',
        nomeMotivo: 'FIM JORNADA',
        horasParado: (17 * 60 + 15 - (9 * 60 + 42)) / 60,
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
    const aguardando = resumo.paradasValidas.find(
      (p) => p.justificativa === CAMASI_AGUARDANDO_JUSTIFICATIVA && p.inicioParado === '09:42:00'
    );
    expect(aguardando?.fimParado).toBe('12:30:00');
  });

  it('produção aberta (sem fim) vira Em produção até agora', () => {
    const escalaContinua = {
      ...ESCALA_PERFILADEIRA_PADRAO,
      faixas: [{ inicio: '07:00', fim: '17:15' }],
    };
    const agoraMs = new Date(2026, 8, 14, 12, 30, 0, 0).getTime();
    const rows: TempoProducaoRow[] = [
      row({
        id: 1,
        data: '2026-09-14',
        inicioProducao: '10:00:00',
        fimProducao: null,
        nomeOperador: 'FUNDO DO ROUPEIRO',
        horasProducao: 0,
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
    expect(emProd?.inicioProducao).toBe('10:00:00');
    expect(emProd?.fimProducao).toBe('12:30:00');
  });

  it('parada aberta (sem fim) usa motivo ou Aguardando justificativa até agora', () => {
    const escalaContinua = {
      ...ESCALA_PERFILADEIRA_PADRAO,
      faixas: [{ inicio: '07:00', fim: '17:15' }],
    };
    const agoraMs = new Date(2026, 8, 14, 12, 30, 0, 0).getTime();
    const rows: TempoProducaoRow[] = [
      row({
        id: 1,
        data: '2026-09-14',
        inicioProducao: '09:00:00',
        fimProducao: '09:30:00',
        horasProducao: 0.5,
      }),
      row({
        id: 2,
        data: '2026-09-14',
        inicioParado: '09:30:00',
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

    const aberta = resumo.paradasValidas.find((p) => p.inicioParado === '09:30:00');
    expect(aberta?.fimParado).toBe('12:30:00');
    expect(aberta?.justificativa).toBe(CAMASI_AGUARDANDO_JUSTIFICATIVA);
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
});
