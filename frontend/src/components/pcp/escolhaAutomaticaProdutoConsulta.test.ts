import { describe, expect, it } from 'vitest';
import { escolhaAutomaticaProdutoConsulta } from './ModalFiltrosConsultaEstoque';

describe('escolhaAutomaticaProdutoConsulta', () => {
  it('abre direto o item quando o ressuprimento é comprado, mesmo com BOM', () => {
    expect(
      escolhaAutomaticaProdutoConsulta({ temBom: true, todosComprados: true })
    ).toEqual({ modoProduto: 'diretos', empenhoEscopo: 'todos' });
  });

  it('abre direto o item quando ninguém tem BOM', () => {
    expect(
      escolhaAutomaticaProdutoConsulta({ temBom: false, todosComprados: false })
    ).toEqual({ modoProduto: 'diretos', empenhoEscopo: 'todos' });
  });

  it('pergunta a visualização quando há BOM e o item não é comprado', () => {
    expect(
      escolhaAutomaticaProdutoConsulta({ temBom: true, todosComprados: false })
    ).toBeNull();
  });
});
