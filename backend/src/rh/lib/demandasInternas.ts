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

const MAX_EMAILS = 30;
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** Lista de e-mails do card: minúsculos, sem repetição. E-mail inválido é recusado. */
export function normalizarEmails(valor: unknown): string[] {
  if (!Array.isArray(valor)) throw new DemandaErro('Informe os e-mails como uma lista.');
  const emails: string[] = [];
  for (const bruto of valor) {
    const email = String(bruto ?? '').trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_RE.test(email) || email.length > 254) throw new DemandaErro(`E-mail inválido: ${email}`);
    if (!emails.includes(email)) emails.push(email);
  }
  if (emails.length > MAX_EMAILS) throw new DemandaErro(`Informe no máximo ${MAX_EMAILS} e-mails por card.`);
  return emails;
}

export function lerEmails(bruto: string): string[] {
  try {
    return normalizarEmails(JSON.parse(bruto));
  } catch {
    return [];
  }
}

export const PRIORIDADES = ['baixa', 'media', 'alta'] as const;
export type Prioridade = (typeof PRIORIDADES)[number];
const ROTULO_PRIORIDADE: Record<Prioridade, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta' };

export function rotuloPrioridade(prioridade: string | null): string {
  return prioridade && prioridade in ROTULO_PRIORIDADE ? ROTULO_PRIORIDADE[prioridade as Prioridade] : 'sem prioridade';
}

export function normalizarPrioridade(valor: unknown): Prioridade | null {
  if (valor === undefined || valor === null || String(valor).trim() === '') return null;
  const prioridade = String(valor).trim().toLowerCase();
  if (!(PRIORIDADES as readonly string[]).includes(prioridade)) throw new DemandaErro('Escolha a prioridade: baixa, média ou alta.');
  return prioridade as Prioridade;
}

export type Responsavel = { matricula: string; nome: string };

const MAX_RESPONSAVEIS = 20;

/** Matrículas pedidas pelo cliente; o nome vem sempre do orgânico (ver repositório). */
export function matriculasResponsaveis(valor: unknown): string[] {
  if (!Array.isArray(valor)) throw new DemandaErro('Informe os responsáveis como uma lista.');
  const matriculas: string[] = [];
  for (const bruto of valor) {
    const matricula = String(
      bruto && typeof bruto === 'object' ? (bruto as Record<string, unknown>).matricula ?? '' : bruto ?? '',
    ).trim();
    if (matricula && !matriculas.includes(matricula)) matriculas.push(matricula);
  }
  if (matriculas.length > MAX_RESPONSAVEIS) throw new DemandaErro(`Informe no máximo ${MAX_RESPONSAVEIS} responsáveis.`);
  return matriculas;
}

export function lerResponsaveis(bruto: string): Responsavel[] {
  try {
    const lista = JSON.parse(bruto);
    if (!Array.isArray(lista)) return [];
    return lista
      .map((item) => ({ matricula: String(item?.matricula ?? '').trim(), nome: String(item?.nome ?? '').trim() }))
      .filter((item) => item.matricula && item.nome);
  } catch {
    return [];
  }
}

export type EstadoCardNotificavel = {
  titulo: string;
  observacao: string;
  concluido: boolean;
  prazo: string | null;
  checklists: Checklist[];
  prioridade?: string | null;
  responsaveis?: Responsavel[];
};

export function formatarPrazo(prazo: string | null): string {
  if (!prazo) return 'sem prazo';
  const [ano, mes, dia] = prazo.split('-');
  return `${dia}/${mes}/${ano}`;
}

function resumir(texto: string, max = 300): string {
  const limpo = texto.trim();
  return limpo.length > max ? `${limpo.slice(0, max - 1)}…` : limpo;
}

const ROTULO_COR: Record<string, string> = {
  pessego: 'Pêssego',
  lilas: 'Lilás',
};

function rotuloCor(cor: string): string {
  return ROTULO_COR[cor] ?? cor.charAt(0).toUpperCase() + cor.slice(1);
}

