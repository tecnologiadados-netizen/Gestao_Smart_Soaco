import { describe, expect, it } from 'vitest';
import {
  extrairPagamentoXmlNfe,
  motivoLancamentoBoletoIncompleto,
  resolverParcelasPreEntrada,
  somaParcelasFechaValorNf,
} from './nfeXmlParcelas.js';

const XML_A_VISTA = `<?xml version="1.0"?><NFe><infNFe>
  <ide><dhEmi>2026-11-09T00:00:00-03:00</dhEmi><nNF>39157</nNF></ide>
  <total><ICMSTot><vNF>110.00</vNF></ICMSTot></total>
  <pag><detPag><indPag>0</indPag><tPag>01</tPag><vPag>110.00</vPag></detPag></pag>
</infNFe></NFe>`;

const XML_FATURA = `<?xml version="1.0"?><NFe><infNFe>
  <ide><dhEmi>2026-11-09T10:00:00-03:00</dhEmi></ide>
  <total><ICMSTot><vNF>300.00</vNF></ICMSTot></total>
  <cobr>
    <fat><nFat>1</nFat><vLiq>300.00</vLiq></fat>
    <dup><nDup>002</nDup><dVenc>2027-01-08</dVenc><vDup>150.00</vDup></dup>
    <dup><nDup>001</nDup><dVenc>2026-12-09</dVenc><vDup>150.00</vDup></dup>
  </cobr>
</infNFe></NFe>`;

describe('extrairPagamentoXmlNfe', () => {
  it('nota sem dup não tem fatura, mesmo com pagamento à vista', () => {
    const r = extrairPagamentoXmlNfe(XML_A_VISTA);
    expect(r.temFatura).toBe(false);
    expect(r.dups).toEqual([]);
    expect(r.dhEmi).toBe('2026-11-09');
    expect(r.vNF).toBe(110);
  });

  it('lê as duplicatas e ordena pelo número', () => {
    const r = extrairPagamentoXmlNfe(XML_FATURA);
    expect(r.temFatura).toBe(true);
    expect(r.dups.map((d) => d.dataVencimento)).toEqual(['2026-12-09', '2027-01-08']);
    expect(r.dups.map((d) => d.valor)).toEqual([150, 150]);
  });
});

