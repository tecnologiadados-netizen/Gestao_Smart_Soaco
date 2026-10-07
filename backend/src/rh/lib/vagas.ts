export class VagaErro extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const STATUS_VAGA = [
  'aberta_sem_divulgacao',
  'em_divulgacao',
  'triagem',
  'entrevista',
  'fechada',
] as const;

export type StatusVaga = (typeof STATUS_VAGA)[number];

const PROXIMOS: Record<StatusVaga, StatusVaga[]> = {
  aberta_sem_divulgacao: ['em_divulgacao', 'fechada'],
  em_divulgacao: ['aberta_sem_divulgacao', 'triagem', 'fechada'],
  triagem: ['em_divulgacao', 'entrevista', 'fechada'],
  entrevista: ['triagem', 'em_divulgacao', 'fechada'],
  fechada: ['aberta_sem_divulgacao', 'em_divulgacao'],
};

export function ehStatusVaga(valor: string): valor is StatusVaga {
  return (STATUS_VAGA as readonly string[]).includes(valor);
}

export function normalizarStatusCadastro(valor: unknown): StatusVaga {
  const status = typeof valor === 'string' ? valor.trim() : '';
  if (status === 'aberta_sem_divulgacao' || status === 'em_divulgacao') return status;
  throw new VagaErro('A vaga começa aberta, com ou sem divulgação.');
}

export function normalizarTransicao(atual: string, proximo: unknown): StatusVaga {
  if (!ehStatusVaga(atual)) throw new VagaErro('Status atual da vaga é inválido.');
  const status = typeof proximo === 'string' ? proximo.trim() : '';
  if (!ehStatusVaga(status)) throw new VagaErro('Escolha um status da vaga.');
  if (status === atual) return status;
  if (!PROXIMOS[atual].includes(status)) throw new VagaErro('Essa mudança de status não faz parte do andamento da vaga.');
  return status;
}

export function normalizarPrazo(valor: unknown): string | null {
  if (valor == null) return null;
  const texto = String(valor).trim();
  if (!texto) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) throw new VagaErro('Informe a data limite no formato AAAA-MM-DD.');
  const data = new Date(`${texto}T00:00:00Z`);
  if (Number.isNaN(data.getTime()) || data.toISOString().slice(0, 10) !== texto) {
    throw new VagaErro('A data limite de fechamento é inválida.');
  }
  return texto;
}

const CORES_POSTIT = new Set([
  'branco',
  'amarelo',
  'pessego',
  'laranja',
  'coral',
  'vermelho',
  'rosa',
  'vinho',
  'lilas',
  'roxo',
  'azul',
  'marinho',
  'ciano',
  'menta',
  'verde',
  'lima',
  'cinza',
]);

export function normalizarCor(valor: unknown): string {
  if (valor == null || String(valor).trim() === '') return 'branco';
  const cor = String(valor).trim().toLowerCase();
  if (!CORES_POSTIT.has(cor)) throw new VagaErro('Escolha uma cor do post-it.');
  return cor;
}

export function nomeObrigatorio(valor: unknown, rotulo: string): string {
  const texto = typeof valor === 'string' ? valor.trim() : '';
  if (!texto) throw new VagaErro(`Informe ${rotulo}.`);
  return texto.slice(0, 160);
}

export type LinkDivulgacao = {
  id: string;
  url: string;
  descricao: string;
};

export function normalizarLinks(valor: unknown): LinkDivulgacao[] {
  if (valor == null) return [];
  if (!Array.isArray(valor)) throw new VagaErro('Os links de divulgação estão em formato inválido.');
  const links: LinkDivulgacao[] = [];
  for (const item of valor) {
    if (!item || typeof item !== 'object') continue;
    const bruto = item as Record<string, unknown>;
    const descricao = typeof bruto.descricao === 'string' ? bruto.descricao.trim().slice(0, 80) : '';
    const urlBruta = typeof bruto.url === 'string' ? bruto.url.trim() : '';
    if (!descricao && !urlBruta) continue;
    if (!urlBruta) throw new VagaErro('Informe o endereço de cada link de divulgação.');
    if (/^[a-z][a-z0-9+.-]*:/i.test(urlBruta) && !/^https?:/i.test(urlBruta)) {
      throw new VagaErro('Um dos links de divulgação é inválido.');
    }
    const comProtocolo = /^https?:\/\//i.test(urlBruta) ? urlBruta : `https://${urlBruta}`;
    let url: string;
    try {
      const endereco = new URL(comProtocolo);
      if (endereco.protocol !== 'http:' && endereco.protocol !== 'https:') throw new Error('protocolo');
      url = endereco.toString();
    } catch {
      throw new VagaErro('Um dos links de divulgação é inválido.');
    }
    if (url.length > 500) throw new VagaErro('Um dos links de divulgação é longo demais.');
    const id = typeof bruto.id === 'string' && bruto.id.trim() ? bruto.id.trim().slice(0, 40) : crypto.randomUUID();
    links.push({ id, url, descricao });
  }
  if (links.length > 30) throw new VagaErro('São permitidos até 30 links de divulgação.');
  return links;
}

export function lerLinksSalvos(texto: string | null | undefined): LinkDivulgacao[] {
  try {
    const valor = JSON.parse(texto || '[]') as unknown;
    if (!Array.isArray(valor)) return [];
    return valor.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const bruto = item as Record<string, unknown>;
      const url = typeof bruto.url === 'string' ? bruto.url : '';
      const id = typeof bruto.id === 'string' ? bruto.id : '';
      if (!url || !id) return [];
      const descricao = typeof bruto.descricao === 'string' ? bruto.descricao : '';
      return [{ id, url, descricao }];
    });
  } catch {
    return [];
  }
}

