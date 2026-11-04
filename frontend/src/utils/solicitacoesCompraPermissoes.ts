import { PERMISSOES, type CodigoPermissao } from '../config/permissoes';

type HasPermission = (codigo: CodigoPermissao) => boolean;

export const PERMISSOES_ACESSO_SOLICITACOES_COMPRA: CodigoPermissao[] = [
  PERMISSOES.COMPRAS_SOLICITACOES_VER,
];

export function podeAcessarSolicitacoesCompra(hasPermission: HasPermission): boolean {
  return PERMISSOES_ACESSO_SOLICITACOES_COMPRA.some((p) => hasPermission(p));
}
