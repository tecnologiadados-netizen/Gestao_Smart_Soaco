import { describe, expect, it } from 'vitest';
import {
  aplicarCalculoConsumiveisEspeciais,
  tipoConsumivelEspecialPorCodigo,
} from '../../frontend/src/utils/precificacaoConsumiveis';

const item = (
  id: number,
  codigo: string,
  valorTotal: number,
  extra: Record<string, unknown> = {}
) => ({
  id,
  idprodutopai: null,
  codigopai: null,
  descricaopai: null,
  idcomponente: id,
  codigocomponente: codigo,
  componente: codigo,
  qtd: 1,
  valorUnitario: valorTotal,
  valorTotal,
  tipoMaterial: 'Matéria Prima',
  ...extra,
});

describe('consumíveis especiais da precificação', () => {
  it('reconhece somente os quatro códigos liberados para edição', () => {
    expect(tipoConsumivelEspecialPorCodigo(' MP   1309 ')).toBe('gasGlp');
    expect(tipoConsumivelEspecialPorCodigo('muc 4377')).toBe('solda');
    expect(tipoConsumivelEspecialPorCodigo('MUC 4378')).toBe('fosfatizacao');
    expect(tipoConsumivelEspecialPorCodigo('SUB 0001')).toBe('sucata');
    expect(tipoConsumivelEspecialPorCodigo('MP 1310')).toBeNull();
  });

  it('prefere o preço manual e preserva o cálculo automático nos demais', () => {
    const resultado = aplicarCalculoConsumiveisEspeciais(
      [
        item(1, 'MP BASE', 100, { idFamiliaProduto: 65 }),
        item(2, 'MP 1309', 0, { valorTotalManual: 27.45 }),
        item(3, 'MUC 4377', 0),
        item(4, 'MUC 4378', 0),
        item(5, 'SUB 0001', 0),
      ],
      { gasGlp: '3,00', solda: '4,00', fosfatizacao: '5,00', sucata: '2,00' }
    );

    expect(resultado.find((i) => i.id === 2)?.valorTotal).toBe(27.45);
    expect(resultado.find((i) => i.id === 3)?.valorTotal).toBe(4);
    expect(resultado.find((i) => i.id === 4)?.valorTotal).toBe(5);
    expect(resultado.find((i) => i.id === 5)?.valorTotal).toBe(2);
  });
});
