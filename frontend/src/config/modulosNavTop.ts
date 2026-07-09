import { PERMISSOES, type CodigoPermissao } from './permissoes';
import { PERMISSOES_ACESSO_FINANCEIRO_MENU } from '../utils/financeiroPermissoes';
import { PERMISSOES_ACESSO_FLUXOS } from '../utils/fluxosPermissoes';
import { PERMISSOES_ROTA_SUPORTE_CHAMADOS } from '../utils/suportePermissoes';

/** Módulo = botão principal da barra superior (sem submenus). Ordem de definição não importa; exibição A–Z + Outro. */
export type ModuloNavTopDef = {
  code: string;
  label: string;
  permissoes: CodigoPermissao[];
};

export const MODULO_AREA_OUTRO_CODE = 'outro';
export const MODULO_AREA_OUTRO_LABEL = 'Outro';

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
  { code: 'fluxos_decisorios', label: 'Fluxos Decisórios', permissoes: [...PERMISSOES_ACESSO_FLUXOS] },
  { code: 'compras', label: 'Compras', permissoes: [PERMISSOES.COMPRAS_VER] },
  { code: 'engenharia', label: 'Engenharia', permissoes: [PERMISSOES.PRECIFICACAO_VER] },
  { code: 'qualidade', label: 'Qualidade', permissoes: [PERMISSOES.QUALIDADE_VER] },
  { code: 'financeiro', label: 'Financeiro', permissoes: [...PERMISSOES_ACESSO_FINANCEIRO_MENU] },
  {
    code: 'logistica',
    label: 'Logística',
    permissoes: [PERMISSOES.LOGISTICA_VER, PERMISSOES.LOGISTICA_TOTAL, PERMISSOES.LOGISTICA_CUBAGEM_VER],
  },
  { code: 'integracao', label: 'Integração', permissoes: [PERMISSOES.INTEGRACAO_VER] },
  {
    code: 'email',
    label: 'E-mail',
    permissoes: [PERMISSOES.SISTEMA_EMAIL, PERMISSOES.USUARIOS_GERENCIAR],
  },
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
  { code: 'suporte', label: 'Suporte', permissoes: [...PERMISSOES_ROTA_SUPORTE_CHAMADOS, PERMISSOES.SUPORTE_CONFIGURAR] },
];

export type ModuloAreaOption = { code: string; label: string };

/** Lista viva de áreas para abertura de chamado (A–Z + Outro no final). */
export function listModulosAreaParaUsuario(
  hasPermission: (c: CodigoPermissao) => boolean,
  isMaster: boolean
): ModuloAreaOption[] {
  const modulos = MODULOS_NAV_TOP.filter(
    (m) => isMaster || m.permissoes.some((p) => hasPermission(p))
  )
    .map((m) => ({ code: m.code, label: m.label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }));
  modulos.push({ code: MODULO_AREA_OUTRO_CODE, label: MODULO_AREA_OUTRO_LABEL });
  return modulos;
}

export function resolveModuloAreaLabel(code: string): string | null {
  const c = code.trim().toLowerCase();
  if (c === MODULO_AREA_OUTRO_CODE) return MODULO_AREA_OUTRO_LABEL;
  const found = MODULOS_NAV_TOP.find((m) => m.code === c);
  return found?.label ?? null;
}
