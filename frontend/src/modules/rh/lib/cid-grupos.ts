/**
 * Agrupamento CID-10 em “grupos de sintomas” para rankings de RH.
 * A primeira faixa definida que casar ganha — ordem do array IMPORTA.
 */

import type { FaltaGrupoSintomaCidRow } from "@rh/types/api";
import {
  tituloGrupoSintoma,
  ID_CAPITULOS_AGREGADOS,
  SUBCAPITULO_POR_LETRA,
} from "@rh/lib/grupos-sintomas-cid-titulos";

export interface ParsedCid {
  rawToken: string
  letter: string
  block: number
}

export interface DefinicaoGrupoCid {
  id: string
  titulo: string
  match: (p: ParsedCid) => boolean
}

/** Primeiro CID da c├®lula (ex.: "M54.5; OBS" ÔåÆ M54.5). */
export function primeiroTokenCid(cid: string): string {
  const s = cid.trim().toUpperCase().replace(/\u00A0/g, ' ')
  const part = s.split(/[;,]/)[0]?.trim() ?? ''
  return part || s
}

/** Chave est├ível para somar QNTD quando a planilha repete o mesmo CID com texto diferente (A09 - ÔÇª vs A09- ÔÇª). */
export function chaveAgregacaoCidPlanilha(cidBruto: string): string {
  const token = primeiroTokenCid(cidBruto)
  const m = token.match(/^([A-Z])(\d{2})(?:[.\/](\d+))?/i)
  if (m) {
    const letter = m[1].toUpperCase()
    const block = m[2]
    const sub = m[3]
    if (sub != null && sub !== '') {
      const subNorm = sub.replace(/^0+/, '') || '0'
      return `${letter}${block}.${subNorm}`
    }
    return `${letter}${block}`
  }
  const norm = cidBruto
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return `livre:${norm}`
}

function extrairDescricaoCidPlanilha(cidBruto: string): string {
  return cidBruto
    .trim()
    .replace(/^\s*[A-Z]\d{2}(?:[.\/]\d+)?\s*[-–—:.\s]*/i, '')
    .replace(/^\s*[A-Z]\d{2}\s*-\s*[A-Z]\d{2}(?:\s*,\s*[A-Z]\d{2}\s*-\s*[A-Z]\d{2})*\s*[-–—:.\s]*/i, '')
    .replace(/\.\s*$/, '')
    .trim()
}

/** Exportado para enriquecimento de rótulos em grupos de sintomas. */
export function extrairDescricaoCidCadastro(cidBruto: string): string {
  return extrairDescricaoCidPlanilha(cidBruto)
}

/** R├│tulo unificado na lista expandida do grupo (c├│digo + descri├º├úo). */
export function rotuloCidPlanilhaExibicao(cidBruto: string, chave?: string): string {
  const k = chave ?? chaveAgregacaoCidPlanilha(cidBruto)
  if (k.startsWith('livre:')) return cidBruto.trim()
  const desc = extrairDescricaoCidPlanilha(cidBruto)
  return desc ? `${k} — ${desc}` : k
}

export type CidAgregadoPlanilha = { chave: string; rotulo: string; qntd: number }

/** Soma dias (QNTD) por chave de CID; mant├®m o r├│tulo da variante com maior volume na linha. */
export function acumularCidPlanilha(
  map: Map<string, CidAgregadoPlanilha & { melhorLinhaQtd: number }>,
  cidBruto: string,
  qntd: number,
): void {
  const c = cidBruto.trim()
  if (!c) return
  const chave = chaveAgregacaoCidPlanilha(c)
  const rotulo = rotuloCidPlanilhaExibicao(c, chave)
  const cur = map.get(chave)
  if (!cur) {
    map.set(chave, { chave, rotulo, qntd, melhorLinhaQtd: qntd })
    return
  }
  cur.qntd += qntd
  if (qntd > cur.melhorLinhaQtd || (qntd === cur.melhorLinhaQtd && rotulo.length > cur.rotulo.length)) {
    cur.rotulo = rotulo
    cur.melhorLinhaQtd = qntd
  }
}

