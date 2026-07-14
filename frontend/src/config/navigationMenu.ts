import { PERMISSOES, type CodigoPermissao } from './permissoes';
import { podeAcessarRotaFinanceiro } from '../utils/financeiroPermissoes';
import {
  podeEditarPainelMetas,
  podeVerPainelGerencial,
  podeVerPainelTv,
} from '../utils/painelProducaoPermissoes';

export type NavMenuEntry =
  | { kind: 'link'; to: string; label: string }
  | { kind: 'submenu'; label: string; children: NavMenuEntry[] };

export type FinanceiroMenuEntry =
  | { kind: 'link'; to: string; label: string }
  | { kind: 'submenu'; label: string; children: { to: string; label: string }[] };

export const PCP_MENU: NavMenuEntry[] = [
  { kind: 'link', to: '/pedidos/dash-entregas', label: 'Painel Pedidos em aberto' },
  { kind: 'link', to: '/pedidos/sequenciamento-carradas', label: 'Sequenciamento carradas' },
  { kind: 'link', to: '/pedidos', label: 'Gerenciador de pedidos' },
  { kind: 'link', to: '/pedidos/encerrados', label: 'Pedidos encerrados' },
  {
    kind: 'submenu',
    label: 'Estoque',
    children: [
      { kind: 'link', to: '/pedidos/mrp-dashboard', label: 'Painel MRP' },
      { kind: 'link', to: '/pedidos/mrp', label: 'MRP Produtos secundários' },
      { kind: 'link', to: '/pedidos/mrp-produtos-em-processo', label: 'MRP Produtos em processo' },
      { kind: 'link', to: '/pedidos/mpp', label: 'MPP' },
      { kind: 'link', to: '/pedidos/ressup-almox', label: 'Ressuprimento Almox' },
      { kind: 'link', to: '/pedidos/ressup-nao-almox', label: 'Ressup Não Almox' },
      { kind: 'link', to: '/pedidos/consulta-estoque', label: 'Consulta de Estoque' },
    ],
  },
  {
    kind: 'submenu',
    label: 'Programação',
    children: [
      { kind: 'link', to: '/pedidos/programacao-setorial', label: 'Programação Setorial' },
      {
        kind: 'submenu',
        label: 'Programação Perfiladeiras',
        children: [{ kind: 'link', to: '/pedidos/programacao-producao', label: 'Recurso 1000' }],
      },
      {
        kind: 'submenu',
        label: 'Configuração',
        children: [
          { kind: 'link', to: '/pedidos/programacao-producao/recursos', label: 'Recursos' },
          { kind: 'link', to: '/pedidos/regras-data-entrega', label: 'Regras data de entrega' },
        ],
      },
    ],
  },
  {
    kind: 'submenu',
    label: 'Painel Metas',
    children: [
      { kind: 'link', to: '/pedidos/painel-metas/gerencial', label: 'Painel Gerencial' },
      { kind: 'link', to: '/pedidos/painel-metas/tv', label: 'Painel TV' },
      { kind: 'link', to: '/pedidos/painel-metas/metas', label: 'Metas' },
    ],
  },
];

export const LOGISTICA_MENU: NavMenuEntry[] = [
  { kind: 'link', to: '/heatmap', label: 'Roteirizador' },
  {
    kind: 'submenu',
    label: 'Cubagem',
    children: [
      { kind: 'link', to: '/logistica/cubagem/veiculos', label: 'Veículos' },
      { kind: 'link', to: '/logistica/cubagem/produtos', label: 'Dimensões de Produtos' },
      { kind: 'link', to: '/logistica/cubagem/simulacao', label: 'Simulação' },
    ],
  },
];

export const COMUNICACAO_INTERNA_SUBMENUS: { to: string; label: string }[] = [
  { to: '/pedidos/sycroorder', label: 'Comunicação PD' },
];

export const COMPRAS_SUBMENUS: { to: string; label: string }[] = [
  { to: '/compras/dashboard', label: 'Dashboard' },
  { to: '/compras/coletas-precos', label: 'Coletas de Preços' },
  { to: '/compras/pre-compra', label: 'Pré Compra' },
  { to: '/compras/painel-rupturas', label: 'Painel de Rupturas' },
];

