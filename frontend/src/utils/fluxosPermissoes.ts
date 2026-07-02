import { PERMISSOES, type CodigoPermissao } from '../config/permissoes';

/** Permissões que permitem abrir a lista e visualizar fluxos salvos. */
export const PERMISSOES_ACESSO_FLUXOS: CodigoPermissao[] = [
  PERMISSOES.FLUXOS_VER,
  PERMISSOES.FLUXOS_EDITAR,
];

export function podeVerFluxos(hasPermission: (codigo: CodigoPermissao) => boolean): boolean {
  return PERMISSOES_ACESSO_FLUXOS.some((p) => hasPermission(p));
}

export function podeEditarFluxos(hasPermission: (codigo: CodigoPermissao) => boolean): boolean {
  return hasPermission(PERMISSOES.FLUXOS_EDITAR);
}