/** Letra categor├¡a + bloco NN (opcional subdivis├úo na regex, ignorada para faixas). */
export function parseCid10(token: string): ParsedCid | null {
  const t = primeiroTokenCid(token)
  const m = t.match(/^([A-Z])(\d{2})(?:[\.\/](\d+))?/)
  if (!m) return null
  return { rawToken: t, letter: m[1], block: Number(m[2]) }
}

export const GRUPOS_SINTOMA_CID: DefinicaoGrupoCid[] = [
  {
    id: 'digestivo',
    titulo: tituloGrupoSintoma('digestivo'),
    match: ({ letter, block: b }) => (letter === 'A' && b >= 4 && b <= 9) || letter === 'K',
  },
  {
    id: 'infeccoes-virais',
    titulo: tituloGrupoSintoma('infeccoes-virais'),
    match: ({ letter, block: b }) => {
      if (letter === 'A') {
        if (b === 81) return true
        if (b >= 87 && b <= 89) return true
        if (b === 90) return true
        if (b >= 92 && b <= 99) return true
      }
      if (letter !== 'B') return false
      if (b === 25) return true
      if ([3, 4, 7, 8, 9].includes(b)) return true
      if (b >= 27 && b <= 34) return true
      return false
    },
  },
  {
    id: 'respiratorio',
    titulo: tituloGrupoSintoma('respiratorio'),
    match: ({ letter, block: b }) => (letter === 'J') || (letter === 'U' && b === 7),
  },
  {
    id: 'sintomas-sinais',
    titulo: tituloGrupoSintoma('sintomas-sinais'),
    match: ({ letter, block: b }) => {
      if (letter === 'G' && (b === 43 || b === 44)) return true
      if (letter === 'R') return true
      return false
    },
  },
  {
    id: 'saude-mental',
    titulo: tituloGrupoSintoma('saude-mental'),
    match: ({ letter }) => letter === 'F',
  },
  {
    id: 'osteomuscular-m',
    titulo: tituloGrupoSintoma('osteomuscular-m'),
    match: ({ letter }) => letter === 'M',
  },
  {
    id: 'traumatismos-st',
    titulo: tituloGrupoSintoma('traumatismos-st'),
    match: ({ letter }) => letter === 'S' || letter === 'T' || letter === 'V' || letter === 'W' || letter === 'X' || letter === 'Y',
  },
  {
    id: 'z-preventiva',
    titulo: tituloGrupoSintoma('z-preventiva'),
    match: ({ letter }) => letter === 'Z',
  },
  {
    id: 'o-gravidez',
    titulo: tituloGrupoSintoma('o-gravidez'),
    match: ({ letter }) => letter === 'O',
  },
]

/** Faixas curtas com sobreposição parcial ainda entram no grupo específico (ex.: J09–J11 → influenza). */
const MAX_BLOCOS_FAIXA_PARCIAL = 15;

export interface FaixaCidCadastro {
  letter: string;
  blockInicio: number;
  blockFim: number;
}

function resolverGrupoCidSubcapitulo(parsed: ParsedCid): { id: string; titulo: string } {
  const subId = SUBCAPITULO_POR_LETRA[parsed.letter];
  if (subId) {
    return { id: subId, titulo: tituloGrupoSintoma(subId) };
  }
  return { id: ID_CAPITULOS_AGREGADOS, titulo: tituloGrupoSintoma(ID_CAPITULOS_AGREGADOS) };
}

function resolverGrupoCidOutros(parsed: ParsedCid): { id: string; titulo: string } {
  return resolverGrupoCidSubcapitulo(parsed);
}

function isMarcadorCidAusente(texto: string): boolean {
  const uMarc = texto
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  return (
    (uMarc.includes('CID') && uMarc.includes('AUSENTE'))
    || (uMarc.includes('CID') && uMarc.includes('INEXISTENTE'))
    || uMarc.includes('NAO CONSTA NO DOCUMENTO')
    || uMarc.includes('NÃO CONSTA NO DOCUMENTO')
  );
}

function isArboviroseOuFebreViral(texto: string): boolean {
  return /\bA9[0-9]|arbovirose|febres virais transmitidas/i.test(texto);
}

function isCausaExternaAcidente(texto: string): boolean {
  return /^\s*[VWXY]\d/i.test(texto) || /\b[VWXY]\d{2}/.test(texto);
}

