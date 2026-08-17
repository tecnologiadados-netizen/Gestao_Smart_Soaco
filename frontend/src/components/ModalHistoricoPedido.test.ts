import { describe, expect, it } from 'vitest';
import type { HistoricoItem } from '../api/pedidos';
import {
  isMotivoConfirmacaoConfiavel,
  montarDeltaAjusteHistorico,
} from './ModalHistoricoPedido';

const base = (over: Partial<HistoricoItem>): HistoricoItem => ({
  id: 1,
  id_pedido: 'x',
  previsao_nova: '2026-08-21',
  previsao_anterior: '2026-08-21',
  motivo: '',
  usuario: 'marquesfilho',
  data_ajuste: '2026-08-16T18:00:10.000Z',
  previsao_confiavel: true,
  tipo_evento: 'ajuste_previsao',
  rota: 'rota maranhao centro sul-liberada',
  ...over,
});

describe('montarDeltaAjusteHistorico', () => {
  it('só Confiável: omite data, motivo automático e rota do cabeçalho', () => {
    const atual = base({
      motivo: 'Confirmação de previsão confiável (sequenciamento)',
      previsao_confiavel: true,
    });
    const anterior = base({
      id: 2,
      previsao_confiavel: false,
      motivo: 'Ajuste de programação de produção',
      previsao_anterior: '2026-10-11',
    });
    const delta = montarDeltaAjusteHistorico(
      atual,
      anterior,
      'ROTA MARANHÃO CENTRO SUL - LIBERADA'
    );
    expect(delta.soConfiavel).toBe(true);
    expect(delta.textoPrevisao).toBeNull();
    expect(delta.textoConfiavel).toBe(
      'Previsão confiável: de Não confiável para Confiável'
    );
    expect(delta.mostrarMotivo).toBe(false);
    expect(delta.mostrarRota).toBe(false);
  });

  it('com mudança de data: mostra previsão e motivo; omite rota igual ao cabeçalho', () => {
    const atual = base({
      previsao_nova: '2026-08-21',
      previsao_anterior: '2026-10-11',
      motivo: 'Ajuste de programação de produção',
      previsao_confiavel: false,
    });
    const anterior = base({
      id: 2,
      previsao_nova: '2026-10-11',
      previsao_confiavel: true,
    });
    const delta = montarDeltaAjusteHistorico(
      atual,
      anterior,
      'ROTA MARANHÃO CENTRO SUL - LIBERADA'
    );
    expect(delta.dataMudou).toBe(true);
    expect(delta.soConfiavel).toBe(false);
    expect(delta.textoPrevisao).toBe('Nova previsão: de 11/10/2026 para 21/08/2026');
    expect(delta.mostrarMotivo).toBe(true);
    expect(delta.mostrarRota).toBe(false);
    expect(delta.textoConfiavel).toContain('Não confiável');
  });

  it('exibe rota só quando diverge do cabeçalho', () => {
    const atual = base({
      rota: 'rota belem 07-liberada',
      previsao_anterior: '2026-09-01',
      previsao_nova: '2026-09-10',
      motivo: 'x',
    });
    const delta = montarDeltaAjusteHistorico(
      atual,
      null,
      'ROTA MARANHÃO CENTRO SUL - LIBERADA'
    );
    expect(delta.mostrarRota).toBe(true);
  });
});

describe('isMotivoConfirmacaoConfiavel', () => {
  it('reconhece o motivo gerado pelo sequenciamento', () => {
    expect(
      isMotivoConfirmacaoConfiavel('Confirmação de previsão confiável (sequenciamento)')
    ).toBe(true);
    expect(isMotivoConfirmacaoConfiavel('Ajuste de programação de produção')).toBe(false);
  });
});
