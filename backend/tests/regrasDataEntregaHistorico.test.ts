import { describe, expect, it } from 'vitest';
import { DEFAULT_REGRA_DATA_ENTREGA } from '../src/config/regrasDataEntrega.js';
import {
  calcularDataLimiteCarrada,
  textoMotivoRegraCarrada,
} from '../src/data/regrasDataEntregaRepository.js';
import { montarItemHistoricoRegraCarrada, type PedidoRow } from '../src/data/pedidosRepository.js';

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('calcularDataLimiteCarrada — fallback padrão do sistema', () => {
  const emissao = new Date('2026-07-13T12:00:00');

  it('sem versão (config null) usa DEFAULT: valor ≥ corte → +45 dias', () => {
    const { dataLimite, dias, usouPadraoSistema } = calcularDataLimiteCarrada(emissao, 50000, null);
    expect(usouPadraoSistema).toBe(true);
    expect(dias).toBe(DEFAULT_REGRA_DATA_ENTREGA.carrada.diasIgualOuAcimaCorte);
    expect(dias).toBe(45);
    expect(dataLimite.toISOString().slice(0, 10)).toBe(addDays('2026-07-13', 45));
  });

  it('sem versão (config null) usa DEFAULT: valor < corte → +60 dias', () => {
    const { dataLimite, dias, usouPadraoSistema } = calcularDataLimiteCarrada(emissao, 10000, null);
    expect(usouPadraoSistema).toBe(true);
    expect(dias).toBe(60);
    expect(dataLimite.toISOString().slice(0, 10)).toBe(addDays('2026-07-13', 60));
  });

  it('com versão vigente respeita dias da versão', () => {
    const config = {
      carrada: {
        baseData: 'emissao' as const,
        valorCorte: 30000,
        diasAbaixoCorte: 10,
        diasIgualOuAcimaCorte: 20,
        incluiInserirRomaneio: false,
      },
    };
    const acima = calcularDataLimiteCarrada(emissao, 40000, config);
    expect(acima.usouPadraoSistema).toBe(false);
    expect(acima.dias).toBe(20);
    const abaixo = calcularDataLimiteCarrada(emissao, 1000, config);
    expect(abaixo.dias).toBe(10);
  });
});

describe('textoMotivoRegraCarrada', () => {
  it('descreve padrão do sistema e faixa de corte', () => {
    const t = textoMotivoRegraCarrada(45, 50000, 30000, true);
    expect(t).toContain('emissão + 45 dias');
    expect(t).toContain('valor ≥ corte');
    expect(t).toContain('padrão do sistema');
  });
});

function toYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('montarItemHistoricoRegraCarrada', () => {
  const basePedido = {
    id_pedido: '186-49543-4853',
    cliente: 'NIELLY',
    produto: 'Gondola',
    qtd: 1,
    previsao_entrega: new Date('2026-08-27T12:00:00'),
    previsao_entrega_atualizada: new Date('2026-08-27T12:00:00'),
    TipoF: 'Carradas',
    Emissao: '2026-07-13T12:00:00',
    'Valor Pedido Total': 82000,
    'Data de entrega': '2026-08-30T12:00:00',
  } satisfies PedidoRow & Record<string, unknown>;

  it('gera item sintético quando data Nomus ≠ data-limite (padrão 45)', () => {
    const item = montarItemHistoricoRegraCarrada(basePedido, []);
    expect(item).not.toBeNull();
    expect(item!.tipo_evento).toBe('regra_carrada');
    expect(item!.usuario).toBe('Sistema');
    expect(toYmdLocal(item!.previsao_anterior)).toBe('2026-08-30');
    expect(toYmdLocal(item!.previsao_nova)).toBe(addDays('2026-07-13', 45));
    expect(item!.motivo).toContain('45');
    expect(item!.motivo).toContain('padrão do sistema');
  });

  it('retorna null quando datas Nomus e limite coincidem', () => {
    const limite = addDays('2026-07-13', 45);
    const item = montarItemHistoricoRegraCarrada(
      { ...basePedido, 'Data de entrega': `${limite}T12:00:00` },
      []
    );
    expect(item).toBeNull();
  });

  it('retorna null para TipoF que não é Carradas', () => {
    const item = montarItemHistoricoRegraCarrada(
      { ...basePedido, TipoF: 'Retirada' },
      []
    );
    expect(item).toBeNull();
  });
});
