import { PERMISSOES, type CodigoPermissao } from '../config/permissoes';
import {
  PCP_MENU,
  COMUNICACAO_INTERNA_SUBMENUS,
  COMPRAS_SUBMENUS,
  ENGENHARIA_SUBMENUS,
  QUALIDADE_MENU,
  GESTAO_USUARIOS_SUBMENUS,
  PATH_LABELS,
  type FinanceiroMenuEntry,
  type NavMenuEntry,
  filterPcpMenuChildren,
  buildIntegracaoSubmenusForUser,
  buildFinanceiroMenuForUser,
  buildLogisticaMenuForUser,
} from '../config/navigationMenu';
import { PERMISSOES_ACESSO_PROGRAMACAO_PRODUCAO } from './programacaoProducaoPermissoes';
import { podeVerMenuFinanceiro } from './financeiroPermissoes';
import { podeAcessarRotaChamadosSuporte, podeConfigurarSuporte } from './suportePermissoes';
import { ROTA_PERMISSAO } from './routePermission';
import { criarMatcherTextoLivre, normalizarTextoBusca } from './textoLivreBusca';

export type TelaBuscaRapida = {
  path: string;
  label: string;
  /** Caminho no menu (ex.: PCP › Estoque) para exibição e busca. */
  contexto?: string;
};

type HasPermission = (codigo: CodigoPermissao) => boolean;

export type BuildTelasBuscaRapidaCtx = {
  hasPermission: HasPermission;
  isMaster: boolean;
  grupo?: string | null;
};

function flattenNavMenu(
  entries: NavMenuEntry[],
  hasPermission: HasPermission,
  contexto = '',
  pcpPrefix = false,
): TelaBuscaRapida[] {
  const out: TelaBuscaRapida[] = [];
  for (const entry of entries) {
    if (entry.kind === 'link') {
      out.push({ path: entry.to, label: entry.label, contexto: contexto || undefined });
      continue;
    }
    const children =
      pcpPrefix && (entry.label === 'Estoque' || entry.label === 'Programação')
        ? filterPcpMenuChildren(entry, hasPermission)
        : entry.children;
    const ctx = contexto ? `${contexto} › ${entry.label}` : entry.label;
    out.push(...flattenNavMenu(children, hasPermission, ctx, pcpPrefix));
  }
  return out;
}

function flattenFinanceiroMenu(entries: FinanceiroMenuEntry[], contexto = 'Financeiro'): TelaBuscaRapida[] {
  const out: TelaBuscaRapida[] = [];
  for (const entry of entries) {
    if (entry.kind === 'link') {
      out.push({ path: entry.to, label: entry.label, contexto });
      continue;
    }
    const ctx = `${contexto} › ${entry.label}`;
    for (const child of entry.children) {
      out.push({ path: child.to, label: child.label, contexto: ctx });
    }
  }
  return out;
}

function rotaPermitida(path: string, hasPermission: HasPermission): boolean {
  if (path === '/pedidos/programacao-producao/recursos') {
    return PERMISSOES_ACESSO_PROGRAMACAO_PRODUCAO.some((p) => hasPermission(p));
  }
  if (path === '/usuarios/grupos') {
    return hasPermission(PERMISSOES.USUARIOS_GERENCIAR);
  }
  const perms = ROTA_PERMISSAO[path];
  if (!perms) return false;
  return perms.some((p) => hasPermission(p));
}

