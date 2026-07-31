import { describe, expect, it } from 'vitest';
import type { TooltipDetalheRow } from '../../api/pedidos';
import {
  itemEhTipofCarradas,
  montarEscopoReplicacaoMesmoRm,
} from './sequenciamentoCarradasUtils';

function item(partial: Partial<TooltipDetalheRow> & Pick<TooltipDetalheRow, 'codigo' | 'rota'>): TooltipDetalheRow {
  return {
    rm: '',
    dataEmissao: '',
    pedido: '47678',
    municipio: '',
    aVista: '',
    valorPendente: 0,
    produto: '',
    qtdePendenteReal: 1,
    ...partial,
  };
}

function linhaSnap(partial: Record<string, unknown>): Record<string, unknown> {
  return {
    id_pedido: String(partial.id_pedido ?? 'id'),
    RM: partial.RM ?? '',
    Observacoes: partial.Observacoes ?? 'ROTA BELEM',
    PD: partial.PD ?? '47678',
    Cod: partial.Cod ?? 'PA 1',
    'Descricao do produto': 'x',
    'Qtde Pendente Real': 1,
    'Saldo a Faturar Real': 0,
    ...partial,
  };
}

describe('itemEhTipofCarradas', () => {
  it('reconhece rota ROTA … e rejeita especiais', () => {
    expect(itemEhTipofCarradas({ rota: 'ROTA BELEM ABAETETUBA - LIBERADA' })).toBe(true);
    expect(itemEhTipofCarradas({ rota: '5-Requisicao' })).toBe(false);
    expect(itemEhTipofCarradas({ rota: '1-Retirada na So Aço' })).toBe(false);
  });
});

describe('montarEscopoReplicacaoMesmoRm', () => {
  it('inclui itens de todos os PDs no mesmo RM', () => {
    const linhas = [
      linhaSnap({ id_pedido: 'a1', RM: '01694', PD: '47678', Cod: 'PA 11129' }),
      linhaSnap({ id_pedido: 'a2', RM: '01694', PD: '47678', Cod: 'PA 5413' }),
      linhaSnap({ id_pedido: 'b1', RM: '01694', PD: '48001', Cod: 'PA 9999' }),
      linhaSnap({ id_pedido: 'c1', RM: '01999', PD: '49000', Cod: 'PA 1' }),
    ];
    const escolhidos = [item({ codigo: 'PA 11129', rota: 'ROTA BELEM', rm: '01694', pedido: '47678' })];
    const r = montarEscopoReplicacaoMesmoRm(escolhidos, linhas);
    expect(r.precisaConfirmar).toBe(true);
    expect(r.qtdItens).toBe(3);
    expect(r.qtdPedidos).toBe(2);
    expect(r.extras).toBe(2);
    expect(r.rotulosRm).toEqual(['01694']);
    expect(r.linhasSnapshot).toHaveLength(3);
  });

  it('não expande tipof requisição', () => {
    const linhas = [
      linhaSnap({
        id_pedido: 'r1',
        RM: '',
        Observacoes: '5-Requisicao',
        PD: '1',
        Cod: 'PA 1',
      }),
      linhaSnap({
        id_pedido: 'r2',
        RM: '',
        Observacoes: '5-Requisicao',
        PD: '1',
        Cod: 'PA 2',
      }),
    ];
    const escolhidos = [item({ codigo: 'PA 1', rota: '5-Requisicao', rm: '', pedido: '1' })];
    const r = montarEscopoReplicacaoMesmoRm(escolhidos, linhas);
    expect(r.precisaConfirmar).toBe(false);
    expect(r.linhasSnapshot).toHaveLength(0);
  });
});
