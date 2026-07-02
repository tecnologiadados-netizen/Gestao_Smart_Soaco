/**
 * Regras configuráveis de data de entrega (PCP) — carradas e demais categorias em evolução.
 */

export interface RegraDataEntregaCarradaConfig {
  baseData: 'emissao';
  valorCorte: number;
  diasAbaixoCorte: number;
  diasIgualOuAcimaCorte: number;
  incluiInserirRomaneio: boolean;
}

export interface RegraDataEntregaConfig {
  carrada: RegraDataEntregaCarradaConfig;
}

export const DEFAULT_REGRA_DATA_ENTREGA: RegraDataEntregaConfig = {
  carrada: {
    baseData: 'emissao',
    valorCorte: 30000,
    diasAbaixoCorte: 60,
    diasIgualOuAcimaCorte: 45,
    incluiInserirRomaneio: false,
  },
};

/** Dias fixos (legado SQL) quando não há versão vigente na data de emissão do pedido. */
export const LEGADO_DIAS_CARRADA_SEM_VERSAO = 30;