/** Mudanças que entram só no histórico do card, sem aviso por e-mail. */
export function descreverMudancasSoHistorico(
  antes: { cor: string; emails: string[] },
  depois: { cor: string; emails: string[] },
): string[] {
  const mudancas: string[] = [];
  if ((antes.cor || 'branco') !== (depois.cor || 'branco')) {
    mudancas.push(`Cor do post-it alterada para ${rotuloCor(depois.cor || 'branco')}.`);
  }
  for (const email of depois.emails) {
    if (!antes.emails.includes(email)) mudancas.push(`E-mail incluído na notificação: ${email}`);
  }
  for (const email of antes.emails) {
    if (!depois.emails.includes(email)) mudancas.push(`E-mail retirado da notificação: ${email}`);
  }
  return mudancas;
}

/** Descreve, em frases curtas, o que mudou no card (cor e e-mails não geram aviso). */
export function descreverMudancasCard(antes: EstadoCardNotificavel, depois: EstadoCardNotificavel): string[] {
  const mudancas: string[] = [];
  if (antes.concluido !== depois.concluido) mudancas.push(depois.concluido ? 'Card concluído.' : 'Card reaberto.');
  if (antes.titulo !== depois.titulo) mudancas.push(`Título alterado de “${antes.titulo}” para “${depois.titulo}”.`);
  if ((antes.prioridade ?? null) !== (depois.prioridade ?? null)) {
    mudancas.push(
      depois.prioridade
        ? `Prioridade alterada para ${rotuloPrioridade(depois.prioridade)}.`
        : `Prioridade removida (era ${rotuloPrioridade(antes.prioridade ?? null)}).`,
    );
  }
  const respAntes = antes.responsaveis ?? [];
  const respDepois = depois.responsaveis ?? [];
  for (const r of respDepois) {
    if (!respAntes.some((a) => a.matricula === r.matricula)) mudancas.push(`Responsável incluído: ${r.nome}`);
  }
  for (const r of respAntes) {
    if (!respDepois.some((d) => d.matricula === r.matricula)) mudancas.push(`Responsável retirado: ${r.nome}`);
  }
  if (antes.prazo !== depois.prazo) {
    if (!antes.prazo) mudancas.push(`Prazo definido para ${formatarPrazo(depois.prazo)}.`);
    else if (!depois.prazo) mudancas.push(`Prazo removido (era ${formatarPrazo(antes.prazo)}).`);
    else mudancas.push(`Prazo alterado de ${formatarPrazo(antes.prazo)} para ${formatarPrazo(depois.prazo)}.`);
  }
  if (antes.observacao.trim() !== depois.observacao.trim()) {
    mudancas.push(
      depois.observacao.trim() ? `Observação alterada: ${resumir(depois.observacao)}` : 'Observação apagada.',
    );
  }

  const listasAntes = new Map(antes.checklists.map((lista) => [lista.id, lista]));
  const idsDepois = new Set(depois.checklists.map((lista) => lista.id));
  for (const lista of antes.checklists) {
    if (!idsDepois.has(lista.id)) mudancas.push(`Checklist “${lista.titulo}” excluído.`);
  }
  for (const lista of depois.checklists) {
    const anterior = listasAntes.get(lista.id);
    if (!anterior) {
      mudancas.push(`Checklist “${lista.titulo}” criado.`);
      for (const item of lista.itens) mudancas.push(`Item adicionado em “${lista.titulo}”: ${item.texto}`);
      continue;
    }
    if (anterior.titulo !== lista.titulo) {
      mudancas.push(`Checklist “${anterior.titulo}” renomeado para “${lista.titulo}”.`);
    }
    const itensAntes = new Map(anterior.itens.map((item) => [item.id, item]));
    const itensDepois = new Set(lista.itens.map((item) => item.id));
    for (const item of anterior.itens) {
      if (!itensDepois.has(item.id)) mudancas.push(`Item removido de “${lista.titulo}”: ${item.texto}`);
    }
    for (const item of lista.itens) {
      const itemAntes = itensAntes.get(item.id);
      if (!itemAntes) {
        mudancas.push(`Item adicionado em “${lista.titulo}”: ${item.texto}`);
      } else if (itemAntes.feito !== item.feito) {
        mudancas.push(`${item.feito ? 'Item concluído' : 'Item reaberto'} em “${lista.titulo}”: ${item.texto}`);
      } else if (itemAntes.texto !== item.texto) {
        mudancas.push(`Item alterado em “${lista.titulo}”: ${itemAntes.texto} → ${item.texto}`);
      }
    }
  }
  return mudancas;
}
