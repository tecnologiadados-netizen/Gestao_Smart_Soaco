import { PERMISSOES, type CodigoPermissao } from '../config/permissoes';

type HasPermission = (codigo: CodigoPermissao) => boolean;

/** Abrir tela, histórico, consultar ao vivo e visualizar snapshots. */
export const PERMISSOES_ACESSO_SEQUENCIAMENTO_CARRADAS: CodigoPermissao[] = [
  PERMISSOES.PCP_SEQUENCIAMENTO_CARRADAS_VER,
  PERMISSOES.PCP_SEQUENCIAMENTO_CARRADAS_CRIAR,
  PERMISSOES.PCP_TOTAL,
  PERMISSOES.PCP_VER_TELA,
  PERMISSOES.PEDIDOS_VER,
];

/** Gravar, editar rascunho, concluir e excluir sequenciamentos. */
export const PERMISSOES_EDITAR_SEQUENCIAMENTO_CARRADAS: CodigoPermissao[] = [
  PERMISSOES.PCP_SEQUENCIAMENTO_CARRADAS_CRIAR,
  PERMISSOES.PCP_TOTAL,
  PERMISSOES.PCP_VER_TELA,
  PERMISSOES.PEDIDOS_EDITAR,
];

export function podeAcessarSequenciamentoCarradas(hasPermission: HasPermission): boolean {
  return PERMISSOES_ACESSO_SEQUENCIAMENTO_CARRADAS.some((p) => hasPermission(p));
}

export function podeCriarSequenciamentoCarradas(hasPermission: HasPermission): boolean {
  return PERMISSOES_EDITAR_SEQUENCIAMENTO_CARRADAS.some((p) => hasPermission(p));
}
