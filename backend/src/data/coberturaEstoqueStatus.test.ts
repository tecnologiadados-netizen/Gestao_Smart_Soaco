import { describe, expect, it } from 'vitest';
import {
  agregarCoberturaEstoque,
  calcAtendimento,
  calcCoberturaFirme,
  calcCoberturaMeses,
  calcCoberturaMesesNullable,
  calcFaltante,
  calcValorEstoqueBruto,
  calcValorFirmeMonetario,
  isSemMovimentacaoEstoque,
  classificarBarraFirme,
  classificarCoberturaEstoque,
  classificarKpiFirme,
  classificarStatusPainel,
  compareLinhasPainelV2,
  montarLinhaCobertura,
  sugerirAcaoCobertura,
  type ConsultaEstoqueRowComCm,
} from './coberturaEstoqueStatus.js';

describe('classificarCoberturaEstoque', () => {
  it('classifica ruptura e zerado pelo saldo projetado', () => {
    expect(classificarCoberturaEstoque({ saldo: 1, empenho: 5, saldoProjetado: -2 })).toBe(
      'ruptura_projetada'
    );
    expect(classificarCoberturaEstoque({ saldo: 0, empenho: 0, saldoProjetado: 0 })).toBe(
      'zerado_projetado'
    );
  });

  it('classifica frágil, nivelado e excesso', () => {
    expect(classificarCoberturaEstoque({ saldo: 2, empenho: 10, saldoProjetado: 5 })).toBe(
      'cobertura_fragil'
    );
    expect(classificarCoberturaEstoque({ saldo: 10, empenho: 5, saldoProjetado: 8 })).toBe(
      'nivelado'
    );
    expect(classificarCoberturaEstoque({ saldo: 50, empenho: 0, saldoProjetado: 50 })).toBe(
      'excesso_parado'
    );
    expect(classificarCoberturaEstoque({ saldo: 40, empenho: 10, saldoProjetado: 40 })).toBe(
      'excesso_parado'
    );
  });
});

describe('calcCoberturaMeses', () => {
  it('divide saldo projetado pelo CM e usa 0,01 quando CM é zero (legado)', () => {
    expect(calcCoberturaMeses(124, 124)).toBe(1);
    expect(calcCoberturaMeses(-0.31 * 124, 124)).toBeCloseTo(-0.31, 2);
    expect(calcCoberturaMeses(50, 0)).toBe(5000);
  });
});

describe('calcCoberturaMesesNullable', () => {
  it('nunca inventa divisor quando CM ≤ 0', () => {
    expect(calcCoberturaMesesNullable(10, 5, 0)).toBeNull();
    expect(calcCoberturaMesesNullable(10, 5, -1)).toBeNull();
    expect(calcCoberturaMesesNullable(296, 0, 0)).toBeNull();
  });

  it('calcula (estoque − empenho) ÷ CM', () => {
    expect(calcCoberturaMesesNullable(20, 10, 10)).toBe(1);
    expect(calcCoberturaMesesNullable(5, 10, 10)).toBe(-0.5);
  });
});

describe('calcCoberturaFirme (legado com 0,01)', () => {
  it('usa estoque menos empenho sobre o CM', () => {
    expect(calcCoberturaFirme(20, 10, 10)).toBe(1);
    expect(calcCoberturaFirme(5, 10, 10)).toBe(-0.5);
    expect(calcCoberturaFirme(10, 10, 0)).toBe(0);
  });
});

describe('classificarBarraFirme / classificarKpiFirme', () => {
  it('separa as 7 barras e os KPIs derivados só da cobertura', () => {
    expect(classificarBarraFirme(-0.01)).toBe('lt0');
    expect(classificarKpiFirme(-0.01)).toBe('ruptura');

    expect(classificarBarraFirme(0)).toBe('0_05');
    expect(classificarKpiFirme(0)).toBe('critico');
    expect(classificarBarraFirme(0.49)).toBe('0_05');

    expect(classificarBarraFirme(0.5)).toBe('05_1');
    expect(classificarKpiFirme(0.5)).toBe('atencao');

    expect(classificarBarraFirme(1)).toBe('1_2');
    expect(classificarKpiFirme(1)).toBe('saudavel');
    expect(classificarBarraFirme(2.5)).toBe('2_3');
    expect(classificarKpiFirme(2.5)).toBe('saudavel');

    expect(classificarBarraFirme(3)).toBe('2_3');
    expect(classificarKpiFirme(3)).toBe('saudavel');
    expect(classificarBarraFirme(3.01)).toBe('3_6');
    expect(classificarKpiFirme(3.01)).toBe('excesso');
    expect(classificarBarraFirme(6)).toBe('gt6');
    expect(classificarKpiFirme(6)).toBe('excesso');
  });
});

