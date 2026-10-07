import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { Request, Response } from 'express';
import { buscarCandidatos, buscarPhoton, UF_PARA_ESTADO, type CandidatoNominatim } from '../../services/geocode.js';

const VAR_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'var');
const CEP_CACHE_FILE = join(VAR_DIR, 'rh-geocode-bairro-osm-v1.json');

type Ponto = { lat: number; lng: number };
type Consulta = {
  chave: string;
  consulta: string;
  bairro: string;
  logradouro: string;
  cep: string;
  cidade: string;
  uf: string;
  lat: number | null;
  lng: number | null;
};

const TIPOS_BAIRRO = new Set([
  'suburb',
  'neighbourhood',
  'quarter',
  'village',
  'hamlet',
  'city_district',
  'residential',
  'administrative',
]);

function texto(valor: unknown, limite: number): string {
  if (typeof valor !== 'string') return '';
  return valor.trim().slice(0, limite);
}

function numero(valor: unknown): number | null {
  const n = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(n) ? n : null;
}

function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function lerConsulta(valor: unknown): Consulta | null {
  if (!valor || typeof valor !== 'object') return null;
  const item = valor as Record<string, unknown>;
  const chave = texto(item.chave, 180);
  const consulta = texto(item.consulta, 180);
  if (!chave || !consulta) return null;
  return {
    chave,
    consulta,
    bairro: texto(item.bairro, 80),
    logradouro: texto(item.logradouro, 140),
    cep: texto(item.cep, 12),
    cidade: texto(item.cidade, 80),
    uf: texto(item.uf, 2).toUpperCase(),
    lat: numero(item.lat),
    lng: numero(item.lng),
  };
}

function distanciaKm(a: Ponto, b: Ponto): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rótulos que não são um lugar: geocodificar isso devolve a sede do município. */
export function bairroGenerico(bairro: string): boolean {
  const nome = normalizar(bairro);
  if (!nome) return true;
  return /^(ZONA RURAL|ZONA URBANA|AREA RURAL|RURAL|INTERIOR|DISTRITO|ZONA|SEM BAIRRO|NAO INFORMADO|NAO INFORMADA|NAO CONSTA|SITIO|POVOADO|RODOVIA|AREA)$/.test(
    nome,
  );
}