/** Monta lista de telas que o usuário pode abrir (alinhada ao menu lateral + rotas acessíveis). */
export function buildTelasBuscaRapidaForUser(ctx: BuildTelasBuscaRapidaCtx): TelaBuscaRapida[] {
  const { hasPermission, isMaster, grupo } = ctx;
  const telas: TelaBuscaRapida[] = [];

  if (hasPermission(PERMISSOES.PCP_VER_TELA)) {
    telas.push(...flattenNavMenu(PCP_MENU, hasPermission, 'PCP', true));
  }

  const logisticaMenu = buildLogisticaMenuForUser(hasPermission);
  if (logisticaMenu.length > 0) {
    telas.push(...flattenNavMenu(logisticaMenu, hasPermission, 'Logística'));
  }

  if (hasPermission(PERMISSOES.COMUNICACAO_TELA_VER)) {
    for (const item of COMUNICACAO_INTERNA_SUBMENUS) {
      telas.push({ ...item, contexto: 'Comunicação interna' });
    }
  }

  if (hasPermission(PERMISSOES.FLUXOS_VER) || hasPermission(PERMISSOES.FLUXOS_EDITAR)) {
    telas.push({ path: '/mind-maps', label: PATH_LABELS['/mind-maps'] ?? 'Fluxos Decisórios' });
  }

  if (hasPermission(PERMISSOES.COMPRAS_VER)) {
    for (const item of COMPRAS_SUBMENUS) {
      telas.push({ ...item, contexto: 'Compras' });
    }
  }

  if (hasPermission(PERMISSOES.PRECIFICACAO_VER)) {
    for (const item of ENGENHARIA_SUBMENUS) {
      telas.push({ ...item, contexto: 'Engenharia' });
    }
  }

  if (hasPermission(PERMISSOES.QUALIDADE_VER)) {
    telas.push(...flattenNavMenu(QUALIDADE_MENU, hasPermission, 'Qualidade'));
  }

  if (podeVerMenuFinanceiro(hasPermission)) {
    telas.push(...flattenFinanceiroMenu(buildFinanceiroMenuForUser(hasPermission)));
  }

  const integracaoItems = buildIntegracaoSubmenusForUser(hasPermission, isMaster, grupo);
  for (const item of integracaoItems) {
    telas.push({ ...item, contexto: 'Integração' });
  }

  if (hasPermission(PERMISSOES.USUARIOS_GERENCIAR)) {
    for (const item of GESTAO_USUARIOS_SUBMENUS) {
      telas.push({ ...item, contexto: 'Gestão de usuários' });
    }
  }

  if (podeAcessarRotaChamadosSuporte(hasPermission)) {
    telas.push({ path: '/suporte', label: PATH_LABELS['/suporte'] ?? 'Chamados', contexto: 'Suporte' });
  }
  if (podeConfigurarSuporte(isMaster, hasPermission)) {
    telas.push({
      path: '/suporte/configuracao',
      label: PATH_LABELS['/suporte/configuracao'] ?? 'Configurações de suporte',
      contexto: 'Suporte',
    });
  }

  if (hasPermission(PERMISSOES.RELATORIOS_VER)) {
    telas.push({ path: '/relatorios', label: PATH_LABELS['/relatorios'] ?? 'Relatórios' });
  }

  // Rotas acessíveis por permissão mas fora dos submenus visíveis (ex.: integração).
  const pathsJaIncluidos = new Set(telas.map((t) => t.path));
  for (const [path, label] of Object.entries(PATH_LABELS)) {
    if (path === '/' || path === '/sem-acesso' || pathsJaIncluidos.has(path)) continue;
    if (!rotaPermitida(path, hasPermission)) continue;
    telas.push({ path, label });
  }

  const porPath = new Map<string, TelaBuscaRapida>();
  for (const tela of telas) {
    if (!porPath.has(tela.path)) porPath.set(tela.path, tela);
  }
  return [...porPath.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

function textoBuscaTela(tela: TelaBuscaRapida): string {
  return tela.contexto ? `${tela.label} ${tela.contexto}` : tela.label;
}

function pontuarSimilaridade(termo: string, tela: TelaBuscaRapida): number {
  const matcher = criarMatcherTextoLivre(termo);
  const texto = textoBuscaTela(tela);
  if (!matcher(texto)) return -1;

  const t = normalizarTextoBusca(termo.replace(/%/g, ''));
  if (!t) return 0;

  const labelNorm = normalizarTextoBusca(tela.label);
  const textoNorm = normalizarTextoBusca(texto);

  if (labelNorm === t) return 100;
  if (labelNorm.startsWith(t)) return 90;
  if (textoNorm.startsWith(t)) return 85;

  const idxLabel = labelNorm.indexOf(t);
  if (idxLabel >= 0) return 70 - Math.min(idxLabel, 40);

  const idxTexto = textoNorm.indexOf(t);
  return 50 - Math.min(idxTexto, 40);
}

const MAX_SUGESTOES = 10;

/** Filtra e ordena telas por similaridade ao termo digitado. */
export function filtrarTelasBuscaRapida(telas: TelaBuscaRapida[], termo: string): TelaBuscaRapida[] {
  const t = termo.trim();
  if (!t) return [];

  return telas
    .map((tela) => ({ tela, score: pontuarSimilaridade(t, tela) }))
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score || a.tela.label.localeCompare(b.tela.label, 'pt-BR'))
    .slice(0, MAX_SUGESTOES)
    .map((x) => x.tela);
}
