import { rhFetchJson } from '@rh/lib/rh-fetch';

export const STATUS_VAGA = [
  'aberta_sem_divulgacao',
  'em_divulgacao',
  'triagem',
  'entrevista',
  'fechada',
] as const;

export type StatusVaga = (typeof STATUS_VAGA)[number];

export type VagaHistorico = {
  id: string;
  tipo: 'status' | 'prazo';
  status: StatusVaga;
  prazo: string | null;
  detalhe: string;
  createdBy: string | null;
  createdAt: string;
};

export type LinkDivulgacao = {
  id: string;
  url: string;
  descricao: string;
};

export type Vaga = {
  id: string;
  titulo: string;
  status: StatusVaga;
  prazo: string | null;
  observacao: string;
  links: LinkDivulgacao[];
  cor: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  historico: VagaHistorico[];
};

const ROTULOS: Record<StatusVaga, string> = {
  aberta_sem_divulgacao: 'Aberta sem divulgação',
  em_divulgacao: 'Em divulgação',
  triagem: 'Triagem',
  entrevista: 'Entrevista',
  fechada: 'Fechada',
};

const PROXIMOS: Record<StatusVaga, StatusVaga[]> = {
  aberta_sem_divulgacao: ['em_divulgacao', 'fechada'],
  em_divulgacao: ['aberta_sem_divulgacao', 'triagem', 'fechada'],
  triagem: ['em_divulgacao', 'entrevista', 'fechada'],
  entrevista: ['triagem', 'em_divulgacao', 'fechada'],
  fechada: ['aberta_sem_divulgacao', 'em_divulgacao'],
};

export function rotuloStatus(status: StatusVaga): string {
  return ROTULOS[status];
}

export function proximosStatus(status: StatusVaga): StatusVaga[] {
  return PROXIMOS[status];
}

export function rotuloPrazo(prazo: string | null): string {
  if (!prazo) return '';
  const [ano, mes, dia] = prazo.split('-');
  if (!ano || !mes || !dia) return prazo;
  return `${dia}/${mes}/${ano}`;
}

export function prazoVencido(vaga: Pick<Vaga, 'prazo' | 'status'>): boolean {
  if (!vaga.prazo || vaga.status === 'fechada') return false;
  const hoje = new Date();
  const iso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  return vaga.prazo < iso;
}

export function fraseHistorico(evento: VagaHistorico, anterior: VagaHistorico | undefined): string {
  if (evento.tipo === 'prazo') {
    return evento.prazo
      ? `Prazo de fechamento definido para ${rotuloPrazo(evento.prazo)}`
      : 'Prazo de fechamento removido';
  }
  if (evento.status === 'fechada') return 'Vaga fechada';
  if (anterior?.status === 'fechada') {
    return evento.status === 'em_divulgacao' ? 'Vaga reaberta em divulgação' : 'Vaga reaberta sem divulgação';
  }
  if (!anterior) {
    return evento.status === 'em_divulgacao' ? 'Vaga aberta em divulgação' : 'Vaga aberta sem divulgação';
  }
  return `Passou para ${rotuloStatus(evento.status)}`;
}

export function getVagas(): Promise<{ vagas: Vaga[] }> {
  return rhFetchJson('vagas');
}

export function criarVaga(entrada: {
  titulo: string;
  status: 'aberta_sem_divulgacao' | 'em_divulgacao';
  prazo: string | null;
  observacao: string;
  links: LinkDivulgacao[];
  cor?: string;
}): Promise<{ vaga: Vaga }> {
  return rhFetchJson('vagas', { method: 'POST', body: entrada });
}

export function atualizarVaga(
  id: string,
  patch: {
    titulo?: string;
    observacao?: string;
    prazo?: string | null;
    status?: StatusVaga;
    detalhe?: string;
    links?: LinkDivulgacao[];
    cor?: string;
  },
): Promise<{ vaga: Vaga }> {
  return rhFetchJson(`vagas/${id}`, { method: 'PATCH', body: patch });
}

export function excluirVaga(id: string): Promise<{ vagas: Vaga[] }> {
  return rhFetchJson(`vagas/${id}`, { method: 'DELETE' });
}
