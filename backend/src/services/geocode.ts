/**
 * Coordenadas de município: apontamos pela chave no formato "Município,UF,Brasil" (ex.: Teresina,PI,Brasil).
 * Resolução: 1) banco (MunicipioCoordenada), 2) fallback fixo, 3) cache, 4) Nominatim.
 */

import { buscarCoordenadasMunicipio } from '../data/municipioCoordenadaRepository.js';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const DELAY_MS = 1100;

const cache = new Map<string, { lat: number; lng: number }>();

/** Nome do estado (sem acento) para segunda tentativa no Nominatim quando sigla UF não retorna resultado. */
const UF_PARA_ESTADO: Record<string, string> = {
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
