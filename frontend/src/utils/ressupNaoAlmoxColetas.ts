/** Coletas elegíveis na análise Ressup Não Almox (espelha backend). */
export const RESSUP_NAO_ALMOX_COLETAS = [
  'ISOPOR',
  'TANQUES DE RESFRIADORES',
  'LAMIPRO/POLIPROPLENO',
  'AGLOMERADOS E COMPENSADOS',
  'FUNDÍVEIS',
] as const;

/** Coletas em que o estoque em produção não usa linha Marcenaria. */
export const RESSUP_NAO_ALMOX_COLETAS_SEM_MARCENARIA = [
  'FUNDÍVEIS',
  'ISOPOR',
  'LAMIPRO/POLIPROPLENO',
] as const;

/** Coletas em que o setor 2 (almox secundário) não entra no saldo. */
export const COLETAS_EXCLUIR_SETOR2_ALMOX = [
  'ISOPOR',
  'LAMIPRO/POLIPROPLENO',
  'AGLOMERADOS E COMPENSADOS',
] as const;

export const SETOR_ALMOX_SECUNDARIO = 2;

export function coletaExcluiSetor2Almox(nomeColeta: string | null | undefined): boolean {
  const n = (nomeColeta ?? '').trim().toUpperCase();
  return COLETAS_EXCLUIR_SETOR2_ALMOX.some((c) => c.toUpperCase() === n);
}

/** Fundíveis e tanques: setor 2 permanece e é destacado em card. */
export function coletaDestacaSetor2Almox(nomeColeta: string | null | undefined): boolean {
  const n = (nomeColeta ?? '').trim().toUpperCase();
  return (
    n === 'FUNDÍVEIS' ||
    n === 'FUNDIVEIS' ||
    n === 'TANQUES DE RESFRIADORES'
  );
}

export function coletaExcluiMarcenaria(nomeColeta: string | null | undefined): boolean {
  const n = (nomeColeta ?? '').trim().toUpperCase();
  return RESSUP_NAO_ALMOX_COLETAS_SEM_MARCENARIA.some((c) => c.toUpperCase() === n);
}

export function isColetaFundiveis(nomeColeta: string | null | undefined): boolean {
  const n = (nomeColeta ?? '').trim().toUpperCase();
  return n === 'FUNDÍVEIS' || n === 'FUNDIVEIS';
}
