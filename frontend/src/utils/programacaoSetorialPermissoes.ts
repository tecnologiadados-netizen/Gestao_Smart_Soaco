import { PERMISSOES, type CodigoPermissao } from '../config/permissoes';

type HasPermission = (codigo: CodigoPermissao) => boolean;

/** Abrir tela, listar, gerar e gravar Programação Setorial (independente do gerenciador). */
export const PERMISSOES_ACESSO_PROGRAMACAO_SETORIAL: CodigoPermissao[] = [
  PERMISSOES.PCP_PROGRAMACAO_SETORIAL_VER,
  PERMISSOES.PCP_TOTAL,
];

export function podeAcessarProgramacaoSetorial(hasPermission: HasPermission): boolean {
  return PERMISSOES_ACESSO_PROGRAMACAO_SETORIAL.some((p) => hasPermission(p));
}

/** Alias: a mesma permissão libera visualizar e gerar/gravar. */
export function podeGerarProgramacaoSetorial(hasPermission: HasPermission): boolean {
  return podeAcessarProgramacaoSetorial(hasPermission);
}