/** Centroides OSM (suburb/quarter) — os mesmos rótulos do mapa de ruas. */
const TERESINA_OSM: Record<string, Ponto> = {
  AREIAS: { lat: -5.1589709, lng: -42.7930784 },
  'PEDRA MIUDA': { lat: -5.2036555, lng: -42.7386618 },
  'SANTO ANTONIO': { lat: -5.1531794, lng: -42.7756977 },
  ESPLANADA: { lat: -5.1924686, lng: -42.7547267 },
  ANGELIM: { lat: -5.1818157, lng: -42.7810193 },
  'VILA IRMA DULCE': { lat: -5.1925999, lng: -42.7741595 },
  'IRMA DULCE': { lat: -5.1925999, lng: -42.7741595 },
  'PORTAL DA ALEGRIA': { lat: -5.192725, lng: -42.7438477 },
  'PARQUE SUL': { lat: -5.1462338, lng: -42.7538109 },
  'PORTO ALEGRE': { lat: -5.1736699, lng: -42.7505966 },
  'EDUARDO COSTA': { lat: -5.222091, lng: -42.741932 },
  'SANTA CRUZ': { lat: -5.1576994, lng: -42.7852517 },
  PROMORAR: { lat: -5.1490654, lng: -42.7857292 },
  'PARQUE PIAUI': { lat: -5.1433993, lng: -42.7861969 },
  'DIRCEU ARCOVERDE': { lat: -5.1021281, lng: -42.7548827 },
  DIRCEU: { lat: -5.1021281, lng: -42.7548827 },
  'BELA VISTA': { lat: -5.1345436, lng: -42.7738309 },
  CENTRO: { lat: -5.0897725, lng: -42.8130528 },
  'LOURIVAL PARENTE': { lat: -5.1333468, lng: -42.787478 },
  SATELITE: { lat: -5.0474506, lng: -42.7579193 },
  ITARARE: { lat: -5.1046335, lng: -42.7597654 },
  REDENCAO: { lat: -5.1181595, lng: -42.7930213 },
  'SAO PEDRO': { lat: -5.1183823, lng: -42.8091098 },
  PLANALTO: { lat: -5.0578171, lng: -42.7766089 },
  MOCAMBINHO: { lat: -5.0253266, lng: -42.8128339 },
  FATIMA: { lat: -5.068136, lng: -42.7925973 },
  'NOVA BRASILIA': { lat: -5.051008, lng: -42.8281271 },
  'NOVA BRASIL': { lat: -5.051008, lng: -42.8281271 },
  'PEDRA MOLE': { lat: -5.0113636, lng: -42.7816688 },
  OLARIAS: { lat: -5.0418383, lng: -42.8375256 },
  MAFRENSE: { lat: -5.042672, lng: -42.8320324 },
  'ALTO ALEGRE': { lat: -5.0404731, lng: -42.8239201 },
  'SAO JOAQUIM': { lat: -5.0567363, lng: -42.8345215 },
  ITAPERU: { lat: -5.0479515, lng: -42.822355 },
  MEMORARE: { lat: -5.0459209, lng: -42.8172051 },
  'MORADA NOVA': { lat: -5.1248111, lng: -42.7884901 },
  TABULETA: { lat: -5.1226881, lng: -42.8036522 },
  TRIUNFO: { lat: -5.1273414, lng: -42.795825 },
  'PARQUE SAO JOAO': { lat: -5.1307395, lng: -42.8014469 },
  ACARAPE: { lat: -5.0709927, lng: -42.8298866 },
  COLORADO: { lat: -5.095899, lng: -42.7346159 },
  'SANTA MARIA': { lat: -4.9890498, lng: -42.8376268 },
  GURUPI: { lat: -5.0846391, lng: -42.7387691 },
  PICARRA: { lat: -5.0936472, lng: -42.7988169 },
  CABRAL: { lat: -5.0820069, lng: -42.8015041 },
  JOQUEI: { lat: -5.0762366, lng: -42.7895289 },
  NOIVOS: { lat: -5.0844226, lng: -42.7853232 },
  ILHOTAS: { lat: -5.0917626, lng: -42.792798 },
  VERMELHA: { lat: -5.1053361, lng: -42.8087881 },
  'POTI VELHO': { lat: -5.0369008, lng: -42.8298223 },
  'BUENOS AIRES': { lat: -5.0380224, lng: -42.8085923 },
  'AGUA MINERAL': { lat: -5.0460074, lng: -42.8073712 },
  'CIDADE NOVA': { lat: -5.1087721, lng: -42.7895698 },
  'MONTE CASTELO': { lat: -5.1035626, lng: -42.7964461 },
  ININGA: { lat: -5.0551964, lng: -42.7937519 },
  HORTO: { lat: -5.0661055, lng: -42.7774268 },
  'MORADA DO SOL': { lat: -5.0695917, lng: -42.7662525 },
  'SANTA LIA': { lat: -5.0627306, lng: -42.7528672 },
  'PARQUE IDEAL': { lat: -5.0998199, lng: -42.7482881 },
  ZOOBOTANICO: { lat: -5.0427921, lng: -42.7768369 },
  MATINHA: { lat: -5.0813049, lng: -42.8250504 },
  'SAO CRISTOVAO': { lat: -5.0780929, lng: -42.769979 },
  EXTREMA: { lat: -5.1209031, lng: -42.7581107 },
  'SANTA ROSA': { lat: -5.0246838, lng: -42.8336052 },
  'NOVA TERESINA': { lat: -5.0123789, lng: -42.7956219 },
  PRIMAVERA: { lat: -5.0631586, lng: -42.8129912 },
  'CIDADE JARDIM': { lat: -5.0199177, lng: -42.774207 },
  'RECANTO DAS PALMEIRAS': { lat: -5.0834817, lng: -42.7587604 },
  'VERDE LAR': { lat: -5.0384091, lng: -42.7365904 },
  'NOVO HORIZONTE': { lat: -5.1120996, lng: -42.7492126 },
  'PARQUE JACINTA': { lat: -5.1707674, lng: -42.764411 },
  'VALE QUEM TEM': { lat: -5.0492033, lng: -42.7381782 },
  'CIDADE SUL': { lat: -5.1712607, lng: -42.7545754 },
  RENASCENCA: { lat: -5.0994875, lng: -42.7410008 },
  AEROPORTO: { lat: -5.0680318, lng: -42.8175831 },
};

const TIMON_OSM: Record<string, Ponto> = {
  MATEUZINHO: { lat: -5.1127802, lng: -42.8222858 },
};

const CIDADES_OSM: Record<string, Ponto> = {
  'PI|DEMERVAL LOBAO': { lat: -5.3640643, lng: -42.673993 },
  'PI|NAZARIA': { lat: -5.3512851, lng: -42.8152823 },
  'PI|LAGOA DO PIAUI': { lat: -5.4116544, lng: -42.6450588 },
  'PI|BENEDITINOS': { lat: -5.4565671, lng: -42.3605061 },
  'PI|MONSENHOR GIL': { lat: -5.5609098, lng: -42.6127716 },
  'PI|COIVARAS': { lat: -5.0927005, lng: -42.2052489 },
  'PI|ALTO LONGA': { lat: -5.2549051, lng: -42.2072388 },
  'PI|PAU D ARCO DO PIAUI': { lat: -5.2522265, lng: -42.3884018 },
  'PI|CURRALINHOS': { lat: -5.6190404, lng: -42.8280018 },
  'MA|TIMON': { lat: -5.1004341, lng: -42.8312018 },
};

