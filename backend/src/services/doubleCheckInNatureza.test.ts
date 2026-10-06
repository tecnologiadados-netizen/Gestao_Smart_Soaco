import { describe, expect, it } from 'vitest';
import { classificarNaturezaDivergencia } from './doubleCheckInNatureza.js';

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

  it('considera pagamento com todos os prazos iguais ou maiores como benigno', () => {
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
    ).toBe('real');
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
