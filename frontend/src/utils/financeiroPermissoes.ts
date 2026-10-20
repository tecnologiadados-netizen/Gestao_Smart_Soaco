import { PERMISSOES, type CodigoPermissao } from '../config/permissoes';

/** Qualquer permissão que exibe o menu Financeiro na barra superior. */
export const PERMISSOES_ACESSO_FINANCEIRO_MENU: CodigoPermissao[] = [
  PERMISSOES.FINANCEIRO_VER,
  PERMISSOES.FINANCEIRO_RESUMO_VER,
  PERMISSOES.FINANCEIRO_DRE_VER,
  PERMISSOES.FINANCEIRO_DFC_VER,
  PERMISSOES.FINANCEIRO_PAINEL_COMERCIAL_VER,
  PERMISSOES.FINANCEIRO_RENEGOCIACAO_CONTRATOS_VER,
  PERMISSOES.FINANCEIRO_CRM_VER,
  PERMISSOES.FINANCEIRO_CRM_EMPRESA_VER,
  PERMISSOES.FINANCEIRO_CRM_CLIENTE_VER,
  PERMISSOES.FINANCEIRO_CRM_PENDENCIAS_VER,
  PERMISSOES.FINANCEIRO_CARTEIRA_FINANCEIRA_VER,
  PERMISSOES.FINANCEIRO_DIARIO_VER,
];

export const PERMISSOES_ACESSO_FINANCEIRO_RESUMO: CodigoPermissao[] = [
  PERMISSOES.FINANCEIRO_VER,
  PERMISSOES.FINANCEIRO_RESUMO_VER,
];

export const PERMISSOES_ACESSO_FINANCEIRO_DRE: CodigoPermissao[] = [
  PERMISSOES.FINANCEIRO_VER,
  PERMISSOES.FINANCEIRO_DRE_VER,
];

/** Dashboard Financeiro (a rota antiga /financeiro/resumo também cai aqui). */
export const PERMISSOES_ACESSO_FINANCEIRO_DASHBOARD: CodigoPermissao[] = [
  PERMISSOES.FINANCEIRO_VER,
  PERMISSOES.FINANCEIRO_DRE_VER,
  PERMISSOES.FINANCEIRO_RESUMO_VER,
];

export const PERMISSOES_ACESSO_FINANCEIRO_DFC: CodigoPermissao[] = [
  PERMISSOES.FINANCEIRO_VER,
  PERMISSOES.FINANCEIRO_DFC_VER,
];

export const PERMISSOES_ACESSO_FINANCEIRO_PAINEL_COMERCIAL: CodigoPermissao[] = [
  PERMISSOES.FINANCEIRO_VER,
  PERMISSOES.FINANCEIRO_PAINEL_COMERCIAL_VER,
];

export const PERMISSOES_ACESSO_FINANCEIRO_RENEGOCIACAO: CodigoPermissao[] = [
  PERMISSOES.FINANCEIRO_VER,
  PERMISSOES.FINANCEIRO_RENEGOCIACAO_CONTRATOS_VER,
];

/** Guia "Situação geral da empresa" do CRM. */
export const PERMISSOES_ACESSO_FINANCEIRO_CRM_EMPRESA: CodigoPermissao[] = [
  PERMISSOES.FINANCEIRO_VER,
  PERMISSOES.FINANCEIRO_CRM_VER,
  PERMISSOES.FINANCEIRO_CRM_EMPRESA_VER,
];

/** Guia "Análise de crédito por cliente" do CRM. */
export const PERMISSOES_ACESSO_FINANCEIRO_CRM_CLIENTE: CodigoPermissao[] = [
  PERMISSOES.FINANCEIRO_VER,
  PERMISSOES.FINANCEIRO_CRM_VER,
  PERMISSOES.FINANCEIRO_CRM_CLIENTE_VER,
];

/** Guia "Pendências de crédito com PD em carteira" do CRM. */
export const PERMISSOES_ACESSO_FINANCEIRO_CRM_PENDENCIAS: CodigoPermissao[] = [
  PERMISSOES.FINANCEIRO_VER,
  PERMISSOES.FINANCEIRO_CRM_VER,
  PERMISSOES.FINANCEIRO_CRM_PENDENCIAS_VER,
];

