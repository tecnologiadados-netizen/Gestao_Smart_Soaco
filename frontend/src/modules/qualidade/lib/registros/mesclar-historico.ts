import historicoRncJson from "@qualidade/lib/mock-data/rnc-historico-nomus.json";
import historicoRccJson from "@qualidade/lib/mock-data/rcc-historico-nomus.json";
import type { Registro } from "@qualidade/types/registro";
import { getRegistroDataOcorrencia } from "@qualidade/types/registro";

const historicoRnc = historicoRncJson as Registro[];
const historicoRcc = historicoRccJson as Registro[];

function compararPorData(a: Registro, b: Registro): number {
  return getRegistroDataOcorrencia(b).localeCompare(
    getRegistroDataOcorrencia(a)
  );
}

function mesclarPorIds(
  registrosAtuais: Registro[],
  historico: Registro[]
): Registro[] {
  const ids = new Set(registrosAtuais.map((r) => r.id));
  const novas = historico.filter((r) => !ids.has(r.id));

  if (novas.length === 0) {
    return registrosAtuais;
  }

  return [...registrosAtuais, ...novas].sort(compararPorData);
}

export function mesclarHistoricoRncNomus(
  registrosAtuais: Registro[]
): Registro[] {
  return mesclarPorIds(registrosAtuais, historicoRnc);
}

export function mesclarHistoricoRccNomus(
  registrosAtuais: Registro[]
): Registro[] {
  return mesclarPorIds(registrosAtuais, historicoRcc);
}

export function mesclarHistoricoNomus(registrosAtuais: Registro[]): Registro[] {
  return mesclarHistoricoRccNomus(
    mesclarHistoricoRncNomus(registrosAtuais)
  );
}

export const TOTAL_HISTORICO_RNC_NOMUS = historicoRnc.length;
export const TOTAL_HISTORICO_RCC_NOMUS = historicoRcc.length;
