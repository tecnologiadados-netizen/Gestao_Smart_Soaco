import { describe, expect, it } from 'vitest';
import type { CandidatoNominatim } from '../../services/geocode.js';
import { escolherPonto, extrairPovoado, bairroGenerico, cepCompativel, singularizarLocalidade } from './geocodeLocalidade.js';

const timon: CandidatoNominatim = {
  lat: -5.1054081,
  lng: -42.820791,
  tipo: 'suburb',
  classe: 'boundary',
  nome: 'Mangueira',
  exibicao: 'Mangueira, Timon, Maranhão, Brasil',
};

const ruaFalsa: CandidatoNominatim = {
  lat: -5.0940057,
  lng: -42.7366055,
  tipo: 'road',
  classe: 'highway',
  nome: 'Rua das Mangueiras',
  exibicao: 'Rua das Mangueiras, Colorado, Teresina, Piauí, Brasil',
};

describe('geocode de bairro', () => {
  it('trata MANGUEIRAS como Mangueira', () => {
    expect(singularizarLocalidade('MANGUEIRAS')).toBe('MANGUEIRA');
    expect(singularizarLocalidade('Pedra Miuda')).toBeNull();
  });

  it('coloca Mangueiras no bairro Mangueira de Timon, e não numa rua de nome parecido', () => {
    const ponto = escolherPonto([ruaFalsa, timon], {
      cidade: 'TIMON',
      bairro: 'MANGUEIRAS',
      centro: { lat: -5.094, lng: -42.837 },
    });
    expect(ponto).toEqual({ lat: timon.lat, lng: timon.lng });
  });

  it('não aceita a sede do município no lugar de Zona Rural', () => {
    const sede: CandidatoNominatim = {
      lat: -5.608,
      lng: -42.838,
      tipo: 'administrative',
      classe: 'boundary',
      nome: 'Curralinhos',
      exibicao: 'Curralinhos, Piauí, Brasil',
    };
    const ponto = escolherPonto([sede], {
      cidade: 'CURRALINHOS',
      bairro: 'ZONA RURAL',
      logradouro: 'AV. PRINCIPAL DO POVOADO ANGELIM',
      centro: { lat: -5.608, lng: -42.838 },
    });
    expect(ponto).toBeNull();
    expect(extrairPovoado('AV. PRINCIPAL DO POVOADO ANGELIM')).toBe('ANGELIM');
    expect(bairroGenerico('ZONA RURAL')).toBe(true);
    expect(bairroGenerico('MANGUEIRAS')).toBe(false);
  });

  it('não usa CEP de outra cidade nem de outro bairro', () => {
    expect(
      cepCompativel(
        { cidade: 'Nazária', bairro: '', rua: '' },
        { cidade: 'CURRALINHOS', bairro: 'ZONA RURAL', logradouro: 'AV. PRINCIPAL DO POVOADO ANGELIM' },
      ),
    ).toBe(false);
    expect(
      cepCompativel(
        { cidade: 'Teresina', bairro: 'Santo Antônio', rua: 'Quadra 03' },
        { cidade: 'Teresina', bairro: 'VILA IRMA DULCE', logradouro: 'Rua COSMO, 2267' },
      ),
    ).toBe(false);
  });

  it('aceita a rua do mesmo bairro mesmo com grafia parecida', () => {
    const ponto = escolherPonto(
      [
        {
          lat: -5.1895083,
          lng: -42.7749794,
          tipo: 'street',
          classe: 'highway',
          nome: 'Rua Cósmico',
          exibicao: 'Rua Cósmico, Vila Irmã Dulce, Angelim, Teresina, Piauí',
        },
      ],
      {
        cidade: 'Teresina',
        bairro: 'VILA IRMA DULCE',
        logradouro: 'Rua COSMO, 2267',
        centro: { lat: -5.09, lng: -42.8 },
      },
    );
    expect(ponto).toEqual({ lat: -5.1895083, lng: -42.7749794 });
  });

  it('não aceita só a rua quando o bairro não é aquele lugar', () => {
    const ponto = escolherPonto([ruaFalsa], {
      cidade: 'TERESINA',
      bairro: 'MANGUEIRAS',
      centro: { lat: -5.09, lng: -42.8 },
    });
    expect(ponto).toBeNull();
  });

  it('descarta um ponto no meio rural de Timon quando o centro urbano está na margem do rio', () => {
    const rural: CandidatoNominatim = {
      lat: -5.174,
      lng: -43.002,
      tipo: 'village',
      classe: 'place',
      nome: 'Povoado',
      exibicao: 'Povoado, Timon, Maranhão, Brasil',
    };
    const urbano = { lat: -5.1004, lng: -42.8312 };
    expect(
      escolherPonto([rural], { cidade: 'TIMON', bairro: 'MANGUEIRAS', centro: urbano }),
    ).toBeNull();
    expect(
      escolherPonto([rural, timon], { cidade: 'TIMON', bairro: 'MANGUEIRAS', centro: urbano }),
    ).toEqual({ lat: timon.lat, lng: timon.lng });
  });
});
