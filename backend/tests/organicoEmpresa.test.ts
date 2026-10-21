import { describe, expect, it } from 'vitest';
import {
  normalizeEmpresaTabName,
  resolveEmpresaFromOrganicoCells,
  resolveEmpresaTabFromSecullumFuncionario,
} from '../../frontend/src/modules/rh/lib/organico-empresa';
import { shouldIncludeOrganicoRepresentante } from '../../frontend/src/modules/rh/lib/organico-representantes-policy';

describe('abas de empresa do Orgânico', () => {
  it('não junta móveis, loja e refrigeração dentro de Só Aço', () => {
    expect(normalizeEmpresaTabName('SÓ AÇO INDUSTRIAL LTDA')).toBe('SÓ AÇO INDUSTRIAL LTDA');
    expect(normalizeEmpresaTabName('SÓ AÇO MÓVEIS LTDA')).toBe('SÓ MÓVEIS');
    expect(normalizeEmpresaTabName('SÓ AÇO - LOJA')).toBe('LOJA');
    expect(normalizeEmpresaTabName('SÓ AÇO REFRIGERAÇÃO')).toBe('SO REFRIGERAÇÃO');
    expect(normalizeEmpresaTabName('R N MARQUES ARAUJO')).toBe('R N MARQUES ARAUJO');
  });

  it('setor ou área específica vence o nome genérico da Só Aço', () => {
    expect(
      resolveEmpresaTabFromSecullumFuncionario({
        empresaNome: 'SÓ AÇO INDUSTRIAL LTDA',
        setor: 'LOJA - ADMINISTRATIVO',
        area: 'ADMINISTRATIVO',
      }),
    ).toBe('LOJA');
    expect(
      resolveEmpresaTabFromSecullumFuncionario({
        empresaNome: 'SÓ AÇO INDUSTRIAL LTDA',
        setor: 'PINTURA',
        area: 'PRODUÇÃO',
      }),
    ).toBe('SÓ AÇO INDUSTRIAL LTDA');
    expect(
      resolveEmpresaFromOrganicoCells({
        setor: 'BALCÃO',
        area: 'LOJA',
        diretoria: 'SÓ AÇO INDUSTRIAL LTDA',
      }),
    ).toBe('LOJA');
  });
});

describe('representantes do Orgânico', () => {
  it('tira empresa interna do grupo da lista de representantes', () => {
    expect(shouldIncludeOrganicoRepresentante('Controle de estoque - Só Aço', 'Controle de estoque - Só Aço')).toBe(false);
    expect(shouldIncludeOrganicoRepresentante('SO MOVEIS', 'SÓ MOVEIS LTDA')).toBe(false);
    expect(shouldIncludeOrganicoRepresentante('SO ACO INDUSTRIAL LTDA', 'SO ACO INDUSTRIAL LTDA')).toBe(false);
    expect(shouldIncludeOrganicoRepresentante('HENRIQUE REPRESENTAÇÃO LTDA', 'HENRIQUE REPRESENTAÇÃO LTDA')).toBe(true);
    expect(shouldIncludeOrganicoRepresentante('ANTONIO CARLOS PEREIRA PINTO', 'ANTONIO CARLOS PEREIRA PINTO')).toBe(true);
  });
});
