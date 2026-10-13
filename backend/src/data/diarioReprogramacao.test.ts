import { describe, expect, it } from 'vitest';
import { extrairReprogramacao, extrairReprogramacaoLinha } from './diarioReprogramacao.js';

describe('extrairReprogramacao', () => {
  it('lê a data completa do marcador longo', () => {
    expect(
      extrairReprogramacao('REPROGRAMADO - VENC ORIGINAL 12/09/2026 - CONFISSÃO DE DIV'),
    ).toEqual({ texto: '12/09/2026', vencimentoOriginal: '2026-09-12' });
  });

  it('lê o dia e o mês do marcador curto do Shop9', () => {
    expect(extrairReprogramacao('REP 05/10 CONTRATO 721')).toEqual({
      texto: '05/10',
      vencimentoOriginal: null,
    });
  });

  it('reconhece a palavra reprogramado sem data', () => {
    expect(extrairReprogramacao('Título reprogramado com o banco')).toEqual({
      texto: 'REPROGRAMADO',
      vencimentoOriginal: null,
    });
  });

  it('prefere a descrição e usa o comentário quando a descrição não marca', () => {
    expect(extrairReprogramacaoLinha('NF 10', 'reprogramado pelo financeiro')).toEqual({
      texto: 'REPROGRAMADO',
      vencimentoOriginal: null,
    });
    expect(extrairReprogramacaoLinha('boleto', 'sem marca')).toBeNull();
  });
});
