import { describe, expect, it } from 'vitest';
import {
  classificarNotaGestaoEntrada,
  montarDivergenciasAtuais,
  montarPainelGestaoEntradas,
  prepararDocumentoNoEscopo,
  type DecisaoDiaGestaoEntrada,
  type DecisaoGestaoEntrada,
  type DocGestaoEntrada,
  type LinhaComparativoDia,
} from './gestaoEntradasClassificacao.js';

function doc(partial: Partial<DocGestaoEntrada> & Pick<DocGestaoEntrada, 'idDocumento'>): DocGestaoEntrada {
  return {
    dataEntrada: '2026-09-21',
    idTipoMovimentacao: 11,
    nomeTipo: 'Compra',
    itens: 1,
    ...partial,
  };
}

describe('classificarNotaGestaoEntrada', () => {
  it('nota sem conferência fica pendente mesmo com decisão gravada', () => {
    expect(classificarNotaGestaoEntrada(false, [{ decisao: 'aceita' }])).toBe('pendente');
  });

  it('conferida sem decisão é limpa', () => {
    expect(classificarNotaGestaoEntrada(true, [])).toBe('limpa');
  });

  it('qualquer recusa classifica a nota como recusa', () => {
    expect(
      classificarNotaGestaoEntrada(true, [{ decisao: 'aceita' }, { decisao: 'recusa' }])
    ).toBe('recusa');
  });

  it('só aceites classifica a nota como aceita', () => {
    expect(classificarNotaGestaoEntrada(true, [{ decisao: 'aceita' }])).toBe('aceita');
  });

  it('divergência já igualada no ERP conta como limpa', () => {
    expect(classificarNotaGestaoEntrada(true, [{ decisao: 'aceita' }], false)).toBe('limpa');
    expect(classificarNotaGestaoEntrada(true, [{ decisao: 'recusa' }], false)).toBe('limpa');
  });
});

describe('montarDivergenciasAtuais', () => {
  it('lista só o campo que ainda diverge, com observação', () => {
    const lista = montarDivergenciasAtuais({
      linhas: [
        {
          idItemDocumentoEstoque: 10,
          idItemPedidoCompra: 20,
          codigoProduto: 'MP 1',
          descricaoProduto: 'Perfil',
          divergValorUnitario: true,
          divergQtde: false,
          divergIpi: true,
          divergCondicaoPagamento: false,
          nomePedidoCompra: 'PC 100',
          qtdeNF: 2,
          qtdePC: 2,
          valorUnitarioNF: 12.5,
          valorUnitarioBrutoNF: 12.5,
          valorUnitarioPC: 10,
          valorUnitarioBrutoPC: 10,
          descontoNF: 0,
          descontoPC: 0,
          valorIpiNF: 1.25,
          valorIpiPC: 1,
        },
      ],
      decisoes: [
        {
          idItemDocumentoEstoque: 10,
          idItemPedidoCompra: 20,
          campo: 'valor_unitario',
          decisao: 'aceita',
          justificativaLabel: 'Diferença comercial negociada',
          observacao: 'Ajuste de preço',
          usuarioLogin: 'luisa',
          atualizadoEm: '2026-09-21T18:00:00.000Z',
          historico: [{ texto: 'Ajuste de preço', usuarioLogin: 'luisa', criadoEm: '2026-09-21T18:00:00.000Z' }],
        },
        {
          idItemDocumentoEstoque: 10,
          idItemPedidoCompra: 20,
          campo: 'qtde',
          decisao: 'aceita',
          justificativaLabel: 'Quantidade parcial',
          observacao: 'Não deve aparecer',
          usuarioLogin: 'luisa',
          atualizadoEm: '2026-09-21T18:00:00.000Z',
          historico: [],
        },
      ],
    });
    expect(lista.map((d) => d.campo)).toEqual(['valor_unitario', 'ipi']);
    expect(lista[0]).toMatchObject({
      decisao: 'aceita',
      justificativaLabel: 'Diferença comercial negociada',
      nomePedidoCompra: 'PC 100',
      observacoes: [{ texto: 'Ajuste de preço', usuarioLogin: 'luisa' }],
    });
    expect(lista[0].valorNf).toMatch(/12,50/);
    expect(lista[0].valorPc).toMatch(/10,00/);
    expect(lista[1].valorNf).toMatch(/1,25/);
    expect(lista[1].valorPc).toMatch(/1,00/);
    expect(lista[1]).toMatchObject({ decisao: null, observacoes: [] });
  });
});

