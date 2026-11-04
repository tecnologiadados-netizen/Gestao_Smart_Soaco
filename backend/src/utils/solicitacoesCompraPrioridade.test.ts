import { describe, expect, it } from 'vitest';
import { priorizarSolicitacoesCompra } from './solicitacoesCompraPrioridade.js';

describe('priorizarSolicitacoesCompra', () => {
  it('numera cada coleta pela necessidade mais cedo e desempata pelo nome', () => {
    const linhas = priorizarSolicitacoesCompra([
      {
        idSolicitacao: 2,
        nomeColeta: 'LAMPADA E ABRAÇADEIRA',
        dataNecessidade: '2026-07-02',
      },
      {
        idSolicitacao: 1,
        nomeColeta: 'COMPRAS INTERNAS REFRIGERAÇÃO',
        dataNecessidade: '2026-07-02',
      },
      { idSolicitacao: 3, nomeColeta: 'A DEFINIR', dataNecessidade: '2026-07-14' },
    ]);

    expect(linhas.map((l) => [l.prioridade, l.nomeColeta])).toEqual([
      [1, 'COMPRAS INTERNAS REFRIGERAÇÃO'],
      [2, 'LAMPADA E ABRAÇADEIRA'],
      [3, 'A DEFINIR'],
    ]);
  });

  it('dentro da coleta ordena pela necessidade e, na mesma data, pelo id da SC', () => {
    const linhas = priorizarSolicitacoesCompra([
      { idSolicitacao: 30, nomeColeta: 'EPI', dataNecessidade: '2026-04-10' },
      { idSolicitacao: 10, nomeColeta: 'EPI', dataNecessidade: '2026-03-01' },
      { idSolicitacao: 20, nomeColeta: 'EPI', dataNecessidade: '2026-03-01' },
    ]);

    expect(linhas.map((l) => l.idSolicitacao)).toEqual([10, 20, 30]);
    expect(linhas.every((l) => l.prioridade === 1)).toBe(true);
    expect(linhas[0]?.necessidadeColeta).toBe('2026-03-01');
  });

  it('coleta sem data de necessidade fica depois das que têm data', () => {
    const linhas = priorizarSolicitacoesCompra([
      { idSolicitacao: 1, nomeColeta: 'SEM DATA', dataNecessidade: null },
      { idSolicitacao: 2, nomeColeta: 'CABOS', dataNecessidade: '2026-08-10' },
      { idSolicitacao: 3, nomeColeta: '', dataNecessidade: '2026-12-01' },
    ]);

    expect(linhas.map((l) => l.nomeColeta)).toEqual(['CABOS', 'A DEFINIR', 'SEM DATA']);
    expect(linhas.map((l) => l.prioridade)).toEqual([1, 2, 3]);
  });
});
