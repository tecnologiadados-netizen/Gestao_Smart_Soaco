export const SETOR_EXCLUIDOS = new Set(['---', 'Outros', 'A definir', 'Setor', '', null as unknown as string]);

export const SETOR_PESO = new Set(['Porta Paletes', 'Gôndolas']);

/** A partir de mar/2026, Gôndolas e Porta Paletes passam a medir pedidos atendidos. */
export const SETOR_PEDIDOS_CUTOVER = new Date(2026, 2, 1);

/** Início do histórico mensal (alinhado ao BI / gond_portap.sql). */
export const PRODUCAO_HISTORICO_INICIO = new Date(2024, 0, 1);
