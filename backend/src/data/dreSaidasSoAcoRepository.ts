/**
 * DRE — saídas SOACO por competência:
 * - Nomus: agendamentos P efetivos + lançamentos LP (todas as empresas do filtro).
 * - Shop9: Financeiro_Contas (Só Aço, Só Refrigeração, R N Marques) — somado ao Nomus.
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';
import { isShop9Enabled } from '../config/shop9Db.js';
import { empresasComSaidasShop9Dre, normalizarIdsEmpresasDfc } from './dfcShop9Empresa.js';
import { carregarSaidasShop9SoAcoDre, queryDreShop9FornecedorOpcoesRateio, queryDreShop9RateioFornecedorTotais } from './dreShop9SaidasRepository.js';
import { mapaShop9OrdensCatalogoPorPathKeyDre } from './dreRelacaoPcRepository.js';
import {
  resolverPathKeyAgregacaoSaidas,
  mapaIdsContaPorPathKeyDre,
  listarIdsContaPorPathKeyDre,
} from './drePlanoContasMap.js';
import type { DfcAgendamentoDetalheRow, DfcAgendamentoGranularidade } from './dfcAgendamentoRepository.js';
import { labelEmpresaDfc } from './dfcShop9Empresa.js';
import { linhaPassaFornecedoresRateio } from '../utils/dreRateioFornecedorMatch.js';
import { aplicarRateioInssNasLinhasSaidas, resolverPathKeyInssPoolAgregacao } from './dreInssRateio.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Empresas padrão das saídas SOACO na DRE (alinhado à DFC). */
export const DRE_SAIDAS_SOACO_EMPRESAS_PADRAO: readonly number[] = [1, 2, 3, 4];

/** ids Nomus válidos (1=Só Aço, 2=Só Móveis, 3=Refrigeração, 4=RN Marques). */
function normalizarIdsEmpresa(ids: number[] | undefined): number[] {
  const raw = ids?.length ? ids : [...DRE_SAIDAS_SOACO_EMPRESAS_PADRAO];
  return normalizarIdsEmpresasDfc(raw);
}

function loadSql(name: string): string {
  return readFileSync(join(__dirname, 'sql', name), 'utf-8');
}

export type DreSaidasSoAcoAgregado = {
  pathKey: string;
  periodo: string;
  valor: number;
};