const BAIRROS_OSM: Record<string, Record<string, Ponto>> = {
  'PI|TERESINA': TERESINA_OSM,
  'MA|TIMON': TIMON_OSM,
};

function resolverBairroNaTabela(tabela: Record<string, Ponto>, bairroNorm: string): Ponto | null {
  const exato = tabela[bairroNorm];
  if (exato) return exato;
  if (bairroNorm.length < 6) return null;
  const prefixos = Object.keys(tabela).filter((chave) => chave.startsWith(bairroNorm) && chave !== bairroNorm);
  if (prefixos.length === 1) return tabela[prefixos[0]] ?? null;
  return null;
}

export function bairroEhACidade(bairro: string, cidade: string): boolean {
  const bairroNorm = normalizar(bairro);
  const cidadeNorm = normalizar(cidade);
  return bairroNorm.length > 0 && bairroNorm === cidadeNorm;
}

export function pontoCidadeOsmConhecido(uf: string, cidade: string): Ponto | null {
  const ufNorm = uf.trim().toUpperCase();
  const cidadeNorm = normalizar(cidade);
  if (!ufNorm || !cidadeNorm) return null;
  return CIDADES_OSM[`${ufNorm}|${cidadeNorm}`] ?? null;
}

export function pontoBairroOsmConhecido(uf: string, cidade: string, bairro: string): Ponto | null {
  const ufNorm = uf.trim().toUpperCase();
  const cidadeNorm = normalizar(cidade);
  const bairroNorm = normalizar(bairro);
  if (!ufNorm || !cidadeNorm || !bairroNorm || bairroGenerico(bairro)) return null;
  if (bairroEhACidade(bairro, cidade)) return pontoCidadeOsmConhecido(uf, cidade);
  const tabela = BAIRROS_OSM[`${ufNorm}|${cidadeNorm}`];
  if (!tabela) return null;
  return resolverBairroNaTabela(tabela, bairroNorm);
}

/** Ponto em outro município/estado (ex.: Petrolina). */
export function pontoForaDaCidade(ponto: Ponto, centro: Ponto | null, limiteKm = 40): boolean {
  if (!centro) return false;
  return distanciaKm(centro, ponto) > limiteKm;
}

/** "AV. PRINCIPAL DO POVOADO ANGELIM" → "Angelim". */
export function extrairPovoado(logradouro: string): string | null {
  const match = logradouro.match(/POVOADO\s+(.+)$/i);
  const nome = match?.[1]?.replace(/[,.-].*$/, '').trim() ?? '';
  return nome.length >= 3 ? nome : null;
}

/** "MANGUEIRAS" → "MANGUEIRA". Não corta palavras curtas. */
export function singularizarLocalidade(bairro: string): string | null {
  const partes = bairro.trim().split(/\s+/);
  const ultima = partes[partes.length - 1] ?? '';
  if (!/s$/i.test(ultima) || ultima.length < 6) return null;
  partes[partes.length - 1] = ultima.slice(0, -1);
  const saida = partes.join(' ');
  return normalizar(saida) === normalizar(bairro) ? null : saida;
}

export function expandirLogradouro(logradouro: string): string {
  return logradouro
    .trim()
    .replace(/^(R|RUA)\.?\s+/i, 'Rua ')
    .replace(/^(AV|AVENIDA)\.?\s+/i, 'Avenida ')
    .replace(/^(TV|TRAVESSA)\.?\s+/i, 'Travessa ')
    .replace(/^(QD|QUADRA)\.?\s+/i, 'Quadra ');
}

export function consultasDaLocalidade(
  item: Pick<Consulta, 'consulta' | 'bairro' | 'logradouro' | 'cidade' | 'uf'> & { cep?: string },
): string[] {
  const cidade = item.cidade.trim();
  const uf = item.uf.trim().toUpperCase();
  const bairro = bairroGenerico(item.bairro) ? '' : item.bairro.trim();
  const logradouro = expandirLogradouro(item.logradouro);
  const digitos = (item.cep ?? '').replace(/\D/g, '');
  const cepFmt = digitos.length === 8 && !cepGenerico(digitos) ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : '';
  const estado = UF_PARA_ESTADO[uf];
  const lista: string[] = [];
  const add = (q: string) => {
    const limpo = q.replace(/\s+/g, ' ').trim();
    if (limpo && !lista.includes(limpo)) lista.push(limpo);
  };
  const comEstado = (base: string) => {
    add(`${base}, ${uf}, Brazil`);
    if (estado) add(`${base}, ${estado}, Brazil`);
  };
  const ruaFraca = logradouroFraco(logradouro);
  if (logradouro && !ruaFraca && cidade && uf) {
    if (bairro && cepFmt) comEstado(`${logradouro}, ${bairro}, ${cidade}, ${cepFmt}`);
    if (bairro) comEstado(`${logradouro}, ${bairro}, ${cidade}`);
    if (cepFmt) comEstado(`${logradouro}, ${cidade}, ${cepFmt}`);
    comEstado(`${logradouro}, ${cidade}`);
    const povoado = extrairPovoado(logradouro);
    if (povoado) comEstado(`Povoado ${povoado}, ${cidade}`);
  }
  if (bairro && cidade && uf) {
    const singular = singularizarLocalidade(bairro);
    if (singular) comEstado(`${singular}, ${cidade}`);
    comEstado(`${bairro}, ${cidade}`);
  }
  if (lista.length === 0) add(item.consulta);
  return lista;
}

