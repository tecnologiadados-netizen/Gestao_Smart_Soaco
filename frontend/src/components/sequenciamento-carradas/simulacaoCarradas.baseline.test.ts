import { describe, it, expect } from 'vitest';
import {
  computarBaselines,
  computarItensDataProducao,
  linhaCarradaKey,
  type SimEntry,
} from './simulacaoCarradas';

const CARRADA = 'ROTA TESTE - LIBERADA';
const COD = '01688';

function linha(id: string, dataProducao: string | null): Record<string, unknown> {
  return {
    RM: COD,
    Observacoes: CARRADA,
    idChave: id,
    id_pedido: id,
    data_producao: dataProducao,
    previsao_entrega_atualizada: '2026-07-14',
  };
}

describe('computarBaselines — data de produção', () => {
  it('usa data única quando algumas linhas estão vazias', () => {
    const linhas = [linha('a', '2026-07-14'), linha('b', null)];
    const baseline = computarBaselines(linhas);
    const key = linhaCarradaKey(linhas[0]!);
    expect(baseline.get(key)?.dataProducao).toBe('2026-07-14');
    expect(baseline.get(key)?.dataProducaoDivergente).toBe(false);
  });

  it('marca divergente quando há duas datas distintas preenchidas', () => {
    const linhas = [linha('a', '2026-07-14'), linha('b', '2026-07-15')];
    const baseline = computarBaselines(linhas);
    const key = linhaCarradaKey(linhas[0]!);
    expect(baseline.get(key)?.dataProducao).toBe('');
    expect(baseline.get(key)?.dataProducaoDivergente).toBe(true);
  });
});

describe('computarItensDataProducao', () => {
  it('inclui linhas sem data_producao quando sim define data da carrada', () => {
    const linhas = [linha('item-a', null), linha('item-b', '2026-07-14')];
    const baseline = computarBaselines(linhas);
    const key = linhaCarradaKey(linhas[0]!);
    const sim = new Map<string, SimEntry>([[key, { dataProducao: '2026-07-14' }]]);
    const payload = computarItensDataProducao(linhas, sim, baseline);
    expect(payload).toHaveLength(1);
    expect(payload[0]?.id_pedido).toBe('item-a');
    expect(payload[0]?.data_producao).toBe('2026-07-14');
  });

  it('persiste todos os itens quando baseline parcial tem data única e sim vazio', () => {
    const linhas = [linha('item-a', null), linha('item-b', null)];
    const baselineComData = computarBaselines([
      linha('item-a', '2026-07-14'),
      linha('item-b', null),
    ]);
    const sim = new Map<string, SimEntry>();
    const payload = computarItensDataProducao(linhas, sim, baselineComData);
    expect(payload).toHaveLength(2);
    expect(payload.every((p) => p.data_producao === '2026-07-14')).toBe(true);
  });
});
