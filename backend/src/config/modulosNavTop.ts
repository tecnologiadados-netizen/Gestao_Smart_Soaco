import { PERMISSOES, type CodigoPermissao } from './permissoes.js';

const PERMISSOES_ACESSO_FINANCEIRO_MENU: CodigoPermissao[] = [
  PERMISSOES.FINANCEIRO_VER,
  PERMISSOES.FINANCEIRO_RESUMO_VER,
  PERMISSOES.FINANCEIRO_DRE_VER,
  PERMISSOES.FINANCEIRO_DFC_VER,
  PERMISSOES.FINANCEIRO_PAINEL_COMERCIAL_VER,
  PERMISSOES.FINANCEIRO_RENEGOCIACAO_CONTRATOS_VER,
  PERMISSOES.FINANCEIRO_CRM_VER,
  PERMISSOES.FINANCEIRO_CRM_EMPRESA_VER,
  PERMISSOES.FINANCEIRO_CRM_CLIENTE_VER,
];

export type ModuloNavTopDef = {
  code: string;
  label: string;
  permissoes: CodigoPermissao[];
};

export const MODULO_AREA_OUTRO_CODE = 'outro';
export const MODULO_AREA_OUTRO_LABEL = 'Outro';

/** Botões principais da barra superior (sem submenus). */
export const MODULOS_NAV_TOP: ModuloNavTopDef[] = [
  {
    code: 'pcp',
    label: 'PCP',
    permissoes: [PERMISSOES.PCP_VER_TELA, PERMISSOES.PCP_TOTAL, PERMISSOES.PEDIDOS_VER],
  },
  {
    code: 'comunicacao_interna',
    label: 'Comunicação interna',
    permissoes: [
      PERMISSOES.COMUNICACAO_TELA_VER,
      PERMISSOES.COMUNICACAO_TOTAL,
      PERMISSOES.COMUNICACAO_VER,
      PERMISSOES.PEDIDOS_VER,
    ],
  },
  { code: 'heatmap', label: 'Roteirizador', permissoes: [PERMISSOES.HEATMAP_VER] },
  {
    code: 'fluxos_decisorios',
    label: 'Fluxos Decisórios',
    permissoes: [PERMISSOES.FLUXOS_VER, PERMISSOES.FLUXOS_EDITAR],
  },
  { code: 'compras', label: 'Compras', permissoes: [PERMISSOES.COMPRAS_VER] },
  { code: 'engenharia', label: 'Engenharia', permissoes: [PERMISSOES.PRECIFICACAO_VER] },
  { code: 'financeiro', label: 'Financeiro', permissoes: [...PERMISSOES_ACESSO_FINANCEIRO_MENU] },
  {
    code: 'logistica',
    label: 'Logística',
    permissoes: [PERMISSOES.LOGISTICA_VER, PERMISSOES.LOGISTICA_TOTAL, PERMISSOES.LOGISTICA_CUBAGEM_VER],
  },
  { code: 'integracao', label: 'Integração', permissoes: [PERMISSOES.INTEGRACAO_VER] },
  {
    code: 'whatsapp',
    label: 'WhatsApp',
    permissoes: [PERMISSOES.SISTEMA_WHATSAPP, PERMISSOES.USUARIOS_GERENCIAR],
  },
  {
    code: 'situacao_api',
    label: 'Situação da API',
    permissoes: [PERMISSOES.SISTEMA_SITUACAO_API, PERMISSOES.DASHBOARD_VER],
  },
  { code: 'relatorios', label: 'Relatórios', permissoes: [PERMISSOES.RELATORIOS_VER] },
  {
    code: 'gestao_usuarios',
    label: 'Gestão de usuários',
    permissoes: [
      PERMISSOES.USUARIOS_TELA_VER,
      PERMISSOES.USUARIOS_TOTAL,
      PERMISSOES.GRUPOS_TELA_VER,
      PERMISSOES.GRUPOS_TOTAL,
      PERMISSOES.USUARIOS_GERENCIAR,
    ],
  },
  {
    code: 'suporte',
    label: 'Suporte',
    permissoes: [
      PERMISSOES.SUPORTE_CHAMADOS_VER,
      PERMISSOES.SUPORTE_CHAMADOS_CRIAR,
      PERMISSOES.SUPORTE_CONFIGURAR,
    ],
  },
];

export function usuarioTemPermissaoModulo(perms: string[], isMasterUser: boolean, mod: ModuloNavTopDef): boolean {
  if (isMasterUser) return true;
  return mod.permissoes.some((p) => perms.includes(p));
}

export function listModulosAreaParaPermissoes(
  perms: string[],
  isMasterUser: boolean
): Array<{ code: string; label: string }> {
  const items = MODULOS_NAV_TOP.filter((m) => usuarioTemPermissaoModulo(perms, isMasterUser, m))
    .map((m) => ({ code: m.code, label: m.label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }));
  items.push({ code: MODULO_AREA_OUTRO_CODE, label: MODULO_AREA_OUTRO_LABEL });
  return items;
}

export function resolveModuloAreaLabelFromCode(code: string): string | null {
  const c = code.trim().toLowerCase();
  if (c === MODULO_AREA_OUTRO_CODE) return MODULO_AREA_OUTRO_LABEL;
  const found = MODULOS_NAV_TOP.find((m) => m.code === c);
  return found?.label ?? null;
}