export const COMPRAS_MENU: NavMenuEntry[] = [
  { kind: 'link', to: '/compras/dashboard', label: 'Dashboard' },
  { kind: 'link', to: '/compras/coletas-precos', label: 'Coletas de Preços' },
  { kind: 'link', to: '/compras/pre-compra', label: 'Pré Compra' },
  { kind: 'link', to: '/compras/painel-rupturas', label: 'Painel de Rupturas' },
  {
    kind: 'submenu',
    label: 'Rotina',
    children: [
      { kind: 'link', to: '/compras/rotina/pendencias', label: 'Pendências compras' },
    ],
  },
];

export const ENGENHARIA_SUBMENUS: { to: string; label: string }[] = [
  { to: '/engenharia/precificacao', label: 'Precificação' },
];

export const QUALIDADE_MENU: NavMenuEntry[] = [
  {
    kind: 'submenu',
    label: 'SGQ',
    children: [
      { kind: 'link', to: '/qualidade/documentos', label: 'Documentos' },
      { kind: 'link', to: '/qualidade/calibracoes', label: 'Calibrações' },
      { kind: 'link', to: '/qualidade/registros', label: 'Registros' },
      { kind: 'link', to: '/qualidade/configuracoes', label: 'Configurações' },
    ],
  },
];

export const COMERCIAL_MENU: NavMenuEntry[] = [
  { kind: 'link', to: '/comercial/painel', label: 'Painel Comercial' },
];

export const FINANCEIRO_MENU: FinanceiroMenuEntry[] = [
  { kind: 'link', to: '/financeiro/resumo', label: 'Resumo Financeiro' },
  { kind: 'link', to: '/financeiro/dre', label: 'DRE' },
  { kind: 'link', to: '/financeiro/dfc', label: 'DFC' },
  { kind: 'link', to: '/financeiro/painel-financeiro-comercial', label: 'Painel Financeiro-Comercial' },
  { kind: 'link', to: '/financeiro/renegociacao-contratos', label: 'Simulação de Renegociação' },
  { kind: 'link', to: '/financeiro/crm', label: 'CRM Financeiro' },
];

export const INTEGRACAO_SUBMENUS: { to: string; label: string }[] = [
  { to: '/integracao/alteracao-data-entrega-compra', label: 'Alteração da Data de Entrega do Pedido de Compra' },
  { to: '/integracao/sms', label: 'SMS' },
  { to: '/integracao/credenciais', label: 'Credenciais' },
];

export const GESTAO_USUARIOS_SUBMENUS: { to: string; label: string }[] = [
  { to: '/usuarios', label: 'Usuários' },
  { to: '/usuarios/grupos', label: 'Grupos de usuários' },
];

/** Rotas que podem ser abertas no sistema (path → label). Usado na busca rápida e menus. */
export const PATH_LABELS: Record<string, string> = {
  '/': 'Início',
  '/pedidos/dash-entregas': 'Painel Pedidos em aberto',
  '/pedidos/sequenciamento-carradas': 'Sequenciamento carradas',
  '/pedidos': 'Gerenciador de Pedidos',
  '/pedidos/encerrados': 'Pedidos encerrados',
  '/pedidos/sycroorder': 'Comunicação PD',
  '/suporte': 'Chamados',
  '/suporte/configuracao': 'Configurações de suporte',
  '/pedidos/mrp-dashboard': 'Painel MRP',
  '/pedidos/mrp': 'MRP',
  '/pedidos/mrp-produtos-em-processo': 'MRP - Produtos em Processo',
  '/pedidos/mpp': 'MPP',
  '/pedidos/programacao-setorial': 'Programação Setorial',
  '/pedidos/programacao-producao': 'Programação de produção',
  '/pedidos/programacao-producao/recursos': 'Recursos',
  '/pedidos/regras-data-entrega': 'Regras data de entrega',
  '/pedidos/ressup-almox': 'Ressup Almox',
  '/pedidos/ressup-nao-almox': 'Ressup Não Almox',
  '/pedidos/consulta-estoque': 'Consulta de Estoque',
  '/pedidos/painel-metas/gerencial': 'Painel Gerencial',
  '/pedidos/painel-metas/tv': 'Painel TV',
  '/pedidos/painel-metas/metas': 'Metas',
  '/heatmap': 'Roteirizador',
  '/mind-maps': 'Fluxos Decisórios',
  '/compras': 'Compras',
  '/compras/dashboard': 'Dashboard Compras',
  '/compras/coletas-precos': 'Coletas de Preços',
  '/compras/pre-compra': 'Pré Compra',
  '/compras/painel-rupturas': 'Painel de Rupturas',
  '/compras/rotina/pendencias': 'Pendências compras',
  '/engenharia': 'Engenharia',
  '/engenharia/precificacao': 'Precificação',
  '/qualidade': 'Qualidade',
  '/qualidade/documentos': 'Qualidade — SGQ — Documentos',
  '/qualidade/calibracoes': 'Qualidade — SGQ — Calibrações',
  '/qualidade/registros': 'Qualidade — SGQ — Registros',
  '/qualidade/configuracoes': 'Qualidade — SGQ — Configurações',
  '/financeiro': 'Financeiro',
  '/financeiro/resumo': 'Resumo Financeiro',
  '/financeiro/dfc': 'DFC',
  '/financeiro/dre': 'DRE',
  '/financeiro/painel-financeiro-comercial': 'Painel Financeiro-Comercial',
  '/comercial/painel': 'Painel Comercial',
  '/financeiro/renegociacao-contratos': 'Simulação de Renegociação',
  '/financeiro/crm': 'CRM Financeiro',
  '/relatorios': 'Relatórios',
  '/integracao': 'Integração',
  '/integracao/alteracao-data-entrega-compra': 'Alteração Data Entrega',
  '/integracao/faturamento-diario': 'Faturamento Diário',
  '/integracao/pedidos-entrega-vencida': 'Pedidos Previsão Vencida',
  '/integracao/sms': 'SMS',
  '/integracao/credenciais': 'Credenciais',
  '/integracao/credenciais/email': 'E-mail (Gmail)',
  '/usuarios': 'Usuários',
  '/usuarios/grupos': 'Grupos de usuários',
  '/whatsapp': 'WhatsApp',
  '/situacao-api': 'Situação da API',
  '/logistica/cubagem/veiculos': 'Veículos',
  '/logistica/cubagem/produtos': 'Dimensões de Produtos',
  '/logistica/cubagem/simulacao': 'Simulação de Cubagem',
  '/sem-acesso': 'Sem acesso',
};

