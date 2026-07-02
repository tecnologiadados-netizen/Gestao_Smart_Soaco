import catalogo from '../data/ressupNaoAlmoxDescricoesSimplificadas.json';
import { getCatalogoDescricoesNaoAlmoxRuntime } from './ressupNaoAlmoxCatalogoRuntime';

const MAP_BUNDLED = catalogo as Record<string, string>;

function mapDescricoesAtivo(): Record<string, string> {
  return getCatalogoDescricoesNaoAlmoxRuntime() ?? MAP_BUNDLED;
}

export function normalizarCodProduto(cod: string): string {
  return cod.trim().replace(/\s+/g, ' ');
}

export function descricaoSimplificadaDoCatalogoNaoAlmox(cod: string): string | null {
  const key = normalizarCodProduto(cod);
  const v = mapDescricoesAtivo()[key];
  return v?.trim() ? v.trim() : null;
}
