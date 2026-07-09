import { PERMISSOES, type CodigoPermissao } from '../config/permissoes.js';
import { usuarioTemAcessoMaster } from '../config/grupoMaster.js';

/** Atribuídas por usuário (não herdadas do grupo). */
export const PERMISSOES_PRIORIDADE_PENDENCIAS_COMPRADOR: CodigoPermissao[] = [
  PERMISSOES.COMPRAS_PENDENCIAS_PRIORIDADE_COMPRADOR_1,
  PERMISSOES.COMPRAS_PENDENCIAS_PRIORIDADE_COMPRADOR_2,
  PERMISSOES.COMPRAS_PENDENCIAS_PRIORIDADE_COMPRADOR_3,
];

export function isPermissaoPrioridadePendenciasUsuario(codigo: string): boolean {
  return PERMISSOES_PRIORIDADE_PENDENCIAS_COMPRADOR.includes(codigo as CodigoPermissao);
}

/** Nomes exatos do atributo Nomus 674 (comprador). */
export const COMPRADORES_PENDENCIAS_PRIORIDADE = ['Comprador 1', 'Comprador 2', 'Comprador 3'] as const;

export type CompradorPendenciasPrioridade = (typeof COMPRADORES_PENDENCIAS_PRIORIDADE)[number];

const PERMISSAO_POR_COMPRADOR: Record<CompradorPendenciasPrioridade, CodigoPermissao> = {
  'Comprador 1': PERMISSOES.COMPRAS_PENDENCIAS_PRIORIDADE_COMPRADOR_1,
  'Comprador 2': PERMISSOES.COMPRAS_PENDENCIAS_PRIORIDADE_COMPRADOR_2,
  'Comprador 3': PERMISSOES.COMPRAS_PENDENCIAS_PRIORIDADE_COMPRADOR_3,
};

export function permissaoPrioridadePendenciasParaComprador(
  comprador: string
): CodigoPermissao | null {
  const key = comprador.trim() as CompradorPendenciasPrioridade;
  return PERMISSAO_POR_COMPRADOR[key] ?? null;
}

export async function usuarioPodeEditarPrioridadePendencias(
  login: string,
  comprador: string,
  perms: CodigoPermissao[]
): Promise<boolean> {
  if (await usuarioTemAcessoMaster(login)) return true;
  const codigo = permissaoPrioridadePendenciasParaComprador(comprador);
  if (!codigo) return false;
  return perms.includes(codigo);
}
