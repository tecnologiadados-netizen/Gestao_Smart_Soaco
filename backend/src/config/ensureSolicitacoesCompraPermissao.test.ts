import { describe, expect, it } from 'vitest';
import { PERMISSOES } from './permissoes.js';
import { permissoesSolicitacoesCompraParaGrupo } from './ensureSolicitacoesCompraPermissao.js';

describe('permissoesSolicitacoesCompraParaGrupo', () => {
  it('quem já via Compras ganha o acesso à tela', () => {
    expect(permissoesSolicitacoesCompraParaGrupo([PERMISSOES.COMPRAS_VER])).toEqual([
      PERMISSOES.COMPRAS_SOLICITACOES_VER,
    ]);
  });

  it('não concede a quem não via Compras e não repete o que o grupo já tem', () => {
    expect(permissoesSolicitacoesCompraParaGrupo([PERMISSOES.COMPRAS_EDITAR])).toEqual([]);
    expect(
      permissoesSolicitacoesCompraParaGrupo([
        PERMISSOES.COMPRAS_VER,
        PERMISSOES.COMPRAS_SOLICITACOES_VER,
      ])
    ).toEqual([]);
  });
});
