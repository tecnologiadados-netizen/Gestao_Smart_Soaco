import { PERMISSOES, type CodigoPermissao } from '../config/permissoes';

type HasPermission = (codigo: CodigoPermissao) => boolean;

/** Acesso à tela Double Check NFe (isolado de Compras geral). */
export const PERMISSOES_ACESSO_DOUBLE_CHECKIN: CodigoPermissao[] = [
  PERMISSOES.COMPRAS_DOUBLE_CHECKIN,
];

export function podeAcessarDoubleCheckIn(hasPermission: HasPermission): boolean {
  return PERMISSOES_ACESSO_DOUBLE_CHECKIN.some((p) => hasPermission(p));
}

/** Exibe o menu Compras se tiver Compras geral ou alguma tela isolada do setor. */
export function podeVerMenuCompras(hasPermission: HasPermission): boolean {
  return (
    hasPermission(PERMISSOES.COMPRAS_VER) ||
    podeAcessarDoubleCheckIn(hasPermission) ||
    hasPermission(PERMISSOES.COMPRAS_MATERIAIS_CHEGAR_VER) ||
    hasPermission(PERMISSOES.COMPRAS_SOLICITACOES_VER)
  );
}