export type DreSaidasSoAcoNaoMapeado = {
  idContaFinanceiro: number | null;
  nomePlanoFinanceiro: string;
  valor: number;
  quantidade: number;
};

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatYmd(d: Date | string | null): string | null {
  if (d == null) return null;
  const dt = d instanceof Date ? d : new Date(d as string);
  if (Number.isNaN(dt.getTime())) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function aplicarSql(
  sql: string,
  params: { idEmpresas: number[]; dataInicio: string; dataFim: string },
): string {
  const inEmpresas = normalizarIdsEmpresa(params.idEmpresas).join(', ');
  return sql
    .replace(/\{\{ID_EMPRESAS_IN\}\}/g, inEmpresas)
    .replace(/\{\{DATA_COMPETENCIA_MIN\}\}/g, params.dataInicio)
    .replace(/\{\{DATA_COMPETENCIA_MAX\}\}/g, params.dataFim);
}

function aplicarSqlFornecedorOpcoesRateio(
  sql: string,
  params: { idEmpresas: number[]; idsContas: number[] },
): string | null {
  const idsContas = params.idsContas.filter((n) => Number.isFinite(n) && n > 0);
  if (idsContas.length === 0) return null;
  const inEmpresas = normalizarIdsEmpresa(params.idEmpresas).join(', ');
  const inContas = idsContas.join(', ');
  return sql
    .replace(/\{\{ID_EMPRESAS_IN\}\}/g, inEmpresas)
    .replace(/\{\{ID_CONTAS_IN\}\}/g, inContas);
}

function extrairValorLinha(row: Record<string, unknown>): number {
  return Math.abs(toNum(row.valorBaixado ?? row.valor));
}

function agregarLinhasSaidas(
  list: unknown[],
  granularidade: 'dia' | 'mes',
): {
  linhas: DreSaidasSoAcoAgregado[];
  naoMapeados: DreSaidasSoAcoNaoMapeado[];
  totalBruto: number;
  totalMapeado: number;
} {
  const agregado = new Map<string, number>();
  const naoMap = new Map<string, DreSaidasSoAcoNaoMapeado>();
  let totalBruto = 0;
  let totalMapeado = 0;

  for (const r of list) {
    const row = r as Record<string, unknown>;
    const valor = extrairValorLinha(row);
    if (valor <= 0) continue;
    totalBruto += valor;

    const ymd = formatYmd(row.dataCompetencia as Date | string);
    if (!ymd) continue;
    const periodo = granularidade === 'mes' ? ymd.slice(0, 7) : ymd;

    const idCf = row.idContaFinanceiro != null ? Math.trunc(Number(row.idContaFinanceiro)) : null;
    const nomePlano = String(row.nomePlanoFinanceiro ?? row.nome ?? '').trim();
    const pathKeyInss = resolverPathKeyInssPoolAgregacao(nomePlano, idCf);
    const pathKey = pathKeyInss ?? resolverPathKeyAgregacaoSaidas(idCf, nomePlano);

    if (!pathKey) {
      const k = `${idCf ?? 0}\t${nomePlano}`;
      const cur = naoMap.get(k) ?? {
        idContaFinanceiro: idCf,
        nomePlanoFinanceiro: nomePlano || '(sem nome)',
        valor: 0,
        quantidade: 0,
      };
      cur.valor += valor;
      cur.quantidade += 1;
      naoMap.set(k, cur);
      continue;
    }

    totalMapeado += valor;
    const aggKey = `${pathKey}\t${periodo}`;
    agregado.set(aggKey, (agregado.get(aggKey) ?? 0) + valor);
  }

  const linhas: DreSaidasSoAcoAgregado[] = [...agregado.entries()].map(([k, valor]) => {
    const [pathKey, periodo] = k.split('\t');
    return { pathKey: pathKey!, periodo: periodo!, valor: Math.round(valor * 100) / 100 };
  });

  const naoMapeados = [...naoMap.values()].sort((a, b) => b.valor - a.valor);

  return { linhas, naoMapeados, totalBruto, totalMapeado };
}

function mesclarAgregadosSaidas(
  partes: { linhas: DreSaidasSoAcoAgregado[]; naoMapeados: DreSaidasSoAcoNaoMapeado[]; totalBruto: number; totalMapeado: number }[],
): {
  linhas: DreSaidasSoAcoAgregado[];
  naoMapeados: DreSaidasSoAcoNaoMapeado[];
  totalBruto: number;
  totalMapeado: number;
} {
  const agregado = new Map<string, number>();
  const naoMap = new Map<string, DreSaidasSoAcoNaoMapeado>();
  let totalBruto = 0;
  let totalMapeado = 0;

  for (const p of partes) {
    totalBruto += p.totalBruto;
    totalMapeado += p.totalMapeado;
    for (const l of p.linhas) {
      const k = `${l.pathKey}\t${l.periodo}`;
      agregado.set(k, (agregado.get(k) ?? 0) + l.valor);
    }
    for (const n of p.naoMapeados) {
      const k = `${n.idContaFinanceiro ?? 0}\t${n.nomePlanoFinanceiro}`;
      const cur = naoMap.get(k) ?? { ...n, valor: 0, quantidade: 0 };
      cur.valor += n.valor;
      cur.quantidade += n.quantidade;
      naoMap.set(k, cur);
    }
  }

  const linhas = [...agregado.entries()].map(([k, valor]) => {
    const [pathKey, periodo] = k.split('\t');
    return { pathKey: pathKey!, periodo: periodo!, valor: Math.round(valor * 100) / 100 };
  });

  return {
    linhas,
    naoMapeados: [...naoMap.values()].sort((a, b) => b.valor - a.valor),
    totalBruto,
    totalMapeado,
  };
}

function mesclarIdsPorPathKey(
  nomus: Record<string, number[]>,
  shop9: Record<string, number[]>,
): Record<string, number[]> {
  const out: Record<string, number[]> = { ...nomus };
  for (const [pk, ids] of Object.entries(shop9)) {
    const cur = new Set(out[pk] ?? []);
    for (const id of ids) cur.add(id);
    if (cur.size > 0) out[pk] = [...cur].sort((a, b) => a - b);
  }
  return out;
}

async function carregarSaidasNomusSoAcoDre(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresas: number[];
  granularidade?: 'dia' | 'mes';
}): Promise<{
  linhas: DreSaidasSoAcoAgregado[];
  naoMapeados: DreSaidasSoAcoNaoMapeado[];
  totalBruto: number;
  totalMapeado: number;
  erro?: string;
}> {
  if (!isNomusEnabled()) {
    return { linhas: [], naoMapeados: [], totalBruto: 0, totalMapeado: 0, erro: 'NOMUS_DB_URL não configurado' };
  }
  const pool = getNomusPool();
  if (!pool) {
    return { linhas: [], naoMapeados: [], totalBruto: 0, totalMapeado: 0, erro: 'Pool Nomus indisponível' };
  }

  const idEmpresas = normalizarIdsEmpresa(params.idEmpresas);
  const sqlParams = {
    idEmpresas,
    dataInicio: params.dataInicio,
    dataFim: params.dataFim,
  };
  const sqlAgendamentos = aplicarSql(loadSql('dreSaidasSoAco.sql'), sqlParams);
  const sqlLancamentosLp = aplicarSql(loadSql('dreSaidasSoAcoLancamentosLp.sql'), sqlParams);

  try {
    const granularidade = params.granularidade ?? 'mes';
    const [[rawAg], [rawLp]] = await Promise.all([
      pool.query(sqlAgendamentos),
      pool.query(sqlLancamentosLp),
    ]);
    const listAg = Array.isArray(rawAg) ? rawAg : [];
    const listLp = Array.isArray(rawLp) ? rawLp : [];
    return agregarLinhasSaidas([...listAg, ...listLp], granularidade);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[dreSaidasSoAcoRepository] Nomus:', msg);
    return { linhas: [], naoMapeados: [], totalBruto: 0, totalMapeado: 0, erro: msg };
  }
}

