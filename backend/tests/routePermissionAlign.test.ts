import { describe, expect, it } from 'vitest';
import { PERMISSOES } from '../../frontend/src/config/permissoes';
import {
  KPI_PAINEIS,
  PERMISSOES_ACESSO_PAINEL_COBERTURA_ESTOQUE,
  PERMISSOES_ACESSO_PAINEL_PEDIDOS_EM_ABERTO,
  PERMISSOES_ACESSO_PAINEL_PRODUCAO_CAMASI,
} from '../../frontend/src/config/kpisCatalog';
import { ROTA_PERMISSAO, resolverPermissoesRota } from '../../frontend/src/utils/routePermission';

const LEGACY_FALLBACKS = [
  PERMISSOES.PCP_CONSULTA_ESTOQUE_VER,
  PERMISSOES.PCP_TOTAL,
  PERMISSOES.PCP_VER_TELA,
  PERMISSOES.DASHBOARD_VER,
  PERMISSOES.PEDIDOS_VER,
  PERMISSOES.PRODUCAO_VER,
  PERMISSOES.PRODUCAO_TOTAL,
] as const;

describe('kpisCatalog frontend (política estrita)', () => {
  it('painéis migrados usam somente permissão KPI específica', () => {
    const strictIds = ['cobertura-estoque', 'pedidos-em-aberto', 'producao-camasi'];
    for (const id of strictIds) {
      const painel = KPI_PAINEIS.find((p) => p.id === id);
      expect(painel?.permissoes).toHaveLength(1);
      expect(painel?.permissoes[0]).toMatch(/^kpis\.painel\./);
    }
  });

  it('constantes de rota espelham catálogo sem fallbacks legados', () => {
    const all = [
      ...PERMISSOES_ACESSO_PAINEL_COBERTURA_ESTOQUE,
      ...PERMISSOES_ACESSO_PAINEL_PEDIDOS_EM_ABERTO,
      ...PERMISSOES_ACESSO_PAINEL_PRODUCAO_CAMASI,
    ];
    for (const legacy of LEGACY_FALLBACKS) {
      expect(all).not.toContain(legacy);
    }
  });
});

describe('resolverPermissoesRota', () => {
  it('resolve match exato', () => {
    expect(resolverPermissoesRota('/pedidos/cobertura-estoque')).toEqual(
      PERMISSOES_ACESSO_PAINEL_COBERTURA_ESTOQUE
    );
  });

  it('resolve prefixo mais específico para subrotas dinâmicas', () => {
    expect(resolverPermissoesRota('/pedidos/mrp/42')).toEqual(ROTA_PERMISSAO['/pedidos/mrp']);
    expect(resolverPermissoesRota('/mind-maps/abc/editar')).toEqual(ROTA_PERMISSAO['/mind-maps']);
    expect(resolverPermissoesRota('/kpis/estoque')).toEqual(ROTA_PERMISSAO['/kpis']);
  });

  it('cobre rotas que estavam sem guard explícito', () => {
    expect(resolverPermissoesRota('/comercial/comissionamento')).toBeDefined();
    expect(resolverPermissoesRota('/pedidos/programacao-producao/recursos')).toBeDefined();
  });
});

describe('ROTA_PERMISSAO cobertura', () => {
  const rotasProtegidas = [
    '/pedidos/cobertura-estoque',
    '/pedidos/dash-entregas',
    '/producao/camasi',
    '/comercial/comissionamento',
    '/pedidos/programacao-producao/recursos',
  ];

  it.each(rotasProtegidas)('%s tem permissões definidas', (rota) => {
    expect(ROTA_PERMISSAO[rota]?.length).toBeGreaterThan(0);
  });
});