function blocosFaixa(faixa: FaixaCidCadastro): number[] {
  const out: number[] = [];
  for (let b = faixa.blockInicio; b <= faixa.blockFim; b += 1) out.push(b);
  return out;
}

function grupoSintomaParaParsed(parsed: ParsedCid): DefinicaoGrupoCid | null {
  for (const g of GRUPOS_SINTOMA_CID) {
    if (g.match(parsed)) return g;
  }
  return null;
}

function grupoSintomaParaFaixa(faixa: FaixaCidCadastro): DefinicaoGrupoCid | null {
  const blocos = blocosFaixa(faixa);
  if (blocos.length === 0) return null;

  for (const g of GRUPOS_SINTOMA_CID) {
    const matching = blocos.filter((b) => g.match({ letter: faixa.letter, block: b, rawToken: "" }));
    if (matching.length === 0) continue;
    if (matching.length === blocos.length) return g;
    if (blocos.length <= MAX_BLOCOS_FAIXA_PARCIAL) return g;
  }
  return null;
}

/** Extrai códigos individuais e faixas de uma linha do cadastro de CIDs. */
export function extrairElementosCidLinhaCadastro(linha: string): {
  codigos: string[];
  faixas: FaixaCidCadastro[];
} {
  const codigos: string[] = [];
  const faixas: FaixaCidCadastro[] = [];
  const faixaKeys = new Set<string>();

  for (const m of linha.matchAll(/\b([A-Z]\d{2})\s*-\s*([A-Z]\d{2})\b/gi)) {
    const letterA = m[1].slice(0, 1).toUpperCase();
    const letterB = m[2].slice(0, 1).toUpperCase();
    if (letterA !== letterB) continue;
    const blockInicio = Number(m[1].slice(1));
    const blockFim = Number(m[2].slice(1));
    if (!Number.isFinite(blockInicio) || !Number.isFinite(blockFim)) continue;
    const key = `${letterA}:${Math.min(blockInicio, blockFim)}-${Math.max(blockInicio, blockFim)}`;
    if (faixaKeys.has(key)) continue;
    faixaKeys.add(key);
    faixas.push({
      letter: letterA,
      blockInicio: Math.min(blockInicio, blockFim),
      blockFim: Math.max(blockInicio, blockFim),
    });
  }

  const codigoKeys = new Set<string>();
  for (const m of linha.matchAll(/\b([A-Z]\d{2}(?:\.\d+)?)\b/gi)) {
    const token = m[1].toUpperCase();
    const parsed = parseCid10(token);
    if (!parsed) continue;
    const key = `${parsed.letter}${String(parsed.block).padStart(2, "0")}`;
    if (codigoKeys.has(key)) continue;
    codigoKeys.add(key);
    codigos.push(token);
  }

  return { codigos, faixas };
}

/** Classifica uma linha exata do cadastro de CIDs em exatamente um grupo. */
export function classificarLinhaCadastroCid(linha: string): { id: string; titulo: string } {
  const trimmed = linha.trim();
  if (!trimmed) return { id: "cid-vazio", titulo: "(Texto em branco)" };

  if (isMarcadorCidAusente(trimmed)) {
    return {
      id: 'cid-marcador-folha-sem-codigo',
      titulo: tituloGrupoSintoma('cid-marcador-folha-sem-codigo'),
    };
  }

  if (isArboviroseOuFebreViral(trimmed)) {
    return { id: 'infeccoes-virais', titulo: tituloGrupoSintoma('infeccoes-virais') };
  }

  if (isCausaExternaAcidente(trimmed)) {
    return { id: 'traumatismos-st', titulo: tituloGrupoSintoma('traumatismos-st') };
  }

  const { codigos, faixas } = extrairElementosCidLinhaCadastro(trimmed);

  for (const token of codigos) {
    const parsed = parseCid10(token);
    if (!parsed) continue;
    const grupo = grupoSintomaParaParsed(parsed);
    if (grupo) return { id: grupo.id, titulo: grupo.titulo };
  }

  for (const faixa of faixas) {
    const grupo = grupoSintomaParaFaixa(faixa);
    if (grupo) return { id: grupo.id, titulo: grupo.titulo };
  }

  const primeiroCodigo = codigos[0];
  if (primeiroCodigo) {
    const parsed = parseCid10(primeiroCodigo);
    if (parsed) return resolverGrupoCidOutros(parsed);
  }

  if (faixas[0]) {
    const f = faixas[0];
    return resolverGrupoCidOutros({
      letter: f.letter,
      block: f.blockInicio,
      rawToken: `${f.letter}${String(f.blockInicio).padStart(2, "0")}`,
    });
  }

  return resolverGrupoCid(trimmed);
}