function row(
  partial: Partial<ConsultaEstoqueRowComCm> &
    Pick<ConsultaEstoqueRowComCm, 'codigo' | 'saldo' | 'empenho' | 'saldoProjetado'>
): ConsultaEstoqueRowComCm {
  return {
    idProduto: partial.idProduto ?? Math.abs(partial.codigo.length * 17 + Math.floor(partial.saldo)),
    codigo: partial.codigo,
    descricao: partial.descricao ?? partial.codigo,
    unidadeMedida: partial.unidadeMedida ?? 'UN',
    tipoProduto: partial.tipoProduto ?? 'MP',
    saldo: partial.saldo,
    empenho: partial.empenho,
    solicitacao: partial.solicitacao ?? 0,
    cotacao: partial.cotacao ?? 0,
    pedidoCompra: partial.pedidoCompra ?? 0,
    saldoProjetado: partial.saldoProjetado,
    consumoMedio: partial.consumoMedio ?? 10,
    comprador: partial.comprador,
    precoUnitario: partial.precoUnitario ?? null,
    familiaProduto: partial.familiaProduto ?? 'Sem família',
    ultimaMovimentacaoEstoque: partial.ultimaMovimentacaoEstoque,
  };
}

describe('casos de aceite v2', () => {
  it('MP 2616: ruptura com faltante e cobertura negativa', () => {
    const linha = montarLinhaCobertura(
      row({
        codigo: 'MP 2616',
        saldo: 0,
        empenho: 100,
        saldoProjetado: -100,
        consumoMedio: 50,
        pedidoCompra: 0,
        precoUnitario: 2,
      })
    );
    expect(linha.atendimento).toBe(0);
    expect(linha.faltante).toBe(100);
    expect(linha.valorFaltante).toBe(200);
    expect(linha.cobertura).toBe(-2);
    expect(linha.statusPainel).toBe('ruptura');
    expect(linha.acaoSugerida.chave).toBe('comprar_agora');
  });

  it('EMB 0446: aguardando PC quando PC cobre o faltante', () => {
    const linha = montarLinhaCobertura(
      row({
        codigo: 'EMB 0446',
        saldo: 10,
        empenho: 50,
        saldoProjetado: -20,
        consumoMedio: 20,
        pedidoCompra: 40,
        precoUnitario: 1.5,
      })
    );
    expect(linha.faltante).toBe(40);
    expect(linha.statusPainel).toBe('aguardando_pc');
    expect(linha.acaoSugerida.chave).toBe('cobrar_pc');
  });

  it('MP 4791: CM = 0 com empenho atendido → sem histórico (sem cobertura absurda)', () => {
    const linha = montarLinhaCobertura(
      row({
        codigo: 'MP 4791',
        saldo: 100,
        empenho: 20,
        saldoProjetado: 80,
        consumoMedio: 0,
        precoUnitario: 5,
      })
    );
    expect(linha.cobertura).toBeNull();
    expect(linha.faixaFirme).toBeNull();
    expect(linha.statusPainel).toBe('sem_historico');
    expect(Math.abs(linha.cobertura ?? 0)).toBeLessThan(100);
  });

  it('excesso com empenho 0 e CM > 0', () => {
    const linha = montarLinhaCobertura(
      row({
        codigo: 'EXC 001',
        saldo: 100,
        empenho: 0,
        saldoProjetado: 100,
        consumoMedio: 10,
        precoUnitario: 3,
      })
    );
    expect(linha.atendimento).toBeNull();
    expect(linha.faltante).toBe(0);
    expect(linha.cobertura).toBe(10);
    expect(linha.statusPainel).toBe('excesso');
  });

  it('sem giro: CM 0, empenho 0, estoque > 0', () => {
    const linha = montarLinhaCobertura(
      row({
        codigo: 'SG 001',
        saldo: 40,
        empenho: 0,
        saldoProjetado: 40,
        consumoMedio: 0,
      })
    );
    expect(linha.statusPainel).toBe('sem_giro');
    expect(linha.cobertura).toBeNull();
    expect(linha.acaoSugerida.chave).toBe('avaliar_descarte');
  });

  it('preço nulo → valorEstoque, valorFirme e valorFaltante null', () => {
    const linha = montarLinhaCobertura(
      row({
        codigo: 'NP 001',
        saldo: 0,
        empenho: 10,
        saldoProjetado: -10,
        consumoMedio: 5,
        precoUnitario: null,
      })
    );
    expect(linha.precoUnitario).toBeNull();
    expect(linha.valorEstoque).toBeNull();
    expect(linha.valorFirme).toBeNull();
    expect(linha.valorFaltante).toBeNull();
    expect(linha.statusPainel).toBe('ruptura');
  });

  it('preço fracionário baixo (0,002) não é zerado nem descartado', () => {
    const linha = montarLinhaCobertura(
      row({
        codigo: 'MP 3913',
        saldo: 100,
        empenho: 10,
        saldoProjetado: 90,
        consumoMedio: 50,
        precoUnitario: 0.002,
      })
    );
    expect(linha.precoUnitario).toBe(0.002);
    expect(linha.valorEstoque).toBe(0.2);
    expect(linha.valorFirme).toBe(0.18);
  });

  it('|cobertura| nunca absurda por CM=0', () => {
    const linha = montarLinhaCobertura(
      row({
        codigo: 'ABS 001',
        saldo: 296,
        empenho: 0,
        saldoProjetado: 296,
        consumoMedio: 0,
      })
    );
    expect(linha.cobertura).toBeNull();
    expect(linha.coberturaFirme).toBeNull();
  });
});

