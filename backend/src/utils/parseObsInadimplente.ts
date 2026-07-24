/**
 * Quebra o texto livre histórico da coluna OBS em contatos lógicos.
 *
 * Cada cobrança costuma começar com:
 * - âncora + data: "Cobrança em…", "Cobraça efetuada…", "Agendado para dia…", "Dia…"
 * - ou só a data (lista de tentativas): "…novamente,25/11/2024 ,09,12,2024 e sem 03/01/2025…"
 *
 * Datas de previsão embutidas ("previsto para 06/11/2024") NÃO abrem novo contato.
 */

export type ContatoObsParsed = {
  dataContato: Date | null;
  texto: string;
};

/** Cobrança / Cobraça (typo sem "n") + opcional efetuada/em */
const KEYWORD =
  String.raw`Cobra[n]?[cç]a(?:\s+efetuada)?(?:\s+em)?|Agendado\s+para(?:\s+dia)?|Dia`;

const DATE = String.raw`\d{1,2}[/.,]\d{1,2}[/.,]\d{2,4}`;

const KEYWORD_DATE_RE = new RegExp(`(${KEYWORD})\\s+(${DATE})`, 'gi');
const DATE_RE = new RegExp(`(${DATE})`, 'gi');

/** Contexto imediatamente antes da data que indica previsão, não novo contato. */
const CONTEXTO_PREVISAO_RE =
  /(?:previsto|previs[aã]o|pagemnto|pagamento|efetar|efetuar|efetuará|ira\s+efet|irá\s+efet)(?:\s+\w+){0,4}\s+(?:para|em|paa)\s*$/i;

type SplitMatch = {
  index: number;
  end: number;
  data: Date | null;
  /** Trecho de abertura (âncora+data ou só data). */
  abertura: string;
};

function parseDataBr(raw: string): Date | null {
  const cleaned = raw.trim().replace(/,/g, '/').replace(/\./g, '/');
  const m = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  let yyyy = Number(m[3]);
  if (yyyy < 100) yyyy += 2000;
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const d = new Date(yyyy, mm - 1, dd, 12, 0, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return d;
}

function limparTrecho(s: string): string {
  return s
    .replace(/^[\s.,;:…-]+/, '')
    .replace(/[\s.,;:…-]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function coletarSplits(raw: string): SplitMatch[] {
  const keywordSpans: Array<{ start: number; end: number }> = [];
  const matches: SplitMatch[] = [];

  KEYWORD_DATE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = KEYWORD_DATE_RE.exec(raw)) != null) {
    const start = m.index;
    const end = start + m[0].length;
    keywordSpans.push({ start, end });
    matches.push({
      index: start,
      end,
      data: parseDataBr(m[2] ?? ''),
      abertura: m[0],
    });
  }

  DATE_RE.lastIndex = 0;
  while ((m = DATE_RE.exec(raw)) != null) {
    const start = m.index;
    const end = start + m[0].length;
    if (keywordSpans.some((s) => overlaps(start, end, s.start, s.end))) continue;

    const before = raw.slice(Math.max(0, start - 48), start);
    if (CONTEXTO_PREVISAO_RE.test(before)) continue;

    // Evita datas coladas no meio de palavra/número (ex.: códigos).
    const prev = start > 0 ? raw[start - 1]! : '';
    if (prev && /[A-Za-z0-9]/.test(prev)) continue;

    matches.push({
      index: start,
      end,
      data: parseDataBr(m[1] ?? ''),
      abertura: m[0],
    });
  }

  matches.sort((a, b) => a.index - b.index || a.end - b.end);

  // Remove splits duplicados no mesmo ponto.
  const dedup: SplitMatch[] = [];
  for (const cur of matches) {
    const last = dedup[dedup.length - 1];
    if (last && Math.abs(last.index - cur.index) < 2) continue;
    dedup.push(cur);
  }
  return dedup;
}

/**
 * Divide o OBS legado em contatos. Se não houver datas/âncoras reconhecíveis,
 * devolve um único contato com o texto inteiro.
 */
export function parseObsInadimplente(obs: string | null | undefined): ContatoObsParsed[] {
  const raw = String(obs ?? '').trim();
  if (!raw) return [];

  const splits = coletarSplits(raw);
  if (splits.length === 0) {
    return [{ dataContato: null, texto: limparTrecho(raw) }];
  }

  const out: ContatoObsParsed[] = [];

  if (splits[0]!.index > 0) {
    const prefix = limparTrecho(raw.slice(0, splits[0]!.index));
    if (prefix) out.push({ dataContato: null, texto: prefix });
  }

  for (let i = 0; i < splits.length; i++) {
    const cur = splits[i]!;
    const nextStart = i + 1 < splits.length ? splits[i + 1]!.index : raw.length;
    const texto = limparTrecho(raw.slice(cur.index, nextStart));
    if (!texto) continue;
    out.push({ dataContato: cur.data, texto });
  }

  return out.length ? out : [{ dataContato: null, texto: limparTrecho(raw) }];
}

export function formatDataContatoBr(d: Date | null | undefined): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Reconstrói o texto OBS a partir dos contatos estruturados (ordem cronológica). */
export function montarObsFromContatos(
  contatos: Array<{ dataContato: Date | null; texto: string }>
): string | null {
  const sorted = [...contatos].sort((a, b) => {
    const ta = a.dataContato?.getTime() ?? 0;
    const tb = b.dataContato?.getTime() ?? 0;
    if (ta !== tb) return ta - tb;
    return 0;
  });

  const parts = sorted
    .map((c) => {
      const t = limparTrecho(c.texto);
      if (t) return t;
      const d = formatDataContatoBr(c.dataContato);
      return d ? `Cobrança em ${d}` : '';
    })
    .filter(Boolean);

  return parts.length ? parts.join('. ') : null;
}
