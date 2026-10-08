import { describe, expect, it } from 'vitest';
import {
  classificarNaturezaDivergencia,
  observacaoNaturezaDivergencia,
} from './doubleCheckInNatureza.js';

describe('classificarNaturezaDivergencia', () => {
  it('considera preço menor na NF como benigno e preço maior como real', () => {
    expect(
      classificarNaturezaDivergencia({
        linha: { valorUnitarioNF: 6.06, valorUnitarioPC: 6.16 },
        campo: 'valor_unitario',
      })
    ).toBe('benigna');
    expect(
      classificarNaturezaDivergencia({
        linha: { valorUnitarioNF: 6.17, valorUnitarioPC: 6.16 },
        campo: 'valor_unitario',
      })
    ).toBe('real');
  });

  it('mantém qualquer diferença de quantidade como real', () => {
    expect(
      classificarNaturezaDivergencia({
        linha: { qtdeNF: 1652, qtdePC: 1511.88 },
        campo: 'qtde',
      })
    ).toBe('real');
    expect(
      classificarNaturezaDivergencia({
        linha: { qtdeNF: 10, qtdePC: 20 },
        campo: 'qtde',
      })
    ).toBe('real');
  });

  it('considera IPI menor benigno e IPI maior real', () => {
    expect(
      classificarNaturezaDivergencia({
        linha: { valorIpiNF: 10, valorIpiPC: 12 },
        campo: 'ipi',
      })
    ).toBe('benigna');
    expect(
      classificarNaturezaDivergencia({
        linha: { valorIpiNF: 13, valorIpiPC: 12 },
        campo: 'ipi',
      })
    ).toBe('real');
  });

  it('considera pagamento igual, maior ou até 5 dias mais curto como benigno', () => {
    expect(
      classificarNaturezaDivergencia({
        linha: { prazosDiasNF: [35, 65], prazosDiasPC: [30, 60] },
        campo: 'condicao_pagamento',
      })
    ).toBe('benigna');
    expect(
      classificarNaturezaDivergencia({
        linha: { prazosDiasNF: [25, 60], prazosDiasPC: [30, 60] },
        campo: 'condicao_pagamento',
      })
    ).toBe('benigna');
    expect(
      classificarNaturezaDivergencia({
        linha: { prazosDiasNF: [28], prazosDiasPC: [30] },
        campo: 'condicao_pagamento',
      })
    ).toBe('benigna');
    expect(
      classificarNaturezaDivergencia({
        linha: { prazosDiasNF: [24, 60], prazosDiasPC: [30, 60] },
        campo: 'condicao_pagamento',
      })
    ).toBe('real');
  });

  it('mantém real a parcela que só existe na nota', () => {
    expect(
      classificarNaturezaDivergencia({
        linha: { prazosDiasNF: [28, 30], prazosDiasPC: [30] },
        campo: 'condicao_pagamento',
      })
    ).toBe('real');
  });

  it('abona o pagamento inteiro com a justificativa de frete lançado na entrada', () => {
    expect(
      classificarNaturezaDivergencia({
        linha: { prazosDiasNF: [28, 30], prazosDiasPC: [30] },
        campo: 'condicao_pagamento',
        justificativaCodigo: 'frete_lancado_na_entrada',
      })
    ).toBe('benigna');
  });

  it('considera benigno quando todas as parcelas da NF vencem após o prazo do PC', () => {
    expect(
      classificarNaturezaDivergencia({
        linha: { prazosDiasNF: [18, 26], prazosDiasPC: [15] },
        campo: 'condicao_pagamento',
      })
    ).toBe('benigna');
    expect(
      classificarNaturezaDivergencia({
        linha: { prazosDiasNF: [10, 26], prazosDiasPC: [15] },
        campo: 'condicao_pagamento',
      })
    ).toBe('real');
  });

  it('considera ajuste de vencimento para o próximo dia útil como benigno', () => {
    expect(
      classificarNaturezaDivergencia({
        linha: {
          prazosDiasNF: [30, 45],
          prazosDiasPC: [30, 47],
          dataBaseParcelasNF: '2026-10-07',
          dataBaseParcelasPC: '2026-10-07',
          parcelasNF: [
            { dias: 30, dataBase: '2026-10-07', dataVencimento: '2026-11-06' },
            { dias: 45, dataBase: '2026-10-07', dataVencimento: '2026-11-21' },
          ],
          parcelasPC: [
            { dias: 30, dataBase: '2026-10-07', dataVencimento: '2026-11-06' },
            { dias: 47, dataBase: '2026-10-07', dataVencimento: '2026-11-23' },
          ],
        },
        campo: 'condicao_pagamento',
      })
    ).toBe('benigna');
  });

  it('explica no card quando o Nomus só ajustou o dia útil', () => {
    const linha = {
      prazosDiasNF: [30, 45],
      prazosDiasPC: [30, 47],
      dataBaseParcelasNF: '2026-10-07',
      dataBaseParcelasPC: '2026-10-07',
    };
    expect(
      observacaoNaturezaDivergencia({ linha, campo: 'condicao_pagamento' })
    ).toMatch(/próximo dia útil/i);
    expect(observacaoNaturezaDivergencia({ linha, campo: 'qtde' })).toBeNull();
  });

  it('mantém real quando a diferença de dias não é só o próximo dia útil', () => {
    expect(
      classificarNaturezaDivergencia({
        linha: {
          prazosDiasNF: [30, 45],
          prazosDiasPC: [30, 52],
          dataBaseParcelasNF: '2026-10-07',
          dataBaseParcelasPC: '2026-10-07',
          parcelasNF: [
            { dias: 30, dataBase: '2026-10-07', dataVencimento: '2026-11-06' },
            { dias: 45, dataBase: '2026-10-07', dataVencimento: '2026-11-21' },
          ],
          parcelasPC: [
            { dias: 30, dataBase: '2026-10-07', dataVencimento: '2026-11-06' },
            { dias: 52, dataBase: '2026-10-07', dataVencimento: '2026-11-28' },
          ],
        },
        campo: 'condicao_pagamento',
      })
    ).toBe('real');
  });

  it('respeita justificativas técnicas benignas', () => {
    expect(
      classificarNaturezaDivergencia({
        linha: { valorIpiNF: 100, valorIpiPC: 10 },
        campo: 'ipi',
        justificativaCodigo: 'ipi_reflexo',
      })
    ).toBe('benigna');
  });
});
