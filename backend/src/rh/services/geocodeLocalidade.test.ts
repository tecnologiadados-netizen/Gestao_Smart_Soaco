import { describe, expect, it } from 'vitest';
import type { CandidatoNominatim } from '../../services/geocode.js';
import {
  aninhadoEmOutroLugar,
  escolherPonto,
  extrairPovoado,
  bairroGenerico,
  cepCompativel,
  cepCoordenadaEhSedeDaCidade,
  cepGenerico,
  consultasDaLocalidade,
  consultasGoogleDaLocalidade,
  expandirLogradouro,
  tokenConfere,
  interpretarCepAwesome,
  interpretarCepBrasilApi,
  logradouroFraco,
  pontoDoCep,
  pontoDoResultadoGoogle,
  pontoBairroOsmConhecido,
  pontoForaDaCidade,
  pontoDoResultadoPlaces,
  singularizarLocalidade,
} from './geocodeLocalidade.js';

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

  it('descarta coordenada de CEP quando ela é só a sede do município', () => {
    const sedeTeresina = { lat: -5.08917, lng: -42.80194 };
    expect(
      cepCoordenadaEhSedeDaCidade(sedeTeresina, { lat: -5.0892, lng: -42.8016 }, 'ESPLANADA'),
    ).toBe(true);
    expect(
      cepCoordenadaEhSedeDaCidade({ lat: -5.19247, lng: -42.75473 }, { lat: -5.0892, lng: -42.8016 }, 'ESPLANADA'),
    ).toBe(false);
    expect(cepCoordenadaEhSedeDaCidade(sedeTeresina, { lat: -5.0892, lng: -42.8016 }, 'CENTRO')).toBe(false);
  });

  it('usa o CEP 64039-546 na Esplanada, não no centro de Teresina', () => {
    const centro = { lat: -5.0892, lng: -42.8016 };
    const awesome = interpretarCepAwesome({
      lat: '-5.1935693',
      lng: '-42.7418148',
      city: 'Teresina',
      district: 'Esplanada',
      address: 'Quadra J2',
    });
    expect(awesome).toEqual({
      lat: -5.1935693,
      lng: -42.7418148,
      cidade: 'Teresina',
      bairro: 'Esplanada',
      rua: 'Quadra J2',
    });
    expect(
      pontoDoCep(
        awesome!,
        { cidade: 'Teresina', bairro: 'ESPLANADA', logradouro: 'QD J2' },
        centro,
      ),
    ).toEqual({ lat: -5.1935693, lng: -42.7418148 });

    const brasilapi = interpretarCepBrasilApi({
      city: 'Teresina',
      neighborhood: 'Esplanada',
      street: 'Quadra J2',
    });
    expect(brasilapi).toEqual({
      lat: null,
      lng: null,
      cidade: 'Teresina',
      bairro: 'Esplanada',
      rua: 'Quadra J2',
    });
    expect(
      pontoDoCep(
        { lat: -5.08917, lng: -42.80194, cidade: 'Teresina', bairro: 'Esplanada', rua: 'Quadra J2' },
        { cidade: 'Teresina', bairro: 'ESPLANADA', logradouro: 'QD J2' },
        centro,
      ),
    ).toBeNull();
  });

  it('rejeita CEP de outra cidade e aceita o da mesma cidade mesmo com bairro diferente', () => {
    expect(
      cepCompativel(
        { cidade: 'Nazária', bairro: '', rua: '' },
        { cidade: 'CURRALINHOS', bairro: 'ZONA RURAL', logradouro: 'AV. PRINCIPAL DO POVOADO ANGELIM' },
      ),
    ).toBe(false);
    expect(
      cepCompativel(
        { cidade: 'Teresina', bairro: 'Santo Antônio', rua: 'Quadra 03' },
        { cidade: 'Teresina', bairro: 'PEDRA MIUDA', logradouro: 'Estrada Pedra Miúda' },
      ),
    ).toBe(true);
  });

  it('busca rua com bairro antes do bairro sozinho, quando a rua existe no mapa', () => {
    const perguntas = consultasDaLocalidade({
      consulta: 'Teresina',
      bairro: 'Pedra Miúda',
      logradouro: 'Estrada Pedra Miúda, 100',
      cidade: 'Teresina',
      uf: 'PI',
    });
    expect(perguntas[0]).toMatch(/Estrada Pedra Miúda, 100, Pedra Miúda, Teresina/i);
    expect(expandirLogradouro('R CRISTINO CASTRO')).toBe('Rua CRISTINO CASTRO');
    expect(perguntas.findIndex((item) => /^Pedra Miúda, Teresina/i.test(item))).toBeGreaterThan(0);
  });

  it('busca CEP + rua expandida antes do bairro', () => {
    const perguntas = consultasDaLocalidade({
      consulta: '64028255',
      bairro: 'SANTO ANTONIO',
      logradouro: 'R CRISTINO CASTRO',
      cidade: 'Teresina',
      uf: 'PI',
      cep: '64028255',
    });
    expect(perguntas[0]).toMatch(/Rua CRISTINO CASTRO, SANTO ANTONIO, Teresina, 64028-255/i);
    expect(perguntas.findIndex((item) => /^SANTO ANTONIO, Teresina/i.test(item))).toBeGreaterThan(0);
  });

  it('não confunde Cristino Castro com Cristino Castelo Branco', () => {
    expect(tokenConfere('R CRISTINO CASTRO', 'Rua Cristino Castelo Branco')).toBe(false);
    expect(tokenConfere('Rua COSMO, 2267', 'Rua Cósmico')).toBe(true);
    const ponto = escolherPonto(
      [
        {
          lat: -5.05,
          lng: -42.8,
          tipo: 'street',
          classe: 'highway',
          nome: 'Rua Cristino Castelo Branco',
          exibicao: 'Rua Cristino Castelo Branco, Teresina, Piauí',
        },
      ],
      {
        cidade: 'Teresina',
        bairro: 'SANTO ANTONIO',
        logradouro: 'R CRISTINO CASTRO',
        centro: { lat: -5.09, lng: -42.8 },
      },
    );
    expect(ponto).toBeNull();
  });

  it('não troca a Esplanada pelo conjunto de mesmo nome dentro de Angelim', () => {
    const esplanada: CandidatoNominatim = {
      lat: -5.1924686,
      lng: -42.7547267,
      tipo: 'suburb',
      classe: 'boundary',
      nome: 'Esplanada',
      exibicao: 'Esplanada, Teresina, Piauí, Região Nordeste, Brasil',
    };
    const dentroDeAngelim: CandidatoNominatim = {
      lat: -5.1927149,
      lng: -42.7627505,
      tipo: 'residential',
      classe: 'landuse',
      nome: 'Esplanada',
      exibicao: 'Esplanada, Angelim, Teresina, Piauí, Região Nordeste, Brasil',
    };
    expect(aninhadoEmOutroLugar(dentroDeAngelim.exibicao, 'Esplanada', 'Teresina')).toBe(true);
    expect(aninhadoEmOutroLugar(esplanada.exibicao, 'Esplanada', 'Teresina')).toBe(false);
    const ponto = escolherPonto([dentroDeAngelim, esplanada], {
      cidade: 'Teresina',
      bairro: 'ESPLANADA',
      centro: { lat: -5.0892, lng: -42.8016 },
    });
    expect(ponto).toEqual({ lat: esplanada.lat, lng: esplanada.lng });
  });

  it('para Quadra/CEP da Esplanada busca o bairro, não a sede da cidade', () => {
    expect(cepGenerico('64000000')).toBe(true);
    expect(cepGenerico('64039-546')).toBe(false);
    expect(logradouroFraco('Quadra J2')).toBe(true);
    expect(logradouroFraco('Estrada Pedra Miúda, 9519')).toBe(false);
    const perguntas = consultasDaLocalidade({
      consulta: '64039546',
      bairro: 'Esplanada',
      logradouro: 'Quadra J2',
      cidade: 'Teresina',
      uf: 'PI',
    });
    expect(perguntas[0]).toMatch(/^Esplanada, Teresina/i);
    expect(perguntas.some((item) => /Quadra J2/i.test(item))).toBe(false);
  });

  it('no Google, CEP genérico busca rua e bairro, não o 64000-000', () => {
    const perguntas = consultasGoogleDaLocalidade({
      cep: '64000000',
      logradouro: 'R CRISTINO CASTRO',
      bairro: 'SANTO ANTONIO',
      cidade: 'Teresina',
      uf: 'PI',
    });
    expect(perguntas[0]).toMatch(/Rua CRISTINO CASTRO, SANTO ANTONIO, Teresina - PI/i);
    expect(perguntas.some((item) => /64000-000/.test(item))).toBe(false);
  });

  it('no Google, CEP de rua basta — não manda o endereço misturado da Secullum', () => {
    const perguntas = consultasGoogleDaLocalidade({
      cep: '64039546',
      logradouro: 'QD J2, C41 CONJUNTO RESIDENCIAL ESPLANADA , CEP 64039-546 Teresina-pi',
      bairro: 'Esplanada',
      cidade: 'Teresina',
      uf: 'PI',
    });
    expect(perguntas[0]).toMatch(/^64039-546, Teresina - PI/i);
    expect(perguntas.every((item) => item.startsWith('64039-546'))).toBe(true);
    expect(perguntas.some((item) => /Residencial|Quadra J2/i.test(item))).toBe(false);
  });

  it('aceita o CEP/rua do Places e recusa só a cidade', () => {
    const centro = { lat: -5.0892, lng: -42.8016 };
    expect(
      pontoDoResultadoPlaces(
        {
          types: ['locality', 'political'],
          formattedAddress: 'Teresina, Piauí, Brazil',
          location: { latitude: -5.0961242, longitude: -42.8023065 },
        },
        { cidade: 'Teresina', bairro: 'SANTO ANTONIO', centro },
      ),
    ).toBeNull();
    expect(
      pontoDoResultadoPlaces(
        {
          types: ['postal_code'],
          formattedAddress: 'R. Cristino Castro - Santo Antonio, Teresina - PI, 64028-255, Brazil',
          location: { latitude: -5.1507346, longitude: -42.7573062 },
        },
        { cidade: 'Teresina', bairro: 'SANTO ANTONIO', centro },
      ),
    ).toEqual({ lat: -5.1507346, lng: -42.7573062 });
    expect(
      pontoDoResultadoPlaces(
        {
          types: ['postal_code'],
          formattedAddress: 'Teresina - PI, 64027-668, Brazil',
          location: { latitude: -5.20334, longitude: -42.7443366 },
        },
        { cidade: 'Teresina', bairro: 'AREIAS', centro },
      ),
    ).toBeNull();
    expect(
      pontoDoResultadoPlaces(
        {
          types: ['point_of_interest', 'establishment'],
          formattedAddress: 'R. Dois, 50 - Esplanada, Teresina - PI, 64040-768',
          displayName: { text: 'Residencial Esplanada' },
          location: { latitude: -5.1917034, longitude: -42.7632763 },
        },
        { cidade: 'Teresina', bairro: 'ESPLANADA', centro },
      ),
    ).toBeNull();
  });

  it('crava Areias no suburb OSM do mapa, não no centroide do CEP', () => {
    expect(pontoBairroOsmConhecido('PI', 'Teresina', 'AREIAS')).toEqual({
      lat: -5.1589709,
      lng: -42.7930784,
    });
    expect(pontoBairroOsmConhecido('PI', 'Teresina', 'Areias')).toEqual({
      lat: -5.1589709,
      lng: -42.7930784,
    });
    expect(pontoBairroOsmConhecido('PI', 'Teresina', 'ZONA RURAL')).toBeNull();
  });

  it('crava Nova Brasília no suburb OSM do norte, não em Morada Nova', () => {
    expect(pontoBairroOsmConhecido('PI', 'Teresina', 'NOVA BRASILIA')).toEqual({
      lat: -5.051008,
      lng: -42.8281271,
    });
    expect(pontoBairroOsmConhecido('PI', 'Teresina', 'NOVA BRASIL')).toEqual({
      lat: -5.051008,
      lng: -42.8281271,
    });
    expect(pontoBairroOsmConhecido('PI', 'Teresina', 'Morada Nova')).toEqual({
      lat: -5.1248111,
      lng: -42.7884901,
    });
  });

  it('não aceita ponto em outro estado e mapeia Mateuzinho de Timon', () => {
    const centroTeresina = { lat: -5.08917, lng: -42.80194 };
    expect(pontoForaDaCidade({ lat: -9.3891, lng: -40.503 }, centroTeresina)).toBe(true);
    expect(pontoForaDaCidade({ lat: -5.051008, lng: -42.8281271 }, centroTeresina)).toBe(false);
    expect(pontoBairroOsmConhecido('MA', 'Timon', 'Mateuzinho')).toEqual({
      lat: -5.1127802,
      lng: -42.8222858,
    });
  });

  it('recusa o resultado do Google quando ele é só a cidade', () => {
    const centro = { lat: -5.0892, lng: -42.8016 };
    expect(
      pontoDoResultadoGoogle(
        {
          types: ['locality', 'political'],
          formatted_address: 'Teresina, PI, Brasil',
          geometry: { location: { lat: -5.08917, lng: -42.80194 }, location_type: 'APPROXIMATE' },
        },
        { cidade: 'Teresina', bairro: 'SANTO ANTONIO', centro },
      ),
    ).toBeNull();
    expect(
      pontoDoResultadoGoogle(
        {
          types: ['street_address'],
          formatted_address: 'Rua Cristino Castro, Santo Antônio, Teresina - PI, Brasil',
          geometry: { location: { lat: -5.102, lng: -42.79 }, location_type: 'ROOFTOP' },
        },
        { cidade: 'Teresina', bairro: 'SANTO ANTONIO', centro },
      ),
    ).toEqual({ lat: -5.102, lng: -42.79 });
  });

  it('aceita a Estrada Pedra Miúda como o bairro Pedra Miúda, ao sul do centro', () => {
    const estrada: CandidatoNominatim = {
      lat: -5.20334,
      lng: -42.7443366,
      tipo: 'road',
      classe: 'highway',
      nome: 'Estrada Pedra Miúda',
      exibicao: 'Estrada Pedra Miúda, Pedra Miúda, Teresina, Piauí, Brasil',
    };
    const ponto = escolherPonto([estrada], {
      cidade: 'Teresina',
      bairro: 'Pedra Miúda',
      logradouro: 'Estrada Pedra Miúda, 9519',
      centro: { lat: -5.0892, lng: -42.8016 },
    });
    expect(ponto).toEqual({ lat: estrada.lat, lng: estrada.lng });
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
