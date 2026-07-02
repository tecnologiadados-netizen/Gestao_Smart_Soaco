import type { EmpresaOption } from './types';

/** Empresas disponíveis no filtro do painel (ordem e rótulos fixos). */
export const EMPRESAS_PAINEL: EmpresaOption[] = [
  { id: 1, nome: "SÓ AÇO INDUSTRIAL" },
  { id: 3, nome: "R N MARQUES" },
  { id: 2, nome: "SÓ MÓVEIS" },
  { id: 5, nome: "SÓ REFRIGERAÇÃO" },
];

export const EMPRESAS_PAINEL_IDS = EMPRESAS_PAINEL.map((empresa) => empresa.id);

export function getEmpresaPainelNome(id: number): string | null {
  return EMPRESAS_PAINEL.find((empresa) => empresa.id === id)?.nome ?? null;
}

/**
 * Filtro por empresa Weberp (af.idEmpresa).
 * null = todas as empresas habilitadas no painel, não todas as empresas do banco.
 */
export function buildEmpresaFilter(empresaId?: number | null): {
  clause: string;
  params: number[];
} {
  if (empresaId == null || empresaId <= 0) {
    return {
      clause: ` AND af.idEmpresa IN (${EMPRESAS_PAINEL_IDS.map(() => "?").join(",")}) `,
      params: [...EMPRESAS_PAINEL_IDS],
    };
  }
  return {
    clause: " AND af.idEmpresa = ? ",
    params: [empresaId],
  };
}

export function parseEmpresaIdParam(
  value: string | null | undefined,
): number | null {
  if (!value?.trim()) return null;
  const id = Number.parseInt(value, 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return EMPRESAS_PAINEL_IDS.includes(id) ? id : null;
}
