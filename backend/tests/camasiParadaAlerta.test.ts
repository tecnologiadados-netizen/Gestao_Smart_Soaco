import { describe, expect, it } from 'vitest';
import {
  CAMASI_AGUARDANDO_JUSTIFICATIVA,
  CAMASI_PARADA_SEM_JUSTIFICATIVA,
  type TempoProducaoRow,
} from '../src/data/camasiTempoProducaoRepository.js';
import {
  avaliarAlertaParadaCamasi,
  estadoAlertaVazio,
  isProducaoRealCamasi,
  montarMensagemAlertaParadaCamasi,
  type CamasiParadaAlertaEstadoMem,
} from '../src/utils/camasiParadaAlerta.js';

const ESCALA_CONTINUA = {
  diasSemana: [1, 2, 3, 4, 5],
  faixas: [{ inicio: '07:00', fim: '17:15' }],
};

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
    nomeOperador: 'PORTA  DIREITA  DO  AR 160',
    horasProducao: 0,
    horasParado: 0,
    ...partial,
  };
}

const HOJE = '2026-09-21'; // segunda

function ms(h: number, min: number, s = 0): number {
  return new Date(2026, 8, 21, h, min, s, 0).getTime();
}

const DUMMY_INICIO: TempoProducaoRow = row({
  id: 5987,
  data: HOJE,
  inicioProducao: '07:00:00',
  fimProducao: '07:00:00',
  inicioParado: '07:00:00',
  fimParado: '07:00:00',
  nomeMotivo: 'INÍCIO JORNADA',
});

const PROD_BLIP: TempoProducaoRow = row({
  id: 5988,
  data: HOJE,
  inicioProducao: '13:09:59',
  fimProducao: '13:10:54',
  horasProducao: 55 / 3600,
});

function evalAt(
  agoraMs: number,
  rows: TempoProducaoRow[],
  estado: CamasiParadaAlertaEstadoMem | null = null
) {
  return avaliarAlertaParadaCamasi({
    agoraMs,
    escala: ESCALA_CONTINUA,
    rows,
    estado,
    maquina: 'Perfiladeira',
  });
}

describe('isProducaoRealCamasi', () => {
  it('ignora dummy 07:00–07:00', () => {
    expect(isProducaoRealCamasi(DUMMY_INICIO)).toBe(false);
  });
  it('aceita produção com início ≠ fim', () => {
    expect(isProducaoRealCamasi(PROD_BLIP)).toBe(true);
  });
});

