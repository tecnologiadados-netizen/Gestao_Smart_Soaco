import { PERMISSOES, type CodigoPermissao } from '../config/permissoes';

/** Atribuídas por usuário (não herdadas do grupo). */
export const PERMISSOES_PRIORIDADE_PENDENCIAS_COMPRADOR: CodigoPermissao[] = [
  PERMISSOES.COMPRAS_PENDENCIAS_PRIORIDADE_COMPRADOR_1,
  PERMISSOES.COMPRAS_PENDENCIAS_PRIORIDADE_COMPRADOR_2,
  PERMISSOES.COMPRAS_PENDENCIAS_PRIORIDADE_COMPRADOR_3,
];

export const LABELS_PRIORIDADE_PENDENCIAS_COMPRADOR: Record<CodigoPermissao, string> = {
  [PERMISSOES.COMPRAS_PENDENCIAS_PRIORIDADE_COMPRADOR_1]: 'Comprador 1',
  [PERMISSOES.COMPRAS_PENDENCIAS_PRIORIDADE_COMPRADOR_2]: 'Comprador 2',
  [PERMISSOES.COMPRAS_PENDENCIAS_PRIORIDADE_COMPRADOR_3]: 'Comprador 3',
};

export function isPermissaoPrioridadePendenciasUsuario(codigo: string): boolean {
  return PERMISSOES_PRIORIDADE_PENDENCIAS_COMPRADOR.includes(codigo as CodigoPermissao);
}

const PERMISSAO_POR_COMPRADOR: Record<string, CodigoPermissao> = {
  'Comprador 1': PERMISSOES.COMPRAS_PENDENCIAS_PRIORIDADE_COMPRADOR_1,
  'Comprador 2': PERMISSOES.COMPRAS_PENDENCIAS_PRIORIDADE_COMPRADOR_2,
  'Comprador 3': PERMISSOES.COMPRAS_PENDENCIAS_PRIORIDADE_COMPRADOR_3,
};

export function podeEditarPrioridadePendencias(
  comprador: string | null | undefined,
  isMaster: boolean,
  hasPermission: (c: CodigoPermissao) => boolean
): boolean {
  if (isMaster) return true;
  const codigo = PERMISSAO_POR_COMPRADOR[String(comprador ?? '').trim()];
  if (!codigo) return false;
  return hasPermission(codigo);
}

export function prioridadePendenciasDePermissoesUsuario(permissoes: string[] | null | undefined): string[] {
  return (permissoes ?? []).filter((p) => isPermissaoPrioridadePendenciasUsuario(p));
}
