/**
 * Coordenadas de município: apontamos pela chave no formato "Município,UF,Brasil" (ex.: Teresina,PI,Brasil).
 * Resolução: 1) banco (MunicipioCoordenada), 2) fallback fixo, 3) cache, 4) Nominatim.
 */

import { buscarCoordenadasMunicipio } from '../data/municipioCoordenadaRepository.js';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const DELAY_MS = 1100;

const cache = new Map<string, { lat: number; lng: number }>();

/** Nome do estado (sem acento) para segunda tentativa no Nominatim quando sigla UF não retorna resultado. */
export const UF_PARA_ESTADO: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapa', BA: 'Bahia', CE: 'Ceara', DF: 'Distrito Federal',
  ES: 'Espirito Santo', GO: 'Goias', MA: 'Maranhao', MG: 'Minas Gerais', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso',
  PA: 'Para', PB: 'Paraiba', PE: 'Pernambuco', PI: 'Piaui', PR: 'Parana', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RO: 'Rondonia', RR: 'Roraima', RS: 'Rio Grande do Sul', SC: 'Santa Catarina', SE: 'Sergipe', SP: 'Sao Paulo', TO: 'Tocantins',
};

/** Formato da chave: Município,UF,Brasil. Normalizada (minúscula, sem acento) para cache e fallback. */
export function chaveLocal(municipio: string, uf: string): string {
  const m = (municipio || '').trim();
  const u = (uf || '').trim().toUpperCase();
  return `${m},${u},Brasil`;
}

