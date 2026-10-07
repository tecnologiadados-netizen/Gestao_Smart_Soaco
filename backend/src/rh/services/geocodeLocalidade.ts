import type { Request, Response } from 'express';
import { buscarCandidatos, buscarPhoton, UF_PARA_ESTADO, type CandidatoNominatim } from '../../services/geocode.js';

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

export function consultasDaLocalidade(item: Pick<Consulta, 'consulta' | 'bairro' | 'logradouro' | 'cidade' | 'uf'>): string[] {
  const cidade = item.cidade.trim();
  const uf = item.uf.trim().toUpperCase();
  const bairro = bairroGenerico(item.bairro) ? '' : item.bairro.trim();
  const logradouro = item.logradouro.trim();
  const estado = UF_PARA_ESTADO[uf];
  const lista: string[] = [];
  const add = (q: string) => {
    const limpo = q.replace(/\s+/g, ' ').trim();
    if (limpo && !lista.includes(limpo)) lista.push(limpo);
  };
  if (bairro && cidade && uf) {
    const singular = singularizarLocalidade(bairro);
    if (singular) add(`${singular}, ${cidade}, ${uf}, Brazil`);
    add(`${bairro}, ${cidade}, ${uf}, Brazil`);
    if (singular && estado) add(`${singular}, ${cidade}, ${estado}, Brazil`);
    if (estado) add(`${bairro}, ${cidade}, ${estado}, Brazil`);
  }
  if (logradouro && cidade && uf) {
    add(`${logradouro}, ${cidade}, ${uf}, Brazil`);
    if (estado) add(`${logradouro}, ${cidade}, ${estado}, Brazil`);
    const povoado = extrairPovoado(logradouro);
    if (povoado) {
      add(`Povoado ${povoado}, ${cidade}, ${uf}, Brazil`);
      if (estado) add(`Povoado ${povoado}, ${cidade}, ${estado}, Brazil`);
    }
  }
  if (lista.length === 0) add(item.consulta);
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

function tokenConfere(logradouro: string, nome: string): boolean {
  const palavras = normalizar(nome).split(' ').filter((palavra) => palavra.length >= 4);
  return tokensLogradouro(logradouro).some((token) =>
    palavras.some((palavra) => palavra.startsWith(token) || token.startsWith(palavra) || palavra.startsWith(token.slice(0, 4))),
  );
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
  const singular = singularizarLocalidade(bairro);
  const singularNorm = singular ? normalizar(singular) : '';
  return nome === alvo || (singularNorm.length >= 4 && nome === singularNorm);
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
    const ehBairro = TIPOS_BAIRRO.has(candidato.tipo) || candidato.classe === 'place' || candidato.classe === 'boundary';
    const tokenBate = tokenConfere(contexto.logradouro ?? '', candidato.nome);
    const noBairro = textoContemBairro(textoCandidato, contexto.bairro);
    if (ehVia && !casa && !(tokenBate && (noBairro || bairroGenerico(contexto.bairro)))) continue;
    const distancia = contexto.centro ? distanciaKm(contexto.centro, candidato) : 0;
    const forte = (casa && ehBairro) || (tokenBate && noBairro);
    const limite = forte ? 30 : 12;
    if (contexto.centro && distancia > limite) continue;
    let nota = 80 - distancia;
    if (casa) nota += 50;
    if (ehBairro) nota += 20;
    if (tokenBate && noBairro) nota += 80;
    if (ehVia && !(tokenBate && noBairro)) nota -= 40;
    if (!melhor || nota > melhor.nota) melhor = { ponto: { lat: candidato.lat, lng: candidato.lng }, nota };
  }
  return melhor && melhor.nota >= 50 ? melhor.ponto : null;
}

type CepLocal = Ponto & { cidade: string; bairro: string; rua: string };

const cacheCep = new Map<string, CepLocal | null>();

