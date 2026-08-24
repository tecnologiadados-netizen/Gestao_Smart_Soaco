export type RfvScores = { r: number; f: number; v: number };

export type RfvSegmentoDef = {
  id: string;
  label: string;
  cor: string;
  textCor: string;
  /** Região aproximada na matriz (Recência × FV) para layout visual */
  gridArea: string;
};

export const RFV_SEGMENTOS: RfvSegmentoDef[] = [
  { id: 'campeoes', label: 'Campeões', cor: '#E8886B', textCor: '#ffffff', gridArea: '1 / 5 / 2 / 6' },
  { id: 'nao_posso_perde_los', label: 'Não posso perdê-los', cor: '#67D4F7', textCor: '#1a1a1a', gridArea: '1 / 1 / 2 / 3' },
  { id: 'clientes_fieis', label: 'Clientes fiéis', cor: '#B5D96C', textCor: '#1a1a1a', gridArea: '1 / 3 / 3 / 6' },
  { id: 'em_risco', label: 'Em risco', cor: '#F5D76E', textCor: '#1a1a1a', gridArea: '2 / 1 / 4 / 3' },
  { id: 'potenciais_fieis', label: 'Potenciais fiéis', cor: '#9C7B5C', textCor: '#ffffff', gridArea: '3 / 4 / 5 / 6' },
  { id: 'clientes_recentes', label: 'Clientes recentes', cor: '#4ECDC4', textCor: '#1a1a1a', gridArea: '5 / 5 / 6 / 6' },
  { id: 'promissores', label: 'Promissores', cor: '#C9A0B8', textCor: '#1a1a1a', gridArea: '5 / 4 / 6 / 5' },
  { id: 'precisam_atencao', label: 'Precisam de atenção', cor: '#2A7B8C', textCor: '#ffffff', gridArea: '3 / 3 / 4 / 4' },
  { id: 'prestes_hibernar', label: 'Prestes a hibernar', cor: '#C4B896', textCor: '#1a1a1a', gridArea: '4 / 3 / 6 / 4' },
  { id: 'hibernando', label: 'Hibernando', cor: '#4A5568', textCor: '#ffffff', gridArea: '4 / 2 / 5 / 3' },
  { id: 'perdidos', label: 'Perdidos', cor: '#C0392B', textCor: '#ffffff', gridArea: '4 / 1 / 6 / 3' },
  { id: 'outros', label: 'Outros', cor: '#64748B', textCor: '#ffffff', gridArea: '5 / 4 / 6 / 6' },
];

const SEGMENTO_OUTROS = 'outros';

/** Prioridade decrescente — primeiro match vence. */
export function classificarSegmentoRfv({ r, f, v }: RfvScores): string {
  if (r >= 4 && f >= 4 && v >= 4) return 'campeoes';
  if (r <= 2 && f >= 4 && v >= 4) return 'nao_posso_perde_los';
  if (r >= 3 && f >= 4 && v >= 3) return 'clientes_fieis';
  if (r <= 2 && f >= 3 && v >= 3) return 'em_risco';
  if (r >= 4 && f >= 2 && v >= 2) return 'potenciais_fieis';
  if (r >= 4 && f <= 2) return 'clientes_recentes';
  if (r >= 3 && f <= 2 && v >= 3) return 'promissores';
  if (r === 3 && f === 3) return 'precisam_atencao';
  if (r === 2 && f <= 2 && v <= 2) return 'hibernando';
  if (r === 2 && f <= 2) return 'prestes_hibernar';
  if (r === 1) return 'perdidos';
  return SEGMENTO_OUTROS;
}

export function fvScoreFrom(f: number, v: number): number {
  return Math.max(1, Math.min(5, Math.round((f + v) / 2)));
}

export function labelSegmento(id: string): string {
  return RFV_SEGMENTOS.find((s) => s.id === id)?.label ?? id;
}
