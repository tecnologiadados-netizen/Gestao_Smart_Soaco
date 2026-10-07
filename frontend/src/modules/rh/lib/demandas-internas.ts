import { rhFetchJson } from '@rh/lib/rh-fetch';

export type DemandaAnexo = {
  id: string;
  nome: string;
  mimeType: string;
  storagePath: string;
};

export type DemandaItem = { id: string; texto: string; feito: boolean };
export type DemandaChecklist = { id: string; titulo: string; itens: DemandaItem[] };

export type DemandaCard = {
  id: string;
  quadroId: string;
  listaId: string;
  titulo: string;
  observacao: string;
  concluido: boolean;
  cor: string;
  prazo: string | null;
  ordem: number;
  checklists: DemandaChecklist[];
  anexos: DemandaAnexo[];
};

export type DemandaLista = {
  id: string;
  quadroId: string;
  nome: string;
  ordem: number;
  cards: DemandaCard[];
};

export type DemandaQuadro = {
  id: string;
  nome: string;
  ordem: number;
  listas: DemandaLista[];
};

export type DemandasArvore = { quadros: DemandaQuadro[] };

export type CardPatch = {
  titulo?: string;
  observacao?: string;
  concluido?: boolean;
  checklists?: DemandaChecklist[];
  cor?: string;
  prazo?: string | null;
};

export const CORES_POSTIT = [
  { id: 'branco', rotulo: 'Branco', fundo: '#FFFFFF', texto: '#10233f', dobra: '#D5DEE8' },
  { id: 'amarelo', rotulo: 'Amarelo', fundo: '#FFE56A', texto: '#3A2A00', dobra: '#E2C63A' },
  { id: 'pessego', rotulo: 'Pêssego', fundo: '#FFCBA4', texto: '#3A2A00', dobra: '#E5A87A' },
  { id: 'laranja', rotulo: 'Laranja', fundo: '#F5A524', texto: '#FFFFFF', dobra: '#D4890C' },
  { id: 'coral', rotulo: 'Coral', fundo: '#FF6F61', texto: '#FFFFFF', dobra: '#D45548' },
  { id: 'vermelho', rotulo: 'Vermelho', fundo: '#E23B3B', texto: '#FFFFFF', dobra: '#B82A2A' },
  { id: 'rosa', rotulo: 'Rosa', fundo: '#E36A9A', texto: '#FFFFFF', dobra: '#C44E7C' },
  { id: 'vinho', rotulo: 'Vinho', fundo: '#8E3A59', texto: '#FFFFFF', dobra: '#6E2A44' },
  { id: 'lilas', rotulo: 'Lilás', fundo: '#C9B6E4', texto: '#2C2140', dobra: '#A890C8' },
  { id: 'roxo', rotulo: 'Roxo', fundo: '#8E6CC0', texto: '#FFFFFF', dobra: '#6E4E9E' },
  { id: 'azul', rotulo: 'Azul', fundo: '#3D8BFD', texto: '#FFFFFF', dobra: '#2468D0' },
  { id: 'marinho', rotulo: 'Marinho', fundo: '#1B4F8A', texto: '#FFFFFF', dobra: '#123866' },
  { id: 'ciano', rotulo: 'Ciano', fundo: '#26C6DA', texto: '#08343A', dobra: '#1A9AAB' },
  { id: 'menta', rotulo: 'Menta', fundo: '#7DDEAE', texto: '#0E3324', dobra: '#5CB88A' },
  { id: 'verde', rotulo: 'Verde', fundo: '#7CB342', texto: '#FFFFFF', dobra: '#5C8A2C' },
  { id: 'lima', rotulo: 'Lima', fundo: '#D4E157', texto: '#2A3300', dobra: '#B4C23A' },
  { id: 'cinza', rotulo: 'Cinza', fundo: '#90A4AE', texto: '#FFFFFF', dobra: '#708890' },
] as const;

export function corDoPostIt(id: string | null | undefined) {
  return CORES_POSTIT.find((item) => item.id === id) ?? CORES_POSTIT[0];
}

