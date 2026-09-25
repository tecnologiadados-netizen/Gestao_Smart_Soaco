import { describe, expect, it } from 'vitest';
import type { DoubleCheckInComparativoLinha } from '../data/doubleCheckInRepository.js';
import type { DoubleCheckInComparativoDecisaoRow } from '../data/doubleCheckInLocalRepository.js';
import {
  montarMensagemConferenciaWhatsApp,
  montarRelatoConferencia,
  renderConferenciaHtml,
} from './doubleCheckInConferenciaRelato.js';

function linha(p: Partial<DoubleCheckInComparativoLinha> & Pick<DoubleCheckInComparativoLinha, 'idItemDocumentoEstoque' | 'codigoProduto'>): DoubleCheckInComparativoLinha {
  return {
    idItemPedidoCompra: p.idItemDocumentoEstoque,
    idPedidoCompra: 27798,
    nomePedidoCompra: 'PC27798',
    idProduto: p.idItemDocumentoEstoque,
    descricaoProduto: null,
    qtdeNF: 1,
    umNF: 'UN',
    qtdePC: 1,
    umPC: 'UN',
    valorUnitarioBrutoNF: 0,
    valorUnitarioBrutoPC: 0,
    descontoNF: 0,
    descontoPC: 0,
    valorUnitarioNF: 0,
    valorUnitarioPC: 0,
    valorIpiNF: 0,
    valorIpiPC: 0,
    condicaoPagamentoNF: 'À Vista.',
    regraPagamentoNF: '0',
    condicaoPagamentoPC: 'Não Existente',
    regraPagamentoPC: '1',
    dataBaseParcelasNF: null,
    dataBaseParcelasPC: null,
    parcelasNF: [],
    parcelasPC: [],
    prazosDiasNF: [],
    prazosDiasPC: [],
    prazosLabelNF: null,
    prazosLabelPC: null,
    divergValorUnitario: false,
    divergQtde: false,
    divergIpi: false,
    divergCondicaoPagamento: true,
    temDivergencia: true,
    ...p,
  };
}

function decisao(
  linha: DoubleCheckInComparativoLinha,
  campo: DoubleCheckInComparativoDecisaoRow['campo'],
  justificativaLabel: string,
  decisaoValor: 'aceita' | 'recusa' = 'aceita'
): DoubleCheckInComparativoDecisaoRow {
  return {
    id: linha.idItemDocumentoEstoque,
    idDocumentoEstoque: 1,
    idItemDocumentoEstoque: linha.idItemDocumentoEstoque,
    idItemPedidoCompra: linha.idItemPedidoCompra,
    campo,
    decisao: decisaoValor,
    justificativaOpcaoId: 1,
    justificativaCodigo: 'x',
    justificativaLabel,
    observacao: null,
    usuarioId: 1,
    usuarioLogin: 'luisa',
    atualizadoEm: '2026-09-22T14:51:00.000Z',
    historicoObservacoes: [],
  };
}

