import { PERMISSOES } from '../config/permissoes';
import type { CodigoPermissao } from '../config/permissoes';
import { PERMISSOES_ACESSO_FLUXOS } from './fluxosPermissoes';
import { PERMISSOES_ACESSO_PROGRAMACAO_PRODUCAO } from './programacaoProducaoPermissoes';
import { PERMISSOES_ROTA_SUPORTE_CHAMADOS } from './suportePermissoes';
import {
  PERMISSOES_ACESSO_PAINEL_GERENCIAL,
  PERMISSOES_ACESSO_PAINEL_METAS,
  PERMISSOES_ACESSO_PAINEL_TV,
} from './painelProducaoPermissoes';
import {
  PERMISSOES_ACESSO_FINANCEIRO_DFC,
  PERMISSOES_ACESSO_FINANCEIRO_DRE,
  PERMISSOES_ACESSO_FINANCEIRO_PAINEL_COMERCIAL,
  PERMISSOES_ACESSO_FINANCEIRO_RENEGOCIACAO,
  PERMISSOES_ACESSO_FINANCEIRO_RESUMO,
  PERMISSOES_ACESSO_FINANCEIRO_CRM,
} from './financeiroPermissoes';

export const ROTA_PERMISSAO: Record<string, CodigoPermissao[]> = {
  '/pedidos/dash-entregas': [PERMISSOES.PCP_VER_TELA, PERMISSOES.PCP_TOTAL, PERMISSOES.DASHBOARD_VER, PERMISSOES.PEDIDOS_VER],
  '/pedidos/sequenciamento-carradas': [PERMISSOES.PCP_VER_TELA, PERMISSOES.PCP_TOTAL, PERMISSOES.PEDIDOS_VER],
  '/pedidos': [PERMISSOES.PCP_VER_TELA, PERMISSOES.PCP_TOTAL, PERMISSOES.PEDIDOS_VER],
  '/pedidos/encerrados': [PERMISSOES.PCP_VER_TELA, PERMISSOES.PCP_TOTAL, PERMISSOES.PEDIDOS_VER],
  '/pedidos/programacao-setorial': [PERMISSOES.PCP_VER_TELA, PERMISSOES.PCP_TOTAL, PERMISSOES.PEDIDOS_VER],
  '/pedidos/programacao-producao': PERMISSOES_ACESSO_PROGRAMACAO_PRODUCAO,
  '/pedidos/regras-data-entrega': [
    PERMISSOES.PCP_REGRAS_ENTREGA_VER,
    PERMISSOES.PCP_REGRAS_ENTREGA_EDITAR,
    PERMISSOES.PCP_TOTAL,
  ],
  '/pedidos/sycroorder': [PERMISSOES.COMUNICACAO_TELA_VER, PERMISSOES.COMUNICACAO_TOTAL, PERMISSOES.COMUNICACAO_VER, PERMISSOES.PEDIDOS_VER],
  '/suporte': PERMISSOES_ROTA_SUPORTE_CHAMADOS,
  '/suporte/configuracao': [PERMISSOES.SUPORTE_CONFIGURAR],
  '/pedidos/mrp': [PERMISSOES.PCP_VER_TELA, PERMISSOES.PCP_TOTAL, PERMISSOES.PEDIDOS_VER],
  '/pedidos/mrp-produtos-em-processo': [PERMISSOES.PCP_VER_TELA, PERMISSOES.PCP_TOTAL, PERMISSOES.PEDIDOS_VER],
  '/pedidos/mrp-dashboard': [PERMISSOES.PCP_VER_TELA, PERMISSOES.PCP_TOTAL, PERMISSOES.PEDIDOS_VER],
  '/pedidos/mpp': [PERMISSOES.PCP_VER_TELA, PERMISSOES.PCP_TOTAL, PERMISSOES.PEDIDOS_VER],
  '/pedidos/ressup-almox': [PERMISSOES.PCP_VER_TELA, PERMISSOES.PCP_TOTAL, PERMISSOES.PEDIDOS_VER],
  '/pedidos/ressup-nao-almox': [PERMISSOES.PCP_VER_TELA, PERMISSOES.PCP_TOTAL, PERMISSOES.PEDIDOS_VER],
  '/pedidos/consulta-estoque': [PERMISSOES.PCP_CONSULTA_ESTOQUE_VER, PERMISSOES.PCP_TOTAL],
  '/pedidos/painel-metas/gerencial': PERMISSOES_ACESSO_PAINEL_GERENCIAL,
  '/pedidos/painel-metas/tv': PERMISSOES_ACESSO_PAINEL_TV,
  '/pedidos/painel-metas/metas': [
    ...PERMISSOES_ACESSO_PAINEL_METAS,
    ...PERMISSOES_ACESSO_PAINEL_GERENCIAL,
  ],
  '/heatmap': [PERMISSOES.HEATMAP_VER],
  '/mind-maps': PERMISSOES_ACESSO_FLUXOS,
  '/compras': [PERMISSOES.COMPRAS_VER],
  '/compras/dashboard': [PERMISSOES.COMPRAS_VER],
  '/compras/coletas-precos': [PERMISSOES.COMPRAS_VER],
  '/compras/pre-compra': [PERMISSOES.COMPRAS_VER],
  '/compras/rotina/pendencias': [PERMISSOES.COMPRAS_VER],
  '/engenharia': [PERMISSOES.PRECIFICACAO_VER],
  '/engenharia/precificacao': [PERMISSOES.PRECIFICACAO_VER],
  '/qualidade': [PERMISSOES.QUALIDADE_VER],
  '/qualidade/documentos': [PERMISSOES.QUALIDADE_VER],
  '/qualidade/calibracoes': [PERMISSOES.QUALIDADE_VER],
  '/qualidade/registros': [PERMISSOES.QUALIDADE_VER],
  '/qualidade/configuracoes': [PERMISSOES.QUALIDADE_VER],
  '/financeiro': PERMISSOES_ACESSO_FINANCEIRO_RESUMO,
  '/financeiro/resumo': PERMISSOES_ACESSO_FINANCEIRO_RESUMO,
  '/financeiro/dfc': PERMISSOES_ACESSO_FINANCEIRO_DFC,
  '/financeiro/dre': PERMISSOES_ACESSO_FINANCEIRO_DRE,
  '/financeiro/painel-financeiro-comercial': PERMISSOES_ACESSO_FINANCEIRO_PAINEL_COMERCIAL,
  '/financeiro/renegociacao-contratos': PERMISSOES_ACESSO_FINANCEIRO_RENEGOCIACAO,
  '/financeiro/crm': PERMISSOES_ACESSO_FINANCEIRO_CRM,
  '/logistica/cubagem/veiculos': [PERMISSOES.LOGISTICA_VER, PERMISSOES.LOGISTICA_TOTAL, PERMISSOES.LOGISTICA_CUBAGEM_VER],
  '/logistica/cubagem/produtos': [PERMISSOES.LOGISTICA_VER, PERMISSOES.LOGISTICA_TOTAL, PERMISSOES.LOGISTICA_CUBAGEM_VER],
  '/logistica/cubagem/simulacao': [PERMISSOES.LOGISTICA_VER, PERMISSOES.LOGISTICA_TOTAL, PERMISSOES.LOGISTICA_CUBAGEM_VER],
  '/relatorios': [PERMISSOES.RELATORIOS_VER],
  '/integracao': [PERMISSOES.INTEGRACAO_VER],
  '/integracao/alteracao-data-entrega-compra': [PERMISSOES.INTEGRACAO_VER],
  '/integracao/faturamento-diario': [PERMISSOES.INTEGRACAO_VER],
  '/integracao/pedidos-entrega-vencida': [PERMISSOES.INTEGRACAO_VER],
  '/integracao/sms': [PERMISSOES.INTEGRACAO_VER],
  '/integracao/credenciais': [
    PERMISSOES.INTEGRACAO_VER,
    PERMISSOES.SISTEMA_EMAIL,
    PERMISSOES.SISTEMA_WHATSAPP,
    PERMISSOES.USUARIOS_GERENCIAR,
  ],
  '/integracao/credenciais/email': [PERMISSOES.SISTEMA_EMAIL, PERMISSOES.USUARIOS_GERENCIAR],
  '/usuarios': [PERMISSOES.USUARIOS_TELA_VER, PERMISSOES.USUARIOS_TOTAL, PERMISSOES.GRUPOS_TELA_VER, PERMISSOES.GRUPOS_TOTAL, PERMISSOES.USUARIOS_GERENCIAR],
  '/situacao-api': [PERMISSOES.SISTEMA_SITUACAO_API, PERMISSOES.DASHBOARD_VER],
  '/whatsapp': [PERMISSOES.SISTEMA_WHATSAPP, PERMISSOES.USUARIOS_GERENCIAR],
};

