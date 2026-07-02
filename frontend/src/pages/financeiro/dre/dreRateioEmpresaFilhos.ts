import {
  DFC_EMPRESA_OPCOES,
  DFC_EMPRESAS_TODAS,
  DFC_ID_EMPRESA_RN_MARQUES,
} from '../dfc/dfcEmpresas';
import type { DreEstruturaNo } from './ArvoreContasDre';

function empresaPorTextoFilho(texto: string): number | null {
  const t = texto.toLowerCase();
  for (const o of DFC_EMPRESA_OPCOES) {
    if (t.includes(o.label.toLowerCase())) return o.id;
  }
  if (t.includes('rn marques') || t.includes('r n marques')) return DFC_ID_EMPRESA_RN_MARQUES;
  return null;
}

/** Mapeia filhas analíticas da DRE para idEmpresa (ex.: 13.1.12.1 → Só Aço). */
export function mapearFilhosParaEmpresas(filhos: DreEstruturaNo[]): Map<number, DreEstruturaNo> | null {
  if (filhos.length === 0) return null;

  const porNome = new Map<number, DreEstruturaNo>();
  for (const f of filhos) {
    const id = empresaPorTextoFilho(`${f.nome} ${f.codigo}`);
    if (id != null && !porNome.has(id)) porNome.set(id, f);
  }
  if (porNome.size === filhos.length && porNome.size === DFC_EMPRESAS_TODAS.length) {
    return porNome;
  }

  const sorted = [...filhos].sort((a, b) =>
    a.codigo.localeCompare(b.codigo, undefined, { numeric: true }),
  );
  if (sorted.length === DFC_EMPRESAS_TODAS.length) {
    const porOrdem = new Map<number, DreEstruturaNo>();
    DFC_EMPRESAS_TODAS.forEach((id, i) => {
      const filho = sorted[i];
      if (filho) porOrdem.set(id, filho);
    });
    return porOrdem;
  }

  return porNome.size > 0 ? porNome : null;
}

export function filhosSaoRateioEmpresa(filhos: DreEstruturaNo[]): boolean {
  const map = mapearFilhosParaEmpresas(filhos);
  return map != null && map.size === filhos.length;
}
