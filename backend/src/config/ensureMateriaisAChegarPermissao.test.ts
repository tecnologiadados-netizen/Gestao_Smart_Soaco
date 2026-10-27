import { describe, expect, it } from 'vitest';
import { PERMISSOES } from './permissoes.js';
import { permissoesMateriaisAChegarParaGrupo } from './ensureMateriaisAChegarPermissao.js';

describe('permissoesMateriaisAChegarParaGrupo', () => {
  it('quem já abria a tela ganha acesso e guia de datas', () => {
    expect(permissoesMateriaisAChegarParaGrupo([PERMISSOES.PCP_VER_TELA])).toEqual([
      PERMISSOES.COMPRAS_MATERIAIS_CHEGAR_VER,
      PERMISSOES.COMPRAS_MATERIAIS_CHEGAR_DATAS_VER,
    ]);
    expect(permissoesMateriaisAChegarParaGrupo([PERMISSOES.COMPRAS_VER])).toHaveLength(2);
  });

  it('alterar datas só para quem também editava Integração', () => {
    expect(
      permissoesMateriaisAChegarParaGrupo([PERMISSOES.PEDIDOS_VER, PERMISSOES.INTEGRACAO_EDITAR])
    ).toContain(PERMISSOES.COMPRAS_MATERIAIS_CHEGAR_DATAS_ALTERAR);
    expect(permissoesMateriaisAChegarParaGrupo([PERMISSOES.INTEGRACAO_EDITAR])).toEqual([]);
  });

  it('não repete o que o grupo já tem', () => {
    expect(
      permissoesMateriaisAChegarParaGrupo([PERMISSOES.PCP_TOTAL, PERMISSOES.COMPRAS_MATERIAIS_CHEGAR_VER])
    ).toEqual([PERMISSOES.COMPRAS_MATERIAIS_CHEGAR_DATAS_VER]);
  });
});