/** Paths de menu do mais específico (longo) ao mais genérico — evita pai genérico (ex.: `/pedidos`) ficar ativo em irmãos (`/pedidos/dash-entregas`). */
const NAV_MENU_PATHS_BY_SPECIFICITY = Object.keys(PATH_LABELS)
  .filter((p) => p !== '/')
  .sort((a, b) => b.length - a.length || b.localeCompare(a));

export function navPathAtivo(to: string, pathname: string): boolean {
  if (pathname === to) return true;
  if (!pathname.startsWith(`${to}/`)) return false;

  // Prefixo só destaca se `to` for o item de menu mais específico que casa com o pathname
  // (ex.: `/pedidos/mrp` em `/pedidos/mrp/123`; não `/pedidos` em `/pedidos/dash-entregas`).
  for (const path of NAV_MENU_PATHS_BY_SPECIFICITY) {
    if (pathname === path || pathname.startsWith(`${path}/`)) {
      return path === to;
    }
  }
  return true;
}

export function navMenuEntryAtivo(entry: NavMenuEntry, pathname: string): boolean {
  if (entry.kind === 'link') return navPathAtivo(entry.to, pathname);
  return entry.children.some((c) => navMenuEntryAtivo(c, pathname));
}

export function getLabelForPath(path: string): string {
  if (path.startsWith('/mind-maps')) return PATH_LABELS['/mind-maps'] ?? 'Fluxos Decisórios';
  if (path.startsWith('/pedidos/programacao-producao/recursos')) {
    return PATH_LABELS['/pedidos/programacao-producao/recursos'] ?? 'Recursos';
  }
  if (path.startsWith('/pedidos/regras-data-entrega')) {
    return PATH_LABELS['/pedidos/regras-data-entrega'] ?? 'Regras data de entrega';
  }
  if (path.startsWith('/pedidos/programacao-producao')) {
    return PATH_LABELS['/pedidos/programacao-producao'] ?? 'Programação de produção';
  }
  return PATH_LABELS[path] ?? (path || 'Início');
}

type HasPermission = (codigo: CodigoPermissao) => boolean;