/** O CEP só vale se a cidade (e o bairro, quando os dois existem) forem os da Secullum. */
export function cepCompativel(
  cep: { cidade: string; bairro: string; rua: string },
  contexto: { cidade: string; bairro: string; logradouro: string },
): boolean {
  if (!cep.cidade || normalizar(cep.cidade) !== normalizar(contexto.cidade)) return false;
  if (cep.bairro && contexto.bairro && !bairroGenerico(contexto.bairro) && normalizar(cep.bairro) !== normalizar(contexto.bairro)) {
    return false;
  }
  if (cep.rua && contexto.logradouro) {
    const rua = normalizar(cep.rua);
    const tokens = tokensLogradouro(contexto.logradouro);
    if (tokens.length > 0 && !tokens.some((token) => rua.includes(token) || token.includes(rua))) return false;
  }
  return true;
}

async function buscarCep(cep: string): Promise<CepLocal | null> {
  const digitos = cep.replace(/\D/g, '');
  if (digitos.length !== 8) return null;
  if (cacheCep.has(digitos)) return cacheCep.get(digitos) ?? null;
  try {
    const resposta = await fetch(`https://brasilapi.com.br/api/cep/v2/${digitos}`, { signal: AbortSignal.timeout(5000) });
    if (!resposta.ok) {
      cacheCep.set(digitos, null);
      return null;
    }
    const dados = (await resposta.json()) as {
      city?: string;
      neighborhood?: string;
      street?: string;
      location?: { coordinates?: { latitude?: string; longitude?: string } };
    };
    const lat = Number(dados.location?.coordinates?.latitude);
    const lng = Number(dados.location?.coordinates?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      cacheCep.set(digitos, null);
      return null;
    }
    const local = { lat, lng, cidade: dados.city ?? '', bairro: dados.neighborhood ?? '', rua: dados.street ?? '' };
    cacheCep.set(digitos, local);
    return local;
  } catch {
    cacheCep.set(digitos, null);
    return null;
  }
}

export async function geocodeLocalidadesHandler(req: Request, res: Response): Promise<void> {
  const bruto = Array.isArray(req.body?.consultas) ? (req.body.consultas as unknown[]) : [];
  const consultas = bruto.slice(0, 12).map(lerConsulta).filter((item): item is Consulta => item != null);
  const pontos: Array<{ chave: string; lat: number; lng: number }> = [];
  for (const consulta of consultas) {
    try {
      const centro = consulta.lat != null && consulta.lng != null ? { lat: consulta.lat, lng: consulta.lng } : null;
      const contexto = {
        cidade: consulta.cidade,
        bairro: bairroGenerico(consulta.bairro) ? '' : consulta.bairro,
        logradouro: consulta.logradouro,
        centro,
      };
      const perguntas = consultasDaLocalidade(consulta);
      const deRua = consulta.logradouro
        ? perguntas.filter((pergunta) => normalizar(pergunta).includes(normalizar(consulta.logradouro).slice(0, 18)))
        : [];
      const deBairro = perguntas.filter((pergunta) => !deRua.includes(pergunta));
      let escolhido: Ponto | null = null;
      for (const pergunta of deBairro) {
        escolhido = escolherPonto(await buscarCandidatos(pergunta), contexto);
        if (escolhido) break;
      }
      if (!escolhido) {
        for (const pergunta of deRua) {
          escolhido = escolherPonto(await buscarCandidatos(pergunta), contexto);
          if (escolhido) break;
        }
      }
      if (!escolhido && consulta.logradouro) {
        const consultaRua = [consulta.logradouro, contexto.bairro, consulta.cidade, consulta.uf].filter(Boolean).join(', ');
        escolhido = escolherPonto(await buscarPhoton(consultaRua), contexto);
      }
      if (!escolhido && consulta.cep) {
        const local = await buscarCep(consulta.cep);
        if (local && cepCompativel(local, contexto) && (!centro || distanciaKm(centro, local) <= 40)) {
          escolhido = { lat: local.lat, lng: local.lng };
        }
      }
      if (!escolhido) continue;
      pontos.push({ chave: consulta.chave, lat: escolhido.lat, lng: escolhido.lng });
    } catch {
      /* a próxima consulta segue; o bairro fica no centro urbano da cidade */
    }
  }
  res.json({ pontos });
}
