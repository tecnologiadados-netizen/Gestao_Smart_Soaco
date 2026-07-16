/**
 * Integração Nomus REST — Representantes (aba Orgânico → Representantes).
 *
 * O endpoint dedicado `/representantes` já devolve a lista completa (não paginada em 50 como `/pessoas`),
 * então uma única requisição basta. Filtramos por `ativo === true` e normalizamos para o formato
 * consumido pelo frontend (OrganicoRepresentante base, vinda do Nomus).
 *
 * Resultado é mantido em cache em memória por alguns minutos (a lista muda raramente).
 * Somente leitura.
 */

const DEFAULT_BASE_URL = 'https://soaco.nomus.com.br/soaco/rest';
const CACHE_TTL_MS = 10 * 60 * 1000;

/** Formato base do representante (Nomus) que o frontend espera em { representantes: [...] }. */
export interface NomusRepresentante {
  nome: string;
  nomeRazaoSocial: string;
  cpf: string;
  telefone: string;
  codigo: string;
}

interface RawRepresentante {
  ativo?: boolean;
  nome?: string;
  nomeRazaoSocial?: string;
  cnpj?: string;
  cpf?: string;
  telefone?: string;
  codigo?: string;
}

function getBaseUrl(): string {
  return (process.env.NOMUS_REST_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function getBearer(): string | null {
  const t = process.env.NOMUS_PESSOAS_BEARER_TOKEN?.trim();
  return t && t !== '' ? t : null;
}

export function isNomusRestEnabled(): boolean {
  return getBearer() !== null;
}

function limpar(v?: string | null): string {
  return String(v ?? '').trim();
}

let cache: { at: number; data: NomusRepresentante[] } | null = null;

/**
 * Busca a lista de representantes ativos no Nomus.
 * Lança erro se o token não estiver configurado ou a API falhar (sem cache válido).
 */
export async function fetchNomusRepresentantes(): Promise<NomusRepresentante[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

  const bearer = getBearer();
  if (!bearer) {
    throw new Error('Integração Nomus REST não configurada (defina NOMUS_PESSOAS_BEARER_TOKEN).');
  }

  const res = await fetch(`${getBaseUrl()}/representantes`, {
    headers: { Authorization: `Bearer ${bearer}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Nomus /representantes falhou (HTTP ${res.status}). ${txt.slice(0, 200)}`);
  }

  const raw = (await res.json()) as RawRepresentante[];
  const list = Array.isArray(raw) ? raw : [];

  const data = list
    .filter((r) => r.ativo !== false)
    .map<NomusRepresentante>((r) => {
      const nomeRazaoSocial = limpar(r.nomeRazaoSocial) || limpar(r.nome);
      return {
        nome: limpar(r.nome) || nomeRazaoSocial,
        nomeRazaoSocial,
        cpf: limpar(r.cnpj) || limpar(r.cpf),
        telefone: limpar(r.telefone),
        codigo: limpar(r.codigo),
      };
    })
    .filter((r) => r.nome !== '' || r.nomeRazaoSocial !== '');

  cache = { at: Date.now(), data };
  return data;
}