/** Remove acentos e colapsa espaços (igual ao repo) para chave normalizada e query Nominatim. */
function normalizarSemAcentos(texto: string): string {
  return (texto || '')
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/** Chave normalizada para cache/fallback: "teresina,pi,brasil". */
function chaveNormalizada(municipio: string, uf: string): string {
  const m = normalizarSemAcentos(municipio);
  const u = (uf || '').trim().toLowerCase();
  return `${m},${u},brasil`;
}

/** Fallback: coordenadas conhecidas (chave no formato normalizado "municipio,uf,brasil"). */
const FALLBACK_COORDS: Record<string, { lat: number; lng: number }> = {
  'moncao,ma,brasil': { lat: -3.4917, lng: -45.2511 },
  'luzilandia,pi,brasil': { lat: -3.4649, lng: -42.3690 },
};

/** Retorna coordenadas só do cache (chave no formato Município,UF,Brasil). */
export function geocodeFromCache(municipio: string, uf: string): { lat: number; lng: number } | null {
  return cache.get(chaveNormalizada(municipio, uf)) ?? null;
}

/** Faz uma única requisição ao Nominatim. */
async function fetchNominatim(q: string): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({
    q,
    format: 'json',
    limit: '1',
    countrycodes: 'br',
  });
  const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: { 'User-Agent': 'GestorPedidosSoAco/1.0' },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
  if (!Array.isArray(data) || data.length === 0) return null;
  const lat = parseFloat(data[0].lat ?? '');
  const lng = parseFloat(data[0].lon ?? '');
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

/**
 * Retorna coordenadas a partir da chave "Município,UF,Brasil".
 * Ordem: 1) banco, 2) fallback fixo, 3) cache, 4) Nominatim (query no mesmo formato).
 */
export async function geocodeMunicipio(
  municipio: string,
  uf: string
): Promise<{ lat: number; lng: number } | null> {
  const key = chaveNormalizada(municipio, uf);

  const fromDb = await buscarCoordenadasMunicipio(municipio, uf);
  if (fromDb) {
    cache.set(key, fromDb);
    return fromDb;
  }

  const fallbackFixo = FALLBACK_COORDS[key];
  if (fallbackFixo) {
    cache.set(key, fallbackFixo);
    return fallbackFixo;
  }

  const cached = cache.get(key);
  if (cached) return cached;

  const municipioTrim = (municipio || '').trim();
  const municipioNorm = normalizarSemAcentos(municipio) || municipioTrim;
  const ufNorm = (uf || '').trim().toUpperCase();

  await delay();
  try {
    const queries: string[] = [];
    if (municipioTrim && ufNorm) queries.push(`${municipioTrim}, ${ufNorm}, Brazil`);
    if (municipioNorm && ufNorm) queries.push(`${municipioNorm}, ${ufNorm}, Brazil`);
    if (ufNorm && UF_PARA_ESTADO[ufNorm]) queries.push(`${municipioTrim}, ${UF_PARA_ESTADO[ufNorm]}, Brazil`);
    if (ufNorm && UF_PARA_ESTADO[ufNorm]) queries.push(`${municipioNorm}, ${UF_PARA_ESTADO[ufNorm]}, Brazil`);

    for (const q of [...new Set(queries)]) {
      const coords = await fetchNominatim(q);
      if (coords) {
        cache.set(key, coords);
        return coords;
      }
      await delay();
    }
  } catch {
    // ignora erro de rede/timeout
  }
  return null;
}

/** Atrasa entre chamadas para respeitar limite do Nominatim (1 req/s). */
export function delay(ms: number = DELAY_MS): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type CandidatoNominatim = {
  lat: number;
  lng: number;
  tipo: string;
  classe: string;
  nome: string;
  exibicao: string;
};

const cacheCandidatos = new Map<string, CandidatoNominatim[]>();

/** Até cinco resultados, para escolher o bairro certo em vez do primeiro hit. */
async function fetchCandidatos(q: string): Promise<CandidatoNominatim[]> {
  const params = new URLSearchParams({
    q,
    format: 'json',
    limit: '5',
    addressdetails: '1',
    countrycodes: 'br',
  });
  const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: { 'User-Agent': 'GestorPedidosSoAco/1.0' },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as Array<{
    lat?: string;
    lon?: string;
    type?: string;
    class?: string;
    addresstype?: string;
    name?: string;
    display_name?: string;
  }>;
  if (!Array.isArray(data)) return [];
  const saida: CandidatoNominatim[] = [];
  for (const item of data) {
    const lat = parseFloat(item.lat ?? '');
    const lng = parseFloat(item.lon ?? '');
    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
    saida.push({
      lat,
      lng,
      tipo: item.addresstype || item.type || '',
      classe: item.class || '',
      nome: item.name || '',
      exibicao: item.display_name || '',
    });
  }
  return saida;
}

let filaNominatim: Promise<void> = Promise.resolve();

/** Vários candidatos do Nominatim, na mesma fila (1 por segundo). */
export function buscarCandidatos(consulta: string): Promise<CandidatoNominatim[]> {
  const chave = `cand:${normalizarSemAcentos(consulta)}`;
  if (!chave || chave === 'cand:') return Promise.resolve([]);
  const emCache = cacheCandidatos.get(chave);
  if (emCache) return Promise.resolve(emCache);

  const execucao = filaNominatim.then(async () => {
    const ja = cacheCandidatos.get(chave);
    if (ja) return ja;
    await delay();
    const lista = await fetchCandidatos(consulta);
    cacheCandidatos.set(chave, lista);
    return lista;
  });
  filaNominatim = execucao.then(
    () => undefined,
    () => undefined,
  );
  return execucao;
}

/** Uma consulta livre ao Nominatim, na mesma fila do restante do sistema (1 por segundo). */
export function geocodeTexto(consulta: string): Promise<{ lat: number; lng: number } | null> {
  const chave = normalizarSemAcentos(consulta);
  if (!chave) return Promise.resolve(null);
  const emCache = cache.get(chave);
  if (emCache) return Promise.resolve(emCache);

  const execucao = filaNominatim.then(async () => {
    const ja = cache.get(chave);
    if (ja) return ja;
    await delay();
    const coords = await fetchNominatim(consulta);
    if (coords) cache.set(chave, coords);
    return coords;
  });
  filaNominatim = execucao.then(
    () => undefined,
    () => undefined,
  );
  return execucao;
}

const cachePhoton = new Map<string, CandidatoNominatim[]>();

/** Complementa o Nominatim quando a rua existe com outra grafia (ex.: Cosmo → Cósmico). */
export async function buscarPhoton(consulta: string): Promise<CandidatoNominatim[]> {
  const chave = normalizarSemAcentos(consulta);
  if (!chave) return [];
  const emCache = cachePhoton.get(chave);
  if (emCache) return emCache;
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(consulta)}&limit=5&lang=default`;
    const res = await fetch(url, { headers: { 'User-Agent': 'GestorPedidosSoAco/1.0' }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      cachePhoton.set(chave, []);
      return [];
    }
    const dados = (await res.json()) as {
      features?: Array<{
        geometry?: { coordinates?: [number, number] };
        properties?: {
          name?: string;
          street?: string;
          locality?: string;
          district?: string;
          city?: string;
          state?: string;
          type?: string;
          osm_key?: string;
        };
      }>;
    };
    const saida: CandidatoNominatim[] = [];
    for (const feature of dados.features ?? []) {
      const coords = feature.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;
      const props = feature.properties ?? {};
      const nome = props.name || props.street || '';
      const exibicao = [nome, props.locality, props.district, props.city, props.state].filter(Boolean).join(', ');
      saida.push({
        lat: coords[1],
        lng: coords[0],
        tipo: props.type || '',
        classe: props.osm_key || '',
        nome,
        exibicao,
      });
    }
    cachePhoton.set(chave, saida);
    return saida;
  } catch {
    cachePhoton.set(chave, []);
    return [];
  }
}
