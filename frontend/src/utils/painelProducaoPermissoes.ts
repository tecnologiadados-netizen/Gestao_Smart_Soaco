import { PERMISSOES, type CodigoPermissao } from '../config/permissoes';

export const PERMISSOES_ACESSO_PAINEL_GERENCIAL: CodigoPermissao[] = [
  PERMISSOES.PCP_PAINEL_GERENCIAL_VER,
  PERMISSOES.PCP_TOTAL,
];

export const PERMISSOES_ACESSO_PAINEL_TV: CodigoPermissao[] = [
  PERMISSOES.PCP_PAINEL_TV_VER,
  PERMISSOES.PCP_TOTAL,
];

/** Visualizar Apuração; quem tem Painel Gerencial continua com acesso (compatibilidade). */
export const PERMISSOES_ACESSO_PAINEL_APURACAO: CodigoPermissao[] = [
  PERMISSOES.PCP_PAINEL_APURACAO_VER,
  PERMISSOES.PCP_PAINEL_GERENCIAL_VER,
  PERMISSOES.PCP_TOTAL,
];

export const PERMISSOES_ACESSO_PAINEL_METAS: CodigoPermissao[] = [
  PERMISSOES.PCP_PAINEL_METAS_EDITAR,
  PERMISSOES.PCP_TOTAL,
];

export const PERMISSOES_ACESSO_PAINEL_FAIXAS: CodigoPermissao[] = [
  PERMISSOES.PCP_PAINEL_METAS_FAIXAS_EDITAR,
  PERMISSOES.PCP_PAINEL_METAS_EDITAR,
  PERMISSOES.PCP_TOTAL,
];

export const PERMISSOES_ACESSO_PAINEL_METAS_QUALQUER: CodigoPermissao[] = [
  PERMISSOES.PCP_PAINEL_GERENCIAL_VER,
  PERMISSOES.PCP_PAINEL_TV_VER,
  PERMISSOES.PCP_PAINEL_APURACAO_VER,
  PERMISSOES.PCP_PAINEL_METAS_EDITAR,
  PERMISSOES.PCP_PAINEL_METAS_FAIXAS_EDITAR,
  PERMISSOES.PCP_TOTAL,
];

export function podeVerPainelGerencial(hasPermission: (c: CodigoPermissao) => boolean): boolean {
  return PERMISSOES_ACESSO_PAINEL_GERENCIAL.some((p) => hasPermission(p));
}

export function podeVerPainelTv(hasPermission: (c: CodigoPermissao) => boolean): boolean {
  return PERMISSOES_ACESSO_PAINEL_TV.some((p) => hasPermission(p));
}

export function podeVerPainelApuracao(hasPermission: (c: CodigoPermissao) => boolean): boolean {
  return PERMISSOES_ACESSO_PAINEL_APURACAO.some((p) => hasPermission(p));
}

export function podeEditarPainelMetas(hasPermission: (c: CodigoPermissao) => boolean): boolean {
  return PERMISSOES_ACESSO_PAINEL_METAS.some((p) => hasPermission(p));
}

export function podeEditarFaixasDesconto(hasPermission: (c: CodigoPermissao) => boolean): boolean {
  return PERMISSOES_ACESSO_PAINEL_FAIXAS.some((p) => hasPermission(p));
}

/** Cadastro de Metas (metas e/ou faixas): editar metas, editar faixas ou só visualizar via Gerencial. */
export function podeAcessarCadastroMetas(hasPermission: (c: CodigoPermissao) => boolean): boolean {
  return (
    podeEditarPainelMetas(hasPermission) ||
    podeEditarFaixasDesconto(hasPermission) ||
    podeVerPainelGerencial(hasPermission)
  );
}
