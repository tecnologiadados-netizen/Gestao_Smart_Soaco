import { PERMISSOES, type CodigoPermissao } from './permissoes';

export type KpiPainelDef = {
  id: string;
  pastaId: string;
  label: string;
  /** Nome curto na capa do card */
  capaTitulo: string;
  to: string;
  /** Qualquer uma destas permissões libera o card/rota do painel */
  permissoes: CodigoPermissao[];
};

export type KpiPastaDef = {
  id: string;
  label: string;
  descricao?: string;
};

/** Pastas do hub KPIs (ordem de exibição). */
export const KPI_PASTAS: KpiPastaDef[] = [
  {
    id: 'producao',
    label: 'Produção',
    descricao: 'Painéis e indicadores de chão de fábrica',
  },
  {
    id: 'comercial',
    label: 'Comercial',
    descricao: 'Painéis e indicadores comerciais',
  },
  {
    id: 'estoque',
    label: 'Estoque',
    descricao: 'Cobertura, ruptura e posição de estoque',
  },
];

/** Painéis do hub KPIs. Novos painéis entram aqui e saem do menu lateral. */
export const KPI_PAINEIS: KpiPainelDef[] = [
  {
    id: 'producao-camasi',
    pastaId: 'producao',
    label: 'Produção Camasi',
    capaTitulo: 'PRODUÇÃO CAMASI',
    to: '/producao/camasi',
    permissoes: [
      PERMISSOES.KPIS_PAINEL_PRODUCAO_CAMASI_VER,
      PERMISSOES.PRODUCAO_VER,
      PERMISSOES.PRODUCAO_TOTAL,
    ],
  },
  {
    id: 'pedidos-em-aberto',
    pastaId: 'comercial',
    label: 'Painel Pedidos em aberto',
    capaTitulo: 'PEDIDOS EM ABERTO',
    to: '/pedidos/dash-entregas',
    permissoes: [
      PERMISSOES.KPIS_PAINEL_PEDIDOS_EM_ABERTO_VER,
      PERMISSOES.PCP_VER_TELA,
      PERMISSOES.PCP_TOTAL,
      PERMISSOES.DASHBOARD_VER,
      PERMISSOES.PEDIDOS_VER,
    ],
  },
  {
    id: 'painel-comercial',
    pastaId: 'comercial',
    label: 'Painel Comercial',
    capaTitulo: 'PAINEL COMERCIAL',
    to: '/comercial/painel',
    permissoes: [PERMISSOES.COMERCIAL_VER, PERMISSOES.COMERCIAL_PAINEL_VER],
  },
  {
    id: 'historico-vendas',
    pastaId: 'comercial',
    label: 'Histórico de Vendas',
    capaTitulo: 'HISTÓRICO DE VENDAS',
    to: '/comercial/historico-vendas',
    permissoes: [PERMISSOES.COMERCIAL_VER, PERMISSOES.COMERCIAL_HISTORICO_VENDAS_VER],
  },
  {
    id: 'classificacao-rfv',
    pastaId: 'comercial',
    label: 'Classificação RFV',
    capaTitulo: 'CLASSIFICAÇÃO RFV',
    to: '/comercial/classificacao-rfv',
    permissoes: [PERMISSOES.COMERCIAL_VER, PERMISSOES.COMERCIAL_RFV_VER],
  },
  {
    id: 'analise-comissionamento',
    pastaId: 'comercial',
    label: 'Análise de Comissionamento',
    capaTitulo: 'COMISSIONAMENTO',
    to: '/comercial/comissionamento',
    permissoes: [PERMISSOES.COMERCIAL_VER, PERMISSOES.COMERCIAL_COMISSIONAMENTO_VER],
  },
  {
    id: 'cobertura-estoque',
    pastaId: 'estoque',
    label: 'Cobertura de Estoque',
    capaTitulo: 'COBERTURA ESTOQUE',
    to: '/pedidos/cobertura-estoque',
    permissoes: [
      PERMISSOES.KPIS_PAINEL_COBERTURA_ESTOQUE_VER,
      PERMISSOES.PCP_CONSULTA_ESTOQUE_VER,
      PERMISSOES.PCP_TOTAL,
    ],
  },
];

export type HasPermissionFn = (codigo: CodigoPermissao) => boolean;

export function podeVerKpiPainel(painel: KpiPainelDef, hasPermission: HasPermissionFn): boolean {
  return painel.permissoes.some((p) => hasPermission(p));
}

export function listarPaineisDaPasta(
  pastaId: string,
  hasPermission: HasPermissionFn
): KpiPainelDef[] {
  return KPI_PAINEIS.filter((p) => p.pastaId === pastaId && podeVerKpiPainel(p, hasPermission));
}