export function buildIntegracaoSubmenusForUser(
  hasPermission: HasPermission,
  isMaster: boolean,
  grupo: string | null | undefined,
): { to: string; label: string }[] {
  const items: { to: string; label: string }[] = [];
  if (hasPermission(PERMISSOES.INTEGRACAO_VER)) {
    const g = String(grupo ?? '').trim();
    const somenteAlteracao = g === 'Compras' || g === 'Operador Compras';
    if (somenteAlteracao) {
      items.push(...INTEGRACAO_SUBMENUS.filter((i) => i.to === '/integracao/alteracao-data-entrega-compra'));
    } else {
      items.push(...INTEGRACAO_SUBMENUS);
    }
  }
  if (isMaster || hasPermission(PERMISSOES.SISTEMA_WHATSAPP)) {
    items.push({ to: '/whatsapp', label: 'WhatsApp' });
  }
  if (
    isMaster ||
    hasPermission(PERMISSOES.SISTEMA_EMAIL) ||
    hasPermission(PERMISSOES.SISTEMA_WHATSAPP) ||
    hasPermission(PERMISSOES.USUARIOS_GERENCIAR)
  ) {
    if (!items.some((i) => i.to === '/integracao/credenciais')) {
      items.push({ to: '/integracao/credenciais', label: 'Credenciais' });
    }
  }
  if (isMaster || hasPermission(PERMISSOES.SISTEMA_SITUACAO_API)) {
    items.push({ to: '/situacao-api', label: 'Situação da API' });
  }
  return items;
}

export function buildFinanceiroMenuForUser(hasPermission: HasPermission): FinanceiroMenuEntry[] {
  const filtered: FinanceiroMenuEntry[] = [];
  for (const entry of FINANCEIRO_MENU) {
    if (entry.kind === 'link') {
      if (podeAcessarRotaFinanceiro(entry.to, hasPermission)) filtered.push(entry);
      continue;
    }
    const children = entry.children.filter((c) => podeAcessarRotaFinanceiro(c.to, hasPermission));
    if (children.length > 0) filtered.push({ ...entry, children });
  }
  return filtered;
}

export function buildLogisticaMenuForUser(hasPermission: HasPermission): NavMenuEntry[] {
  const filtered: NavMenuEntry[] = [];
  for (const entry of LOGISTICA_MENU) {
    if (entry.kind === 'link' && entry.to === '/heatmap') {
      if (hasPermission(PERMISSOES.HEATMAP_VER)) filtered.push(entry);
      continue;
    }
    if (entry.kind === 'submenu' && entry.label === 'Cubagem') {
      const podeCubagem =
        hasPermission(PERMISSOES.LOGISTICA_VER) ||
        hasPermission(PERMISSOES.LOGISTICA_TOTAL) ||
        hasPermission(PERMISSOES.LOGISTICA_CUBAGEM_VER);
      if (podeCubagem) filtered.push(entry);
    }
  }
  return filtered;
}

/** Filtra entradas do menu PCP conforme permissões (mesma lógica do menu horizontal). */
export function filterPcpMenuChildren(
  entry: NavMenuEntry,
  hasPermission: HasPermission,
): NavMenuEntry[] {
  if (entry.kind !== 'submenu') return [];

  if (entry.label === 'Estoque') {
    return entry.children.filter(
      (c) =>
        c.kind !== 'link' ||
        c.to !== '/pedidos/consulta-estoque' ||
        hasPermission(PERMISSOES.PCP_CONSULTA_ESTOQUE_VER) ||
        hasPermission(PERMISSOES.PCP_TOTAL),
    );
  }

  if (entry.label === 'Painel Metas') {
    return entry.children.filter((c) => {
      if (c.kind !== 'link') return true;
      if (c.to === '/pedidos/painel-metas/gerencial') return podeVerPainelGerencial(hasPermission);
      if (c.to === '/pedidos/painel-metas/tv') return podeVerPainelTv(hasPermission);
      if (c.to === '/pedidos/painel-metas/metas') {
        return podeEditarPainelMetas(hasPermission) || podeVerPainelGerencial(hasPermission);
      }
      return true;
    });
  }

  return entry.children
    .map((child) => {
      if (child.kind === 'submenu' && child.label === 'Configuração') {
        const leaves = child.children.filter((leaf) => {
          if (leaf.kind !== 'link') return true;
          if (leaf.to === '/pedidos/regras-data-entrega') {
            return (
              hasPermission(PERMISSOES.PCP_REGRAS_ENTREGA_VER) ||
              hasPermission(PERMISSOES.PCP_REGRAS_ENTREGA_EDITAR) ||
              hasPermission(PERMISSOES.PCP_TOTAL)
            );
          }
          return true;
        });
        if (leaves.length === 0) return null;
        return { ...child, children: leaves };
      }
      return child;
    })
    .filter((c): c is NavMenuEntry => c != null);
}