describe('classificarStatusPainel cascata', () => {
  it('prioriza aguardando_pc e ruptura antes de faixas de cobertura', () => {
    expect(
      classificarStatusPainel({
        saldo: 1,
        empenho: 10,
        consumoMedio: 10,
        pedidoCompra: 20,
        cobertura: -0.9,
        faltante: 9,
      })
    ).toBe('aguardando_pc');
    expect(
      classificarStatusPainel({
        saldo: 1,
        empenho: 10,
        consumoMedio: 10,
        pedidoCompra: 0,
        cobertura: -0.9,
        faltante: 9,
      })
    ).toBe('ruptura');
  });
});

describe('calcAtendimento / calcFaltante', () => {
  it('atendimento null com empenho 0; faltante nunca negativo', () => {
    expect(calcAtendimento(10, 0)).toBeNull();
    expect(calcAtendimento(5, 10)).toBe(0.5);
    expect(calcFaltante(5, 10)).toBe(5);
    expect(calcFaltante(15, 10)).toBe(0);
  });
});

describe('agregarCoberturaEstoque', () => {
  it('totais de status e barras com CM>0; capital agrega valorFirme', () => {
    const rows: ConsultaEstoqueRowComCm[] = [
      row({ codigo: 'A', saldo: 1, empenho: 5, saldoProjetado: -2, comprador: 'Comprador 1', precoUnitario: 10 }),
      row({ codigo: 'B', saldo: 2, empenho: 1, saldoProjetado: 5, comprador: 'Comprador 1', precoUnitario: 2 }),
      row({ codigo: 'C', saldo: 8, empenho: 1, saldoProjetado: 8, comprador: 'Comprador 2', precoUnitario: 5 }),
      row({ codigo: 'D', saldo: 20, empenho: 5, saldoProjetado: 20, comprador: 'Comprador 2' }),
      row({ codigo: 'E', saldo: 30, empenho: 5, saldoProjetado: 30, comprador: 'Comprador 3', precoUnitario: 1 }),
      row({ codigo: 'F', saldo: 45, empenho: 5, saldoProjetado: 45, comprador: 'Comprador 3', precoUnitario: 3 }),
      row({ codigo: 'G', saldo: 80, empenho: 5, saldoProjetado: 80 }),
    ];
    const agg = agregarCoberturaEstoque(rows);
    expect(agg.totalItens).toBe(7);
    expect(agg.itens).toHaveLength(7);
    expect(agg.barrasFirme.reduce((s, t) => s + t.itens, 0)).toBe(7);

    expect(agg.kpisFirme.find((k) => k.kpi === 'ruptura')?.itens).toBe(1);
    expect(agg.kpisFirme.find((k) => k.kpi === 'critico')?.itens).toBe(1);
    expect(agg.kpisFirme.find((k) => k.kpi === 'atencao')?.itens).toBe(1);
    expect(agg.kpisFirme.find((k) => k.kpi === 'saudavel')?.itens).toBe(2);
    expect(agg.kpisFirme.find((k) => k.kpi === 'excesso')?.itens).toBe(2);
    expect(agg.kpisFirme.find((k) => k.kpi === 'ruptura')?.capital).toBe(-40);

    for (const item of agg.itens) {
      expect(item.cobertura).toBe(
        calcCoberturaMesesNullable(item.saldo, item.empenho, item.consumoMedio)
      );
      expect(item.coberturaFirme).toBe(item.cobertura);
      expect(item.statusPainel).toBe(item.kpiFirme);
      expect(item.valorEstoque).toBe(calcValorEstoqueBruto(item.saldo, item.precoUnitario));
      expect(item.valorFirme).toBe(
        calcValorFirmeMonetario(item.saldo, item.empenho, item.precoUnitario)
      );
    }

    const esperadoEstoque = agg.itens
      .filter((i) => i.valorEstoque != null)
      .reduce((s, i) => s + (i.valorEstoque ?? 0), 0);
    const esperadoFirme = agg.itens
      .filter((i) => i.valorFirme != null)
      .reduce((s, i) => s + (i.valorFirme ?? 0), 0);
    expect(agg.valorEstoqueTotal).toBeCloseTo(esperadoEstoque, 2);
    expect(agg.valorFirmeTotal).toBeCloseTo(esperadoFirme, 2);
    expect(agg.valorEstoqueTotal).toBeGreaterThan(0);
    // Sem data de movimentação → todos entram no card 60d (mesmo universo com preço).
    expect(agg.valorEstoqueSemMov60dTotal).toBeCloseTo(esperadoEstoque, 2);

    const c1 = agg.porComprador.find((c) => c.comprador === 'Comprador 1');
    expect(c1?.ruptura).toBe(1);
    expect(c1?.critico).toBe(1);
    expect(c1?.atencao).toBe(0);
    expect(c1?.aguardandoPc).toBe(0);

    const indefinido = agg.porComprador.find((c) => c.comprador === 'A definir');
    expect(indefinido?.itens).toBe(1);

    const sorted = [...agg.itens].sort(compareLinhasPainelV2);
    expect(sorted[0].codigo).toBe('A');
  });

  it('itens CM=0 não entram nas barras', () => {
    const agg = agregarCoberturaEstoque([
      row({ codigo: 'CM0', saldo: 10, empenho: 5, saldoProjetado: 5, consumoMedio: 0 }),
      row({ codigo: 'CM1', saldo: 20, empenho: 5, saldoProjetado: 15, consumoMedio: 10, precoUnitario: 1 }),
    ]);
    expect(agg.barrasFirme.reduce((s, t) => s + t.itens, 0)).toBe(1);
    expect(agg.itens.find((i) => i.codigo === 'CM0')?.statusPainel).toBe('sem_historico');
  });
});

