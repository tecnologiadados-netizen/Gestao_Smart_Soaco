import { PERMISSOES, type CodigoPermissao } from '../config/permissoes';

/** Permissões que permitem abrir a lista e visualizar programações de produção. */
export const PERMISSOES_ACESSO_PROGRAMACAO_PRODUCAO: CodigoPermissao[] = [
  PERMISSOES.PCP_VER_TELA,
  PERMISSOES.PCP_TOTAL,
  PERMISSOES.PEDIDOS_VER,
];

export function podeVerProgramacaoProducao(hasPermission: (codigo: CodigoPermissao) => boolean): boolean {
  return PERMISSOES_ACESSO_PROGRAMACAO_PRODUCAO.some((p) => hasPermission(p));
}

/** Por enquanto, mesmas permissões da visualização (edição detalhada virá depois). */
export function podeEditarProgramacaoProducao(hasPermission: (codigo: CodigoPermissao) => boolean): boolean {
  return podeVerProgramacaoProducao(hasPermission);
}