const MAX_DETALHE_DRE_NOMUS = 2000;

function periodoFromYmdDetalhe(ymd: string, granularidade: DfcAgendamentoGranularidade): string {
  return granularidade === 'mes' ? ymd.slice(0, 7) : ymd;
}

/**
 * Detalhe DRE Nomus — mesma base da grade (competência + contafinanceiro).
 */
export async function queryDreNomusSaidasDetalhe(params: {
  dataInicio: string;
  dataFim: string;
  idEmpresas: number[];
  idsContaFinanceiro: number[];
  granularidade: DfcAgendamentoGranularidade;
  periodoBucket?: string | null;
}): Promise<{ detalhes: DfcAgendamentoDetalheRow[]; erro?: string }> {
  const idsSet = new Set(params.idsContaFinanceiro.filter((n) => n > 0));
  if (idsSet.size === 0) return { detalhes: [] };
  if (!isNomusEnabled()) {
    return { detalhes: [], erro: 'Nomus: NOMUS_DB_URL não configurado (detalhe DRE)' };
  }
  const pool = getNomusPool();
  if (!pool) {
    return { detalhes: [], erro: 'Nomus: pool indisponível (detalhe DRE)' };
  }

  const idEmpresas = normalizarIdsEmpresa(params.idEmpresas);
  const sqlParams = {
    idEmpresas,
    dataInicio: params.dataInicio,
    dataFim: params.dataFim,
  };
  const sqlAgendamentos = aplicarSql(loadSql('dreSaidasSoAco.sql'), sqlParams);
  const sqlLancamentosLp = aplicarSql(loadSql('dreSaidasSoAcoLancamentosLp.sql'), sqlParams);

  try {
    const [[rawAg], [rawLp]] = await Promise.all([
      pool.query(sqlAgendamentos),
      pool.query(sqlLancamentosLp),
    ]);
    const listAg = Array.isArray(rawAg) ? rawAg : [];
    const listLp = Array.isArray(rawLp) ? rawLp : [];
    const detalhes: DfcAgendamentoDetalheRow[] = [];
    const idsVistos = new Set<string>();

    for (const r of listAg) {
      const row = r as Record<string, unknown>;
      const idCf = row.idContaFinanceiro != null ? Math.trunc(Number(row.idContaFinanceiro)) : 0;
      if (!idCf || !idsSet.has(idCf)) continue;

      const valor = extrairValorLinha(row);
      if (valor <= 0) continue;

      const ymd = formatYmd(row.dataCompetencia as Date | string);
      if (!ymd || ymd < params.dataInicio || ymd > params.dataFim) continue;

      const periodo = periodoFromYmdDetalhe(ymd, params.granularidade);
      if (params.periodoBucket && periodo !== params.periodoBucket) continue;

      const id = Math.trunc(Number(row.id));
      if (!id) continue;
      const chave = `A#${id}`;
      if (idsVistos.has(chave)) continue;

      const idEmpresa = Math.trunc(Number(row.idEmpresa ?? 0)) || 0;
      detalhes.push({
        id,
        descricaoLancamento: row.descricaoLancamento != null ? String(row.descricaoLancamento).trim() || null : null,
        nome: row.nomePessoa != null ? String(row.nomePessoa).trim() || null : null,
        dataVencimento: formatYmd(row.dataVencimento as Date | string),
        dataBaixa: formatYmd(row.dataBaixa as Date | string),
        dataCompetencia: ymd,
        valorBaixado: Math.round(valor * 100) / 100,
        tipoRef: 'A',
        idEmpresa,
        idContaFinanceiro: idCf,
        empresa: idEmpresa > 0 ? labelEmpresaDfc(idEmpresa) : null,
      });
      idsVistos.add(chave);
    }

    for (const r of listLp) {
      const row = r as Record<string, unknown>;
      const idCf = row.idContaFinanceiro != null ? Math.trunc(Number(row.idContaFinanceiro)) : 0;
      if (!idCf || !idsSet.has(idCf)) continue;

      const valor = extrairValorLinha(row);
      if (valor <= 0) continue;

      const ymd = formatYmd(row.dataCompetencia as Date | string);
      if (!ymd || ymd < params.dataInicio || ymd > params.dataFim) continue;

      const periodo = periodoFromYmdDetalhe(ymd, params.granularidade);
      if (params.periodoBucket && periodo !== params.periodoBucket) continue;

      const id = Math.trunc(Number(row.id));
      if (!id) continue;
      const chave = `L#${id}`;
      if (idsVistos.has(chave)) continue;

      const idEmpresa = Math.trunc(Number(row.idEmpresa ?? 0)) || 0;
      detalhes.push({
        id,
        descricaoLancamento: row.descricao != null ? String(row.descricao).trim() || null : null,
        nome: row.nomePessoa != null ? String(row.nomePessoa).trim() || null : null,
        dataVencimento: null,
        dataBaixa: formatYmd(row.dataLancamento as Date | string),
        dataCompetencia: ymd,
        valorBaixado: Math.round(valor * 100) / 100,
        tipoRef: 'L',
        idEmpresa,
        idContaFinanceiro: idCf,
        empresa: idEmpresa > 0 ? labelEmpresaDfc(idEmpresa) : null,
      });
      idsVistos.add(chave);
    }

    detalhes.sort((a, b) => b.valorBaixado - a.valorBaixado);
    return { detalhes: detalhes.slice(0, MAX_DETALHE_DRE_NOMUS) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[queryDreNomusSaidasDetalhe]', msg);
    return { detalhes: [], erro: msg };
  }
}

export async function carregarSaidasSoAcoDre(params: {
  dataInicio: string;
  dataFim: string;
  /** Padrão: 1 (Só Aço) e 2 (Só Móveis). */
  idEmpresas?: number[];
  granularidade?: 'dia' | 'mes';
}): Promise<{
  linhas: DreSaidasSoAcoAgregado[];
  naoMapeados: DreSaidasSoAcoNaoMapeado[];
  totalBruto: number;
  totalMapeado: number;
  erro?: string;
  fonteSaidas?: 'shop9' | 'nomus' | 'shop9+nomus';
  idsPorPathKey?: Record<string, number[]>;
  /** ids Shop9 (Ordem_Plano_Contas3) por pathKey — para drill-down por competência. */
  idsPorPathKeyShop9?: Record<string, number[]>;
  /** Catálogo Shop9 por pathKey (relacao PC) — drill-down rateio independente do filtro da grade. */
  shop9OrdensCatalogoPorPathKey?: Record<string, number[]>;
  /** Simples Nacional direto na filial 6 Shop9 (RN Marques) por período — somado ao rateio RN. */
  simplesNacionalFilial6PorPeriodo?: Record<string, number>;
}> {
  const idEmpresasReq = normalizarIdsEmpresa(params.idEmpresas);
  const granularidade = params.granularidade ?? 'mes';
  const erros: string[] = [];

  const idEmpresasShop9 = empresasComSaidasShop9Dre(idEmpresasReq);
  const incluirShop9 = idEmpresasShop9.length > 0 && isShop9Enabled();

  const partes: {
    linhas: DreSaidasSoAcoAgregado[];
    naoMapeados: DreSaidasSoAcoNaoMapeado[];
    totalBruto: number;
    totalMapeado: number;
  }[] = [];

  let shop9Usado = false;
  let idsShop9: Record<string, number[]> = {};
  let simplesNacionalFilial6PorPeriodo: Record<string, number> = {};

  const [nomus, shop9, shop9OrdensCatalogoPorPathKey] = await Promise.all([
    carregarSaidasNomusSoAcoDre({
      ...params,
      idEmpresas: idEmpresasReq,
    }),
    incluirShop9
      ? carregarSaidasShop9SoAcoDre({
          dataInicio: params.dataInicio,
          dataFim: params.dataFim,
          idEmpresas: idEmpresasReq,
          granularidade,
        })
      : Promise.resolve({
          linhas: [],
          naoMapeados: [],
          totalBruto: 0,
          totalMapeado: 0,
          idsPorPathKeyShop9: {} as Record<string, number[]>,
          simplesNacionalFilial6PorPeriodo: {} as Record<string, number>,
          usado: false,
          erro: undefined as string | undefined,
        }),
    isShop9Enabled() ? mapaShop9OrdensCatalogoPorPathKeyDre() : Promise.resolve({} as Record<string, number[]>),
  ]);

  let nomusUsado = false;
  if (isNomusEnabled()) {
    if (nomus.erro) erros.push(`Nomus: ${nomus.erro}`);
    partes.push(nomus);
    nomusUsado = true;
  } else if (idEmpresasReq.length > 0) {
    erros.push('Nomus: NOMUS_DB_URL não configurado');
  }

  if (incluirShop9) {
    if (shop9.erro) erros.push(`Shop9: ${shop9.erro}`);
    if (shop9.usado) {
      shop9Usado = true;
      idsShop9 = shop9.idsPorPathKeyShop9;
      simplesNacionalFilial6PorPeriodo = shop9.simplesNacionalFilial6PorPeriodo ?? {};
      partes.push({
        linhas: shop9.linhas,
        naoMapeados: shop9.naoMapeados,
        totalBruto: shop9.totalBruto,
        totalMapeado: shop9.totalMapeado,
      });
    }
  }

  if (partes.length === 0) {
    const msg =
      erros.join('; ') ||
      (idEmpresasShop9.length > 0
        ? 'Shop9 indisponível para saídas DRE'
        : 'Nenhuma fonte de saídas disponível');
    return { linhas: [], naoMapeados: [], totalBruto: 0, totalMapeado: 0, erro: msg };
  }

  const merged = mesclarAgregadosSaidas(partes);
  const linhasRateadas = aplicarRateioInssNasLinhasSaidas(merged.linhas);
  const fonteSaidas: 'shop9' | 'nomus' | 'shop9+nomus' =
    shop9Usado && nomusUsado
      ? 'shop9+nomus'
      : shop9Usado
        ? 'shop9'
        : 'nomus';

  return {
    ...merged,
    linhas: linhasRateadas,
    erro: erros.length > 0 ? erros.join('; ') : undefined,
    fonteSaidas,
    idsPorPathKey: mesclarIdsPorPathKey(mapaIdsContaPorPathKeyDre(), idsShop9),
    idsPorPathKeyShop9: idsShop9,
    shop9OrdensCatalogoPorPathKey,
    simplesNacionalFilial6PorPeriodo,
  };
}

async function carregarLinhasNomusSaidasBrutas(params: {
  idEmpresas: number[];
  dataInicio: string;
  dataFim: string;
}): Promise<{ listAg: unknown[]; listLp: unknown[]; erro?: string }> {
  if (!isNomusEnabled()) {
    return { listAg: [], listLp: [], erro: 'Nomus: NOMUS_DB_URL não configurado' };
  }
  const pool = getNomusPool();
  if (!pool) {
    return { listAg: [], listLp: [], erro: 'Nomus: pool indisponível' };
  }
  const sqlParams = {
    idEmpresas: normalizarIdsEmpresa(params.idEmpresas),
    dataInicio: params.dataInicio,
    dataFim: params.dataFim,
  };
  const sqlAgendamentos = aplicarSql(loadSql('dreSaidasSoAco.sql'), sqlParams);
  const sqlLancamentosLp = aplicarSql(loadSql('dreSaidasSoAcoLancamentosLp.sql'), sqlParams);
  try {
    const [[rawAg], [rawLp]] = await Promise.all([
      pool.query(sqlAgendamentos),
      pool.query(sqlLancamentosLp),
    ]);
    return {
      listAg: Array.isArray(rawAg) ? rawAg : [],
      listLp: Array.isArray(rawLp) ? rawLp : [],
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { listAg: [], listLp: [], erro: msg };
  }
}

/** Nomes distintos de fornecedores na conta DRE (Nomus + Shop9, sem período — configuração de rateio). */
export async function queryDreFornecedorOpcoes(params: {
  pathKey?: string;
}): Promise<{ nomes: string[]; erro?: string }> {
  const pathKey = params.pathKey?.trim();
  if (!pathKey) {
    return { nomes: [], erro: 'Informe a conta DRE (pathKey).' };
  }

  const erros: string[] = [];
  const nomesSet = new Set<string>();

  const idsConta = listarIdsContaPorPathKeyDre(pathKey);
  if (idsConta.length > 0 && isNomusEnabled()) {
    const pool = getNomusPool();
    if (!pool) {
      erros.push('Nomus: pool indisponível');
    } else {
      const sql = aplicarSqlFornecedorOpcoesRateio(loadSql('dreFornecedorOpcoesRateio.sql'), {
        idEmpresas: [...DRE_SAIDAS_SOACO_EMPRESAS_PADRAO],
        idsContas: idsConta,
      });
      if (sql) {
        try {
          const [rows] = await pool.query(sql);
          for (const r of Array.isArray(rows) ? rows : []) {
            const row = r as Record<string, unknown>;
            const nome = row.nomePessoa != null ? String(row.nomePessoa).trim() : '';
            if (nome) nomesSet.add(nome);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          erros.push(`Nomus: ${msg}`);
        }
      }
    }
  } else if (idsConta.length > 0 && !isNomusEnabled()) {
    erros.push('Nomus: NOMUS_DB_URL não configurado');
  }

  const shop9 = await queryDreShop9FornecedorOpcoesRateio(pathKey);
  if (shop9.erro) erros.push(shop9.erro);
  for (const nome of shop9.nomes) nomesSet.add(nome);

  const nomes = [...nomesSet].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  if (nomes.length === 0) {
    return {
      nomes: [],
      erro: erros.join('; ') || 'Conta DRE sem vínculo Nomus/Shop9 para listar fornecedores.',
    };
  }

  return { nomes, erro: erros.length > 0 ? erros.join('; ') : undefined };
}

/** Soma por período dos lançamentos dos fornecedores selecionados em uma conta DRE (Nomus + Shop9). */
export async function queryDreRateioFornecedorTotais(params: {
  dataInicio: string;
  dataFim: string;
  granularidade: DfcAgendamentoGranularidade;
  idEmpresas?: number[];
  pathKey: string;
  nomesFornecedor: string[];
  /** Pool completo para fatia de rateio (todas filiais Shop9/Nomus, sem recorte de empresa). */
  poolRateio?: boolean;
}): Promise<{ totaisPorPeriodo: Record<string, number>; erro?: string }> {
  const nomes = [...new Set(params.nomesFornecedor.map((n) => n.trim()).filter(Boolean))];
  if (nomes.length === 0) return { totaisPorPeriodo: {} };

  const pathKey = params.pathKey.trim();
  if (!pathKey) return { totaisPorPeriodo: {}, erro: 'Informe pathKey da conta DRE.' };

  const erros: string[] = [];
  const totais = new Map<string, number>();

  const acumularPeriodo = (periodo: string, valor: number) => {
    if (!periodo || valor <= 0) return;
    totais.set(periodo, (totais.get(periodo) ?? 0) + valor);
  };

  const idsConta = listarIdsContaPorPathKeyDre(pathKey);
  const idsSet = new Set(idsConta);
  const idEmpresasEff = params.poolRateio
    ? [...DRE_SAIDAS_SOACO_EMPRESAS_PADRAO]
    : (params.idEmpresas ?? [...DRE_SAIDAS_SOACO_EMPRESAS_PADRAO]);

  if (idsConta.length > 0) {
    const { listAg, listLp, erro } = await carregarLinhasNomusSaidasBrutas({
      idEmpresas: idEmpresasEff,
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
    });
    if (erro && listAg.length === 0 && listLp.length === 0) {
      erros.push(erro);
    } else {
      const acumularNomus = (row: Record<string, unknown>) => {
        const idCf = row.idContaFinanceiro != null ? Math.trunc(Number(row.idContaFinanceiro)) : 0;
        if (!idCf || !idsSet.has(idCf)) return;
        if (!linhaPassaFornecedoresRateio(
          row.nomePessoa != null ? String(row.nomePessoa) : null,
          nomes,
        )) return;
        const valor = extrairValorLinha(row);
        if (valor <= 0) return;
        const ymd = formatYmd(row.dataCompetencia as Date | string);
        if (!ymd || ymd < params.dataInicio || ymd > params.dataFim) return;
        const periodo = params.granularidade === 'mes' ? ymd.slice(0, 7) : ymd;
        acumularPeriodo(periodo, valor);
      };

      for (const r of listAg) acumularNomus(r as Record<string, unknown>);
      for (const r of listLp) acumularNomus(r as Record<string, unknown>);
    }
  }

  const shop9 = await queryDreShop9RateioFornecedorTotais({
    dataInicio: params.dataInicio,
    dataFim: params.dataFim,
    granularidade: params.granularidade,
    idEmpresas: idEmpresasEff,
    pathKey,
    nomesFornecedor: nomes,
    poolRateio: params.poolRateio,
  });
  if (shop9.erro) erros.push(shop9.erro);
  for (const [periodo, valor] of Object.entries(shop9.totaisPorPeriodo)) {
    acumularPeriodo(periodo, valor);
  }

  const totaisPorPeriodo: Record<string, number> = {};
  for (const [p, v] of totais.entries()) {
    totaisPorPeriodo[p] = Math.round(v * 100) / 100;
  }

  if (Object.keys(totaisPorPeriodo).length === 0 && erros.length > 0) {
    return { totaisPorPeriodo: {}, erro: erros.join('; ') };
  }
  return { totaisPorPeriodo, erro: erros.length > 0 ? erros.join('; ') : undefined };
}
