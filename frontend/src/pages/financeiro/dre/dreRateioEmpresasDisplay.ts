import { linhaPassaFornecedoresRateio } from '../../../utils/dreRateioFornecedorMatch';
import { DFC_EMPRESAS_TODAS, labelEmpresaDfc } from '../dfc/dfcEmpresas';
import type { DreRateioConfig, DreRateioOrigem, DreRateioProLaborePct, DreRateioRegra } from './dreRateioEmpresas';
import { rateioProporcional } from './dreSimplesNacionalRateio';

export const RATEIO_DEMAIS_ID_EMPRESA = 0;

export function partesValorRateioEmpresas(
  valor: number,
  percentuais: DreRateioProLaborePct,
): Record<number, number> {
  const pesos = DFC_EMPRESAS_TODAS.map((id) => Math.max(0, percentuais[id] ?? 0));
  const valores = rateioProporcional(valor, pesos);
  return Object.fromEntries(DFC_EMPRESAS_TODAS.map((id, i) => [id, valores[i] ?? 0]));
}

export function regrasRateioParaConta(
  config: DreRateioConfig | null | undefined,
  pathKeyConta: string,
): DreRateioRegra[] {
  if (!config?.regras?.length) return [];
  return config.regras.filter((r) => {
    if (r.origem.tipo === 'fornecedores') {
      return r.origem.pathKeyConta === pathKeyConta && r.origem.nomes.length > 0;
    }
    if (r.origem.tipo === 'plano_contas') {
      return r.origem.pathKey === pathKeyConta;
    }
    return false;
  });
}

export { normalizarNomeFornecedorRateio } from '../../../utils/dreRateioFornecedorMatch';

export function regraFornecedorParaLinha(
  regras: DreRateioRegra[],
  nomeFornecedor: string | null | undefined,
): DreRateioRegra | null {
  const nome = nomeFornecedor ?? '';
  if (!nome.trim()) return null;
  for (const r of regras) {
    if (r.origem.tipo !== 'fornecedores') continue;
    if (linhaPassaFornecedoresRateio(nome, r.origem.nomes)) return r;
  }
  return null;
}

/** Soma das fatias de rateio para as empresas do filtro da faixa. */
export function somaFatiaRateioEmpresasFiltro(
  totalRateado: number,
  percentuais: DreRateioProLaborePct,
  idEmpresasFiltro: number[],
): number {
  if (Math.abs(totalRateado) < 0.005 || idEmpresasFiltro.length === 0) return 0;
  const partes = partesValorRateioEmpresas(totalRateado, percentuais);
  return idEmpresasFiltro.reduce((s, id) => s + (partes[id] ?? 0), 0);
}

/**
 * Detalhe com rateio por fornecedor: demais lançamentos ficam no físico do filtro;
 * fornecedores rateados buscam em todas as empresas e exibem só a fatia do filtro.
 */
export function montarDetalheRateioEmpresasFiltro<
  T extends {
    id: number;
    descricaoLancamento?: string | null;
    nome?: string | null;
    dataVencimento?: string | null;
    dataBaixa?: string | null;
    dataCompetencia?: string | null;
    valorBaixado: number;
    tipoRef: 'A' | 'L';
    idEmpresa: number;
    empresa?: string | null;
    idContaFinanceiro?: number | null;
  },
>(linhas: T[], regras: DreRateioRegra[], idEmpresasFiltro: number[]): T[] {
  const regrasFf = regras.filter((r) => r.origem.tipo === 'fornecedores' && r.origem.nomes.length > 0);
  if (regrasFf.length === 0 || idEmpresasFiltro.length === 0) return linhas;

  const idsFiltro = new Set(idEmpresasFiltro);
  const out: T[] = [];

  for (const row of linhas) {
    const regra = regraFornecedorParaLinha(regrasFf, row.nome ?? null);
    if (regra) {
      const partes = partesValorRateioEmpresas(row.valorBaixado, regra.percentuais);
      for (const idEmp of idEmpresasFiltro) {
        const valor = partes[idEmp] ?? 0;
        if (Math.abs(valor) < 0.005) continue;
        out.push({
          ...row,
          idEmpresa: idEmp,
          empresa: labelEmpresaDfc(idEmp),
          valorBaixado: valor,
        });
      }
      continue;
    }
    if (idsFiltro.has(row.idEmpresa)) {
      out.push(row);
    }
  }

  return out;
}

/** Aplica recorte ou expansão do rateio por fornecedor no detalhe de lançamentos. */
export function aplicarRecorteRateioDetalhe<
  T extends {
    id: number;
    descricaoLancamento?: string | null;
    nome?: string | null;
    dataVencimento?: string | null;
    dataBaixa?: string | null;
    dataCompetencia?: string | null;
    valorBaixado: number;
    tipoRef: 'A' | 'L';
    idEmpresa: number;
    empresa?: string | null;
    idContaFinanceiro?: number | null;
  },
>(linhas: T[], regras: DreRateioRegra[], recorte?: number): T[] {
  const regrasFf = regras.filter((r) => r.origem.tipo === 'fornecedores' && r.origem.nomes.length > 0);
  if (regrasFf.length === 0) return linhas;

  if (recorte === RATEIO_DEMAIS_ID_EMPRESA) {
    return linhas.filter((row) => !regraFornecedorParaLinha(regrasFf, row.nome ?? null));
  }

  if (recorte != null && recorte > 0) {
    return montarDetalheRateioEmpresasFiltro(linhas, regrasFf, [recorte]);
  }

  return expandirLinhasDetalheRateioEmpresas(linhas, regras);
}

export function expandirLinhasDetalheRateioEmpresas<
  T extends {
    id: number;
    descricaoLancamento?: string | null;
    nome?: string | null;
    dataVencimento?: string | null;
    dataBaixa?: string | null;
    dataCompetencia?: string | null;
    valorBaixado: number;
    tipoRef: 'A' | 'L';
    idEmpresa: number;
    empresa?: string | null;
    idContaFinanceiro?: number | null;
  },
>(linhas: T[], regras: DreRateioRegra[]): T[] {
  if (regras.length === 0) return linhas;
  const regrasFf = regras.filter((r) => r.origem.tipo === 'fornecedores' && r.origem.nomes.length > 0);
  if (regrasFf.length === 0) return linhas;

  const out: T[] = [];
  for (const row of linhas) {
    const regra = regraFornecedorParaLinha(regrasFf, row.nome ?? null);
    if (!regra) {
      out.push(row);
      continue;
    }
    const partes = partesValorRateioEmpresas(row.valorBaixado, regra.percentuais);
    for (const idEmp of DFC_EMPRESAS_TODAS) {
      const valor = partes[idEmp] ?? 0;
      if (Math.abs(valor) < 0.005) continue;
      out.push({
        ...row,
        idEmpresa: idEmp,
        empresa: labelEmpresaDfc(idEmp),
        valorBaixado: valor,
      });
    }
  }
  return out;
}

export function labelOrigemResumoRateio(origem: DreRateioOrigem): string {
  if (origem.tipo === 'plano_contas') return `${origem.codigo} — ${origem.nome}`;
  const qtd = origem.nomes.length;
  const nomes =
    qtd === 0 ? 'nenhum fornecedor' : qtd === 1 ? origem.nomes[0]! : `${qtd} fornecedores`;
  return `${origem.codigoConta} — ${origem.nomeConta} · ${nomes}`;
}
