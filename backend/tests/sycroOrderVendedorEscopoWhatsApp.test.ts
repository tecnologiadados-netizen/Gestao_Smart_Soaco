import { describe, expect, it } from 'vitest';
import {
  codigoWhatsAppTagDisponivel,
  normalizarNomeVendedorWhatsApp,
  resolverEscopoWhatsAppPorVendedor,
} from '../src/utils/sycroOrderVendedorEscopoWhatsApp.ts';

describe('sycroOrderVendedorEscopoWhatsApp', () => {
  it('normaliza acentos e maiúsculas', () => {
    expect(normalizarNomeVendedorWhatsApp('Gold Representações')).toBe('GOLD REPRESENTACOES');
  });

  it('mapeia Loja', () => {
    expect(resolverEscopoWhatsAppPorVendedor('miriam da silva nepomuceno')).toBe('loja');
    expect(resolverEscopoWhatsAppPorVendedor('MARIA LEOPOLDINA ARAUJO MARQUES')).toBe('loja');
    expect(resolverEscopoWhatsAppPorVendedor('ROBERTO')).toBe('loja');
    expect(resolverEscopoWhatsAppPorVendedor('Roberto')).toBe('loja');
  });

  it('mapeia Indústria', () => {
    expect(resolverEscopoWhatsAppPorVendedor('ANTONIO LUIS PEREIRA DE SOUSA')).toBe('industria');
    expect(resolverEscopoWhatsAppPorVendedor('antonio luis pereira de sousa')).toBe('industria');
    expect(resolverEscopoWhatsAppPorVendedor('LARISSE NARLLA')).toBe('industria');
    expect(resolverEscopoWhatsAppPorVendedor('Gold Representações')).toBe('industria');
  });

  it('fallback Indústria quando fora da lista ou sem vendedor', () => {
    expect(resolverEscopoWhatsAppPorVendedor('ANTONIO CARLOS PEREIRA PINTO')).toBe('industria');
    expect(resolverEscopoWhatsAppPorVendedor(null)).toBe('industria');
    expect(resolverEscopoWhatsAppPorVendedor('')).toBe('industria');
  });

  it('escolhe o código do tipo SMS', () => {
    expect(codigoWhatsAppTagDisponivel(true, 'loja')).toBe('sycroorder_tag_disponivel_loja');
    expect(codigoWhatsAppTagDisponivel(false, 'industria')).toBe(
      'sycroorder_tag_indisponivel_industria'
    );
  });
});
