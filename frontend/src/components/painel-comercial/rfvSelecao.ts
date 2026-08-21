import type { RfvClienteItem } from '../../api/rfvClientes';

export type RfvSelecao =
  | null
  | { tipo: 'segmento'; segmentoId: string }
  | { tipo: 'celula'; rScore: number; fvScore: number }
  | { tipo: 'score'; dim: 'r' | 'f' | 'v'; score: number };

export function toggleSelecao<T extends RfvSelecao>(atual: RfvSelecao, nova: Exclude<RfvSelecao, null>): RfvSelecao {
  if (!atual) return nova;
  if (atual.tipo !== nova.tipo) return nova;
  if (atual.tipo === 'segmento' && nova.tipo === 'segmento' && atual.segmentoId === nova.segmentoId) return null;
  if (atual.tipo === 'celula' && nova.tipo === 'celula' && atual.rScore === nova.rScore && atual.fvScore === nova.fvScore) return null;
  if (atual.tipo === 'score' && nova.tipo === 'score' && atual.dim === nova.dim && atual.score === nova.score) return null;
  return nova;
}

export function filtrarClientesPorSelecao(clientes: RfvClienteItem[], selecao: RfvSelecao): RfvClienteItem[] {
  if (!selecao) return clientes;
  if (selecao.tipo === 'segmento') return clientes.filter((c) => c.segmentoId === selecao.segmentoId);
  if (selecao.tipo === 'celula') return clientes.filter((c) => c.rScore === selecao.rScore && c.fvScore === selecao.fvScore);
  if (selecao.dim === 'r') return clientes.filter((c) => c.rScore === selecao.score);
  if (selecao.dim === 'f') return clientes.filter((c) => c.fScore === selecao.score);
  return clientes.filter((c) => c.vScore === selecao.score);
}

export function isSegmentoSelecionado(selecao: RfvSelecao, segmentoId: string): boolean {
  return selecao?.tipo === 'segmento' && selecao.segmentoId === segmentoId;
}

export function isScoreSelecionado(selecao: RfvSelecao, dim: 'r' | 'f' | 'v', score: number): boolean {
  return selecao?.tipo === 'score' && selecao.dim === dim && selecao.score === score;
}

export function isCelulaSelecionada(selecao: RfvSelecao, rScore: number, fvScore: number): boolean {
  return selecao?.tipo === 'celula' && selecao.rScore === rScore && selecao.fvScore === fvScore;
}

export function descricaoSelecao(selecao: RfvSelecao, labelSegmento: (id: string) => string): string {
  if (!selecao) return 'Todos os clientes';
  if (selecao.tipo === 'segmento') return labelSegmento(selecao.segmentoId);
  if (selecao.tipo === 'celula') return `Recência R${selecao.rScore} × FV ${selecao.fvScore}`;
  const dimLabel = selecao.dim === 'r' ? 'Recência' : selecao.dim === 'f' ? 'Frequência' : 'Valor';
  const prefix = selecao.dim === 'r' ? 'R' : selecao.dim === 'f' ? 'F' : 'V';
  return `${dimLabel} ${prefix}${selecao.score}`;
}
