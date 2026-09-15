import { KNOWLEDGE_CHUNKS, type KnowledgeChunk } from './knowledge/chunks.js';

const STOPWORDS = new Set([
  'o',
  'a',
  'os',
  'as',
  'um',
  'uma',
  'uns',
  'umas',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'e',
  'ou',
  'que',
  'qual',
  'quais',
  'como',
  'para',
  'por',
  'com',
  'sem',
  'no',
  'na',
  'nos',
  'nas',
  'em',
  'ao',
  'aos',
  'se',
  'me',
  'te',
  'lhe',
  'eu',
  'voce',
  'vc',
  'esse',
  'essa',
  'isso',
  'este',
  'esta',
  'isto',
  'ser',
  'sao',
  'esta',
  'tem',
  'ter',
  'foi',
  'era',
  'sobre',
  'dentro',
  'sistema',
  'tela',
]);

function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s%]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(s: string): string[] {
  return normalizar(s)
    .split(' ')
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function haystack(chunk: KnowledgeChunk): string {
  return normalizar(
    `${chunk.tela} ${chunk.titulo} ${chunk.texto} ${(chunk.aliases ?? []).join(' ')}`
  );
}

/** Recupera top-N chunks por overlap lexical + aliases + frases. */
export function retrieveKnowledge(pergunta: string, topN = 8): KnowledgeChunk[] {
  const qNorm = normalizar(pergunta);
  const qTokens = tokens(pergunta);
  if (qTokens.length === 0) {
    return KNOWLEDGE_CHUNKS.filter((c) => c.id.startsWith('glossario-')).slice(0, topN);
  }

  const scored = KNOWLEDGE_CHUNKS.map((chunk) => {
    const hay = haystack(chunk);
    let score = 0;

    for (const t of qTokens) {
      if (hay.includes(t)) score += t.length >= 5 ? 3 : 2;
    }

    // Frase completa / alias exato
    for (const alias of chunk.aliases ?? []) {
      const a = normalizar(alias);
      if (a && qNorm.includes(a)) score += 12;
      else if (a && hay.includes(a) && qTokens.some((t) => a.includes(t))) score += 2;
    }

    // Título da seção
    const tituloNorm = normalizar(chunk.titulo);
    if (tituloNorm && qTokens.every((t) => tituloNorm.includes(t))) score += 8;
    else if (tituloNorm && qTokens.some((t) => tituloNorm.includes(t) && t.length >= 4)) score += 3;

    // Bônus glossário em perguntas “o que é / significa”
    if (
      /o que e|o que significa|pra que serve|para que serve|explique|definir|definicao/.test(qNorm) &&
      chunk.id.startsWith('glossario-')
    ) {
      score += 4;
    }

    return { chunk, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return KNOWLEDGE_CHUNKS.filter((c) =>
      ['amigaco-escopo', 'glossario-pipeline-compras', 'consulta-estoque-cascata'].includes(c.id)
    );
  }

  return scored.slice(0, topN).map((x) => x.chunk);
}

export function formatContextForPrompt(chunks: KnowledgeChunk[]): string {
  return chunks
    .map((c, i) => `[${i + 1}] Tela: ${c.tela}\nTítulo: ${c.titulo}\n${c.texto}`)
    .join('\n\n');
}
