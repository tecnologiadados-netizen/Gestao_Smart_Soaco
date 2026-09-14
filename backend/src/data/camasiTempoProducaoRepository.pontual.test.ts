import { describe, expect, it } from 'vitest';
import {
  ESCALA_PERFILADEIRA_PADRAO,
  anexarExcecoes,
} from '../utils/recursoEscalaTrabalho.js';
import {
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

  it('gera gap inicial e recorta fim da parada ao limite pontual', () => {
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
        // já recortado pela aplicarEscalaNaRow: 12:36→14:00
        horasParado: (14 * 60 - (12 * 60 + 36)) / 60,
      }),
    ];

    const resumo = buildDashboardResumo(rows, {
      escala,
      horasEscala: 8,
    });

    const gap = resumo.paradasValidas.find(
      (p) => p.justificativa === CAMASI_PARADA_SEM_JUSTIFICATIVA
    );
    expect(gap).toBeTruthy();
    expect(gap!.inicioParado).toBe('06:00:00');
    expect(gap!.fimParado).toBe('06:29:00');
    expect(gap!.minutos).toBe(29);

    const fimJornada = resumo.paradasValidas.find((p) => p.justificativa === 'FIM JORNADA');
    expect(fimJornada).toBeTruthy();
    expect(fimJornada!.inicioParado).toBe('12:36:00');
    expect(fimJornada!.fimParado).toBe('14:00:00');

    const prodEntre = resumo.producaoValidas.find(
      (p) => p.inicioProducao === '06:31:00' && p.fimProducao === '12:36:00'
    );
    expect(prodEntre).toBeTruthy();
  });
});
