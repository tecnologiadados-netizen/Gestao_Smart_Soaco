import { PERMISSOES, type CodigoPermissao } from '../config/permissoes';

type HasPermission = (codigo: CodigoPermissao) => boolean;

export const PERMISSOES_ACESSO_MATERIAIS_A_CHEGAR: CodigoPermissao[] = [PERMISSOES.COMPRAS_MATERIAIS_CHEGAR_VER];

export function podeAcessarMateriaisAChegar(hasPermission: HasPermission): boolean {
  return PERMISSOES_ACESSO_MATERIAIS_A_CHEGAR.some((p) => hasPermission(p));
}

/** Guia "Datas de entrega a atualizar" (exige também o acesso à tela). */
export function podeVerDatasEntregaAtualizar(hasPermission: HasPermission): boolean {
  return podeAcessarMateriaisAChegar(hasPermission) && hasPermission(PERMISSOES.COMPRAS_MATERIAIS_CHEGAR_DATAS_VER);
}

/** Botão "Alterar data" no pedido (exige também o acesso à tela). */
export function podeAlterarDatasEntrega(hasPermission: HasPermission): boolean {
  return podeAcessarMateriaisAChegar(hasPermission) && hasPermission(PERMISSOES.COMPRAS_MATERIAIS_CHEGAR_DATAS_ALTERAR);
}