describe('montarPainelGestaoEntradas', () => {
  const docs: DocGestaoEntrada[] = [
    doc({ idDocumento: 1, itens: 2 }),
    doc({ idDocumento: 2, itens: 1, idTipoMovimentacao: 35, nomeTipo: 'Devolução' }),
    doc({ idDocumento: 3, dataEntrada: '2026-09-22', itens: 4 }),
    doc({ idDocumento: 4, dataEntrada: '2026-09-22' }),
  ];

  const decisoes: DecisaoGestaoEntrada[] = [
    {
      idDocumentoEstoque: 2,
      campo: 'qtde',
      decisao: 'aceita',
      justificativaCodigo: 'qtde_parcial',
      justificativaLabel: 'Quantidade parcial / saldo de PC',
    },
    {
      idDocumentoEstoque: 2,
      campo: 'valor_unitario',
      decisao: 'aceita',
      justificativaCodigo: 'diferenca_comercial',
      justificativaLabel: 'Diferença comercial negociada',
    },
    {
      idDocumentoEstoque: 3,
      campo: 'ipi',
      decisao: 'recusa',
      justificativaCodigo: 'tributacao_ipi',
      justificativaLabel: 'Frete / IPI / tributação',
    },
    {
      idDocumentoEstoque: 3,
      campo: 'qtde',
      decisao: 'aceita',
      justificativaCodigo: 'qtde_parcial',
      justificativaLabel: 'Quantidade parcial / saldo de PC',
    },
    {
      idDocumentoEstoque: 4,
      campo: 'ipi',
      decisao: 'aceita',
      justificativaCodigo: 'arredondamento',
      justificativaLabel: 'Ajuste de arredondamento',
    },
  ];

  const painel = montarPainelGestaoEntradas({
    dataInicio: '2026-09-21',
    dataFim: '2026-09-22',
    docs,
    idsConferidos: new Set([1, 2, 3]),
    idsComDivergenciaAtual: new Set([2, 3]),
    decisoes,
  });

  it('separa limpas, aceitas, recusas e pendentes', () => {
    expect(painel.kpis).toMatchObject({
      qtdeNotas: 4,
      qtdeItens: 8,
      qtdeConferidas: 3,
      qtdeLimpas: 1,
      qtdeAceitas: 1,
      qtdeRecusas: 1,
      qtdePendentes: 1,
      qtdeDecisoesAceitas: 3,
      qtdeDecisoesRecusas: 1,
    });
    expect(painel.kpis.pctLimpas).toBeCloseTo(100 / 3);
  });

  it('não conta entrada anterior à conferência como pendente', () => {
    const comHistorico = montarPainelGestaoEntradas({
      dataInicio: '2026-07-01',
      dataFim: '2026-09-22',
      docs: [...docs, doc({ idDocumento: 5, dataEntrada: '2026-07-01' })],
      idsConferidos: new Set([1, 2, 3]),
      idsComDivergenciaAtual: new Set([2, 3]),
      decisoes,
    });
    expect(comHistorico.kpis.qtdeNotas).toBe(5);
    expect(comHistorico.kpis.qtdePendentes).toBe(1);
    expect(comHistorico.serieDiaria.find((d) => d.data === '2026-07-01')).toMatchObject({
      notas: 1,
      pendentes: 0,
    });
  });

  it('ignora decisão de nota ainda não conferida no ranking', () => {
    const aceitasQtde = painel.porCampo.find((c) => c.campo === 'qtde');
    expect(aceitasQtde).toMatchObject({ aceitas: 2, recusas: 0, qtde: 2, documentos: 2 });
    expect(painel.porJustificativa.find((j) => j.codigo === 'arredondamento')).toBeUndefined();
    expect(painel.porJustificativa[0]).toMatchObject({
      codigo: 'qtde_parcial',
      qtde: 2,
    });
  });

  it('soma a série do dia e os tipos de movimento', () => {
    expect(painel.serieDiaria).toEqual([
      {
        data: '2026-09-21',
        notas: 2,
        itens: 3,
        limpas: 1,
        aceitas: 1,
        recusas: 0,
        pendentes: 0,
      },
      {
        data: '2026-09-22',
        notas: 2,
        itens: 5,
        limpas: 0,
        aceitas: 0,
        recusas: 1,
        pendentes: 1,
      },
    ]);
    expect(painel.porTipo.map((t) => t.idTipoMovimentacao)).toEqual([11, 35]);
    expect(painel.porTipo[0]).toMatchObject({ notas: 3, itens: 7, divergencias: 1 });
    expect(painel.porTipo[1]).toMatchObject({ notas: 1, itens: 1, divergencias: 1 });
  });
});