/** Mesma busca que o usuário faz no Google Maps: rua + bairro + cidade, ou o CEP quando ele é de rua. */
export function consultasGoogleDaLocalidade(item: {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}): string[] {
  const digitos = item.cep.replace(/\D/g, '');
  const cepFmt = digitos.length === 8 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : '';
  const cidade = item.cidade.trim();
  const uf = item.uf.trim().toUpperCase();
  const bairro = bairroGenerico(item.bairro) ? '' : item.bairro.trim();
  const rua = item.logradouro
    .trim()
    .replace(/^(R|RUA)\.?\s+/i, 'Rua ')
    .replace(/^(AV|AVENIDA)\.?\s+/i, 'Avenida ')
    .replace(/^(TV|TRAVESSA)\.?\s+/i, 'Travessa ')
    .replace(/^(QD|QUADRA)\.?\s+/i, 'Quadra ');
  const lista: string[] = [];
  const add = (q: string) => {
    const limpo = q.replace(/\s+/g, ' ').trim();
    if (limpo && !lista.includes(limpo)) lista.push(limpo);
  };
  if (cepFmt && !cepGenerico(digitos)) {
    if (cidade && uf) add(`${cepFmt}, ${cidade} - ${uf}, Brasil`);
    add(`${cepFmt}, Brasil`);
    return lista;
  }
  if (rua && !logradouroFraco(rua) && bairro && cidade && uf) add(`${rua}, ${bairro}, ${cidade} - ${uf}, Brasil`);
  if (rua && !logradouroFraco(rua) && cidade && uf) add(`${rua}, ${cidade} - ${uf}, Brasil`);
  if (bairro && cidade && uf) add(`${bairro}, ${cidade} - ${uf}, Brasil`);
  return lista;
}

const PARADA_RUA = new Set([
  'RUA', 'AV', 'AVENIDA', 'TRAVESSA', 'TV', 'PCA', 'PRACA', 'ALAMEDA', 'RODOVIA', 'ESTRADA',
  'PRINCIPAL', 'POVOADO', 'POV', 'DO', 'DA', 'DE', 'DOS', 'DAS', 'SN', 'NUMERO', 'LOTE', 'QUADRA',
]);

export function tokensLogradouro(logradouro: string): string[] {
  return normalizar(logradouro)
    .split(' ')
    .filter((token) => token.length >= 4 && !PARADA_RUA.has(token) && !/^\d+$/.test(token));
}

export function tokenConfere(logradouro: string, nome: string): boolean {
  const tokens = tokensLogradouro(logradouro);
  if (tokens.length === 0) return false;
  const palavras = normalizar(nome)
    .split(' ')
    .filter((palavra) => palavra.length >= 4);
  const bate = (token: string) =>
    palavras.some((palavra) => {
      if (palavra.startsWith(token) || token.startsWith(palavra)) return true;
      // Só tokens curtos (COSMO ↔ CÓSMICO). CASTRO não pode casar com CASTELO.
      if (token.length >= 6) return false;
      return palavra.startsWith(token.slice(0, 4));
    });
  const fortes = tokens.filter((token) => token.length >= 6);
  if (fortes.length > 0) return fortes.every(bate);
  return tokens.some(bate);
}

function textoContemBairro(texto: string, bairro: string): boolean {
  const alvo = normalizar(bairro);
  if (!alvo || bairroGenerico(bairro)) return false;
  if (texto.includes(alvo)) return true;
  const singular = singularizarLocalidade(bairro);
  return singular != null && texto.includes(normalizar(singular));
}

function nomeCasa(nome: string, bairro: string): boolean {
  const alvo = normalizar(bairro);
  if (!alvo) return false;
  const singular = singularizarLocalidade(bairro);
  const singularNorm = singular ? normalizar(singular) : '';
  if (nome === alvo || (singularNorm.length >= 4 && nome === singularNorm)) return true;
  const composto = alvo.split(' ').filter(Boolean).length >= 2;
  return composto && alvo.length >= 6 && nome.includes(alvo);
}

function segmentoEhOBairro(parte: string, bairro: string): boolean {
  const nome = normalizar(parte);
  const alvo = normalizar(bairro);
  if (!nome || !alvo) return false;
  if (nome === alvo) return true;
  const singular = singularizarLocalidade(bairro);
  return singular != null && nome === normalizar(singular);
}

/**
 * "Esplanada, Angelim, Teresina" é um conjunto dentro de Angelim, não o bairro Esplanada.
 * "Esplanada, Teresina" é o próprio bairro.
 */
