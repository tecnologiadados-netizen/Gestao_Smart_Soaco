import { describe, expect, it } from 'vitest';
import type { MapaMunicipioItem } from '../api/pedidos';
import { PONTO_RETORNO_TERESINA } from './heatmapRoteirizador';
import {
  agruparCidadesPorCarrada,
  analisarIntersecaoRotas,
  montarRotaLocal,
  estilosTrechosIntersecao,
  recortarPolylineForaDaIntersecao,
  type RotaCarradaMapa,
} from './heatmapRotasTodasCarradas';

function item(parcial: Partial<MapaMunicipioItem> & Pick<MapaMunicipioItem, 'municipio' | 'uf' | 'lat' | 'lng'>): MapaMunicipioItem {
  return {
    chave: `${parcial.municipio},${parcial.uf}`,
    valorPendente: 1,
    detalhes: [],
    cor: 'verde',
    ...parcial,
  };
}

function linha(lat: number, lng0: number, lng1: number, passos: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= passos; i++) {
    const t = i / passos;
    pts.push([lat, lng0 + (lng1 - lng0) * t]);
  }
  return pts;
}

function rotaFalsa(nome: string, polyline: [number, number][], geometria: 'reta' | 'estrada' = 'estrada'): RotaCarradaMapa {
  return {
    id: nome,
    nome,
    cor: '#000',
    polyline,
    totalKm: 0,
    cidades: 1,
    geometria,
    coords: [],
    resultadoBase: {
      ordemIndices: [],
      pernas: [],
      retornoKm: 0,
      totalKm: 0,
      usouOsrm: false,
      perfilOsrm: null,
    },
  };
}

describe('agruparCidadesPorCarrada', () => {
  it('trata cada carrada como lista própria e ignora rota que não é carrada', () => {
    const codó = item({
      municipio: 'Codó',
      uf: 'MA',
      lat: -4.45,
      lng: -43.88,
      rotas: ['ROTA 1', 'Retirada na So Aco', 'ROTA 2'],
    });
    const picos = item({
      municipio: 'Picos',
      uf: 'PI',
      lat: -7.07,
      lng: -41.46,
      rotas: ['ROTA 1'],
    });
    const teresina = item({
      municipio: 'Teresina',
      uf: 'PI',
      lat: -5.09,
      lng: -42.8,
      rotas: ['ROTA 1'],
    });
    const grupos = agruparCidadesPorCarrada([
      { item: codó, chave: 'codo' },
      { item: picos, chave: 'picos' },
      { item: teresina, chave: 'the' },
    ]);
    expect(grupos.map((g) => g.nome)).toEqual(['ROTA 1', 'ROTA 2']);
    expect(grupos[0]!.cidades.map((c) => c.chave).sort()).toEqual(['codo', 'picos']);
    expect(grupos[1]!.cidades.map((c) => c.chave)).toEqual(['codo']);
  });
});

describe('montarRotaLocal', () => {
  it('fecha o ciclo na base e não mistura outra carrada', () => {
    const rota = montarRotaLocal(
      'ROTA 7',
      [
        { chave: 'a', lat: -6.2, lng: -43.1, label: 'A, PI' },
        { chave: 'b', lat: -7.1, lng: -41.5, label: 'B, PI' },
      ],
      0
    );
    expect(rota).not.toBeNull();
    expect(rota!.cidades).toBe(2);
    expect(rota!.geometria).toBe('reta');
    expect(rota!.polyline[0]![0]).toBeCloseTo(PONTO_RETORNO_TERESINA.lat, 4);
    const fim = rota!.polyline[rota!.polyline.length - 1]!;
    expect(fim[0]).toBeCloseTo(PONTO_RETORNO_TERESINA.lat, 4);
    expect(fim[1]).toBeCloseTo(PONTO_RETORNO_TERESINA.lng, 4);
    expect(rota!.polyline.length).toBe(4);
  });
});

