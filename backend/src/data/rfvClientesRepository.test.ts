import { describe, expect, it } from 'vitest';
import { normalizeEmissaoYmd } from './historicoVendasRepository.js';
import { calcularRfvCompleto } from './rfvClientesRepository.js';
import type { VendaHistoricoRow } from './historicoVendasRepository.js';

function row(partial: Partial<VendaHistoricoRow> & Pick<VendaHistoricoRow, 'cliente' | 'dataEmissao' | 'pdId'>): VendaHistoricoRow {
  return {
    pdCodigo: 'PD-1',
    mes: '2024-06',
    vendedor: 'V1',
    uf: 'PI',
    municipio: 'Teresina',
    regiao: 'Grande THE',
    codigoProduto: 'P1',
    descricaoProduto: 'Produto',
    grupoProduto: 'Grupo',
    subgrupo1: 'S1',
    subgrupo2: 'S2',
    qtdeVendida: 1,
    valorVendido: 100,
    ...partial,
  };
}

describe('normalizeEmissaoYmd', () => {
  it('extrai YYYY-MM-DD de ISO com timezone', () => {
    expect(normalizeEmissaoYmd('2022-08-19T03:00:00.000Z')).toBe('2022-08-19');
  });

  it('aceita YYYY-MM-DD puro', () => {
    expect(normalizeEmissaoYmd('2024-12-31')).toBe('2024-12-31');
  });

  it('aceita dd/mm/aaaa', () => {
    expect(normalizeEmissaoYmd('19/08/2022')).toBe('2022-08-19');
  });

  it('aceita objeto Date', () => {
    const d = new Date(2023, 5, 15);
    expect(normalizeEmissaoYmd(d)).toBe('2023-06-15');
  });

  it('retorna null para vazio ou inválido', () => {
    expect(normalizeEmissaoYmd('')).toBeNull();
    expect(normalizeEmissaoYmd('—')).toBeNull();
    expect(normalizeEmissaoYmd('invalid')).toBeNull();
  });
});

describe('calcularRfvCompleto — última compra e recência', () => {
  it('usa a emissão mais recente do cliente e recência coerente com dataFim', () => {
    const rows: VendaHistoricoRow[] = [
      row({ cliente: 'Cliente A', pdId: 1, dataEmissao: '2022-08-19T03:00:00.000Z', valorVendido: 50 }),
      row({ cliente: 'Cliente A', pdId: 2, dataEmissao: '2024-06-01', valorVendido: 150 }),
      row({ cliente: 'Cliente B', pdId: 3, dataEmissao: '2024-06-10', valorVendido: 200 }),
    ];

    const result = calcularRfvCompleto(rows, '2024-06-30');
    const a = result.clientes.find((c) => c.cliente === 'Cliente A');
    const b = result.clientes.find((c) => c.cliente === 'Cliente B');

    expect(a?.ultimaEmissao).toBe('2024-06-01');
    expect(a?.recenciaDias).toBe(29);
    expect(b?.ultimaEmissao).toBe('2024-06-10');
    expect(b?.recenciaDias).toBe(20);
  });

  it('recência alta quando última compra no recorte é antiga', () => {
    const rows: VendaHistoricoRow[] = [
      row({ cliente: 'Cliente Antigo', pdId: 10, dataEmissao: '2022-01-15', valorVendido: 80 }),
    ];

    const result = calcularRfvCompleto(rows, '2024-06-30');
    const c = result.clientes.find((x) => x.cliente === 'Cliente Antigo');

    expect(c?.ultimaEmissao).toBe('2022-01-15');
    expect(c?.recenciaDias).toBeGreaterThan(800);
  });
});
