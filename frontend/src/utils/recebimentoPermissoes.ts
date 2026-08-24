import { PERMISSOES, type CodigoPermissao } from '../config/permissoes';

type HasPermission = (codigo: CodigoPermissao) => boolean;

export const PERMISSOES_ACESSO_RECEBIMENTO: CodigoPermissao[] = [
  PERMISSOES.RECEBIMENTO_MESA,
  PERMISSOES.RECEBIMENTO_CONFERENTE,
  PERMISSOES.RECEBIMENTO_TOTAL,
];

export const PERMISSOES_ACESSO_GESTAO_MESA: CodigoPermissao[] = [
  PERMISSOES.RECEBIMENTO_MESA,
  PERMISSOES.RECEBIMENTO_TOTAL,
];

export const PERMISSOES_ACESSO_DIGITACAO_CONFERENCIA: CodigoPermissao[] = [
  PERMISSOES.RECEBIMENTO_CONFERENTE,
  PERMISSOES.RECEBIMENTO_TOTAL,
];

export function podeVerMenuRecebimento(hasPermission: HasPermission): boolean {
  return PERMISSOES_ACESSO_RECEBIMENTO.some((p) => hasPermission(p));
}

export function podeAcessarGestaoMesa(hasPermission: HasPermission): boolean {
  return PERMISSOES_ACESSO_GESTAO_MESA.some((p) => hasPermission(p));
}

export function podeAcessarDigitacaoConferencia(hasPermission: HasPermission): boolean {
  return PERMISSOES_ACESSO_DIGITACAO_CONFERENCIA.some((p) => hasPermission(p));
}