describe('analisarIntersecaoRotas', () => {
  it('marca trecho em que duas rotas seguem juntas', () => {
    const compartilhado = linha(-6, -43, -42, 20);
    const a = [...compartilhado, ...linha(-6, -42, -40.5, 12).slice(1)];
    const sobe: [number, number][] = [];
    for (let i = 1; i <= 12; i++) sobe.push([-6 + i * 0.12, -42]);
    const b = [...compartilhado, ...sobe];
    const analise = analisarIntersecaoRotas(
      [rotaFalsa('ROTA A', a), rotaFalsa('ROTA B', b)],
      [{ lat: -6, lng: -42.5, label: 'Oeiras/PI' }]
    );
    expect(analise.trechos.length).toBeGreaterThan(0);
    expect(analise.trechos[0]!.carradas.sort()).toEqual(['ROTA A', 'ROTA B']);
    expect(analise.trechos[0]!.km).toBeGreaterThan(80);
    expect(analise.trechos[0]!.pertoDe).toBe('Oeiras/PI');
  });

  it('marca cruzamento em X e ignora só a ponta comum da base', () => {
    const horizontal = linha(-6, -43.2, -40.8, 24);
    const vertical: [number, number][] = [];
    for (let i = 0; i <= 24; i++) vertical.push([-7.1 + (i / 24) * 2.2, -42.05]);
    const cruzam = analisarIntersecaoRotas([
      rotaFalsa('ROTA A', horizontal),
      rotaFalsa('ROTA B', vertical),
    ]);
    expect(cruzam.cruzamentos.length).toBeGreaterThan(0);
    expect(cruzam.cruzamentos[0]!.carradas.sort()).toEqual(['ROTA A', 'ROTA B']);
    expect(cruzam.cruzamentos[0]!.lat).toBeCloseTo(-6, 1);
    expect(cruzam.cruzamentos[0]!.lng).toBeCloseTo(-42.05, 1);

    const base: [number, number] = [PONTO_RETORNO_TERESINA.lat, PONTO_RETORNO_TERESINA.lng];
    const norte: [number, number][] = [base, [-3.4, -42.8], [-2.6, -42.2]];
    const sul: [number, number][] = [base, [-6.8, -42.8], [-7.6, -43.4]];
    const soBase = analisarIntersecaoRotas([rotaFalsa('ROTA N', norte), rotaFalsa('ROTA S', sul)]);
    expect(soBase.trechos).toEqual([]);
    expect(soBase.cruzamentos).toEqual([]);
  });
});

describe('recortarPolylineForaDaIntersecao', () => {
  it('remove o miolo compartilhado e conserva as pontas exclusivas', () => {
    const compartilhado = linha(-6, -43, -42, 20);
    const antes = linha(-6.5, -43.6, -43, 6);
    const depois = linha(-6, -42, -41.2, 8).slice(1);
    const rota = [...antes, ...compartilhado.slice(1), ...depois];
    const partes = recortarPolylineForaDaIntersecao(rota, [compartilhado]);
    const meio = compartilhado[10]!;
    expect(partes.length).toBe(2);
    for (const parte of partes) {
      const contemMeio = parte.some((p) => p[0] === meio[0] && p[1] === meio[1]);
      expect(contemMeio).toBe(false);
    }
    expect(partes[0]![0]).toEqual(antes[0]);
    expect(partes[1]![partes[1]!.length - 1]).toEqual(depois[depois.length - 1]);
  });
});

describe('estilosTrechosIntersecao', () => {
  it('separa trechos vizinhos de grupos diferentes e repete o ritmo do mesmo grupo', () => {
    const a1 = linha(-6, -43, -42, 8);
    const b = linha(-6, -42, -41, 8);
    const a2 = linha(-7.2, -40, -39, 8);
    const estilo = estilosTrechosIntersecao([
      { id: 'a1', polyline: a1, carradas: ['ROTA A', 'ROTA B'] },
      { id: 'b', polyline: b, carradas: ['ROTA A'] },
      { id: 'a2', polyline: a2, carradas: ['ROTA B', 'ROTA A'] },
    ]);
    expect(estilo.dashPorId.a1).not.toBe(estilo.dashPorId.b);
    expect(estilo.dashPorId.a1).toBe(estilo.dashPorId.a2);
    expect(estilo.emendas).toHaveLength(1);
    expect(estilo.emendas[0]!.lat).toBeCloseTo(-6, 2);
    expect(estilo.emendas[0]!.lng).toBeCloseTo(-42, 2);
  });
});