/** Verifica se um CID pertence a um grupo cadastrado (lista explícita de CIDs correlatos). */
function cidEstaNaFaixa(chave: string, inicio: string, fim: string): boolean {
  const pa = parseCid10(inicio);
  const pb = parseCid10(fim);
  const pc = parseCid10(chave);
  if (!pa || !pb || !pc) return false;
  if (pa.letter !== pb.letter || pa.letter !== pc.letter) return false;
  return pc.block >= pa.block && pc.block <= pb.block;
}

function linhaCadastroContemCodigo(chave: string, linhaCadastro: string): boolean {
  const ranges = [...linhaCadastro.matchAll(/([A-Z]\d{2})\s*-\s*([A-Z]\d{2})/gi)];
  for (const m of ranges) {
    if (cidEstaNaFaixa(chave, m[1].toUpperCase(), m[2].toUpperCase())) return true;
  }
  const token = chave.replace(/\./g, "\\.");
  return new RegExp(`\\b${token}\\b`, "i").test(linhaCadastro);
}

export function cidPertenceAoGrupo(cidBruto: string, grupoCids: string[]): boolean {
  const alvo = chaveAgregacaoCidPlanilha(cidBruto);
  if (!alvo || alvo.startsWith("livre:")) return false;
  const parsedAlvo = parseCid10(alvo);

  for (const entry of grupoCids) {
    const ref = chaveAgregacaoCidPlanilha(entry);
    if (!ref || ref.startsWith("livre:")) continue;
    if (alvo === ref) return true;
    if (alvo.startsWith(`${ref}.`) || ref.startsWith(`${alvo}.`)) return true;
    const parsedRef = parseCid10(ref);
    if (parsedAlvo && parsedRef && parsedAlvo.letter === parsedRef.letter && parsedAlvo.block === parsedRef.block) {
      return true;
    }
    if (linhaCadastroContemCodigo(alvo, entry)) return true;
  }
  return false;
}

function resolverGrupoCidCadastro(
  cidBruto: string,
  grupos: FaltaGrupoSintomaCidRow[],
): { id: string; titulo: string } | null {
  for (const g of grupos) {
    if (g.cids.length > 0 && cidPertenceAoGrupo(cidBruto, g.cids)) {
      return { id: g.id, titulo: g.titulo };
    }
  }
  return null;
}

export function resolverGrupoCid(
  cidBruto: string,
  gruposCadastro?: FaltaGrupoSintomaCidRow[],
): { id: string; titulo: string } {
  const parsed = parseCid10(cidBruto)

  if (parsed) {
    for (const g of GRUPOS_SINTOMA_CID) {
      if (g.match(parsed)) return { id: g.id, titulo: g.titulo }
    }
    return resolverGrupoCidOutros(parsed)
  }

  const t = cidBruto.trim()
  if (!t) return { id: 'cid-vazio', titulo: '(Texto em branco)' }

  if (isMarcadorCidAusente(t)) {
    return {
      id: 'cid-marcador-folha-sem-codigo',
      titulo: tituloGrupoSintoma('cid-marcador-folha-sem-codigo'),
    }
  }

  if (isArboviroseOuFebreViral(t)) {
    return { id: 'infeccoes-virais', titulo: tituloGrupoSintoma('infeccoes-virais') }
  }

  if (isCausaExternaAcidente(t)) {
    return { id: 'traumatismos-st', titulo: tituloGrupoSintoma('traumatismos-st') }
  }

  if (gruposCadastro?.length) {
    const fromCadastro = resolverGrupoCidCadastro(cidBruto, gruposCadastro);
    if (fromCadastro) return fromCadastro;
  }

  const safe = t.replace(/\s+/g, ' ').slice(0, 48)
  return {
    id: `livre:${safe.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 36)}`,
    titulo: `Registo sem formato CID reconhecível: ${safe}${t.length > 48 ? '…' : ''}`,
  }
}