describe('calcValorEstoqueBruto', () => {
  it('calcula saldo x preco e retorna null sem preco', () => {
    expect(calcValorEstoqueBruto(10, 2.64)).toBe(26.4);
    expect(calcValorEstoqueBruto(1, 10)).toBe(10);
    expect(calcValorEstoqueBruto(10, null)).toBeNull();
    expect(calcValorEstoqueBruto(10, 0)).toBeNull();
  });
});

describe('isSemMovimentacaoEstoque', () => {
  const ref = new Date(2026, 7, 24); // 24/08/2026

  it('sem data ou inválida → true', () => {
    expect(isSemMovimentacaoEstoque(null, 60, ref)).toBe(true);
    expect(isSemMovimentacaoEstoque(undefined, 60, ref)).toBe(true);
    expect(isSemMovimentacaoEstoque('xyz', 60, ref)).toBe(true);
  });

  it('movimentação recente → false; há 60+ dias → true', () => {
    expect(isSemMovimentacaoEstoque('2026-08-20', 60, ref)).toBe(false);
    expect(isSemMovimentacaoEstoque('2026-06-25', 60, ref)).toBe(true); // exatamente 60 dias
    expect(isSemMovimentacaoEstoque('2026-05-01', 60, ref)).toBe(true);
  });
});