describe('resolverParcelasPreEntrada', () => {
  it('fatura do XML vence sobre uma resposta antiga do usuário', () => {
    const r = resolverParcelasPreEntrada({
      xml: XML_FATURA,
      resposta: { situacao: 'ja_paga', parcelas: [] },
      dataBaseDocumento: null,
    });
    expect(r.origem).toBe('xml');
    expect(r.pendente).toBe(false);
    expect(r.parcelas.map((p) => p.dias)).toEqual([30, 60]);
    expect(r.dataBase).toBe('2026-11-09');
    expect(r.condicao).toBe('Fatura da NF');
  });

  it('sem fatura fica pendente até o usuário responder', () => {
    const r = resolverParcelasPreEntrada({
      xml: XML_A_VISTA,
      resposta: null,
      dataBaseDocumento: null,
    });
    expect(r.origem).toBe('pendente');
    expect(r.pendente).toBe(true);
    expect(r.parcelas).toEqual([]);
    expect(r.valorNf).toBe(110);
  });

  it('já paga vira uma parcela de 0 dias na emissão', () => {
    const r = resolverParcelasPreEntrada({
      xml: XML_A_VISTA,
      resposta: { situacao: 'ja_paga', parcelas: [] },
      dataBaseDocumento: null,
    });
    expect(r.origem).toBe('ja_paga');
    expect(r.regra).toBe('0');
    expect(r.parcelas[0]).toMatchObject({ dias: 0, dataVencimento: '2026-11-09', valor: 110 });
  });

  it('boleto sem condição, forma ou classificação continua pendente', () => {
    const r = resolverParcelasPreEntrada({
      xml: XML_A_VISTA,
      resposta: {
        situacao: 'boleto_externo',
        parcelas: [{ numero: 1, dataVencimento: '2026-12-09', valor: 110 }],
      },
      dataBaseDocumento: null,
    });
    expect(r.origem).toBe('pendente');
    expect(r.pendente).toBe(true);
    expect(r.parcelas[0]).toMatchObject({ dataVencimento: '2026-12-09', dias: 30, valor: 110 });
  });

  it('lançamento completo usa condição, forma e classifica cada parcela', () => {
    const r = resolverParcelasPreEntrada({
      xml: XML_A_VISTA,
      resposta: {
        situacao: 'boleto_externo',
        condicaoPagamento: '30/60',
        formaPagamento: 'Boleto',
        regra: '30,60',
        parcelas: [
          { numero: 2, dataVencimento: '2027-01-08', valor: 55, paga: false },
          { numero: 1, dataVencimento: '2026-12-09', valor: 55, paga: true },
        ],
      },
      dataBaseDocumento: null,
    });
    expect(r.origem).toBe('boleto_externo');
    expect(r.pendente).toBe(false);
    expect(r.condicao).toBe('30/60');
    expect(r.regra).toBe('30,60');
    expect(r.dataBase).toBe('2026-11-09');
    expect(r.formaPagamento).toBe('Boleto');
    expect(r.parcelas.map((p) => p.dias)).toEqual([30, 60]);
    expect(r.parcelas.map((p) => p.paga)).toEqual([true, false]);
  });

  it('a data base informada substitui a emissão na conta dos dias', () => {
    const r = resolverParcelasPreEntrada({
      xml: XML_A_VISTA,
      resposta: {
        situacao: 'boleto_externo',
        condicaoPagamento: '30',
        formaPagamento: 'Boleto',
        regra: '30',
        dataBase: '2026-11-20',
        parcelas: [{ numero: 1, dataVencimento: '2026-12-20', valor: 110, paga: false }],
      },
      dataBaseDocumento: null,
    });
    expect(r.origem).toBe('boleto_externo');
    expect(r.dataBase).toBe('2026-11-20');
    expect(r.parcelas.map((p) => p.dias)).toEqual([30]);
  });

  it('se todas as parcelas estão pagas, o lançamento de boleto não fecha', () => {
    const r = resolverParcelasPreEntrada({
      xml: XML_A_VISTA,
      resposta: {
        situacao: 'boleto_externo',
        condicaoPagamento: 'À vista',
        formaPagamento: 'Boleto',
        regra: '0',
        parcelas: [{ numero: 1, dataVencimento: '2026-11-09', valor: 110, paga: true }],
      },
      dataBaseDocumento: null,
    });
    expect(r.pendente).toBe(true);
    expect(r.origem).toBe('pendente');
  });

  it('sem XML não trata como pago', () => {
    const r = resolverParcelasPreEntrada({
      xml: null,
      resposta: null,
      dataBaseDocumento: '2026-11-09',
    });
    expect(r.origem).toBe('sem_xml');
    expect(r.pendente).toBe(true);
  });
});

describe('motivoLancamentoBoletoIncompleto', () => {
  it('exige condição, regra, forma e pelo menos uma parcela a vencer', () => {
    expect(
      motivoLancamentoBoletoIncompleto({
        condicaoPagamento: '30',
        formaPagamento: 'Boleto',
        regra: '30',
        parcelas: [{ valor: 110, paga: false }],
      })
    ).toBeNull();
    expect(
      motivoLancamentoBoletoIncompleto({
        condicaoPagamento: '',
        formaPagamento: 'Boleto',
        regra: '30',
        parcelas: [{ valor: 110, paga: false }],
      })
    ).toMatch(/condição/);
    expect(
      motivoLancamentoBoletoIncompleto({
        condicaoPagamento: '30',
        formaPagamento: 'Boleto',
        regra: '',
        parcelas: [{ valor: 110, paga: false }],
      })
    ).toMatch(/regra/);
    expect(
      motivoLancamentoBoletoIncompleto({
        condicaoPagamento: '30',
        formaPagamento: 'Boleto',
        regra: '30',
        parcelas: [{ valor: 110, paga: true }],
      })
    ).toMatch(/Já foi paga/);
  });
});

describe('somaParcelasFechaValorNf', () => {
  it('aceita a soma em centavos igual ao total da nota', () => {
    expect(somaParcelasFechaValorNf([{ valor: 50.1 }, { valor: 59.9 }], 110)).toBe(true);
    expect(somaParcelasFechaValorNf([{ valor: 100 }], 110)).toBe(false);
    expect(somaParcelasFechaValorNf([{ valor: 10 }], null)).toBe(true);
  });
});
