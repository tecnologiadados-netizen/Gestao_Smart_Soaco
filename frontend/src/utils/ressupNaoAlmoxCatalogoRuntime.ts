import catalogoFund from '../data/ressupNaoAlmoxFundiveisPares.json';

let descricoesRuntime: Record<string, string> | null = null;
let fundiveisRuntime: Record<string, string> | null = null;

const MAP_FUND_BUNDLED = catalogoFund as Record<string, string>;

export function aplicarCatalogoRessupNaoAlmox(partial: {
  descricoes?: Record<string, string>;
  fundiveis?: Record<string, string>;
}): void {
  if (partial.descricoes) descricoesRuntime = partial.descricoes;
  if (partial.fundiveis) fundiveisRuntime = partial.fundiveis;
}

export function getCatalogoDescricoesNaoAlmoxRuntime(): Record<string, string> | null {
  return descricoesRuntime;
}

export function getCatalogoFundiveisRuntime(): Record<string, string> {
  return fundiveisRuntime ?? MAP_FUND_BUNDLED;
}

export function patchCatalogoDescricaoNaoAlmoxRuntime(cod: string, desc: string): void {
  const key = cod.trim().replace(/\s+/g, ' ');
  const base = { ...(descricoesRuntime ?? {}) };
  if (desc.trim()) base[key] = desc.trim();
  else delete base[key];
  descricoesRuntime = base;
}

export function patchCatalogoFundivelRuntime(sem: string, com: string | null): void {
  const key = sem.trim().replace(/\s+/g, ' ');
  const base = { ...getCatalogoFundiveisRuntime() };
  if (com?.trim() && com.trim() !== key) base[key] = com.trim();
  else delete base[key];
  fundiveisRuntime = base;
}

export function codigoPintadoDoCatalogo(codSemPintura: string): string | null {
  const key = codSemPintura.trim().replace(/\s+/g, ' ');
  return getCatalogoFundiveisRuntime()[key]?.trim() || null;
}
