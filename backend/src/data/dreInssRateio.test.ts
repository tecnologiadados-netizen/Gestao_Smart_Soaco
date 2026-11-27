import { describe, expect, it } from 'vitest';
import { pathKeyDrePorCodigo } from './drePlanoContasMap.js';
import {
  DRE_FGTS_POOL_PATHKEY,
  DRE_INSS_POOL_PATHKEY,
  aplicarRateioInssNasLinhasSaidas,
  resolverPathKeyInssPoolAgregacao,
} from './dreInssRateio.js';

describe('pool de INSS e FGTS', () => {
  it('reconhece a conta única de cada origem', () => {
    expect(resolverPathKeyInssPoolAgregacao('INSS', 308, 'nomus')).toBe(DRE_INSS_POOL_PATHKEY);
    expect(resolverPathKeyInssPoolAgregacao('FGTS', 43, 'nomus')).toBe(DRE_FGTS_POOL_PATHKEY);
    expect(resolverPathKeyInssPoolAgregacao('FGTS', 9076, 'shop9')).toBe(DRE_FGTS_POOL_PATHKEY);
    expect(resolverPathKeyInssPoolAgregacao('Outra', 9076, 'shop9')).toBe(DRE_FGTS_POOL_PATHKEY);
    expect(resolverPathKeyInssPoolAgregacao('FGTS Multa Rescisória', 41, 'nomus')).toBeNull();
    expect(resolverPathKeyInssPoolAgregacao('Outra', 43, 'shop9')).toBeNull();
  });

  it('divide o FGTS entre operação, logística e administrativo pelo salário', () => {
    const op = pathKeyDrePorCodigo('10.1.1')!;
    const log = pathKeyDrePorCodigo('11.2.1.1')!;
    const adm = pathKeyDrePorCodigo('13.1.1')!;
    const fgtsOp = pathKeyDrePorCodigo('10.1.8')!;
    const fgtsLog = pathKeyDrePorCodigo('11.2.1.8')!;
    const fgtsAdm = pathKeyDrePorCodigo('13.1.7')!;
    const out = aplicarRateioInssNasLinhasSaidas([
      { pathKey: op, periodo: '2026-09', valor: 500 },
      { pathKey: log, periodo: '2026-09', valor: 300 },
      { pathKey: adm, periodo: '2026-09', valor: 200 },
      { pathKey: DRE_FGTS_POOL_PATHKEY, periodo: '2026-09', valor: 1000 },
    ]);
    const valor = (pk: string) => out.find((l) => l.pathKey === pk)?.valor ?? 0;
    expect(valor(fgtsOp)).toBe(500);
    expect(valor(fgtsLog)).toBe(300);
    expect(valor(fgtsAdm)).toBe(200);
    expect(out.some((l) => l.pathKey === DRE_FGTS_POOL_PATHKEY)).toBe(false);
    expect(valor(op) + valor(log) + valor(adm)).toBe(1000);
  });
});