export function listarPastasVisiveis(hasPermission: HasPermissionFn): KpiPastaDef[] {
  return KPI_PASTAS.filter((pasta) => listarPaineisDaPasta(pasta.id, hasPermission).length > 0);
}

export function getKpiPasta(pastaId: string): KpiPastaDef | undefined {
  return KPI_PASTAS.find((p) => p.id === pastaId);
}

export function getKpiPainel(painelId: string): KpiPainelDef | undefined {
  return KPI_PAINEIS.find((p) => p.id === painelId);
}

export function pastaHubPath(pastaId: string): string {
  return `/kpis/${pastaId}`;
}

/** Qualquer painel liberado OU kpis.ver → acesso ao hub. */
export function podeAcessarHubKpis(hasPermission: HasPermissionFn): boolean {
  if (hasPermission(PERMISSOES.KPIS_VER)) return true;
  return KPI_PAINEIS.some((p) => podeVerKpiPainel(p, hasPermission));
}

function uniqPermissoes(list: CodigoPermissao[]): CodigoPermissao[] {
  return [...new Set(list)];
}

/** Permissões aceitas na rota /kpis (e pastas) — hub + qualquer painel do catálogo. */
export const PERMISSOES_ACESSO_HUB_KPIS: CodigoPermissao[] = uniqPermissoes([
  PERMISSOES.KPIS_VER,
  ...KPI_PAINEIS.flatMap((p) => p.permissoes),
]);

/** Permissões da rota do painel Produção Camasi. */
export const PERMISSOES_ACESSO_PAINEL_PRODUCAO_CAMASI: CodigoPermissao[] =
  getKpiPainel('producao-camasi')?.permissoes ?? [
    PERMISSOES.KPIS_PAINEL_PRODUCAO_CAMASI_VER,
    PERMISSOES.PRODUCAO_VER,
    PERMISSOES.PRODUCAO_TOTAL,
  ];

/** Permissões da rota do painel Pedidos em aberto. */
export const PERMISSOES_ACESSO_PAINEL_PEDIDOS_EM_ABERTO: CodigoPermissao[] =
  getKpiPainel('pedidos-em-aberto')?.permissoes ?? [
    PERMISSOES.KPIS_PAINEL_PEDIDOS_EM_ABERTO_VER,
    PERMISSOES.PCP_VER_TELA,
    PERMISSOES.PCP_TOTAL,
    PERMISSOES.DASHBOARD_VER,
    PERMISSOES.PEDIDOS_VER,
  ];

/** Permissões da rota do painel Cobertura de Estoque. */
export const PERMISSOES_ACESSO_PAINEL_COBERTURA_ESTOQUE: CodigoPermissao[] =
  getKpiPainel('cobertura-estoque')?.permissoes ?? [
    PERMISSOES.KPIS_PAINEL_COBERTURA_ESTOQUE_VER,
    PERMISSOES.PCP_CONSULTA_ESTOQUE_VER,
    PERMISSOES.PCP_TOTAL,
  ];

/** Permissões da rota do Painel Comercial. */
export const PERMISSOES_ACESSO_PAINEL_COMERCIAL_KPI: CodigoPermissao[] =
  getKpiPainel('painel-comercial')?.permissoes ?? [
    PERMISSOES.COMERCIAL_VER,
    PERMISSOES.COMERCIAL_PAINEL_VER,
  ];

/** Permissões da rota do Histórico de Vendas. */
export const PERMISSOES_ACESSO_PAINEL_HISTORICO_VENDAS: CodigoPermissao[] =
  getKpiPainel('historico-vendas')?.permissoes ?? [
    PERMISSOES.COMERCIAL_VER,
    PERMISSOES.COMERCIAL_HISTORICO_VENDAS_VER,
  ];

/** Permissões da rota Classificação RFV. */
export const PERMISSOES_ACESSO_PAINEL_RFV: CodigoPermissao[] =
  getKpiPainel('classificacao-rfv')?.permissoes ?? [
    PERMISSOES.COMERCIAL_VER,
    PERMISSOES.COMERCIAL_RFV_VER,
  ];

/** Permissões da rota Análise de Comissionamento. */
export const PERMISSOES_ACESSO_PAINEL_COMISSIONAMENTO: CodigoPermissao[] =
  getKpiPainel('analise-comissionamento')?.permissoes ?? [
    PERMISSOES.COMERCIAL_VER,
    PERMISSOES.COMERCIAL_COMISSIONAMENTO_VER,
  ];
