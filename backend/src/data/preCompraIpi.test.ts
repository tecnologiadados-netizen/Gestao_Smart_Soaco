import { describe, expect, it } from 'vitest';
import { aplicarIpiNoItemPdf, type PreCompraCotacaoRow } from './preCompraRepository.js';

function item(parcial: Partial<PreCompraCotacaoRow>): PreCompraCotacaoRow {
  return {
    cotacao: 'CC000856',
    data_emissao: null,
    comprador: null,
    email: null,
    telefone: null,
    fornecedor_id: 1,
    fornecedor: null,
    cnpj: null,
    telefone_fornecedor: null,
    cep: null,
    endereco: null,
    numero_endereco: null,
    bairro: null,
    municipio: null,
    codigo_produto: 'MP 3693',
    codigo_fornecedor: null,
    descricao_produto: null,
    qtde: 30,
    unidade: 'PAR',
    preco_unitario: 400,
    valor_total: 12000,
    solicitacao_id: null,
    data_necessidade: null,
    status: 3,
    ...parcial,
  };
}

describe('aplicarIpiNoItemPdf', () => {
  it('soma o IPI do Nomus no unitário e no total da linha', () => {
    const pdf = aplicarIpiNoItemPdf(item({ valor_ipi: 1170 }));
    expect(pdf.preco_unitario).toBe(439);
    expect(pdf.valor_total).toBe(13170);
    expect(pdf.valor_ipi).toBe(1170);
  });

  it('mantém o preço quando o item não tem IPI', () => {
    const pdf = aplicarIpiNoItemPdf(item({ valor_ipi: 0 }));
    expect(pdf.preco_unitario).toBe(400);
    expect(pdf.valor_total).toBe(12000);
  });

  it('reescala o IPI quando o total acompanha a quantidade da cotação', () => {
    const pdf = aplicarIpiNoItemPdf(
      item({
        qtde: 30,
        qtde_atendida: 15,
        preco_unitario: 400,
        valor_total: 6000,
        valor_ipi: 585,
      })
    );
    expect(pdf.valor_total).toBe(13170);
    expect(pdf.preco_unitario).toBe(439);
  });

  it('calcula o IPI só sobre a mercadoria quando a alíquota existe', () => {
    const pdf = aplicarIpiNoItemPdf(
      item({
        qtde: 260,
        preco_unitario: 8.93,
        valor_total: 2321.8,
        valor_frete: 1498,
        aliquota_ipi: 6.5,
        valor_ipi: 248.29,
        base_ipi: 3819.8,
      })
    );
    expect(pdf.valor_ipi).toBe(150.92);
    expect(pdf.valor_total).toBe(2472.72);
    expect(pdf.preco_unitario).toBe(9.51);
  });

  it('retira o frete da base quando só o valor de IPI do Nomus está gravado', () => {
    const pdf = aplicarIpiNoItemPdf(
      item({
        qtde: 260,
        preco_unitario: 8.93,
        valor_total: 2321.8,
        valor_frete: 1498,
        valor_ipi: 248.29,
        base_ipi: 3819.8,
      })
    );
    expect(pdf.valor_ipi).toBe(150.92);
    expect(pdf.preco_unitario).toBe(9.51);
  });
});