export function aninhadoEmOutroLugar(exibicao: string, bairro: string, cidade: string): boolean {
  const cidadeNorm = normalizar(cidade);
  const partes = exibicao
    .split(',')
    .map((parte) => normalizar(parte))
    .filter(Boolean);
  const indiceCidade = partes.findIndex((parte) => parte === cidadeNorm);
  if (indiceCidade <= 0) return false;
  const generico = /^(REGIAO( \w+)?|ZONA( \w+)?|DISTRITO|SETOR|AREA|NORTE|SUL|LESTE|OESTE|CENTRO)$/;
  return partes
    .slice(0, indiceCidade)
    .some((parte) => !generico.test(parte) && !segmentoEhOBairro(parte, bairro));
}

function ehSedeMunicipal(candidato: CandidatoNominatim, cidade: string): boolean {
  if (normalizar(candidato.nome) !== normalizar(cidade)) return false;
  return (
    candidato.tipo === 'city' ||
    candidato.tipo === 'town' ||
    candidato.tipo === 'municipality' ||
    candidato.tipo === 'administrative' ||
    candidato.classe === 'boundary'
  );
}

/** Escolhe o lugar do endereço. Descarta a sede do município quando a busca é mais específica. */
export function escolherPonto(
  candidatos: CandidatoNominatim[],
  contexto: { cidade: string; bairro: string; logradouro?: string; centro: Ponto | null },
): Ponto | null {
  const cidadeNorm = normalizar(contexto.cidade);
  const especifico = normalizar(contexto.bairro) !== '' || normalizar(contexto.logradouro ?? '') !== '';
  let melhor: { ponto: Ponto; nota: number } | null = null;
  for (const candidato of candidatos) {
    const textoCandidato = normalizar(`${candidato.nome} ${candidato.exibicao}`);
    if (cidadeNorm && !textoCandidato.includes(cidadeNorm)) continue;
    if (especifico && ehSedeMunicipal(candidato, contexto.cidade)) continue;
    const nome = normalizar(candidato.nome);
    const casa = nomeCasa(nome, contexto.bairro);
    const ehVia = candidato.classe === 'highway' || candidato.tipo === 'road' || candidato.tipo === 'street';
    if (!ehVia && casa && aninhadoEmOutroLugar(candidato.exibicao, contexto.bairro, contexto.cidade)) continue;
    const ehBairro = TIPOS_BAIRRO.has(candidato.tipo) || candidato.classe === 'place' || candidato.classe === 'boundary';
    const bairroOficial =
      candidato.tipo === 'suburb' || candidato.tipo === 'neighbourhood' || candidato.tipo === 'quarter';
    const tokenBate = tokenConfere(contexto.logradouro ?? '', candidato.nome);
    const noBairro = textoContemBairro(textoCandidato, contexto.bairro);
    if (ehVia && !casa && !(tokenBate && (noBairro || bairroGenerico(contexto.bairro)))) continue;
    const distancia = contexto.centro ? distanciaKm(contexto.centro, candidato) : 0;
    const forte = casa || (tokenBate && noBairro);
    const limite = forte ? 40 : 12;
    if (contexto.centro && distancia > limite) continue;
    let nota = 80 - distancia;
    if (casa) nota += 50;
    if (ehBairro) nota += 20;
    if (bairroOficial) nota += 40;
    if (tokenBate && noBairro) nota += 80;
    if (ehVia && !(tokenBate && noBairro)) nota -= 40;
    if (!melhor || nota > melhor.nota) melhor = { ponto: { lat: candidato.lat, lng: candidato.lng }, nota };
  }
  return melhor && melhor.nota >= 50 ? melhor.ponto : null;
}

type CepLocal = { lat: number | null; lng: number | null; cidade: string; bairro: string; rua: string };

/** CEP genérico de município (64000-000) não localiza rua; o bairro do colaborador é que vale. */
export function cepGenerico(cep: string): boolean {
  const digitos = cep.replace(/\D/g, '');
  return digitos.length === 8 && digitos.endsWith('000');
}

/** Quadra/lote/conjunto quase nunca existe no OSM; geocodificar isso devolve a cidade. */
export function logradouroFraco(logradouro: string): boolean {
  const nome = normalizar(logradouro);
  if (!nome) return true;
  return /^(QD|QUADRA|LT|LOTE|LOTEAMENTO|CJ|CONJ|CONJUNTO|NUCLEO|RESIDENCIAL|SETOR)(\s|$)/.test(nome);
}

const cacheEnderecoCep = new Map<string, CepLocal | null>();
const cachePontoCep = new Map<string, Ponto>();
let awesomePausaAte = 0;
let awesomeFila: Promise<void> = Promise.resolve();

function lerCachePontoDisco(): void {
  if (cachePontoCep.size > 0) return;
  try {
    if (!existsSync(CEP_CACHE_FILE)) return;
    const cru = JSON.parse(readFileSync(CEP_CACHE_FILE, 'utf8')) as Record<string, Ponto>;
    for (const [cep, ponto] of Object.entries(cru)) {
      if (ponto && Number.isFinite(ponto.lat) && Number.isFinite(ponto.lng)) cachePontoCep.set(cep, ponto);
    }
  } catch {
    /* cache opcional */
  }
}