describe('relato da conferência NF × PC', () => {
  const muc = linha({
    idItemDocumentoEstoque: 1,
    codigoProduto: 'MUC 3767',
    valorUnitarioBrutoNF: 8.78,
    valorUnitarioBrutoPC: 8.78,
    descontoNF: 1.3,
    descontoPC: 0.25,
    valorUnitarioNF: 7.48,
    valorUnitarioPC: 8.53,
    divergValorUnitario: true,
  });
  const mua = linha({
    idItemDocumentoEstoque: 2,
    codigoProduto: 'MUA 0215',
    valorUnitarioNF: 17.58,
    valorUnitarioPC: 17.07,
    valorUnitarioBrutoNF: 17.58,
    valorUnitarioBrutoPC: 17.58,
    descontoPC: 0.51,
    divergValorUnitario: true,
  });

  const relato = montarRelatoConferencia({
    meta: {
      numeroNfe: '44544',
      numeroDocumentoFiscal: 'DE39631',
      nomeParceiro: 'FERREIRA <SUPER>',
    },
    conferidoPor: 'Luisa',
    conferidoEm: '2026-09-22T17:51:00.000Z',
    linhas: [muc, mua],
    decisoes: [
      decisao(muc, 'valor_unitario', 'Ajuste de arredondamento'),
      decisao(muc, 'condicao_pagamento', 'Condição de pagamento divergente'),
      decisao(mua, 'valor_unitario', 'Ajuste de arredondamento'),
      decisao(mua, 'condicao_pagamento', 'Condição de pagamento divergente'),
    ],
  });

  it('agrupa o pagamento igual e calcula a diferença do preço', () => {
    expect(relato).not.toBeNull();
    expect(relato!.pagamentoComum?.nf).toBe('À Vista');
    expect(relato!.pagamentoComum?.pc).toBe('Não Existente');
    expect(relato!.totalProdutos).toBe(2);
    expect(relato!.totalDivergencias).toBe(3);
    expect(relato!.aceitas).toBe(3);
    expect(relato!.produtos[0]?.campos.map((c) => c.campo)).toEqual(['valor_unitario']);
    expect(relato!.produtos[0]?.campos[0]?.diferenca).toContain('1,05');
    expect(relato!.produtos[0]?.campos[0]?.sinal).toBe('neg');
    expect(relato!.produtos[1]?.campos[0]?.sinal).toBe('pos');
  });

  it('monta o WhatsApp curto com o link', () => {
    const texto = montarMensagemConferenciaWhatsApp(relato!, 'https://gsmartsoaco.com.br/c/abc');
    expect(texto).toContain('*Conferência NF × Pedido*');
    expect(texto).toContain('*Pagamento — vale para todos*');
    expect(texto).toContain('*Preços*');
    expect(texto).toContain('*MUC 3767* · PC27798');
    expect(texto).toContain('https://gsmartsoaco.com.br/c/abc');
    expect(texto).not.toContain('líq. (bruto');
    expect(texto).not.toContain('(0)');
  });

  it('formata prazos no WhatsApp com NF/PC em linhas e diferença', () => {
    const comPrazo = montarRelatoConferencia({
      meta: { numeroNfe: '9899', numeroDocumentoFiscal: 'DE39727', nomeParceiro: 'CHICO' },
      conferidoPor: 'Luisa',
      linhas: [
        linha({
          idItemDocumentoEstoque: 10,
          codigoProduto: 'X',
          condicaoPagamentoNF: '(1x) 30',
          regraPagamentoNF: '30',
          condicaoPagamentoPC: '(1x) 30',
          regraPagamentoPC: '30',
          dataBaseParcelasNF: '2026-09-25',
          dataBaseParcelasPC: '2026-09-22',
          prazosLabelNF: '27',
          prazosLabelPC: '30',
          prazosDiasNF: [27],
          prazosDiasPC: [30],
          parcelasNF: [
            { numero: 1, dataBase: '2026-09-25', dataVencimento: '2026-10-22', dias: 27 },
          ],
          parcelasPC: [
            { numero: 1, dataBase: '2026-09-22', dataVencimento: '2026-10-22', dias: 30 },
          ],
          divergValorUnitario: false,
          divergCondicaoPagamento: true,
        }),
      ],
      decisoes: [decisao(linha({ idItemDocumentoEstoque: 10, codigoProduto: 'X' }), 'condicao_pagamento', 'Outros')],
    });
    // ajusta decisão com obs
    const dec = comPrazo!.pagamentoComum!;
    dec.observacao = 'entrada avulsa';
    const texto = montarMensagemConferenciaWhatsApp(comPrazo!, 'https://gsmartsoaco.com.br/c/x');
    expect(texto).toContain('*Prazos (vencimento − data base)*');
    expect(texto).toContain('Parc. #1');
    expect(texto).toContain('= NF: base 25/09 → venc. 22/10 = *27d*');
    expect(texto).toContain('= PC: base 22/09 → venc. 22/10 = *30d*');
    expect(texto).toContain('= Diferença: *3 dias (NF menor)*');
  });

  it('não agrupa pagamento quando uma linha difere', () => {
    const outra = linha({
      idItemDocumentoEstoque: 3,
      codigoProduto: 'X',
      condicaoPagamentoPC: '30 dias',
      divergValorUnitario: false,
    });
    const misto = montarRelatoConferencia({
      meta: { numeroNfe: '1', numeroDocumentoFiscal: 'D', nomeParceiro: 'A' },
      conferidoPor: 'Luisa',
      linhas: [muc, outra],
      decisoes: [
        decisao(muc, 'valor_unitario', 'Ajuste de arredondamento'),
        decisao(muc, 'condicao_pagamento', 'Condição de pagamento divergente'),
        decisao(outra, 'condicao_pagamento', 'Condição de pagamento divergente', 'recusa'),
      ],
    });
    expect(misto!.pagamentoComum).toBeNull();
    expect(misto!.recusadas).toBe(1);
    const texto = montarMensagemConferenciaWhatsApp(misto!, null);
    expect(texto).not.toContain('vale para todos');
    expect(texto).toContain('❌ Recusada');
  });

  it('escapa o HTML e usa a paleta e a logo', () => {
    const html = renderConferenciaHtml(relato!);
    expect(html).toContain('#041E42');
    expect(html).toContain('#FFAD00');
    expect(html).toContain('/logo-soaco-clean.png');
    expect(html).toContain('FERREIRA &lt;SUPER&gt;');
    expect(html).not.toContain('FERREIRA <SUPER>');
    expect(html).toContain('Bruto e desconto');
  });
});
