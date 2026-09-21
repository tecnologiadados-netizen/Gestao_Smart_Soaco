import { describe, expect, it } from 'vitest';
import {
  CAMASI_OBS_INICIO_ESCALA,
  CAMASI_PARADA_SEM_JUSTIFICATIVA,
  type CamasiParadaValida,
} from './camasiTempoProducaoRepository.js';
import {
  aplicarJustificativasManuais,
  isParadaJustificativaEditavel,
  nomeJustificativaReservado,
} from '../utils/camasiJustificativa.js';

describe('justificativa manual Camasi', () => {
  it('só libera corte automático de início/fim de escala', () => {
    expect(isParadaJustificativaEditavel({ observacao: CAMASI_OBS_INICIO_ESCALA })).toBe(true);
    expect(isParadaJustificativaEditavel({ observacao: 'Inferido: fim de produção congelado sem parada registrada' })).toBe(
      false
    );
  });

  it('não cadastra nomes reservados', () => {
    expect(nomeJustificativaReservado('SEM JUSTIFICATIVA')).toBe(true);
    expect(nomeJustificativaReservado('INÍCIO JORNADA')).toBe(true);
    expect(nomeJustificativaReservado('SET UP')).toBe(false);
  });

  it('aplica o motivo salvo na linha SEM JUSTIFICATIVA e mantém editável', () => {
    const p: CamasiParadaValida = {
      id: -1,
      data: '2026-09-18',
      inicioParado: '07:05:00',
      fimParado: '07:09:28',
      horas: 4 / 60,
      minutos: 4,
      peca: '(sem peça)',
      justificativa: CAMASI_PARADA_SEM_JUSTIFICATIVA,
      observacao: CAMASI_OBS_INICIO_ESCALA,
      categoria: 'operacional',
    };
    aplicarJustificativasManuais(
      [p],
      [
        {
          data: '2026-09-18',
          inicioParado: '07:05:00',
          fimParado: '07:09:28',
          observacaoOrigem: CAMASI_OBS_INICIO_ESCALA,
          nome: 'SET UP',
        },
      ]
    );
    expect(p.justificativa).toBe('SET UP');
    expect(p.justificativaEditavel).toBe(true);
  });
});