/** @deprecated Rotas agora usam permissões em ROTA_PERMISSAO; mantido para compatibilidade. */
export const ROTAS_APENAS_MASTER = ['/situacao-api', '/whatsapp'];

export const ROTAS_ORDEM = [
  '/pedidos/dash-entregas',
  '/pedidos',
  '/pedidos/encerrados',
  '/pedidos/programacao-setorial',
  '/pedidos/programacao-producao',
  '/pedidos/sycroorder',
  '/suporte',
  '/suporte/configuracao',
  '/pedidos/mrp-dashboard',
  '/pedidos/mrp',
  '/pedidos/mrp-produtos-em-processo',
  '/pedidos/mpp',
  '/pedidos/ressup-almox',
  '/pedidos/ressup-nao-almox',
  '/pedidos/consulta-estoque',
  '/heatmap',
  '/mind-maps',
  '/compras',
  '/compras/dashboard',
  '/compras/coletas-precos',
  '/compras/pre-compra',
  '/compras/rotina/pendencias',
  '/engenharia',
  '/engenharia/precificacao',
  '/qualidade',
  '/qualidade/documentos',
  '/financeiro',
  '/financeiro/resumo',
  '/financeiro/dfc',
  '/financeiro/dre',
  '/financeiro/painel-financeiro-comercial',
  '/financeiro/renegociacao-contratos',
  '/financeiro/crm',
  '/logistica/cubagem/veiculos',
  '/logistica/cubagem/produtos',
  '/logistica/cubagem/simulacao',
  '/relatorios',
  '/integracao',
  '/integracao/alteracao-data-entrega-compra',
  '/integracao/faturamento-diario',
  '/integracao/pedidos-entrega-vencida',
  '/integracao/sms',
  '/integracao/credenciais',
  '/integracao/credenciais/email',
  '/usuarios',
  '/situacao-api',
  '/whatsapp',
] as const;

export function primeiraRotaPermitida(hasPermission: (codigo: CodigoPermissao) => boolean, _isMaster = false): string | null {
  for (const path of ROTAS_ORDEM) {
    const perms = ROTA_PERMISSAO[path];
    if (perms && perms.some((p) => hasPermission(p))) return path;
  }
  return null;
}

export function primeiraRotaPermitidaPorPermissoes(permissoes: string[], isMaster = false): string | null {
  const hasPermission = (codigo: CodigoPermissao) => isMaster || permissoes.includes(codigo);
  return primeiraRotaPermitida(hasPermission, isMaster);
}
