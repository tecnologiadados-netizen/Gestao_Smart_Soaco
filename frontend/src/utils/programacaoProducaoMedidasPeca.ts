import type { MedidasPecaCatalogEntry } from '../components/programacao-producao/types';
import { normalizarCodComponente } from './programacaoProducaoDescricaoSimplificada';
import { getCatalogoMedidasPecaRuntime } from './programacaoProducaoCatalogoRuntime';

export function medidasPecaDoCatalogo(cod: string): MedidasPecaCatalogEntry | null {
  const key = normalizarCodComponente(cod);
  const map = getCatalogoMedidasPecaRuntime();
  if (!map) return null;
  const entry = map[key];
  if (!entry) return null;
  return {
    med1: entry.med1 != null && Number.isFinite(entry.med1) && entry.med1 > 0 ? entry.med1 : null,
    med2: entry.med2 != null && Number.isFinite(entry.med2) && entry.med2 > 0 ? entry.med2 : null,
  };
}
