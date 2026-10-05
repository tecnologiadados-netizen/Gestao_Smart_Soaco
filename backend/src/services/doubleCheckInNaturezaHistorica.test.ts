import { describe, expect, it } from 'vitest';
import type { CampoRelato, RelatoConferencia } from './doubleCheckInConferenciaRelato.js';
import {
  parseNumeroPtBr,
  reclassificarRelatoHistorico,
} from './doubleCheckInNaturezaHistorica.js';

function campo(
  parcial: Partial<CampoRelato> & Pick<CampoRelato, 'campo' | 'nf' | 'pc'>
): CampoRelato {
  const { campo: nomeCampo, nf, pc, ...restante } = parcial;
  return {
    campo: nomeCampo,
    natureza: 'real',
    titulo: nomeCampo,
    nf,
    pc,
    diferenca: null,
    sinal: null,
    decisao: 'aceita',
    justificativa: 'Outros',
    observacao: null,
    detalhe: null,
    descontoWhatsApp: null,
    ...restante,
  };
}

function relato(campos: CampoRelato[]): RelatoConferencia {
  return {
    numeroNfe: '1226549',
    numeroDocumentoFiscal: 'DE39840',
    nomeParceiro: 'AÇO CEARENSE',
    conferidoPor: 'Luisa',
    conferidoEm: null,
    totalProdutos: 1,
    totalDivergencias: campos.length,
    totalDivergenciasReais: campos.length,
    totalDivergenciasBenignas: 0,
    aceitas: campos.length,
    recusadas: 0,
    pagamentoComum: null,
    produtos: [{ codigo: 'MP 5626', pedido: 'PC27854', campos }],
  };
}

describe('natureza histórica do Double CheckIn', () => {
  it('interpreta valores brasileiros do snapshot', () => {
    expect(parseNumeroPtBr('R$ 1.652,30')).toBe(1652.3);
    expect(parseNumeroPtBr('−R$ 6,10')).toBe(-6.1);
    expect(parseNumeroPtBr('1.511,88 QUILOGRAMA')).toBe(1511.88);
  });

  it('reclassifica preço menor como benigno e mantém quantidade como real', () => {
    const reclassificado = reclassificarRelatoHistorico(
      relato([
        campo({ campo: 'valor_unitario', nf: 'R$ 6,06', pc: 'R$ 6,16' }),
        campo({ campo: 'qtde', nf: '1.652 QUILOGRAMA', pc: '1.511,88 QUILOGRAMA' }),
      ])
    );
    expect(reclassificado.produtos[0]?.campos.map((item) => item.natureza)).toEqual([
      'benigna',
      'real',
    ]);
    expect(reclassificado.totalDivergenciasReais).toBe(1);
    expect(reclassificado.totalDivergenciasBenignas).toBe(1);
    expect(reclassificado.schemaVersion).toBe(2);
  });

  it('reconhece justificativa técnica benigna em snapshot antigo', () => {
    const reclassificado = reclassificarRelatoHistorico(
      relato([
        campo({
          campo: 'ipi',
          nf: 'R$ 500,00',
          pc: 'R$ 300,00',
          justificativa: 'IPI reflexo do valor ou da quantidade',
        }),
      ])
    );
    expect(reclassificado.produtos[0]?.campos[0]?.natureza).toBe('benigna');
    expect(reclassificado.produtos[0]?.campos[0]?.justificativaCodigo).toBe('ipi_reflexo');
  });

  it('remove falsa divergência de pagamento quando falta data base mas a condição é igual', () => {
    const reclassificado = reclassificarRelatoHistorico(
      relato([
        campo({
          campo: 'condicao_pagamento',
          nf: '(1x) 30 (28/39d)',
          pc: '(1x) 30',
          tabelaPrazos: {
            dataBaseNF: '2026-09-02',
            dataBasePC: null,
            linhas: [
              {
                numero: 1,
                vencimentoNF: '2026-09-30',
                diasNF: 28,
                vencimentoPC: '2026-10-25',
                diasPC: null,
              },
              {
                numero: 2,
                vencimentoNF: '2026-10-11',
                diasNF: 39,
                vencimentoPC: null,
                diasPC: null,
              },
            ],
          },
        }),
      ])
    );
    expect(reclassificado.totalDivergencias).toBe(0);
    expect(reclassificado.totalDivergenciasReais).toBe(0);
    expect(reclassificado.produtos[0]?.campos).toEqual([]);
  });
});