function gravarCachePontoDisco(cep: string, ponto: Ponto): void {
  cachePontoCep.set(cep, ponto);
  try {
    mkdirSync(VAR_DIR, { recursive: true });
    const atual: Record<string, Ponto> = {};
    for (const [chave, valor] of cachePontoCep.entries()) atual[chave] = valor;
    writeFileSync(CEP_CACHE_FILE, JSON.stringify(atual));
  } catch {
    /* o mapa ainda usa o cache em memória */
  }
}

/** O CEP localiza. Cidade da Secullum só impede um CEP de outro município distante. */
export function cepCompativel(
  cep: { cidade: string; bairro: string; rua: string },
  contexto: { cidade: string; bairro: string; logradouro: string },
): boolean {
  if (!cep.cidade || !contexto.cidade) return true;
  return normalizar(cep.cidade) === normalizar(contexto.cidade);
}

function bairroEhCentro(bairro: string): boolean {
  return /^(CENTRO|CENTRO NORTE|CENTRO SUL)$/.test(normalizar(bairro));
}

/**
 * A BrasilAPI/IBGE devolve a sede do município para muitos CEPs (ex.: Teresina em -5.08917, -42.80194).
 * Se o colaborador tem bairro específico, essa coordenada não serve.
 */
export function cepCoordenadaEhSedeDaCidade(
  ponto: Ponto,
  centro: Ponto | null,
  bairro: string,
): boolean {
  if (!centro || bairroEhCentro(bairro) || bairroGenerico(bairro) || !bairro.trim()) return false;
  return distanciaKm(centro, ponto) < 1.6;
}

