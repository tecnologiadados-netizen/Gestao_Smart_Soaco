import { describe, expect, it } from 'vitest';
import {
  cardTemPrevisaoNaoConfiavelNasLinhas,
  mensagemBloqueioNaoConfiavel,
  pdsDisponiveisEntreIds,
} from '../src/services/sycroOrderDisponivelConfiavel.ts';

describe('disponível x previsão não confiável', () => {
  it('detecta não confiável só nos itens do card', () => {
    const rows = [
      { id_pedido: '1-10-1', PD: '10', previsao_atual_confiavel: true },
      { id_pedido: '1-10-2', PD: '10', previsao_atual_confiavel: false },
    ];
    expect(cardTemPrevisaoNaoConfiavelNasLinhas(rows, JSON.stringify(['1-10-1']), null)).toBe(false);
    expect(cardTemPrevisaoNaoConfiavelNasLinhas(rows, JSON.stringify(['1-10-2']), null)).toBe(true);
    expect(cardTemPrevisaoNaoConfiavelNasLinhas(rows, null, null)).toBe(true);
  });

  it('lista o PD quando a linha está Disponível', () => {
    const rows = [
      { id_pedido: '9-20-1', PD: '20', Card: 'Disponível' },
      { id_pedido: '9-21-1', PD: '21', Card: 'Card' },
    ];
    expect(pdsDisponiveisEntreIds(['9-20-1', '9-21-1'], rows)).toEqual(['20']);
    expect(pdsDisponiveisEntreIds(['outro'], rows)).toEqual([]);
  });

  it('explica o que fazer, no singular e no plural', () => {
    expect(mensagemBloqueioNaoConfiavel(['49722'])).toContain('pedido 49722');
    expect(mensagemBloqueioNaoConfiavel(['49722'])).toContain('Desmarque a tag Disponível');
    expect(mensagemBloqueioNaoConfiavel(['1', '2'])).toContain('os pedidos 1, 2');
  });
});
