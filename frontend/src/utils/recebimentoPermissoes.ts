import { PERMISSOES, type CodigoPermissao } from '../config/permissoes';

type HasPermission = (codigo: CodigoPermissao) => boolean;

export const PERMISSOES_ACESSO_RECEBIMENTO: CodigoPermissao[] = [
  PERMISSOES.RECEBIMENTO_MESA,
  PERMISSOES.RECEBIMENTO_CONFERENTE,
  PERMISSOES.RECEBIMENTO_TOTAL,
  PERMISSOES.RECEBIMENTO_HISTORICO,
];

export const PERMISSOES_ACESSO_GESTAO_MESA: CodigoPermissao[] = [
  PERMISSOES.RECEBIMENTO_MESA,
  PERMISSOES.RECEBIMENTO_TOTAL,
];

export const PERMISSOES_ACESSO_DIGITACAO_CONFERENCIA: CodigoPermissao[] = [
  PERMISSOES.RECEBIMENTO_CONFERENTE,
  PERMISSOES.RECEBIMENTO_TOTAL,
];

/** Abre a tela: quem confere ou quem pode ver o histórico. */
export const PERMISSOES_ACESSO_TELA_DIGITACAO: CodigoPermissao[] = [
  ...PERMISSOES_ACESSO_DIGITACAO_CONFERENCIA,
  PERMISSOES.RECEBIMENTO_HISTORICO,
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

/** Aba de histórico na digitação. Não entra na permissão total do recebimento. */
export function podeVerHistoricoDigitacaoConferencia(hasPermission: HasPermission): boolean {
  return hasPermission(PERMISSOES.RECEBIMENTO_HISTORICO);
}

export function podeAbrirTelaDigitacaoConferencia(hasPermission: HasPermission): boolean {
  return PERMISSOES_ACESSO_TELA_DIGITACAO.some((p) => hasPermission(p));
}
