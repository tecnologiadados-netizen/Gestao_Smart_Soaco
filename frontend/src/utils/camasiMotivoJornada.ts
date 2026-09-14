/**
 * Motivos RICMAQ de início/fim de turno — jornada ociosa, não parada operacional.
 */

function normalizarMotivo(motivo: string): string {
  return motivo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

const JORNADA = /^(INICIO|FIM)(\s+DE)?\s+JORNADA$/;
const INICIO_JORNADA = /^INICIO(\s+DE)?\s+JORNADA$/;

export function isMotivoJornadaCamasi(motivo: string | null | undefined): boolean {
  if (!motivo) return false;
  return JORNADA.test(normalizarMotivo(motivo));
}

export function isMotivoInicioJornadaCamasi(motivo: string | null | undefined): boolean {
  if (!motivo) return false;
  return INICIO_JORNADA.test(normalizarMotivo(motivo));
}

export type CamasiCategoriaParada = 'jornada' | 'operacional';

export function categoriaParadaCamasi(motivo: string | null | undefined): CamasiCategoriaParada {
  return isMotivoJornadaCamasi(motivo) ? 'jornada' : 'operacional';
}
