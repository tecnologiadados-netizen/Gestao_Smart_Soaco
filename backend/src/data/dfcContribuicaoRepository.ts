/**
 * DFC — contribuições granulares para filtro no front (sem reconsultar ao refinar).
 */

import type { DfcAgendamentoGranularidade } from './dfcAgendamentoRepository.js';
import { DFC_EMPRESAS_CARGA } from './dfcNomusRepository.js';
import { coletarContribuicoesNomus } from './dfcNomusRepository.js';
import { coletarContribuicoesShop9 } from './dfcShop9Repository.js';
import { isShop9Enabled } from '../config/shop9Db.js';

export type DfcContribuicaoLinha = {
  idContaFinanceiro: number;
  valor: number;
  /** id Nomus normalizado (1–4) via nome da empresa, não o id bruto do ERP. */
  idEmpresa: number;
  /** Nome da empresa no Nomus (para resolver filial quando idEmpresa do ERP diverge). */
  empresa?: string | null;
  contaBancaria: string | null;
  codigoConta: number;
  tipoRef: 'A' | 'L';
  /** Data (YYYY-MM-DD) para formar o período (baixa ou vencimento, conforme origem). */
  dataBucket: string;
};

export async function queryDfcContribuicoesCompletas(params: {
  dataInicio: string;
  dataFim: string;
  granularidade: DfcAgendamentoGranularidade;
}): Promise<{ contribuicoes: DfcContribuicaoLinha[]; erro?: string }> {
  const idEmpresas = [...DFC_EMPRESAS_CARGA];
  const erros: string[] = [];
  const contribuicoes: DfcContribuicaoLinha[] = [];

  const nomus = await coletarContribuicoesNomus({
    dataInicio: params.dataInicio,
    dataFim: params.dataFim,
    idEmpresas,
  });
  if (nomus.erro) erros.push(nomus.erro);
  contribuicoes.push(...nomus.contribuicoes);

  if (isShop9Enabled()) {
    const shop9 = await coletarContribuicoesShop9({
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
      idEmpresas,
    });
    if (shop9.erro) erros.push(shop9.erro);
    contribuicoes.push(...shop9.contribuicoes);
  }

  return {
    contribuicoes,
    erro: erros.length > 0 ? erros.join('; ') : undefined,
  };
}

export function listarContasBancariasDasContribuicoes(contribuicoes: DfcContribuicaoLinha[]): string[] {
  return [
    ...new Set(
      contribuicoes
        .map((c) => c.contaBancaria?.trim())
        .filter((n): n is string => Boolean(n)),
    ),
  ].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}
