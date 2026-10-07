import { randomUUID } from 'crypto';

export class DemandaErro extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'DemandaErro';
  }
}

export type ChecklistItem = { id: string; texto: string; feito: boolean };
export type Checklist = { id: string; titulo: string; itens: ChecklistItem[] };

const MAX_CHECKLISTS = 20;
const MAX_ITENS = 100;
const CORES_CARD = new Set([
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
  if (valor === undefined || valor === null || String(valor).trim() === '') return 'branco';
  const cor = String(valor).trim().toLowerCase();
  if (!CORES_CARD.has(cor)) throw new DemandaErro('Escolha uma cor do post-it.');
  return cor;
}

export function normalizarPrazo(valor: unknown): string | null {
  if (valor === undefined || valor === null || String(valor).trim() === '') return null;
  const prazo = String(valor).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(prazo)) throw new DemandaErro('Informe o prazo como uma data.');
  const [ano, mes, dia] = prazo.split('-').map(Number);
  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
    throw new DemandaErro('Informe o prazo como uma data.');
  }
  return prazo;
}

export function inserirAntes(ids: string[], id: string, antesDeId: string | null): string[] {
  const sem = ids.filter((item) => item !== id);
  if (!antesDeId || antesDeId === id) return [...sem, id];
  const indice = sem.indexOf(antesDeId);
  if (indice < 0) return [...sem, id];
  return [...sem.slice(0, indice), id, ...sem.slice(indice)];
}

export function nomeObrigatorio(valor: unknown, rotulo: string, max = 120): string {
  const nome = String(valor ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!nome) throw new DemandaErro(`Informe ${rotulo}.`);
  return nome.slice(0, max);
}

function idEstavel(valor: unknown): string {
  const id = String(valor ?? '').trim();
  return /^[a-zA-Z0-9_-]{8,80}$/.test(id) ? id : '';
}

export function normalizarChecklists(valor: unknown): Checklist[] {
  if (!Array.isArray(valor)) return [];
  const saida: Checklist[] = [];
  for (const bruto of valor.slice(0, MAX_CHECKLISTS)) {
    if (!bruto || typeof bruto !== 'object') continue;
    const row = bruto as Record<string, unknown>;
    const titulo = String(row.titulo ?? 'Checklist')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 120);
    const itensBrutos = Array.isArray(row.itens) ? row.itens : [];
    const itens: ChecklistItem[] = [];
    for (const item of itensBrutos.slice(0, MAX_ITENS)) {
      if (!item || typeof item !== 'object') continue;
      const atual = item as Record<string, unknown>;
      const texto = String(atual.texto ?? '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 500);
      if (!texto) continue;
      itens.push({
        id: idEstavel(atual.id) || randomUUID(),
        texto,
        feito: atual.feito === true,
      });
    }
    saida.push({
      id: idEstavel(row.id) || randomUUID(),
      titulo: titulo || 'Checklist',
      itens,
    });
  }
  return saida;
}

export function lerChecklists(bruto: string): Checklist[] {
  try {
    return normalizarChecklists(JSON.parse(bruto));
  } catch {
    return [];
  }
}