function numeroCoord(valor: unknown): number | null {
  if (valor == null || valor === '') return null;
  const n = typeof valor === 'number' ? valor : Number(String(valor).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** AwesomeAPI traz lat/lng de rua. BrasilAPI traz o centroide IBGE da cidade — não usar. */
export function interpretarCepAwesome(dados: {
  lat?: unknown;
  lng?: unknown;
  city?: unknown;
  district?: unknown;
  address?: unknown;
}): CepLocal | null {
  const cidade = texto(dados.city, 80);
  const bairro = texto(dados.district, 80);
  const rua = texto(dados.address, 140);
  const lat = numeroCoord(dados.lat);
  const lng = numeroCoord(dados.lng);
  if (!cidade && !bairro && !rua && lat == null) return null;
  return { lat, lng, cidade, bairro, rua };
}

/** Só o endereço. As coordenadas da BrasilAPI/IBGE são a sede do município, não o CEP. */
export function interpretarCepBrasilApi(dados: {
  city?: unknown;
  neighborhood?: unknown;
  street?: unknown;
}): CepLocal | null {
  const cidade = texto(dados.city, 80);
  const bairro = texto(dados.neighborhood, 80);
  const rua = texto(dados.street, 140);
  if (!cidade && !bairro && !rua) return null;
  return { lat: null, lng: null, cidade, bairro, rua };
}

export function pontoDoCep(
  local: CepLocal,
  contexto: { cidade: string; bairro: string; logradouro: string },
  centro: Ponto | null,
): Ponto | null {
  if (local.lat == null || local.lng == null) return null;
  if (!cepCompativel(local, contexto)) return null;
  const ponto = { lat: local.lat, lng: local.lng };
  if (centro && distanciaKm(centro, ponto) > 50) return null;
  if (cepCoordenadaEhSedeDaCidade(ponto, centro, contexto.bairro || local.bairro)) return null;
  return ponto;
}

function googleMapsKey(): string {
  return (process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_GEOCODING_API_KEY ?? '').trim();
}

const TIPOS_GOOGLE_PRECISO = new Set([
  'street_address',
  'premise',
  'subpremise',
  'route',
  'intersection',
  'postal_code',
  'neighborhood',
  'sublocality',
  'sublocality_level_1',
  'sublocality_level_2',
]);

export type GoogleGeocodeResultado = {
  types?: string[];
  formatted_address?: string;
  geometry?: { location?: { lat?: number; lng?: number }; location_type?: string };
};

/** Aceita o ponto do Google quando é rua/CEP/bairro; recusa a sede do município. */
export function pontoDoResultadoGoogle(
  resultado: GoogleGeocodeResultado,
  contexto: { cidade: string; bairro: string; centro: Ponto | null },
): Ponto | null {
  const lat = resultado.geometry?.location?.lat;
  const lng = resultado.geometry?.location?.lng;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const ponto = { lat: lat as number, lng: lng as number };
  const tipos = resultado.types ?? [];
  const preciso = tipos.some((tipo) => TIPOS_GOOGLE_PRECISO.has(tipo));
  const soCidade =
    (tipos.includes('locality') || tipos.includes('administrative_area_level_2')) && !preciso;
  if (soCidade) return null;
  const soPoi =
    (tipos.includes('point_of_interest') || tipos.includes('establishment')) && !preciso;
  if (soPoi) return null;
  const exibicao = normalizar(resultado.formatted_address ?? '');
  const cidade = normalizar(contexto.cidade);
  if (cidade && exibicao && !exibicao.includes(cidade)) return null;
  if (contexto.bairro && !textoContemBairro(exibicao, contexto.bairro)) return null;
  if (contexto.centro && distanciaKm(contexto.centro, ponto) > 50) return null;
  const ruaOuCep =
    tipos.includes('street_address') ||
    tipos.includes('route') ||
    tipos.includes('premise') ||
    tipos.includes('postal_code');
  if (!ruaOuCep && cepCoordenadaEhSedeDaCidade(ponto, contexto.centro, contexto.bairro)) return null;
  return ponto;
}

export type PlacesSearchResultado = {
  types?: string[];
  formattedAddress?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
};

/** Places API (New) — a chave de demonstração do Maps responde aqui, não no Geocoding clássico. */
export function pontoDoResultadoPlaces(
  resultado: PlacesSearchResultado,
  contexto: { cidade: string; bairro: string; centro: Ponto | null },
): Ponto | null {
  return pontoDoResultadoGoogle(
    {
      types: resultado.types,
      formatted_address: resultado.formattedAddress ?? resultado.displayName?.text,
      geometry: {
        location: {
          lat: resultado.location?.latitude,
          lng: resultado.location?.longitude,
        },
      },
    },
    contexto,
  );
}

const cacheGoogle = new Map<string, GoogleGeocodeResultado[]>();
let avisouGoogleSemChave = false;

async function buscarGoogle(consulta: string): Promise<GoogleGeocodeResultado[]> {
  const key = googleMapsKey();
  if (!key) {
    if (!avisouGoogleSemChave) {
      avisouGoogleSemChave = true;
      console.warn(
        '[rh/geocode] Defina GOOGLE_MAPS_API_KEY no backend/.env para localizar CEP e rua pelo Google Places.',
      );
    }
    return [];
  }
  const chave = normalizar(consulta);
  if (!chave) return [];
  const emCache = cacheGoogle.get(chave);
  if (emCache) return emCache;
  try {
    const params = new URLSearchParams({
      address: consulta,
      region: 'br',
      language: 'pt-BR',
      key,
    });
    const resposta = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!resposta.ok) return [];
    const dados = (await resposta.json()) as { status?: string; error_message?: string; results?: GoogleGeocodeResultado[] };
    if (dados.status && dados.status !== 'OK' && dados.status !== 'ZERO_RESULTS') {
      console.warn('[rh/geocode] Google', dados.status, dados.error_message ?? '');
      return [];
    }
    const resultados = Array.isArray(dados.results) ? dados.results : [];
    cacheGoogle.set(chave, resultados);
    return resultados;
  } catch {
    return [];
  }
}

const cachePlaces = new Map<string, PlacesSearchResultado[]>();

async function buscarPlacesTexto(consulta: string): Promise<PlacesSearchResultado[]> {
  const key = googleMapsKey();
  if (!key) return [];
  const chave = normalizar(consulta);
  if (!chave) return [];
  const emCache = cachePlaces.get(chave);
  if (emCache) return emCache;
  try {
    const resposta = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.formattedAddress,places.location,places.types,places.displayName',
      },
      body: JSON.stringify({
        textQuery: consulta,
        languageCode: 'pt-BR',
        regionCode: 'BR',
        maxResultCount: 3,
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!resposta.ok) return [];
    const dados = (await resposta.json()) as { places?: PlacesSearchResultado[]; error?: { message?: string } };
    if (dados.error?.message) {
      console.warn('[rh/geocode] Places', dados.error.message);
      return [];
    }
    const resultados = Array.isArray(dados.places) ? dados.places : [];
    cachePlaces.set(chave, resultados);
    return resultados;
  } catch {
    return [];
  }
}

async function fetchJsonCep(url: string): Promise<{ ok: boolean; status: number; dados: Record<string, unknown> | null }> {
  try {
    const resposta = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!resposta.ok) return { ok: false, status: resposta.status, dados: null };
    const bruto = (await resposta.json()) as unknown;
    if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return { ok: false, status: resposta.status, dados: null };
    const obj = bruto as Record<string, unknown>;
    if (obj.erro === true || obj.erro === 'true') return { ok: false, status: resposta.status, dados: null };
    return { ok: true, status: resposta.status, dados: obj };
  } catch {
    return { ok: false, status: 0, dados: null };
  }
}