describe('avaliarAlertaParadaCamasi — recorte de 21/09/2026', () => {
  it('07:04 ainda na carência — não envia', () => {
    const d = evalAt(ms(7, 4), [DUMMY_INICIO]);
    expect(d.acao).toBe('skip');
    expect(d.motivo).toBe('ainda_na_carencia');
  });

  it('07:10 arma e espera os 20 min após o corte 07:05', () => {
    const d = evalAt(ms(7, 10), [DUMMY_INICIO]);
    expect(d.acao).toBe('skip');
    expect(d.motivo).toBe('aguardando_20min_inicio');
    expect(d.next.inicioEnviado).toBe(false);
  });

  it('07:26 sem produção — 1º WhatsApp (corte 07:05 + 20 min)', () => {
    const d = evalAt(ms(7, 26), [DUMMY_INICIO]);
    expect(d.acao).toBe('send');
    expect(d.tipoEnvio).toBe('inicio');
    expect(d.next.inicioEnviado).toBe(true);
    expect(d.mensagem).toContain('⚠️ Perfiladeira parada há 21 min.');
    expect(d.mensagem).toContain('Desde: 07:05');
    expect(d.mensagem).toContain('Receita configurada: (sem receita)');
    expect(d.mensagem).toContain(CAMASI_PARADA_SEM_JUSTIFICATIVA);
    expect(d.mensagem).toContain('Desloquem até a máquina para averiguar.');
  });

  it('08:00 a 13:09 — mesma ociosidade, não reenvia', () => {
    const estado = { ...estadoAlertaVazio(HOJE), inicioEnviado: true };
    const d = evalAt(ms(13, 0), [DUMMY_INICIO], estado);
    expect(d.acao).toBe('skip');
    expect(d.motivo).toBe('inicio_ja_enviado');
  });

  it('13:10:30 — blip de produção: não envia, zera episódio pós-produção', () => {
    const estado = { ...estadoAlertaVazio(HOJE), inicioEnviado: true };
    const vivo = row({
      ...PROD_BLIP,
      fimProducao: '13:10:20',
    });
    const d = evalAt(ms(13, 10, 30), [DUMMY_INICIO, vivo], estado);
    expect(d.acao).toBe('skip');
    expect(d.motivo).toBe('produzindo');
    expect(d.next.posProducaoEnviado).toBe(false);
    expect(d.next.ultimaProducaoFim).toBe('13:10:20');
  });

  it('13:20 — parada há ~9 min após o freeze: espera', () => {
    const estado: CamasiParadaAlertaEstadoMem = {
      data: HOJE,
      inicioEnviado: true,
      ultimaProducaoFim: '13:10:54',
      posProducaoEnviado: false,
    };
    const d = evalAt(ms(13, 20), [DUMMY_INICIO, PROD_BLIP], estado);
    expect(d.acao).toBe('skip');
    expect(d.motivo).toBe('aguardando_20min_pos_producao');
  });

  it('13:31 — 20 min após 13:10:54: 2º WhatsApp', () => {
    const estado: CamasiParadaAlertaEstadoMem = {
      data: HOJE,
      inicioEnviado: true,
      ultimaProducaoFim: '13:10:54',
      posProducaoEnviado: false,
    };
    const d = evalAt(ms(13, 31), [DUMMY_INICIO, PROD_BLIP], estado);
    expect(d.acao).toBe('send');
    expect(d.tipoEnvio).toBe('pos_producao');
    expect(d.next.posProducaoEnviado).toBe(true);
    expect(d.mensagem).toContain('Desde: 13:10');
    expect(d.mensagem).toContain('PORTA  DIREITA  DO  AR 160');
    expect(d.mensagem).toContain(CAMASI_AGUARDANDO_JUSTIFICATIVA);
  });

  it('14:00 — continua parada, não reenvia', () => {
    const estado: CamasiParadaAlertaEstadoMem = {
      data: HOJE,
      inicioEnviado: true,
      ultimaProducaoFim: '13:10:54',
      posProducaoEnviado: true,
    };
    const d = evalAt(ms(14, 0), [DUMMY_INICIO, PROD_BLIP], estado);
    expect(d.acao).toBe('skip');
    expect(d.motivo).toBe('pos_producao_ja_enviado');
  });

  it('fora da escala (18:00) — não envia', () => {
    const d = evalAt(ms(18, 0), [DUMMY_INICIO, PROD_BLIP]);
    expect(d.acao).toBe('skip');
    expect(d.motivo).toBe('fora_da_escala');
  });
});

describe('avaliarAlertaParadaCamasi — produção cedo', () => {
  it('produção às 07:03: não manda o alerta de início; manda pós-produção 20 min após o freeze', () => {
    const prod = row({
      id: 2,
      data: HOJE,
      inicioProducao: '07:03:00',
      fimProducao: '07:10:00',
      nomeOperador: 'LATERAL',
      horasProducao: 7 / 60,
    });
    const as726 = evalAt(ms(7, 26), [prod]);
    expect(as726.acao).toBe('skip');
    expect(as726.motivo).toBe('aguardando_20min_pos_producao');

    const as730 = evalAt(ms(7, 30), [prod], as726.next);
    expect(as730.acao).toBe('send');
    expect(as730.tipoEnvio).toBe('pos_producao');
    expect(as730.mensagem).toContain('Desde: 07:10');
    expect(as730.mensagem).toContain('LATERAL');
  });
});

describe('montarMensagemAlertaParadaCamasi', () => {
  it('formata mensagem curta', () => {
    const texto = montarMensagemAlertaParadaCamasi({
      maquina: 'Perfiladeira',
      minutos: 20.4,
      desdeMs: ms(7, 5),
      peca: '',
      motivo: CAMASI_PARADA_SEM_JUSTIFICATIVA,
    });
    expect(texto).toBe(
      [
        '⚠️ Perfiladeira parada há 20 min.',
        '',
        'Desde: 07:05',
        'Receita configurada: (sem receita)',
        `Motivo: ${CAMASI_PARADA_SEM_JUSTIFICATIVA}`,
        '',
        'Desloquem até a máquina para averiguar.',
      ].join('\n')
    );
  });
});