describe('valorEstoqueSemMov60dTotal', () => {
  it('soma só itens sem movimentação recente e com preço', () => {
    const agg = agregarCoberturaEstoque([
      row({
        codigo: 'PARADO',
        saldo: 10,
        empenho: 1,
        saldoProjetado: 9,
        precoUnitario: 5,
        ultimaMovimentacaoEstoque: '2026-01-01',
      }),
      row({
        codigo: 'RECENTE',
        saldo: 20,
        empenho: 1,
        saldoProjetado: 19,
        precoUnitario: 3,
        ultimaMovimentacaoEstoque: new Date().toISOString().slice(0, 10),
      }),
      row({
        codigo: 'SEM_PRECO',
        saldo: 50,
        empenho: 1,
        saldoProjetado: 49,
        precoUnitario: null,
        ultimaMovimentacaoEstoque: '2020-01-01',
      }),
    ]);
    expect(agg.valorEstoqueSemMov60dTotal).toBe(50); // 10 × 5
    expect(agg.itens.find((i) => i.codigo === 'PARADO')?.semMovimentacao60d).toBe(true);
    expect(agg.itens.find((i) => i.codigo === 'RECENTE')?.semMovimentacao60d).toBe(false);
  });
});

describe('calcValorFirmeMonetario', () => {
  it('calcula (saldo - empenho) x preco e retorna null sem preco', () => {
    expect(calcValorFirmeMonetario(10, 5, 2.64)).toBe(13.2);
    expect(calcValorFirmeMonetario(1, 5, 10)).toBe(-40);
    expect(calcValorFirmeMonetario(10, 5, null)).toBeNull();
  });
});

describe('sugerirAcaoCobertura', () => {
  it('mapa Status → ação', () => {
    expect(
      sugerirAcaoCobertura({
        statusPainel: 'aguardando_pc',
        solicitacao: 0,
        cotacao: 0,
        pedidoCompra: 40,
      })
    ).toMatchObject({ chave: 'cobrar_pc', prioridade: 'urgente' });

    expect(
      sugerirAcaoCobertura({
        statusPainel: 'ruptura',
        solicitacao: 0,
        cotacao: 0,
        pedidoCompra: 0,
      }).chave
    ).toBe('comprar_agora');

    expect(
      sugerirAcaoCobertura({
        statusPainel: 'ruptura',
        solicitacao: 5,
        cotacao: 0,
        pedidoCompra: 0,
      }).chave
    ).toBe('acelerar_sc_agpag');

    expect(
      sugerirAcaoCobertura({
        statusPainel: 'critico',
        solicitacao: 0,
        cotacao: 0,
        pedidoCompra: 0,
      })
    ).toMatchObject({ chave: 'abrir_sc_urgente', prioridade: 'atencao' });

    expect(
      sugerirAcaoCobertura({
        statusPainel: 'critico',
        solicitacao: 3,
        cotacao: 0,
        pedidoCompra: 0,
      }).chave
    ).toBe('converter_sc');

    expect(
      sugerirAcaoCobertura({
        statusPainel: 'atencao',
        solicitacao: 0,
        cotacao: 0,
        pedidoCompra: 0,
      }).chave
    ).toBe('programar_sc');

    expect(
      sugerirAcaoCobertura({
        statusPainel: 'excesso',
        solicitacao: 0,
        cotacao: 0,
        pedidoCompra: 0,
      }).chave
    ).toBe('bloquear_reposicao');

    expect(
      sugerirAcaoCobertura({
        statusPainel: 'excesso',
        solicitacao: 0,
        cotacao: 0,
        pedidoCompra: 10,
      }).chave
    ).toBe('suspender_compra');

    expect(
      sugerirAcaoCobertura({
        statusPainel: 'saudavel',
        solicitacao: 0,
        cotacao: 0,
        pedidoCompra: 0,
      })
    ).toMatchObject({ chave: 'sem_acao', prioridade: 'ok' });
  });
});