/** Editar To/Cc do e-mail de ação na aba Pendências. */
export const PERMISSOES_EDITAR_CRM_PENDENCIAS_DESTINATARIOS: CodigoPermissao[] = [
  PERMISSOES.FINANCEIRO_VER,
  PERMISSOES.FINANCEIRO_CRM_VER,
  PERMISSOES.FINANCEIRO_CRM_PENDENCIAS_DESTINATARIOS_EDITAR,
];

/** Acesso à tela do CRM (qualquer uma das guias). */
export const PERMISSOES_ACESSO_FINANCEIRO_CRM: CodigoPermissao[] = [
  PERMISSOES.FINANCEIRO_VER,
  PERMISSOES.FINANCEIRO_CRM_VER,
  PERMISSOES.FINANCEIRO_CRM_EMPRESA_VER,
  PERMISSOES.FINANCEIRO_CRM_CLIENTE_VER,
  PERMISSOES.FINANCEIRO_CRM_PENDENCIAS_VER,
];

export const PERMISSOES_ACESSO_FINANCEIRO_CARTEIRA: CodigoPermissao[] = [
  PERMISSOES.FINANCEIRO_VER,
  PERMISSOES.FINANCEIRO_CARTEIRA_FINANCEIRA_VER,
];

export const PERMISSOES_ACESSO_FINANCEIRO_DIARIO: CodigoPermissao[] = [
  PERMISSOES.FINANCEIRO_VER,
  PERMISSOES.FINANCEIRO_DIARIO_VER,
];

export const ROTA_PERMISSOES_FINANCEIRO: Record<string, CodigoPermissao[]> = {
  '/financeiro': PERMISSOES_ACESSO_FINANCEIRO_MENU,
  '/financeiro/resumo': PERMISSOES_ACESSO_FINANCEIRO_MENU,
  '/financeiro/dre': PERMISSOES_ACESSO_FINANCEIRO_DRE,
  '/financeiro/dashboard': PERMISSOES_ACESSO_FINANCEIRO_DASHBOARD,
  '/financeiro/dfc': PERMISSOES_ACESSO_FINANCEIRO_DFC,
  '/financeiro/painel-financeiro-comercial': PERMISSOES_ACESSO_FINANCEIRO_PAINEL_COMERCIAL,
  '/financeiro/renegociacao-contratos': PERMISSOES_ACESSO_FINANCEIRO_RENEGOCIACAO,
  '/financeiro/crm': PERMISSOES_ACESSO_FINANCEIRO_CRM,
  '/financeiro/carteira-financeira': PERMISSOES_ACESSO_FINANCEIRO_CARTEIRA,
  '/financeiro/diario': PERMISSOES_ACESSO_FINANCEIRO_DIARIO,
};

export function podeAcessarRotaFinanceiro(
  path: string,
  hasPermission: (c: CodigoPermissao) => boolean
): boolean {
  const perms = ROTA_PERMISSOES_FINANCEIRO[path];
  if (!perms) return false;
  return perms.some((p) => hasPermission(p));
}

export function podeVerMenuFinanceiro(hasPermission: (c: CodigoPermissao) => boolean): boolean {
  return PERMISSOES_ACESSO_FINANCEIRO_MENU.some((p) => hasPermission(p));
}

/**
 * Telas reais do Financeiro, na ordem em que o usuário deve cair ao entrar.
 * /financeiro e /financeiro/resumo ficam de fora: só redirecionam. Se entrarem
 * nesta lista, o guardião de rota devolve o usuário para elas e a tela fica
 * em "Carregando tela…" para sempre.
 */
export const ROTAS_ENTRADA_FINANCEIRO = [
  '/financeiro/dashboard',
  '/financeiro/dre',
  '/financeiro/dfc',
  '/financeiro/painel-financeiro-comercial',
  '/financeiro/renegociacao-contratos',
  '/financeiro/crm',
  '/financeiro/carteira-financeira',
  '/financeiro/diario',
] as const;

export function rotaInicialFinanceiro(hasPermission: (c: CodigoPermissao) => boolean): string | null {
  for (const path of ROTAS_ENTRADA_FINANCEIRO) {
    if (podeAcessarRotaFinanceiro(path, hasPermission)) return path;
  }
  return null;
}