export function rotuloPrazo(iso: string | null | undefined) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function prazoAtrasado(iso: string | null | undefined, concluido: boolean) {
  if (!iso || concluido || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const hoje = new Date();
  const chave = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  return iso < chave;
}

const BASE = 'demandas-internas';

export function inserirAntes(ids: string[], id: string, antesDeId: string | null): string[] {
  const sem = ids.filter((item) => item !== id);
  if (!antesDeId || antesDeId === id) return [...sem, id];
  const indice = sem.indexOf(antesDeId);
  if (indice < 0) return [...sem, id];
  return [...sem.slice(0, indice), id, ...sem.slice(indice)];
}

export function getDemandas(): Promise<DemandasArvore> {
  return rhFetchJson<DemandasArvore>(BASE);
}

export function criarQuadro(nome: string): Promise<DemandasArvore> {
  return rhFetchJson(BASE + '/quadros', { method: 'POST', body: { nome } });
}

export function renomearQuadro(id: string, nome: string): Promise<DemandasArvore> {
  return rhFetchJson(`${BASE}/quadros/${id}`, { method: 'PATCH', body: { nome } });
}

export function excluirQuadro(id: string, senha: string): Promise<DemandasArvore> {
  return rhFetchJson(`${BASE}/quadros/${id}`, { method: 'DELETE', body: { senha } });
}

export function criarLista(quadroId: string, nome: string): Promise<DemandasArvore> {
  return rhFetchJson(`${BASE}/listas`, { method: 'POST', body: { quadroId, nome } });
}

export function renomearLista(id: string, nome: string): Promise<DemandasArvore> {
  return rhFetchJson(`${BASE}/listas/${id}`, { method: 'PATCH', body: { nome } });
}

export function moverLista(id: string, antesDeId: string | null): Promise<DemandasArvore> {
  return rhFetchJson(`${BASE}/listas/${id}/mover`, { method: 'POST', body: { antesDeId } });
}

export function excluirLista(id: string): Promise<DemandasArvore> {
  return rhFetchJson(`${BASE}/listas/${id}`, { method: 'DELETE' });
}

export function criarCard(listaId: string, titulo: string, cor = 'branco'): Promise<DemandasArvore> {
  return rhFetchJson(`${BASE}/cards`, { method: 'POST', body: { listaId, titulo, cor } });
}

export function atualizarCard(id: string, patch: CardPatch): Promise<DemandasArvore> {
  return rhFetchJson(`${BASE}/cards/${id}`, { method: 'PATCH', body: patch });
}

export function moverCard(id: string, listaId: string, antesDeId: string | null): Promise<DemandasArvore> {
  return rhFetchJson(`${BASE}/cards/${id}/mover`, { method: 'POST', body: { listaId, antesDeId } });
}

export function excluirCard(id: string): Promise<DemandasArvore> {
  return rhFetchJson(`${BASE}/cards/${id}`, { method: 'DELETE' });
}

export function anexarPrint(cardId: string, arquivo: File): Promise<DemandasArvore> {
  const form = new FormData();
  form.append('file', arquivo);
  return rhFetchJson(`${BASE}/cards/${cardId}/anexos`, { method: 'POST', body: form });
}

export function excluirAnexo(id: string): Promise<DemandasArvore> {
  return rhFetchJson(`${BASE}/anexos/${id}`, { method: 'DELETE' });
}

export function corDoQuadro(id: string): string {
  const cores = ['#0079bf', '#519839', '#89609e', '#cd5a91', '#d29034', '#4bbf6b', '#00aecc', '#838c91'];
  let n = 0;
  for (const ch of id) n = (n + ch.charCodeAt(0)) % cores.length;
  return cores[n] ?? cores[0];
}

export function progressoChecklist(card: DemandaCard): { feitos: number; total: number } | null {
  const itens = card.checklists.flatMap((lista) => lista.itens);
  if (!itens.length) return null;
  return { feitos: itens.filter((item) => item.feito).length, total: itens.length };
}