async function buscarEnderecoCep(cep: string): Promise<CepLocal | null> {
  const digitos = cep.replace(/\D/g, '');
  if (digitos.length !== 8) return null;
  if (cacheEnderecoCep.has(digitos)) return cacheEnderecoCep.get(digitos) ?? null;

  const via = await fetchJsonCep(`https://viacep.com.br/ws/${digitos}/json/`);
  if (via.dados) {
    const local = interpretarCepBrasilApi({
      city: via.dados.localidade,
      neighborhood: via.dados.bairro,
      street: via.dados.logradouro,
    });
    if (local) {
      cacheEnderecoCep.set(digitos, local);
      return local;
    }
  }

  const brasil = await fetchJsonCep(`https://brasilapi.com.br/api/cep/v2/${digitos}`);
  if (brasil.dados) {
    const local = interpretarCepBrasilApi(brasil.dados);
    if (local) {
      cacheEnderecoCep.set(digitos, local);
      return local;
    }
  }

  cacheEnderecoCep.set(digitos, null);
  return null;
}

async function buscarAwesomeCoords(cep: string): Promise<CepLocal | null> {
  const digitos = cep.replace(/\D/g, '');
  if (digitos.length !== 8 || cepGenerico(digitos) || Date.now() < awesomePausaAte) return null;
  const execucao = awesomeFila.then(async () => {
    if (Date.now() < awesomePausaAte) return null;
    await new Promise((resolve) => setTimeout(resolve, 400));
    const resposta = await fetchJsonCep(`https://cep.awesomeapi.com.br/json/${digitos}`);
    if (resposta.status === 429) {
      awesomePausaAte = Date.now() + 180_000;
      return null;
    }
    if (!resposta.dados) return null;
    return interpretarCepAwesome(resposta.dados);
  });
  awesomeFila = execucao.then(
    () => undefined,
    () => undefined,
  );
  return execucao;
}

function cepFormatado(digitos: string): string {
  return digitos.length === 8 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
}

async function geocodeBairroOsm(
  bairro: string,
  cidade: string,
  uf: string,
  centro: Ponto | null,
): Promise<Ponto | null> {
  if (!bairro || bairroGenerico(bairro) || !cidade || !uf) return null;
  const conhecido = pontoBairroOsmConhecido(uf, cidade, bairro);
  if (conhecido) return conhecido;
  const contexto = { cidade, bairro, logradouro: '', centro };
  const perguntas = consultasDaLocalidade({
    consulta: bairro,
    bairro,
    logradouro: '',
    cidade,
    uf,
  });
  for (const pergunta of perguntas.slice(0, 2)) {
    const ponto = escolherPonto(await buscarCandidatos(pergunta), contexto);
    if (ponto) return ponto;
  }
  return escolherPonto(await buscarPhoton(`${bairro}, ${cidade}, ${uf}`), contexto);
}

async function geocodeUmaConsulta(consulta: Consulta): Promise<Ponto | null> {
  const centro = consulta.lat != null && consulta.lng != null ? { lat: consulta.lat, lng: consulta.lng } : null;
  const digitos = consulta.cep.replace(/\D/g, '');
  const cepLocais = digitos.length === 8 && !cepGenerico(digitos);
  let bairro = bairroGenerico(consulta.bairro) ? '' : consulta.bairro;
  if (cepLocais) {
    const local = await buscarEnderecoCep(consulta.cep);
    if (local?.bairro && !bairroGenerico(local.bairro)) bairro = local.bairro;
  }
  const pontoBairro = await geocodeBairroOsm(bairro, consulta.cidade, consulta.uf, centro);
  if (pontoBairro && !pontoForaDaCidade(pontoBairro, centro)) {
    if (cepLocais) gravarCachePontoDisco(digitos, pontoBairro);
    return pontoBairro;
  }
  return null;
}

export async function geocodeLocalidadesHandler(req: Request, res: Response): Promise<void> {
  lerCachePontoDisco();
  const bruto = Array.isArray(req.body?.consultas) ? (req.body.consultas as unknown[]) : [];
  const consultas = bruto.slice(0, 24).map(lerConsulta).filter((item): item is Consulta => item != null);
  await Promise.all(consultas.map((item) => (item.cep ? buscarEnderecoCep(item.cep) : Promise.resolve(null))));
  const pontos: Array<{ chave: string; lat: number; lng: number; cep?: string; rua?: string; bairro?: string }> = [];
  const fila = [...consultas];
  let indice = 0;
  const CONCORRENCIA = 4;
  const worker = async () => {
    while (indice < fila.length) {
      const consulta = fila[indice]!;
      indice += 1;
      try {
        const ponto = await geocodeUmaConsulta(consulta);
        if (!ponto) continue;
        const digitos = consulta.cep.replace(/\D/g, '');
        const local = digitos.length === 8 ? cacheEnderecoCep.get(digitos) : null;
        pontos.push({
          chave: consulta.chave,
          lat: ponto.lat,
          lng: ponto.lng,
          cep: cepFormatado(digitos),
          rua: local?.rua ?? '',
          bairro: local?.bairro ?? '',
        });
      } catch {
        /* o lote segue */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCORRENCIA, fila.length) }, () => worker()));
  res.json({ pontos });
}
