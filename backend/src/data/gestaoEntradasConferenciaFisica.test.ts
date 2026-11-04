import { describe, expect, it } from 'vitest';
import {
  agregarConferenciaFisica,
  diaCivilSaoPaulo,
  filtrarVoltasConferenciaFisica,
  montarVoltasNoPeriodo,
  type VoltaBruta,
} from './gestaoEntradasConferenciaFisica.js';

const INICIO = '2026-11-01';
const FIM = '2026-11-03';

function volta(partial: Partial<VoltaBruta> & Pick<VoltaBruta, 'idDocumentoEstoque'>): VoltaBruta {
  return {
    numeroDocumento: 'NF 1',
    conferenteNome: 'Ana',
    conferenteLogin: 'ana',
    atribuidoEm: new Date('2026-11-02T15:00:00-03:00'),
    finalizadoEm: null,
    cancelada: false,
    itens: [],
    origem: 'atual',
    cicloId: null,
    ...partial,
  };
}

describe('conferência física — voltas no período', () => {
  it('conta o dia civil em São Paulo', () => {
    expect(diaCivilSaoPaulo(new Date('2026-11-03T02:30:00Z'))).toBe('2026-11-02');
    expect(diaCivilSaoPaulo(new Date('2026-11-03T03:00:00Z'))).toBe('2026-11-03');
  });

  it('destinação ainda com o conferente entra só no primeiro card', () => {
    const voltas = montarVoltasNoPeriodo(
      [volta({ idDocumentoEstoque: 1, itens: [{ conferido: false }] })],
      INICIO,
      FIM,
    );
    const painel = agregarConferenciaFisica(voltas, INICIO, FIM);
    expect(painel.kpis.qtdeDestinacoes).toBe(1);
    expect(painel.kpis.qtdeEmConferencia).toBe(1);
    expect(painel.kpis.qtdeFinalizadas).toBe(0);
    expect(painel.kpis.taxaDivergencia).toBeNull();
    expect(painel.kpis.leadTimeMedioHoras).toBeNull();
  });

  it('retorno com todos os itens conferidos é conferida e entra no lead time', () => {
    const voltas = montarVoltasNoPeriodo(
      [
        volta({
          idDocumentoEstoque: 2,
          atribuidoEm: new Date('2026-11-02T10:00:00-03:00'),
          finalizadoEm: new Date('2026-11-02T12:30:00-03:00'),
          itens: [{ conferido: true }, { conferido: true }],
        }),
      ],
      INICIO,
      FIM,
    );
    const painel = agregarConferenciaFisica(voltas, INICIO, FIM);
    expect(painel.kpis.qtdeFinalizadas).toBe(1);
    expect(painel.kpis.qtdeDivergencias).toBe(0);
    expect(painel.kpis.taxaDivergencia).toBe(0);
    expect(painel.kpis.qtdePrimeira).toBe(1);
    expect(painel.kpis.qtdeDivergenciaPrimeira).toBe(0);
    expect(painel.kpis.leadTimeMedioHoras).toBe(2.5);
    expect(painel.kpis.leadTimeMedianoHoras).toBe(2.5);
    expect(filtrarVoltasConferenciaFisica(voltas, { tipo: 'finalizadas' })).toHaveLength(1);
    expect(filtrarVoltasConferenciaFisica(voltas, { tipo: 'sem_divergencia' })).toHaveLength(1);
    expect(filtrarVoltasConferenciaFisica(voltas, { tipo: 'leadtime' })).toHaveLength(
      painel.kpis.qtdeAmostraLeadTime,
    );
  });

  it('retorno com item divergente não conta como conferida', () => {
    const voltas = montarVoltasNoPeriodo(
      [
        volta({
          idDocumentoEstoque: 3,
          finalizadoEm: new Date('2026-11-02T18:00:00-03:00'),
          itens: [{ conferido: true }, { conferido: false }],
        }),
      ],
      INICIO,
      FIM,
    );
    const painel = agregarConferenciaFisica(voltas, INICIO, FIM);
    expect(painel.kpis.qtdeFinalizadas).toBe(1);
    expect(painel.kpis.qtdeDivergencias).toBe(1);
    expect(painel.kpis.taxaDivergencia).toBe(100);
    expect(painel.kpis.qtdeDivergenciaPrimeira).toBe(1);
    expect(filtrarVoltasConferenciaFisica(voltas, { tipo: 'divergencia' })).toHaveLength(1);
    expect(filtrarVoltasConferenciaFisica(voltas, { tipo: 'finalizadas' })).toHaveLength(1);
    expect(filtrarVoltasConferenciaFisica(voltas, { tipo: 'divergencia_primeira' })).toHaveLength(1);
  });

  it('cancelada fica de fora e o ciclo anterior continua na conta', () => {
    const voltas = montarVoltasNoPeriodo(
      [
        volta({
          idDocumentoEstoque: 4,
          cancelada: true,
          atribuidoEm: new Date('2026-11-03T09:00:00-03:00'),
          finalizadoEm: new Date('2026-11-03T11:00:00-03:00'),
          itens: [{ conferido: true }],
        }),
        volta({
          idDocumentoEstoque: 4,
          origem: 'ciclo',
          cicloId: 9,
          conferenteNome: 'Bruno',
          atribuidoEm: new Date('2026-11-01T08:00:00-03:00'),
          finalizadoEm: new Date('2026-11-01T09:00:00-03:00'),
          itens: [{ conferido: false }],
        }),
      ],
      INICIO,
      FIM,
    );
    const painel = agregarConferenciaFisica(voltas, INICIO, FIM);
    expect(voltas).toHaveLength(1);
    expect(voltas[0]?.conferente).toBe('Bruno');
    expect(painel.kpis.qtdeDestinacoes).toBe(1);
    expect(painel.kpis.qtdeDivergencias).toBe(1);
    expect(painel.kpis.leadTimeMedioHoras).toBe(1);
  });

  it('fora do período e sem data de destinação não entram', () => {
    const voltas = montarVoltasNoPeriodo(
      [
        volta({
          idDocumentoEstoque: 5,
          atribuidoEm: new Date('2026-10-31T23:30:00-03:00'),
          finalizadoEm: new Date('2026-11-01T08:00:00-03:00'),
          itens: [{ conferido: true }],
        }),
        volta({ idDocumentoEstoque: 6, atribuidoEm: null }),
      ],
      INICIO,
      FIM,
    );
    expect(voltas).toHaveLength(0);
  });

  it('média e mediana usam as mesmas horas do detalhe', () => {
    const voltas = montarVoltasNoPeriodo(
      [
        volta({
          idDocumentoEstoque: 7,
          atribuidoEm: new Date('2026-11-01T08:00:00-03:00'),
          finalizadoEm: new Date('2026-11-01T09:00:00-03:00'),
          itens: [{ conferido: true }],
        }),
        volta({
          idDocumentoEstoque: 8,
          atribuidoEm: new Date('2026-11-01T08:00:00-03:00'),
          finalizadoEm: new Date('2026-11-01T11:00:00-03:00'),
          itens: [{ conferido: true }],
        }),
        volta({
          idDocumentoEstoque: 9,
          atribuidoEm: new Date('2026-11-02T08:00:00-03:00'),
          finalizadoEm: new Date('2026-11-02T18:00:00-03:00'),
          itens: [{ conferido: false }],
        }),
      ],
      INICIO,
      FIM,
    );
    const painel = agregarConferenciaFisica(voltas, INICIO, FIM);
    expect(painel.kpis.qtdeDestinacoes).toBe(filtrarVoltasConferenciaFisica(voltas, { tipo: 'destinacoes' }).length);
    expect(painel.kpis.qtdeFinalizadas).toBe(filtrarVoltasConferenciaFisica(voltas, { tipo: 'finalizadas' }).length);
    expect(painel.kpis.qtdeDivergencias).toBe(filtrarVoltasConferenciaFisica(voltas, { tipo: 'divergencia' }).length);
    expect(painel.kpis.taxaDivergencia).toBe(33.3);
    expect(painel.kpis.leadTimeMedianoHoras).toBe(3);
    expect(painel.kpis.leadTimeMedioHoras).toBe(4.67);
    expect(painel.serieDiaria.map((dia) => dia.destinacoes)).toEqual([2, 1]);
    expect(painel.serieDiaria.map((dia) => dia.finalizadas)).toEqual([2, 1]);
    expect(filtrarVoltasConferenciaFisica(voltas, { tipo: 'dia', dia: '2026-11' })).toHaveLength(3);
    expect(filtrarVoltasConferenciaFisica(voltas, { tipo: 'conferente', nome: 'Ana' })).toHaveLength(3);
  });

  it('a segunda ida continua sendo a segunda mesmo quando a primeira ficou fora do período', () => {
    const voltas = montarVoltasNoPeriodo(
      [
        volta({
          idDocumentoEstoque: 40,
          origem: 'ciclo',
          cicloId: 1,
          atribuidoEm: new Date('2026-10-31T10:00:00-03:00'),
          finalizadoEm: new Date('2026-10-31T12:00:00-03:00'),
          itens: [{ conferido: false }],
        }),
        volta({
          idDocumentoEstoque: 40,
          atribuidoEm: new Date('2026-11-02T10:00:00-03:00'),
          finalizadoEm: new Date('2026-11-02T11:00:00-03:00'),
          itens: [{ conferido: true }],
        }),
      ],
      INICIO,
      FIM,
    );
    const painel = agregarConferenciaFisica(voltas, INICIO, FIM);
    expect(voltas).toHaveLength(1);
    expect(voltas[0]?.voltaNumero).toBe(2);
    expect(painel.kpis.qtdeFinalizadas).toBe(1);
    expect(painel.kpis.qtdeSegunda).toBe(1);
    expect(painel.kpis.qtdeDivergenciaSegunda).toBe(0);
    expect(painel.kpis.qtdePrimeira).toBe(0);
    expect(painel.kpis.taxaDivergencia).toBe(0);
  });

  it('a taxa separa divergência da primeira ida e da segunda', () => {
    const voltas = montarVoltasNoPeriodo(
      [
        volta({
          idDocumentoEstoque: 50,
          origem: 'ciclo',
          cicloId: 2,
          atribuidoEm: new Date('2026-11-01T08:00:00-03:00'),
          finalizadoEm: new Date('2026-11-01T09:00:00-03:00'),
          itens: [{ conferido: false }],
        }),
        volta({
          idDocumentoEstoque: 50,
          atribuidoEm: new Date('2026-11-02T08:00:00-03:00'),
          finalizadoEm: new Date('2026-11-02T10:00:00-03:00'),
          itens: [{ conferido: true }],
        }),
      ],
      INICIO,
      FIM,
    );
    const painel = agregarConferenciaFisica(voltas, INICIO, FIM);
    expect(voltas.map((volta) => volta.voltaNumero).sort()).toEqual([1, 2]);
    expect(painel.kpis.qtdeFinalizadas).toBe(2);
    expect(painel.kpis.qtdeDivergencias).toBe(1);
    expect(painel.kpis.taxaDivergencia).toBe(50);
    expect(painel.kpis.qtdeDivergenciaPrimeira).toBe(1);
    expect(painel.kpis.qtdePrimeira).toBe(1);
    expect(painel.kpis.qtdeDivergenciaSegunda).toBe(0);
    expect(painel.kpis.qtdeSegunda).toBe(1);
    expect(filtrarVoltasConferenciaFisica(voltas, { tipo: 'divergencia' })).toHaveLength(1);
    expect(filtrarVoltasConferenciaFisica(voltas, { tipo: 'divergencia_segunda' })).toHaveLength(0);
    expect(painel.porConferente[0]?.acertosPorChance).toEqual([{ chance: 1, acertos: 1 }]);
  });

  it('conta a chance da contagem e não repete item já acertado numa volta anterior', () => {
    const voltas = montarVoltasNoPeriodo(
      [
        volta({
          idDocumentoEstoque: 70,
          origem: 'ciclo',
          cicloId: 3,
          conferenteNome: 'Ana',
          atribuidoEm: new Date('2026-11-01T08:00:00-03:00'),
          finalizadoEm: new Date('2026-11-01T09:00:00-03:00'),
          itens: [
            { conferido: true, tentativas: 1, idItemDocumento: 10 },
            { conferido: true, tentativas: 2, idItemDocumento: 11 },
            { conferido: false, tentativas: 3, idItemDocumento: 12 },
          ],
        }),
        volta({
          idDocumentoEstoque: 70,
          conferenteNome: 'Bruno',
          atribuidoEm: new Date('2026-11-02T08:00:00-03:00'),
          finalizadoEm: new Date('2026-11-02T09:00:00-03:00'),
          itens: [
            { conferido: true, tentativas: 1, idItemDocumento: 10 },
            { conferido: true, tentativas: 2, idItemDocumento: 11 },
            { conferido: true, tentativas: 3, idItemDocumento: 12 },
            { conferido: true, tentativas: 1, idItemDocumento: 13 },
          ],
        }),
      ],
      INICIO,
      FIM,
    );
    const painel = agregarConferenciaFisica(voltas, INICIO, FIM);
    const ana = painel.porConferente.find((item) => item.nome === 'Ana');
    const bruno = painel.porConferente.find((item) => item.nome === 'Bruno');
    expect(ana?.acertosPorChance).toEqual([
      { chance: 1, acertos: 1 },
      { chance: 2, acertos: 1 },
    ]);
    expect(bruno?.acertosPorChance).toEqual([
      { chance: 1, acertos: 1 },
      { chance: 3, acertos: 1 },
    ]);
  });
});
