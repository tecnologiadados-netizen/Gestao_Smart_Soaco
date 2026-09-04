import { describe, it, expect } from 'vitest';
import { filtrarContribuicoes } from './dfcFiltrarContribuicoes';
import type { DfcContribuicaoLinha } from '../../../api/financeiro';

function linha(
  partial: Partial<DfcContribuicaoLinha> & Pick<DfcContribuicaoLinha, 'situacao' | 'valor'>,
): DfcContribuicaoLinha {
  return {
    idContaFinanceiro: 100,
    idEmpresa: 1,
    contaBancaria: null,
    codigoConta: 10,
    tipoRef: 'A',
    dataBucket: '2026-09-01',
    ...partial,
  };
}

const maps = {
  contas: { '1#100': 1 as const },
  lancs: {},
};

describe('filtrarContribuicoes — cenários', () => {
  it('sem cenários selecionados inclui realizado e projetado', () => {
    const rows = [
      linha({ situacao: 'Realizado', valor: 50 }),
      linha({ situacao: 'Projetado', valor: 80, codigoConta: 99 }),
    ];
    const out = filtrarContribuicoes(
      rows,
      { idEmpresas: [], contasBancarias: [], prioridades: [], idsPlanoContas: [] },
      maps.contas,
      maps.lancs,
    );
    expect(out).toHaveLength(2);
  });

  it('realizado sempre passa mesmo com cenário selecionado', () => {
    const rows = [
      linha({ situacao: 'Realizado', valor: 50, codigoConta: 99 }),
      linha({ situacao: 'Projetado', valor: 80, codigoConta: 99 }),
    ];
    const out = filtrarContribuicoes(
      rows,
      { idEmpresas: [], contasBancarias: [], prioridades: [1], idsPlanoContas: [] },
      maps.contas,
      maps.lancs,
    );
    expect(out.map((r) => r.situacao)).toEqual(['Realizado']);
  });

  it('projetado só passa se prioridade efetiva está no cenário', () => {
    const rows = [
      linha({ situacao: 'Projetado', valor: 80, codigoConta: 10 }),
      linha({ situacao: 'Projetado', valor: 90, codigoConta: 11 }),
    ];
    const out = filtrarContribuicoes(
      rows,
      { idEmpresas: [], contasBancarias: [], prioridades: [1], idsPlanoContas: [] },
      maps.contas,
      maps.lancs,
    );
    expect(out).toHaveLength(1);
    expect(out[0].codigoConta).toBe(10);
  });

  it('projetado sem prioridade efetiva é excluído quando há cenário', () => {
    const rows = [linha({ situacao: 'Projetado', valor: 80, codigoConta: 77 })];
    const out = filtrarContribuicoes(
      rows,
      { idEmpresas: [], contasBancarias: [], prioridades: [2], idsPlanoContas: [] },
      maps.contas,
      maps.lancs,
    );
    expect(out).toHaveLength(0);
  });
});
