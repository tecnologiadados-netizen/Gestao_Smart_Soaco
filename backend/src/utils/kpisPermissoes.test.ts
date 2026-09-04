import { describe, expect, it } from 'vitest';
import { PERMISSOES } from '../config/permissoes.js';
import {
  PERMISSOES_ACESSO_PAINEL_COBERTURA_ESTOQUE,
  PERMISSOES_ACESSO_PAINEL_PEDIDOS_EM_ABERTO,
  PERMISSOES_ACESSO_PAINEL_PRODUCAO_CAMASI,
} from './kpisPermissoes.js';

const LEGACY_FALLBACKS = [
  PERMISSOES.PCP_CONSULTA_ESTOQUE_VER,
  PERMISSOES.PCP_TOTAL,
  PERMISSOES.PCP_VER_TELA,
  PERMISSOES.DASHBOARD_VER,
  PERMISSOES.PEDIDOS_VER,
  PERMISSOES.PRODUCAO_VER,
  PERMISSOES.PRODUCAO_TOTAL,
] as const;

const PERMISSOES_CONSULTA_ESTOQUE = [
  PERMISSOES.PCP_CONSULTA_ESTOQUE_VER,
  PERMISSOES.PCP_TOTAL,
] as const;

describe('kpisPermissoes (política estrita)', () => {
  it('cada painel KPI migrado tem exatamente uma permissão', () => {
    expect(PERMISSOES_ACESSO_PAINEL_COBERTURA_ESTOQUE).toEqual([
      PERMISSOES.KPIS_PAINEL_COBERTURA_ESTOQUE_VER,
    ]);
    expect(PERMISSOES_ACESSO_PAINEL_PEDIDOS_EM_ABERTO).toEqual([
      PERMISSOES.KPIS_PAINEL_PEDIDOS_EM_ABERTO_VER,
    ]);
    expect(PERMISSOES_ACESSO_PAINEL_PRODUCAO_CAMASI).toEqual([
      PERMISSOES.KPIS_PAINEL_PRODUCAO_CAMASI_VER,
    ]);
  });

  it('não inclui fallbacks PCP/Produção legados', () => {
    const all = [
      ...PERMISSOES_ACESSO_PAINEL_COBERTURA_ESTOQUE,
      ...PERMISSOES_ACESSO_PAINEL_PEDIDOS_EM_ABERTO,
      ...PERMISSOES_ACESSO_PAINEL_PRODUCAO_CAMASI,
    ];
    for (const legacy of LEGACY_FALLBACKS) {
      expect(all).not.toContain(legacy);
    }
  });

  it('cobertura e consulta de estoque não compartilham permissões', () => {
    for (const perm of PERMISSOES_ACESSO_PAINEL_COBERTURA_ESTOQUE) {
      expect(PERMISSOES_CONSULTA_ESTOQUE).not.toContain(perm);
    }
    for (const perm of PERMISSOES_CONSULTA_ESTOQUE) {
      expect(PERMISSOES_ACESSO_PAINEL_COBERTURA_ESTOQUE).not.toContain(perm);
    }
  });
});
