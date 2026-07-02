/**
 * Coordenadas de municípios a partir do banco (tabela populada por seed-municipios).
 */

import { prisma } from '../config/prisma.js';

/** Normaliza para comparação: trim, colapsa espaços, remove acentos, minúsculas. */
function normalizarSemAcentos(texto: string): string {
  return (texto || '')
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/** Nome do estado (sem acento, minúsculo) → sigla UF. Usado quando o ERP envia "Piauí" em vez de "PI". */
const ESTADO_PARA_SIGLA: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE',
  'distrito federal': 'DF', 'espirito santo': 'ES', goias: 'GO', maranhao: 'MA',
  'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', para: 'PA',
  paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI', 'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR',
  'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
};

function ufParaSigla(uf: string): string {
  const u = (uf || '').trim().toUpperCase();
  if (u.length === 2) return u;
  const estadoNorm = normalizarSemAcentos(uf);
  return ESTADO_PARA_SIGLA[estadoNorm] ?? u;
}

/**
 * Busca coordenadas do município no banco (nome + UF normalizados).
 * 1) Match exato (nome_normalizado + UF).
 * 2) Fallback: UF igual e nome no DB começa com o nome buscado (ex.: ERP "Santa Luzia" → DB "santa luzia do norte"); único resultado.
 * 3) Se UF vazia/inválida: busca só por nome; se existir apenas um município com esse nome no Brasil, usa.
 */
export async function buscarCoordenadasMunicipio(
  municipio: string,
  uf: string
): Promise<{ lat: number; lng: number } | null> {
  const nome_normalizado = normalizarSemAcentos(municipio);
  const ufNorm = ufParaSigla(uf);
  if (!nome_normalizado) return null;

  try {
    if (ufNorm) {
      const rowExato = await prisma.municipioCoordenada.findFirst({
        where: { nome_normalizado, uf: ufNorm },
        select: { lat: true, lng: true },
      });
      if (rowExato) return { lat: rowExato.lat, lng: rowExato.lng };

      if (nome_normalizado.length >= 2) {
        const porInicio = await prisma.municipioCoordenada.findMany({
          where: { uf: ufNorm, nome_normalizado: { startsWith: nome_normalizado } },
          select: { lat: true, lng: true },
        });
        if (porInicio.length === 1) return { lat: porInicio[0].lat, lng: porInicio[0].lng };
      }
    }

    if (nome_normalizado.length >= 3) {
      const porNomeSó = await prisma.municipioCoordenada.findMany({
        where: { nome_normalizado },
        select: { lat: true, lng: true },
        take: 2,
      });
      if (porNomeSó.length === 1) return { lat: porNomeSó[0].lat, lng: porNomeSó[0].lng };
    }
  } catch {
    // ignora erro de conexão/schema
  }
  return null;
}

/**
 * Busca coordenadas a partir da chave no formato "Município,UF,Brasil" (ex.: Teresina,PI,Brasil).
 * Faz o parse da string e chama buscarCoordenadasMunicipio(municipio, uf).
 */
export async function buscarCoordenadasPorChave(
  chave: string
): Promise<{ lat: number; lng: number } | null> {
  const parts = (chave || '').split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const municipio = parts[0];
  const uf = parts[1];
  return buscarCoordenadasMunicipio(municipio, uf);
}
