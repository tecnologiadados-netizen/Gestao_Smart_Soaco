import { describe, expect, it } from 'vitest';
import type { VendaPainelRow } from '../src/data/painelComercialVendasRepository.js';

function agg(rows: VendaPainelRow[]): { valor: number; qtde: number; pds: number } {
  let valor = 0;
  let qtde = 0;
  const pds = new Set<number>();
  for (const r of rows) {
    valor += r.valorVendido;
    qtde += r.qtdeVendida;
    if (r.pdId > 0) pds.add(r.pdId);
  }
  return { valor, qtde, pds: pds.size };
}

describe('painelComercialVendasRepository (agregações)', () => {
  it('soma consolidada bate com soma do detalhe filtrado', () => {
    const rows: VendaPainelRow[] = [
      {
        pdId: 1,
        pdCodigo: 'PD-1',
        dataEmissao: '2026-06-01',
        mes: '2026-06',
        cliente: 'Cliente A',
        vendedor: 'Vendedor 1',
        uf: 'PI',
        municipio: 'Teresina',
        regiao: 'Grande THE',
        codigoProduto: 'P1',
        descricaoProduto: 'Produto 1',
        grupoProduto: 'Grupo X',
        subgrupo1: 'S1',
        subgrupo2: 'S2',
        qtdeVendida: 2,
        valorVendido: 100,
      },
      {
        pdId: 2,
        pdCodigo: 'PD-2',
        dataEmissao: '2026-06-05',
        mes: '2026-06',
        cliente: 'Cliente B',
        vendedor: 'Vendedor 1',
        uf: 'MA',
        municipio: 'Caxias',
        regiao: 'Outras regiões',
        codigoProduto: 'P2',
        descricaoProduto: 'Produto 2',
        grupoProduto: 'Grupo Y',
        subgrupo1: 'S9',
        subgrupo2: 'S8',
        qtdeVendida: 1,
        valorVendido: 50,
      },
    ];

    const total = agg(rows);
    const filtroVendedor1 = rows.filter((r) => r.vendedor === 'Vendedor 1');
    const totalFiltrado = agg(filtroVendedor1);

    expect(totalFiltrado.valor).toBe(total.valor);
    expect(totalFiltrado.qtde).toBe(total.qtde);
    expect(totalFiltrado.pds).toBe(total.pds);
  });
});

