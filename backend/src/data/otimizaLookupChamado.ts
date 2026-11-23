/**
 * Consulta em lote dos chamados em andamento no Otimiza, pela palavra do documento.
 * A chave fica no backend. No máximo 100 palavras por chamada.
 */

import { numeroSolicitacaoOtimizaValido } from './doubleCheckInOtimiza.js';

const URL_PADRAO =
  'https://eifsophpuwmhebzfznxc.supabase.co/functions/v1/lookup-request-by-keyword';
const LOTE = 100;

function configLookup(): { url: string; anonKey: string; apiKey: string } {
  return {
    url: process.env.OTIMIZA_LOOKUP_URL?.trim() || URL_PADRAO,
    anonKey: process.env.OTIMIZA_SUPABASE_ANON_KEY?.trim() ?? '',
    apiKey: process.env.OTIMIZA_API_KEY?.trim() ?? '',
  };
}

function numerosAbertos(results: unknown): number[] {
  if (!Array.isArray(results)) return [];
  const numeros = new Set<number>();
  for (const item of results) {
    if (!item || typeof item !== 'object') continue;
    const bruto = item as Record<string, unknown>;
    if (bruto.isOpen === false) continue;
    const numero = numeroSolicitacaoOtimizaValido(bruto.number);
    if (numero != null) numeros.add(numero);
  }
  return [...numeros].sort((a, b) => a - b);
}

/** Mapa palavra (maiúsculas) → números de chamado em andamento. */
export function interpretarLoteLookupOtimiza(body: unknown): Map<string, number[]> {
  const mapa = new Map<string, number[]>();
  const raw = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const items = Array.isArray(raw.items) ? raw.items : [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const bruto = item as Record<string, unknown>;
    const palavra = typeof bruto.keyword === 'string' ? bruto.keyword.trim() : '';
    if (!palavra) continue;
    const chave = palavra.toUpperCase();
    const atuais = mapa.get(chave) ?? [];
    const juntos = new Set<number>([...atuais, ...numerosAbertos(bruto.results)]);
    mapa.set(chave, [...juntos].sort((a, b) => a - b));
  }
  return mapa;
}

async function consultarLote(url: string, anonKey: string, apiKey: string, keywords: string[]): Promise<Map<string, number[]>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        'X-Api-Key': apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ keywords, onlyOpen: true }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    console.error('[otimiza] falha de rede no lote', {
      qtde: keywords.length,
      motivo: err instanceof Error ? err.name : 'erro',
    });
    throw new Error('Não foi possível consultar os chamados no Otimiza.');
  }
  if (res.status === 401 || res.status === 403) {
    console.error('[otimiza] lote recusado', { status: res.status });
    throw new Error('A consulta ao Otimiza foi recusada.');
  }
  if (!res.ok) {
    console.error('[otimiza] lote falhou', { status: res.status, qtde: keywords.length });
    throw new Error('Não foi possível consultar os chamados no Otimiza.');
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error('Não foi possível consultar os chamados no Otimiza.');
  }
  const mapa = interpretarLoteLookupOtimiza(body);
  for (const palavra of keywords) {
    const chave = palavra.toUpperCase();
    if (!mapa.has(chave)) mapa.set(chave, []);
  }
  return mapa;
}

/** Uma entrada por palavra. Palavra ausente na resposta fica com lista vazia. */
export async function consultarChamadosAbertosOtimiza(keywords: string[]): Promise<Map<string, number[]>> {
  const { url, anonKey, apiKey } = configLookup();
  if (!anonKey || !apiKey) {
    throw new Error('A consulta ao Otimiza não está configurada.');
  }
  const unicos: string[] = [];
  const vistos = new Set<string>();
  for (const bruto of keywords) {
    const texto = bruto.trim();
    if (texto.length < 4 || texto.length > 80) continue;
    const chave = texto.toUpperCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    unicos.push(texto);
  }
  const mapa = new Map<string, number[]>();
  for (let i = 0; i < unicos.length; i += LOTE) {
    const parte = unicos.slice(i, i + LOTE);
    const parcial = await consultarLote(url, anonKey, apiKey, parte);
    for (const [chave, numeros] of parcial) mapa.set(chave, numeros);
  }
  return mapa;
}
