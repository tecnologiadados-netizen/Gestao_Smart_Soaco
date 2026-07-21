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

/**
 * @deprecated Mantido por compatibilidade; o fallback sem versão vigente usa DEFAULT_REGRA_DATA_ENTREGA.
 */
export const LEGADO_DIAS_CARRADA_SEM_VERSAO = 30;
