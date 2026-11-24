import { describe, expect, it } from 'vitest';
import { aglutinarItensProgramacaoSetorial } from '../../frontend/src/utils/aglutinarProgramacaoSetorial';

function linha(partial: {
  setor: string;
  pd: string;
  cod?: string;
  obs?: string;
  data?: string;
  qty?: number;
  recurso?: string;
}) {
  const qty = partial.qty ?? 1;
  return {
    Observacoes: partial.obs ?? '1-Retirada na So Aço',
    DataBase: partial.data ?? '23/11/2026',
    DataBaseIso: '2026-11-23',
    PD: partial.pd,
    Cod: partial.cod ?? 'PA 1333',
    'Setor de Producao': partial.setor,
    Recurso: partial.recurso,
    originalQty: qty,
    qtyToProduce: qty,
    fulfilledByStock: 0,
  };
}

describe('aglutinarItensProgramacaoSetorial', () => {
  it('mantém cada pedido de Cadeiras na própria linha, mesmo no mesmo dia e código', () => {
    const out = aglutinarItensProgramacaoSetorial([
      linha({ setor: 'Cadeiras', pd: 'PD 49104', qty: 20 }),
      linha({ setor: 'Cadeiras', pd: 'PD 50952', qty: 8 }),
      linha({ setor: 'Cadeiras', pd: 'PD 50614', qty: 10 }),
    ]);

    expect(out).toHaveLength(3);
    expect(out.map((r) => r.PD)).toEqual(['PD 49104', 'PD 50952', 'PD 50614']);
    expect(out.map((r) => r.qtyToProduce)).toEqual([20, 8, 10]);
  });

  it('não soma duas linhas do mesmo pedido de Cadeiras', () => {
    const out = aglutinarItensProgramacaoSetorial([
      linha({ setor: 'Cadeiras', pd: 'PD 50614', qty: 4 }),
      linha({ setor: 'Cadeiras', pd: 'PD 50614', qty: 1 }),
    ]);

    expect(out).toHaveLength(2);
    expect(out.map((r) => r.qtyToProduce)).toEqual([4, 1]);
  });

  it('continua juntando os demais setores pela observação, data e código', () => {
    const out = aglutinarItensProgramacaoSetorial([
      linha({ setor: 'Gôndolas', pd: 'PD 100', qty: 5, recurso: 'PCP' }),
      linha({ setor: 'Gôndolas', pd: 'PD 200', qty: 7 }),
    ]);

    expect(out).toHaveLength(1);
    expect(out[0].PD).toBe('PD 100, PD 200');
    expect(out[0].qtyToProduce).toBe(12);
    expect(out[0].originalQty).toBe(12);
    expect(out[0].Recurso).toBe('PCP');
  });

  it('não mistura Cadeiras com outro setor do mesmo código', () => {
    const out = aglutinarItensProgramacaoSetorial([
      linha({ setor: 'Cadeiras', pd: 'PD 1', qty: 3 }),
      linha({ setor: 'Gôndolas', pd: 'PD 2', qty: 4 }),
      linha({ setor: 'Gôndolas', pd: 'PD 3', qty: 6 }),
    ]);

    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ PD: 'PD 1', qtyToProduce: 3 });
    expect(out[1]).toMatchObject({ PD: 'PD 2, PD 3', qtyToProduce: 10 });
  });
});