function linhaEscopo(
  partial: Partial<LinhaComparativoDia> & Pick<LinhaComparativoDia, 'idItemDocumentoEstoque'>
): LinhaComparativoDia & { idPedidoCompra: number | null } {
  return {
    idItemPedidoCompra: 20,
    idPedidoCompra: 9,
    codigoProduto: 'MP 1',
    descricaoProduto: 'Perfil',
    divergValorUnitario: false,
    divergQtde: false,
    divergIpi: false,
    divergCondicaoPagamento: false,
    valorUnitarioNF: 8,
    valorUnitarioPC: 10,
    qtdeNF: 1,
    qtdePC: 1,
    valorIpiNF: 1,
    valorIpiPC: 1,
    ...partial,
  };
}

function decisaoEscopo(
  partial: Partial<DecisaoDiaGestaoEntrada> & Pick<DecisaoDiaGestaoEntrada, 'campo'>
): DecisaoDiaGestaoEntrada {
  return {
    idItemDocumentoEstoque: 10,
    idItemPedidoCompra: 20,
    decisao: 'aceita',
    justificativaLabel: 'Motivo',
    justificativaCodigo: 'diferenca_comercial',
    observacao: null,
    usuarioLogin: 'luisa',
    atualizadoEm: '2026-10-01T12:00:00.000Z',
    historico: [],
    ...partial,
  };
}

describe('prepararDocumentoNoEscopo', () => {
  it('visão real trata preço menor como sem divergência', () => {
    const linhas = [
      linhaEscopo({
        idItemDocumentoEstoque: 10,
        divergValorUnitario: true,
        valorUnitarioNF: 8,
        valorUnitarioPC: 10,
      }),
    ];
    const decisoes = [decisaoEscopo({ campo: 'valor_unitario' })];
    const real = prepararDocumentoNoEscopo({ linhas, decisoes, escopo: 'reais' });
    const geral = prepararDocumentoNoEscopo({ linhas, decisoes, escopo: 'geral' });

    expect(real.temDivergencia).toBe(false);
    expect(real.pendentes).toBe(0);
    expect(real.divergencias).toEqual([]);
    expect(geral.temDivergencia).toBe(true);
    expect(geral.divergencias.map((d) => d.natureza)).toEqual(['benigna']);
  });

  it('visão real mantém quantidade e ignora benigna no mesmo documento', () => {
    const linhas = [
      linhaEscopo({
        idItemDocumentoEstoque: 10,
        divergValorUnitario: true,
        divergQtde: true,
        qtdeNF: 1,
        qtdePC: 2,
      }),
    ];
    const decisoes = [
      decisaoEscopo({ campo: 'valor_unitario' }),
      decisaoEscopo({ campo: 'qtde', justificativaCodigo: 'qtde_parcial' }),
    ];
    const real = prepararDocumentoNoEscopo({ linhas, decisoes, escopo: 'reais' });
    expect(real.temDivergencia).toBe(true);
    expect(real.pendentes).toBe(0);
    expect([...real.chaves]).toEqual(['10:20:qtde']);
    expect(real.divergencias.map((d) => d.campo)).toEqual(['qtde']);
  });

  it('pendência só benigna não segura a nota na visão real', () => {
    const linhas = [
      linhaEscopo({ idItemDocumentoEstoque: 10, divergValorUnitario: true }),
    ];
    const real = prepararDocumentoNoEscopo({ linhas, decisoes: [], escopo: 'reais' });
    const geral = prepararDocumentoNoEscopo({ linhas, decisoes: [], escopo: 'geral' });
    expect(real.pendentes).toBe(0);
    expect(real.temDivergencia).toBe(false);
    expect(geral.pendentes).toBe(1);
    expect(geral.temDivergencia).toBe(true);
  });

  it('justificativa técnica benigna sai da visão real mesmo com preço maior', () => {
    const linhas = [
      linhaEscopo({
        idItemDocumentoEstoque: 10,
        divergValorUnitario: true,
        valorUnitarioNF: 15,
        valorUnitarioPC: 10,
      }),
    ];
    const decisoes = [
      decisaoEscopo({ campo: 'valor_unitario', justificativaCodigo: 'arredondamento' }),
    ];
    const real = prepararDocumentoNoEscopo({ linhas, decisoes, escopo: 'reais' });
    expect(real.temDivergencia).toBe(false);
    expect(real.chaves.size).toBe(0);
  });
});
