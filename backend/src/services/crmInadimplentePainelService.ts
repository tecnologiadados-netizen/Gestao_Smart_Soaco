import sql from 'mssql';
import { prisma } from '../config/prisma.js';
import { getShop9Pool, isShop9Enabled } from '../config/shop9Db.js';
import { isNomusEnabled } from '../config/nomusDb.js';
import {
  buildPainelAbertosDetalheNomusQuery,
  buildPainelAtrasoCondicaoNomusQuery,
  buildPainelAtrasoEmpresaNomusQuery,
  buildPainelRecuperadoResumoNomusQuery,
  buildPainelRecuperadosDetalheNomusQuery,
  buildPainelSerieMensalNomusQuery,
  buildPainelAtrasoLoteDetalheNomusQuery,
  type PainelDetalheOrdem,
} from '../data/crmFinanceiro/crmPainelInadimplenciaQueries.js';
import { nomusQuery } from '../data/crmFinanceiro/nomusQuery.js';
import { EMPRESAS_PAINEL, getEmpresaPainelNome } from '../data/crmFinanceiro/empresaConfig.js';
import { sqlPagouAposPrazoEfetivoMssql } from '../data/crmFinanceiro/prazoEfetivoPagamentoSql.js';
import {
  DFC_NOMUS_EMPRESA_ACO,
  DFC_NOMUS_EMPRESA_MOVEIS,
  DFC_NOMUS_EMPRESA_REFRIGERACAO,
  DFC_NOMUS_EMPRESA_RN_MARQUES,
  resolverIdEmpresaDfc,
} from '../data/dfcShop9Empresa.js';
import {
  aplicarRetratoNaSerie,
  dataCivilFortaleza,
  limitesMes,
  listarRetratosOficiais,
} from './crmInadimplenciaRetrato.js';
import {
  nomeShop9Condicao,
  SHOP9_ADMINISTRADORA_JOIN,
  sqlShop9CondicaoNome,
  sqlShop9ExcluirTipoOperacional,
} from '../data/crmFinanceiro/shop9TipoConta.js';

const DFC_ID_PARA_CRM: Record<number, number> = {
  [DFC_NOMUS_EMPRESA_ACO]: 1,
  [DFC_NOMUS_EMPRESA_MOVEIS]: 2,
  [DFC_NOMUS_EMPRESA_RN_MARQUES]: 3,
  [DFC_NOMUS_EMPRESA_REFRIGERACAO]: 5,
};

export const PAINEL_DETALHE_PAGE = 400;

export type FatiaPainelDto = {
  chave: string;
  valor: number;
  qtd: number;
  qtdNomus?: number;
  qtdShop9?: number;
};

export type TituloPainelDto = {
  origem: string;
  codigoConta: string;
  clienteNome: string;
  empresaNome: string | null;
  tipo: string | null;
  vencimento: string | null;
  pagamento: string | null;
  dataBaixa: string | null;
  valor: number;
  contatosCount: number;
  tarefaId: number | null;
};

export type PontoSerieInadimplenciaDto = {
  mes: string;
  valorVencido: number;
  qtdVencido: number;
  valorAtraso: number;
  qtdAtraso: number;
  valorAberto: number;
  qtdAberto: number;
  pctAtraso: number;
  pctInadimplente: number;
  fonteInadimplente?: 'retrato' | 'ao_vivo';
  retratoCapturadoEm?: string | null;
};

export type PainelInadimplenciaResumo = {
  porEmpresa: FatiaPainelDto[];
  porCondicao: FatiaPainelDto[];
  recuperado: {
    total: FatiaPainelDto;
    mesmoMes: FatiaPainelDto;
    outrosMeses: FatiaPainelDto;
  };
  serieMensal: PontoSerieInadimplenciaDto[];
  acumulado: {
    pctAtraso: number;
    pctInadimplente: number;
    valorVencido: number;
    valorAtraso: number;
    qtdAtraso: number;
    valorAberto: number;
  };
  erros: string[];
};

export type PainelPeriodo = {
  vencimentoDe?: string | null;
  vencimentoAte?: string | null;
};

export type PainelDetalheFiltro = PainelPeriodo & {
  universo: 'aberto' | 'recuperado' | 'atraso_lote' | 'vencido';
  classe: 'empresa' | 'condicao' | 'total' | 'mesmo_mes' | 'outros_meses';
  chave?: string | null;
  offset?: number;
  limit?: number;
  ordem?: PainelDetalheOrdem;
  dir?: 'asc' | 'desc';
  recebimentoDe?: string | null;
  recebimentoAte?: string | null;
  completo?: boolean;
};

function toYmd(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  const s = String(value);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mesclarFatiasPorOrigem(nomus: FatiaPainelDto[], shop9: FatiaPainelDto[]): FatiaPainelDto[] {
  const map = new Map<string, FatiaPainelDto>();
  const somar = (lista: FatiaPainelDto[], origem: 'nomus' | 'shop9') => {
    for (const f of lista) {
      const chave = f.chave.trim() || 'Sem forma';
      const atual = map.get(chave) ?? { chave, valor: 0, qtd: 0, qtdNomus: 0, qtdShop9: 0 };
      atual.valor += f.valor;
      atual.qtd += f.qtd;
      if (origem === 'nomus') atual.qtdNomus = (atual.qtdNomus ?? 0) + f.qtd;
      else atual.qtdShop9 = (atual.qtdShop9 ?? 0) + f.qtd;
      map.set(chave, atual);
    }
  };
  somar(nomus, 'nomus');
  somar(shop9, 'shop9');
  return [...map.values()].sort((a, b) => b.valor - a.valor);
}

function mapEmpresaNome(id: number | null, nome: string | null): string {
  if (id != null && EMPRESAS_PAINEL.some((e) => e.id === id)) {
    return getEmpresaPainelNome(id) ?? nome?.trim() ?? 'Sem empresa';
  }
  const n = (nome ?? '').trim().toUpperCase();
  const byName = EMPRESAS_PAINEL.find((e) => e.nome.toUpperCase() === n);
  return byName?.nome ?? nome?.trim() ?? 'Sem empresa';
}

/** Evita inflar COUNT/SUM se Filiais ou Centro_Custo tiverem Ordem repetido. */
const SHOP9_EMPRESA_JOINS = `
  OUTER APPLY (SELECT TOP 1 Nome FROM Filiais WHERE Ordem = fc.Ordem_Filial) fl
  OUTER APPLY (SELECT TOP 1 Nome FROM Centro_Custo WHERE Ordem = fc.Ordem_Centro_Custo) cc
`;

function shop9EmpresaNome(r: Record<string, unknown>): string {
  const dfcId = resolverIdEmpresaDfc({
    empresa: r.nomeFilial != null ? String(r.nomeFilial) : null,
    centrocusto: r.centrocusto != null ? String(r.centrocusto) : null,
    nomeFilial: r.nomeFilial != null ? String(r.nomeFilial) : null,
    ordemFilial: toNum(r.ordemFilial),
  });
  const crmId = dfcId != null ? DFC_ID_PARA_CRM[dfcId] ?? null : null;
  return mapEmpresaNome(crmId, crmId != null ? getEmpresaPainelNome(crmId) : null);
}

function shop9Periodo(opts: PainelPeriodo & { recebimentoDe?: string | null; recebimentoAte?: string | null }): string {
  let c = '';
  if (opts.vencimentoDe?.trim()) c += ' AND fc.Data_Vencimento >= @de ';
  if (opts.vencimentoAte?.trim()) c += ' AND fc.Data_Vencimento < DATEADD(day, 1, CONVERT(date, @ate)) ';
  if (opts.recebimentoDe?.trim()) c += ' AND fc.Data_Quitacao >= @recDe ';
  if (opts.recebimentoAte?.trim()) c += ' AND fc.Data_Quitacao < DATEADD(day, 1, CONVERT(date, @recAte)) ';
  return c;
}

function bindShop9(
  req: sql.Request,
  opts: PainelPeriodo & { recebimentoDe?: string | null; recebimentoAte?: string | null },
): sql.Request {
  if (opts.vencimentoDe?.trim()) req.input('de', sql.VarChar(10), opts.vencimentoDe.trim());
  if (opts.vencimentoAte?.trim()) req.input('ate', sql.VarChar(10), opts.vencimentoAte.trim());
  if (opts.recebimentoDe?.trim()) req.input('recDe', sql.VarChar(10), opts.recebimentoDe.trim());
  if (opts.recebimentoAte?.trim()) req.input('recAte', sql.VarChar(10), opts.recebimentoAte.trim());
  return req;
}

function shop9OrderBy(filtro: PainelDetalheFiltro, recup: boolean): string {
  const d = filtro.dir === 'asc' ? 'ASC' : 'DESC';
  switch (filtro.ordem) {
    case 'recebimento':
      return recup ? `fc.Data_Quitacao ${d}, fc.Ordem ${d}` : `fc.Data_Vencimento ${d}, fc.Ordem ${d}`;
    case 'cliente':
      return `cf.Nome ${d}, fc.Ordem ${d}`;
    case 'empresa':
      return `fl.Nome ${d}, fc.Ordem ${d}`;
    case 'conta':
      return `fc.Ordem ${d}`;
    case 'condicao':
      return `${sqlShop9CondicaoNome('fc')} ${d}, fc.Ordem ${d}`;
    case 'valor':
      return `${recup ? SHOP9_VALOR_RECUP : SHOP9_VALOR_ABERTO} ${d}, fc.Ordem ${d}`;
    case 'atraso':
      return recup
        ? `DATEDIFF(day, fc.Data_Vencimento, fc.Data_Quitacao) ${d}, fc.Ordem ${d}`
        : `DATEDIFF(day, fc.Data_Vencimento, GETDATE()) ${d}, fc.Ordem ${d}`;
    default:
      return `fc.Data_Vencimento ${d}, fc.Ordem ${d}`;
  }
}

function cmpDetalhe(a: TituloPainelDto, b: TituloPainelDto, filtro: PainelDetalheFiltro): number {
  const mul = filtro.dir === 'asc' ? 1 : -1;
  const str = (x: string | null | undefined) => (x ?? '').toLowerCase();
  let av: string | number = '';
  let bv: string | number = '';
  switch (filtro.ordem) {
    case 'recebimento':
      av = a.pagamento ?? a.dataBaixa ?? '';
      bv = b.pagamento ?? b.dataBaixa ?? '';
      break;
    case 'cliente':
      av = str(a.clienteNome);
      bv = str(b.clienteNome);
      break;
    case 'empresa':
      av = str(a.empresaNome);
      bv = str(b.empresaNome);
      break;
    case 'conta':
      av = Number(a.codigoConta) || a.codigoConta;
      bv = Number(b.codigoConta) || b.codigoConta;
      break;
    case 'condicao':
      av = str(a.tipo);
      bv = str(b.tipo);
      break;
    case 'valor':
      av = a.valor;
      bv = b.valor;
      break;
    case 'atraso': {
      const da = (a.pagamento ?? a.dataBaixa ?? '').slice(0, 10);
      const db = (b.pagamento ?? b.dataBaixa ?? '').slice(0, 10);
      const va = a.vencimento ?? '';
      const vb = b.vencimento ?? '';
      av = da && va ? Date.parse(`${da}T00:00:00`) - Date.parse(`${va}T00:00:00`) : 0;
      bv = db && vb ? Date.parse(`${db}T00:00:00`) - Date.parse(`${vb}T00:00:00`) : 0;
      break;
    }
    default:
      av = a.vencimento ?? '';
      bv = b.vencimento ?? '';
  }
  let cmp = 0;
  if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
  else cmp = String(av).localeCompare(String(bv), 'pt-BR', { numeric: true });
  if (cmp !== 0) return cmp * mul;
  return b.codigoConta.localeCompare(a.codigoConta) * mul;
}

async function fatiasNomus(
  builder: (opts: PainelPeriodo) => { sql: string; params: (string | number)[] },
  opts: PainelPeriodo,
): Promise<{ fatias: FatiaPainelDto[]; erro?: string }> {
  if (!isNomusEnabled()) return { fatias: [], erro: 'Nomus não configurado' };
  try {
    const q = builder(opts);
    const rows = await nomusQuery<{ chave: unknown; qtd: unknown; valor: unknown }>(q.sql, q.params);
    return {
      fatias: rows.map((r) => ({
        chave: String(r.chave ?? '').trim() || 'Sem condição',
        qtd: Math.trunc(toNum(r.qtd)),
        valor: toNum(r.valor),
      })),
    };
  } catch (e) {
    return { fatias: [], erro: e instanceof Error ? e.message : String(e) };
  }
}

async function recuperadoNomus(opts: PainelPeriodo): Promise<{
  total: FatiaPainelDto;
  mesmoMes: FatiaPainelDto;
  outrosMeses: FatiaPainelDto;
  erro?: string;
}> {
  const vazio = {
    total: { chave: 'Total recuperado', valor: 0, qtd: 0 },
    mesmoMes: { chave: 'Recuperado no mês', valor: 0, qtd: 0 },
    outrosMeses: { chave: 'Pago em meses seguintes', valor: 0, qtd: 0 },
  };
  if (!isNomusEnabled()) return { ...vazio, erro: 'Nomus não configurado' };
  try {
    const q = buildPainelRecuperadoResumoNomusQuery(opts);
    const rows = await nomusQuery<{
      qtdTotal: unknown;
      valorTotal: unknown;
      qtdMesmoMes: unknown;
      valorMesmoMes: unknown;
    }>(q.sql, q.params);
    const r = rows[0];
    const qtdTotal = Math.trunc(toNum(r?.qtdTotal));
    const valorTotal = toNum(r?.valorTotal);
    const qtdMesmo = Math.trunc(toNum(r?.qtdMesmoMes));
    const valorMesmo = toNum(r?.valorMesmoMes);
    return {
      total: { chave: 'Total recuperado', valor: valorTotal, qtd: qtdTotal },
      mesmoMes: { chave: 'Recuperado no mês', valor: valorMesmo, qtd: qtdMesmo },
      outrosMeses: {
        chave: 'Pago em meses seguintes',
        valor: valorTotal - valorMesmo,
        qtd: qtdTotal - qtdMesmo,
      },
    };
  } catch (e) {
    return { ...vazio, erro: e instanceof Error ? e.message : String(e) };
  }
}

const SHOP9_ABERTO = `
  fc.Pagar_Receber = 'R'
  AND fc.Situacao = 'A'
  AND fc.Data_Vencimento IS NOT NULL
  AND fc.Data_Vencimento < CAST(CAST(GETDATE() AS DATE) AS DATETIME)
  AND ISNULL(fc.Valor_Total_Calculado, 0) > 0
  AND (fc.Descricao IS NULL OR fc.Descricao NOT LIKE '%conta pai%')
  ${sqlShop9ExcluirTipoOperacional('fc')}
`;

const SHOP9_RECUP = `
  fc.Pagar_Receber = 'R'
  AND fc.Situacao <> 'A'
  AND fc.Data_Vencimento IS NOT NULL
  AND fc.Data_Quitacao IS NOT NULL
  AND ${sqlPagouAposPrazoEfetivoMssql('fc.Data_Vencimento', 'fc.Data_Quitacao')}
  AND ISNULL(fc.Valor_Total_Calculado, 0) > 0
  AND (fc.Descricao IS NULL OR fc.Descricao NOT LIKE '%conta pai%')
  ${sqlShop9ExcluirTipoOperacional('fc')}
`;

const SHOP9_VALOR_ABERTO = `
  CASE
    WHEN ISNULL(fc.Valor_Total_Calculado, 0) - ISNULL(fc.Valor_Quitado, 0) > 0
      THEN ISNULL(fc.Valor_Total_Calculado, 0) - ISNULL(fc.Valor_Quitado, 0)
    ELSE ISNULL(fc.Valor_Total_Calculado, 0)
  END
`;

const SHOP9_VALOR_RECUP = `
  CASE WHEN ISNULL(fc.Valor_Quitado, 0) > 0 THEN ISNULL(fc.Valor_Quitado, 0) ELSE ISNULL(fc.Valor_Total_Calculado, 0) END
`;

const SHOP9_VALOR_COORTE = `
  CASE WHEN fc.Situacao = 'A' THEN (${SHOP9_VALOR_ABERTO}) ELSE (${SHOP9_VALOR_RECUP}) END
`;

const SHOP9_COORTE = `
  fc.Pagar_Receber = 'R'
  AND ISNULL(fc.Situacao, '') <> 'N'
  AND fc.Data_Vencimento IS NOT NULL
  AND fc.Data_Vencimento < CAST(CAST(GETDATE() AS DATE) AS DATETIME)
  AND ISNULL(fc.Valor_Total_Calculado, 0) > 0
  AND (fc.Descricao IS NULL OR fc.Descricao NOT LIKE '%conta pai%')
  ${sqlShop9ExcluirTipoOperacional('fc')}
`;

const SHOP9_AINDA = `fc.Situacao = 'A'`;
const SHOP9_ATRASOU = `(
  fc.Situacao = 'A'
  OR (
    fc.Situacao <> 'A'
    AND fc.Data_Quitacao IS NOT NULL
    AND ${sqlPagouAposPrazoEfetivoMssql('fc.Data_Vencimento', 'fc.Data_Quitacao')}
  )
)`;

type PontoSerieBruto = {
  mes: string;
  qtdVencido: number;
  valorVencido: number;
  qtdAberto: number;
  valorAberto: number;
  qtdAtraso: number;
  valorAtraso: number;
};

function pct(parte: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.round((10000 * parte) / total) / 100;
}

function pontoFromBruto(b: PontoSerieBruto): PontoSerieInadimplenciaDto {
  return {
    mes: b.mes,
    valorVencido: b.valorVencido,
    qtdVencido: b.qtdVencido,
    valorAtraso: b.valorAtraso,
    qtdAtraso: b.qtdAtraso,
    valorAberto: b.valorAberto,
    qtdAberto: b.qtdAberto,
    pctAtraso: pct(b.valorAtraso, b.valorVencido),
    pctInadimplente: pct(b.valorAberto, b.valorVencido),
    fonteInadimplente: 'ao_vivo',
  };
}

function somarPontos(a: PontoSerieBruto, b: PontoSerieBruto): PontoSerieBruto {
  return {
    mes: a.mes,
    qtdVencido: a.qtdVencido + b.qtdVencido,
    valorVencido: a.valorVencido + b.valorVencido,
    qtdAberto: a.qtdAberto + b.qtdAberto,
    valorAberto: a.valorAberto + b.valorAberto,
    qtdAtraso: a.qtdAtraso + b.qtdAtraso,
    valorAtraso: a.valorAtraso + b.valorAtraso,
  };
}

function mesYmd(ymd: string): string {
  return ymd.slice(0, 7);
}

function addMes(yyyyMm: string, delta: number): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function listarMeses(de: string, ate: string): string[] {
  const out: string[] = [];
  let cur = de;
  while (cur <= ate) {
    out.push(cur);
    cur = addMes(cur, 1);
    if (out.length > 400) break;
  }
  return out;
}

function completarSerie(
  pontos: PontoSerieBruto[],
  opts: PainelPeriodo,
): PontoSerieInadimplenciaDto[] {
  const map = new Map(pontos.filter((p) => p.mes).map((p) => [p.mes, p]));
  const keys = [...map.keys()].sort();
  const de = opts.vencimentoDe?.trim() ? mesYmd(opts.vencimentoDe.trim()) : keys[0];
  const ate = opts.vencimentoAte?.trim() ? mesYmd(opts.vencimentoAte.trim()) : keys[keys.length - 1];
  if (!de || !ate) return [];
  const vazio = (mes: string): PontoSerieBruto => ({
    mes,
    qtdVencido: 0,
    valorVencido: 0,
    qtdAberto: 0,
    valorAberto: 0,
    qtdAtraso: 0,
    valorAtraso: 0,
  });
  return listarMeses(de, ate).map((mes) => pontoFromBruto(map.get(mes) ?? vazio(mes)));
}

function parsePontoRow(r: Record<string, unknown>): PontoSerieBruto {
  return {
    mes: String(r.mes ?? '').slice(0, 7),
    qtdVencido: Math.trunc(toNum(r.qtdVencido)),
    valorVencido: toNum(r.valorVencido),
    qtdAberto: Math.trunc(toNum(r.qtdAberto)),
    valorAberto: toNum(r.valorAberto),
    qtdAtraso: Math.trunc(toNum(r.qtdAtraso)),
    valorAtraso: toNum(r.valorAtraso),
  };
}

async function serieNomus(opts: PainelPeriodo): Promise<{ pontos: PontoSerieBruto[]; erro?: string }> {
  if (!isNomusEnabled()) return { pontos: [] };
  try {
    const q = buildPainelSerieMensalNomusQuery(opts);
    const rows = await nomusQuery<Record<string, unknown>>(q.sql, q.params);
    return { pontos: rows.map(parsePontoRow).filter((p) => p.mes) };
  } catch (e) {
    return { pontos: [], erro: e instanceof Error ? e.message : String(e) };
  }
}

async function serieShop9(opts: PainelPeriodo): Promise<{ pontos: PontoSerieBruto[]; erro?: string }> {
  if (!isShop9Enabled()) return { pontos: [] };
  try {
    const pool = await getShop9Pool();
    if (!pool) return { pontos: [], erro: 'Shop9: falha ao conectar' };
    const result = await bindShop9(pool.request(), opts).query(`
      SELECT
        CONVERT(varchar(7), fc.Data_Vencimento, 126) AS mes,
        COUNT(*) AS qtdVencido,
        SUM(${SHOP9_VALOR_COORTE}) AS valorVencido,
        SUM(CASE WHEN ${SHOP9_AINDA} THEN 1 ELSE 0 END) AS qtdAberto,
        SUM(CASE WHEN ${SHOP9_AINDA} THEN ${SHOP9_VALOR_COORTE} ELSE 0 END) AS valorAberto,
        SUM(CASE WHEN ${SHOP9_ATRASOU} THEN 1 ELSE 0 END) AS qtdAtraso,
        SUM(CASE WHEN ${SHOP9_ATRASOU} THEN ${SHOP9_VALOR_COORTE} ELSE 0 END) AS valorAtraso
      FROM Financeiro_Contas fc
      WHERE ${SHOP9_COORTE} ${shop9Periodo(opts)}
      GROUP BY CONVERT(varchar(7), fc.Data_Vencimento, 126)
      ORDER BY mes
    `);
    return { pontos: ((result.recordset ?? []) as Record<string, unknown>[]).map(parsePontoRow).filter((p) => p.mes) };
  } catch (e) {
    return { pontos: [], erro: e instanceof Error ? e.message : String(e) };
  }
}

function mesclarSerie(grupos: PontoSerieBruto[][]): PontoSerieBruto[] {
  const map = new Map<string, PontoSerieBruto>();
  for (const grupo of grupos) {
    for (const p of grupo) {
      const atual = map.get(p.mes);
      map.set(p.mes, atual ? somarPontos(atual, p) : p);
    }
  }
  return [...map.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

async function shop9Abertos(opts: PainelPeriodo): Promise<{
  empresa: FatiaPainelDto[];
  condicao: FatiaPainelDto[];
  erro?: string;
}> {
  if (!isShop9Enabled()) return { empresa: [], condicao: [], erro: 'Shop9 não configurado' };
  try {
    const pool = await getShop9Pool();
    if (!pool) return { empresa: [], condicao: [], erro: 'Shop9: falha ao conectar' };
    const periodo = shop9Periodo(opts);
    const [emp, cond] = await Promise.all([
      bindShop9(pool.request(), opts).query(`
        SELECT
          ISNULL(fl.Nome, '') AS nomeFilial,
          ISNULL(cc.Nome, '') AS centrocusto,
          fc.Ordem_Filial AS ordemFilial,
          COUNT(*) AS qtd,
          SUM(${SHOP9_VALOR_COORTE}) AS valor
        FROM Financeiro_Contas fc
        ${SHOP9_EMPRESA_JOINS}
        WHERE ${SHOP9_COORTE} AND ${SHOP9_ATRASOU} ${periodo}
        GROUP BY fl.Nome, cc.Nome, fc.Ordem_Filial
      `),
      bindShop9(pool.request(), opts).query(`
        SELECT
          ${sqlShop9CondicaoNome('fc')} AS chave,
          COUNT(*) AS qtd,
          SUM(${SHOP9_VALOR_COORTE}) AS valor
        FROM Financeiro_Contas fc
        ${SHOP9_ADMINISTRADORA_JOIN}
        WHERE ${SHOP9_COORTE} AND ${SHOP9_ATRASOU} ${periodo}
        GROUP BY ${sqlShop9CondicaoNome('fc')}
      `),
    ]);
    const empresaMap = new Map<string, FatiaPainelDto>();
    for (const r of (emp.recordset ?? []) as Record<string, unknown>[]) {
      const chave = shop9EmpresaNome(r);
      const atual = empresaMap.get(chave) ?? { chave, valor: 0, qtd: 0 };
      atual.valor += toNum(r.valor);
      atual.qtd += Math.trunc(toNum(r.qtd));
      empresaMap.set(chave, atual);
    }
    const condicao = ((cond.recordset ?? []) as Record<string, unknown>[]).map((r) => ({
      chave: String(r.chave ?? 'Receber'),
      valor: toNum(r.valor),
      qtd: Math.trunc(toNum(r.qtd)),
    }));
    return { empresa: [...empresaMap.values()], condicao };
  } catch (e) {
    return { empresa: [], condicao: [], erro: e instanceof Error ? e.message : String(e) };
  }
}

async function shop9Recuperado(opts: PainelPeriodo): Promise<{
  total: FatiaPainelDto;
  mesmoMes: FatiaPainelDto;
  outrosMeses: FatiaPainelDto;
  erro?: string;
}> {
  const vazio = {
    total: { chave: 'Total recuperado', valor: 0, qtd: 0 },
    mesmoMes: { chave: 'Recuperado no mês', valor: 0, qtd: 0 },
    outrosMeses: { chave: 'Pago em meses seguintes', valor: 0, qtd: 0 },
  };
  if (!isShop9Enabled()) return { ...vazio, erro: 'Shop9 não configurado' };
  try {
    const pool = await getShop9Pool();
    if (!pool) return { ...vazio, erro: 'Shop9: falha ao conectar' };
    const mesmo = 'YEAR(fc.Data_Vencimento) = YEAR(fc.Data_Quitacao) AND MONTH(fc.Data_Vencimento) = MONTH(fc.Data_Quitacao)';
    const result = await bindShop9(pool.request(), opts).query(`
      SELECT
        COUNT(*) AS qtdTotal,
        SUM(${SHOP9_VALOR_RECUP}) AS valorTotal,
        SUM(CASE WHEN ${mesmo} THEN 1 ELSE 0 END) AS qtdMesmoMes,
        SUM(CASE WHEN ${mesmo} THEN ${SHOP9_VALOR_RECUP} ELSE 0 END) AS valorMesmoMes
      FROM Financeiro_Contas fc
      WHERE ${SHOP9_RECUP} ${shop9Periodo(opts)}
    `);
    const r = ((result.recordset ?? [])[0] ?? {}) as Record<string, unknown>;
    const qtdTotal = Math.trunc(toNum(r.qtdTotal));
    const valorTotal = toNum(r.valorTotal);
    const qtdMesmo = Math.trunc(toNum(r.qtdMesmoMes));
    const valorMesmo = toNum(r.valorMesmoMes);
    return {
      total: { chave: 'Total recuperado', valor: valorTotal, qtd: qtdTotal },
      mesmoMes: { chave: 'Recuperado no mês', valor: valorMesmo, qtd: qtdMesmo },
      outrosMeses: {
        chave: 'Pago em meses seguintes',
        valor: valorTotal - valorMesmo,
        qtd: qtdTotal - qtdMesmo,
      },
    };
  } catch (e) {
    return { ...vazio, erro: e instanceof Error ? e.message : String(e) };
  }
}

function somarFatia(a: FatiaPainelDto, b: FatiaPainelDto, chave: string): FatiaPainelDto {
  return { chave, valor: a.valor + b.valor, qtd: a.qtd + b.qtd };
}

function mensagemErroNomus(msg: string): string {
  if (/ETIMEDOUT/i.test(msg)) {
    return 'Nomus indisponível (timeout de conexão). O painel mostra o Shop9; tente de novo em instantes.';
  }
  return msg;
}

function unicosErros(msgs: (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of msgs) {
    if (!raw) continue;
    const msg = mensagemErroNomus(raw);
    if (seen.has(msg)) continue;
    seen.add(msg);
    out.push(msg);
  }
  return out;
}

function isFalhaConexaoNomus(msg?: string): boolean {
  return Boolean(msg && /ETIMEDOUT|timeout de conexão|Pool Nomus/i.test(msg));
}

export async function obterResumoPainelInadimplencia(opts: PainelPeriodo): Promise<PainelInadimplenciaResumo> {
  const recVazio = {
    total: { chave: 'Total recuperado', valor: 0, qtd: 0 },
    mesmoMes: { chave: 'Recuperado no mês', valor: 0, qtd: 0 },
    outrosMeses: { chave: 'Pago em meses seguintes', valor: 0, qtd: 0 },
  };
  const shop9P = Promise.all([shop9Abertos(opts), shop9Recuperado(opts), serieShop9(opts)]);
  const nomusP = (async () => {
    const empNomus = await fatiasNomus(buildPainelAtrasoEmpresaNomusQuery, opts);
    if (isFalhaConexaoNomus(empNomus.erro)) {
      return {
        empNomus,
        condNomus: { fatias: [], erro: empNomus.erro },
        recNomus: { ...recVazio, erro: empNomus.erro },
        serNomus: { pontos: [] as PontoSerieBruto[], erro: empNomus.erro },
      };
    }
    const condNomus = await fatiasNomus(buildPainelAtrasoCondicaoNomusQuery, opts);
    const recNomus = await recuperadoNomus(opts);
    const serNomus = await serieNomus(opts);
    return { empNomus, condNomus, recNomus, serNomus };
  })();
  const [[abShop9, recShop9, serShop9], nomus] = await Promise.all([shop9P, nomusP]);
  const { empNomus, condNomus, recNomus, serNomus } = nomus;
  const erros = unicosErros([
    empNomus.erro,
    condNomus.erro,
    recNomus.erro,
    abShop9.erro,
    recShop9.erro,
    serNomus.erro,
    serShop9.erro,
  ]);
  const serieViva = completarSerie(mesclarSerie([serNomus.pontos, serShop9.pontos]), opts);
  let serieMensal = serieViva;
  try {
    const retratos = await listarRetratosOficiais();
    serieMensal = aplicarRetratoNaSerie(serieViva, retratos, dataCivilFortaleza().mes);
  } catch (e) {
    erros.push(e instanceof Error ? e.message : String(e));
  }
  const acc = serieMensal.reduce(
    (s, p) => ({
      valorVencido: s.valorVencido + p.valorVencido,
      valorAtraso: s.valorAtraso + p.valorAtraso,
      qtdAtraso: s.qtdAtraso + p.qtdAtraso,
      valorAberto: s.valorAberto + p.valorAberto,
    }),
    { valorVencido: 0, valorAtraso: 0, qtdAtraso: 0, valorAberto: 0 },
  );
  return {
    porEmpresa: mesclarFatiasPorOrigem(empNomus.fatias, abShop9.empresa),
    porCondicao: mesclarFatiasPorOrigem(condNomus.fatias, abShop9.condicao),
    recuperado: {
      total: somarFatia(recNomus.total, recShop9.total, 'Total recuperado'),
      mesmoMes: somarFatia(recNomus.mesmoMes, recShop9.mesmoMes, 'Recuperado no mês'),
      outrosMeses: somarFatia(recNomus.outrosMeses, recShop9.outrosMeses, 'Pago em meses seguintes'),
    },
    serieMensal,
    acumulado: {
      ...acc,
      pctAtraso: pct(acc.valorAtraso, acc.valorVencido),
      pctInadimplente: pct(acc.valorAberto, acc.valorVencido),
    },
    erros,
  };
}

export async function obterPontoSerieMes(mes: string): Promise<{
  ponto: PontoSerieInadimplenciaDto;
  erros: string[];
  confiavel: boolean;
}> {
  const { de, ate } = limitesMes(mes);
  const opts: PainelPeriodo = { vencimentoDe: de, vencimentoAte: ate };
  const [serNomus, serShop9] = await Promise.all([serieNomus(opts), serieShop9(opts)]);
  const erros = unicosErros([serNomus.erro, serShop9.erro]);
  const nomusOk = !isNomusEnabled() || !serNomus.erro;
  const shop9Ok = !isShop9Enabled() || !serShop9.erro;
  const serie = completarSerie(mesclarSerie([serNomus.pontos, serShop9.pontos]), opts);
  const ponto =
    serie.find((p) => p.mes === mes) ??
    pontoFromBruto({
      mes,
      qtdVencido: 0,
      valorVencido: 0,
      qtdAberto: 0,
      valorAberto: 0,
      qtdAtraso: 0,
      valorAtraso: 0,
    });
  return { ponto, erros, confiavel: nomusOk && shop9Ok };
}

async function contatosDosCodigos(
  itens: { origem: string; codigoConta: string }[],
): Promise<Map<string, { tarefaId: number; contatosCount: number }>> {
  const map = new Map<string, { tarefaId: number; contatosCount: number }>();
  if (itens.length === 0) return map;
  const nomusIds = itens.filter((i) => i.origem === 'nomus').map((i) => i.codigoConta);
  const shop9Ids = itens.filter((i) => i.origem === 'shop9').map((i) => i.codigoConta);
  const or: { origem: string; codigoConta: { in: string[] } }[] = [];
  if (nomusIds.length) or.push({ origem: 'nomus', codigoConta: { in: nomusIds } });
  if (shop9Ids.length) or.push({ origem: 'shop9', codigoConta: { in: shop9Ids } });
  if (or.length === 0) return map;
  const rows = await prisma.crmInadimplenteTarefa.findMany({
    where: { OR: or },
    select: { id: true, origem: true, codigoConta: true, _count: { select: { contatos: true } } },
  });
  for (const r of rows) {
    map.set(`${r.origem}:${r.codigoConta}`, { tarefaId: r.id, contatosCount: r._count.contatos });
  }
  return map;
}

function aplicarContatos(rows: TituloPainelDto[], mapa: Map<string, { tarefaId: number; contatosCount: number }>): TituloPainelDto[] {
  return rows.map((r) => {
    const hit = mapa.get(`${r.origem}:${r.codigoConta}`);
    return { ...r, tarefaId: hit?.tarefaId ?? null, contatosCount: hit?.contatosCount ?? 0 };
  });
}

async function detalheAbertosNomus(filtro: PainelDetalheFiltro, limit: number, offset: number): Promise<TituloPainelDto[]> {
  if (!isNomusEnabled()) return [];
  const q = buildPainelAbertosDetalheNomusQuery({
    vencimentoDe: filtro.vencimentoDe,
    vencimentoAte: filtro.vencimentoAte,
    chaveEmpresa: filtro.classe === 'empresa' ? filtro.chave : null,
    chaveCondicao: filtro.classe === 'condicao' ? filtro.chave : null,
    ordem: filtro.ordem,
    dir: filtro.dir,
    limit,
    offset,
  });
  const rows = await nomusQuery<Record<string, unknown>>(q.sql, q.params);
  return rows.map((r) => ({
    origem: 'nomus',
    codigoConta: String(r.codigo ?? ''),
    clienteNome: String(r.pessoa ?? '').trim(),
    empresaNome: r.empresa != null ? String(r.empresa) : null,
    tipo: r.formaPagamento != null ? String(r.formaPagamento) : null,
    vencimento: toYmd(r.dataVencimento),
    pagamento: null,
    dataBaixa: null,
    valor: Math.abs(toNum(r.valor)),
    contatosCount: 0,
    tarefaId: null,
  }));
}

async function detalheRecuperadosNomus(filtro: PainelDetalheFiltro, limit: number, offset: number): Promise<TituloPainelDto[]> {
  if (!isNomusEnabled()) return [];
  const classe =
    filtro.classe === 'mesmo_mes' || filtro.classe === 'outros_meses' ? filtro.classe : 'total';
  const q = buildPainelRecuperadosDetalheNomusQuery({
    vencimentoDe: filtro.vencimentoDe,
    vencimentoAte: filtro.vencimentoAte,
    recebimentoDe: filtro.recebimentoDe,
    recebimentoAte: filtro.recebimentoAte,
    classe,
    ordem: filtro.ordem,
    dir: filtro.dir,
    limit,
    offset,
  });
  const rows = await nomusQuery<Record<string, unknown>>(q.sql, q.params);
  return rows.map((r) => ({
    origem: 'nomus',
    codigoConta: String(r.codigo ?? ''),
    clienteNome: String(r.pessoa ?? '').trim(),
    empresaNome: r.empresa != null ? String(r.empresa) : null,
    tipo: r.formaPagamento != null ? String(r.formaPagamento) : null,
    vencimento: toYmd(r.dataVencimento),
    pagamento: toYmd(r.dataRecebimento) || toYmd(r.dataBaixa),
    dataBaixa: toYmd(r.dataBaixa),
    valor: Math.abs(toNum(r.valor)),
    contatosCount: 0,
    tarefaId: null,
  }));
}

async function detalheAtrasoLoteNomus(filtro: PainelDetalheFiltro, limit: number, offset: number): Promise<TituloPainelDto[]> {
  if (!isNomusEnabled()) return [];
  const q = buildPainelAtrasoLoteDetalheNomusQuery({
    vencimentoDe: filtro.vencimentoDe,
    vencimentoAte: filtro.vencimentoAte,
    chaveEmpresa: filtro.classe === 'empresa' ? filtro.chave : null,
    chaveCondicao: filtro.classe === 'condicao' ? filtro.chave : null,
    apenasAtraso: filtro.universo !== 'vencido',
    ordem: filtro.ordem,
    dir: filtro.dir,
    limit,
    offset,
  });
  const rows = await nomusQuery<Record<string, unknown>>(q.sql, q.params);
  return rows.map((r) => ({
    origem: 'nomus',
    codigoConta: String(r.codigo ?? ''),
    clienteNome: String(r.pessoa ?? '').trim(),
    empresaNome: r.empresa != null ? String(r.empresa) : null,
    tipo: r.formaPagamento != null ? String(r.formaPagamento) : null,
    vencimento: toYmd(r.dataVencimento),
    pagamento: toYmd(r.dataRecebimento) || toYmd(r.dataBaixa),
    dataBaixa: toYmd(r.dataBaixa),
    valor: Math.abs(toNum(r.valor)),
    contatosCount: 0,
    tarefaId: null,
  }));
}

async function detalheShop9(
  filtro: PainelDetalheFiltro,
  limit: number,
  offset: number,
): Promise<TituloPainelDto[]> {
  if (!isShop9Enabled()) return [];
  const pool = await getShop9Pool();
  if (!pool) return [];
  const loteAtraso = filtro.universo === 'atraso_lote';
  const loteVencido = filtro.universo === 'vencido';
  const loteCoorte = loteAtraso || loteVencido;
  const recup = filtro.universo === 'recuperado';
  const mesmo = 'YEAR(fc.Data_Vencimento) = YEAR(fc.Data_Quitacao) AND MONTH(fc.Data_Vencimento) = MONTH(fc.Data_Quitacao)';
  let extra = '';
  const req = bindShop9(pool.request(), filtro);
  if (!recup && filtro.classe === 'condicao' && filtro.chave) {
    extra += ` AND ${sqlShop9CondicaoNome('fc')} = @chave `;
    req.input('chave', sql.NVarChar(160), filtro.chave);
  }
  if (recup && filtro.classe === 'mesmo_mes') extra += ` AND ${mesmo} `;
  if (recup && filtro.classe === 'outros_meses') extra += ` AND NOT (${mesmo}) `;
  req.input('limit', sql.Int, limit);
  req.input('offset', sql.Int, offset);
  const valorExpr = loteCoorte ? SHOP9_VALOR_COORTE : recup ? SHOP9_VALOR_RECUP : SHOP9_VALOR_ABERTO;
  const whereShop9 = loteVencido
    ? SHOP9_COORTE
    : loteAtraso
      ? `${SHOP9_COORTE} AND ${SHOP9_ATRASOU}`
      : recup
        ? SHOP9_RECUP
        : SHOP9_ABERTO;
  const result = await req.query(`
    SELECT
      fc.Ordem AS codigoConta,
      CAST(fc.Data_Vencimento AS DATE) AS dataVencimento,
      CAST(fc.Data_Quitacao AS DATE) AS dataQuitacao,
      fc.Situacao AS situacao,
      ${valorExpr} AS valor,
      cf.Nome AS clienteNome,
      cf.Fantasia AS clienteFantasia,
      fc.Ordem_Filial AS ordemFilial,
      fl.Nome AS nomeFilial,
      cc.Nome AS centrocusto,
      fc.Tipo_Conta AS tipoConta,
      ac.Nome AS administradoraNome,
      fc.Parcela_Descricao AS parcelaDescricao
    FROM Financeiro_Contas fc
    LEFT JOIN Cli_For cf ON cf.Ordem = fc.Ordem_Cli_For
    ${SHOP9_EMPRESA_JOINS}
    ${SHOP9_ADMINISTRADORA_JOIN}
    WHERE ${whereShop9} ${shop9Periodo(filtro)} ${extra}
    ORDER BY ${shop9OrderBy(filtro, recup || loteCoorte)}
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);
  let rows = ((result.recordset ?? []) as Record<string, unknown>[]).map((r) => {
    const aberto = String(r.situacao ?? '') === 'A';
    const pag = recup || (loteCoorte && !aberto) ? toYmd(r.dataQuitacao) : null;
    return {
      origem: 'shop9',
      codigoConta: String(r.codigoConta ?? ''),
      clienteNome: String(r.clienteNome ?? r.clienteFantasia ?? '').trim(),
      empresaNome: shop9EmpresaNome(r),
      tipo: nomeShop9Condicao({
        tipoConta: r.tipoConta != null ? String(r.tipoConta) : null,
        administradora: r.administradoraNome != null ? String(r.administradoraNome) : null,
        parcela: r.parcelaDescricao != null ? String(r.parcelaDescricao) : null,
      }),
      vencimento: toYmd(r.dataVencimento),
      pagamento: pag,
      dataBaixa: pag,
      valor: Math.abs(toNum(r.valor)),
      contatosCount: 0,
      tarefaId: null,
    };
  });
  if (!recup && filtro.classe === 'empresa' && filtro.chave) {
    rows = rows.filter((r) => (r.empresaNome ?? 'Sem empresa') === filtro.chave);
  }
  return rows;
}

async function contarDetalheNomus(filtro: PainelDetalheFiltro): Promise<{ qtd: number; valor: number }> {
  if (!isNomusEnabled()) return { qtd: 0, valor: 0 };
  if (filtro.universo === 'atraso_lote' || filtro.universo === 'vencido') {
    const q = buildPainelAtrasoLoteDetalheNomusQuery({
      vencimentoDe: filtro.vencimentoDe,
      vencimentoAte: filtro.vencimentoAte,
      chaveEmpresa: filtro.classe === 'empresa' ? filtro.chave : null,
      chaveCondicao: filtro.classe === 'condicao' ? filtro.chave : null,
      apenasAtraso: filtro.universo !== 'vencido',
      countOnly: true,
      limit: 1,
      offset: 0,
    });
    const rows = await nomusQuery<{ qtd: unknown; valor: unknown }>(q.sql, q.params);
    return { qtd: Math.trunc(toNum(rows[0]?.qtd)), valor: toNum(rows[0]?.valor) };
  }
  if (filtro.universo === 'aberto') {
    const q = buildPainelAbertosDetalheNomusQuery({
      vencimentoDe: filtro.vencimentoDe,
      vencimentoAte: filtro.vencimentoAte,
      chaveEmpresa: filtro.classe === 'empresa' ? filtro.chave : null,
      chaveCondicao: filtro.classe === 'condicao' ? filtro.chave : null,
      countOnly: true,
      limit: 1,
      offset: 0,
    });
    const rows = await nomusQuery<{ qtd: unknown; valor: unknown }>(q.sql, q.params);
    return { qtd: Math.trunc(toNum(rows[0]?.qtd)), valor: toNum(rows[0]?.valor) };
  }
  const classe =
    filtro.classe === 'mesmo_mes' || filtro.classe === 'outros_meses' ? filtro.classe : 'total';
  const q = buildPainelRecuperadosDetalheNomusQuery({
    vencimentoDe: filtro.vencimentoDe,
    vencimentoAte: filtro.vencimentoAte,
    recebimentoDe: filtro.recebimentoDe,
    recebimentoAte: filtro.recebimentoAte,
    classe,
    countOnly: true,
    limit: 1,
    offset: 0,
  });
  const rows = await nomusQuery<{ qtd: unknown; valor: unknown }>(q.sql, q.params);
  return { qtd: Math.trunc(toNum(rows[0]?.qtd)), valor: toNum(rows[0]?.valor) };
}

async function contarDetalheShop9(filtro: PainelDetalheFiltro): Promise<{ qtd: number; valor: number }> {
  if (!isShop9Enabled()) return { qtd: 0, valor: 0 };
  const pool = await getShop9Pool();
  if (!pool) return { qtd: 0, valor: 0 };
  const loteAtraso = filtro.universo === 'atraso_lote';
  const loteVencido = filtro.universo === 'vencido';
  const loteCoorte = loteAtraso || loteVencido;
  const recup = filtro.universo === 'recuperado';
  const mesmo = 'YEAR(fc.Data_Vencimento) = YEAR(fc.Data_Quitacao) AND MONTH(fc.Data_Vencimento) = MONTH(fc.Data_Quitacao)';
  let extra = '';
  const req = bindShop9(pool.request(), filtro);
  if (!recup && filtro.classe === 'condicao' && filtro.chave) {
    extra += ` AND ${sqlShop9CondicaoNome('fc')} = @chave `;
    req.input('chave', sql.NVarChar(160), filtro.chave);
  }
  if (recup && filtro.classe === 'mesmo_mes') extra += ` AND ${mesmo} `;
  if (recup && filtro.classe === 'outros_meses') extra += ` AND NOT (${mesmo}) `;
  const valorExpr = loteCoorte ? SHOP9_VALOR_COORTE : recup ? SHOP9_VALOR_RECUP : SHOP9_VALOR_ABERTO;
  const whereShop9 = loteVencido
    ? SHOP9_COORTE
    : loteAtraso
      ? `${SHOP9_COORTE} AND ${SHOP9_ATRASOU}`
      : recup
        ? SHOP9_RECUP
        : SHOP9_ABERTO;
  const porEmpresa = !recup && filtro.classe === 'empresa' && Boolean(filtro.chave);
  if (porEmpresa) {
    const result = await req.query(`
      SELECT
        ISNULL(fl.Nome, '') AS nomeFilial,
        ISNULL(cc.Nome, '') AS centrocusto,
        fc.Ordem_Filial AS ordemFilial,
        COUNT(*) AS qtd,
        SUM(${valorExpr}) AS valor
      FROM Financeiro_Contas fc
      ${SHOP9_EMPRESA_JOINS}
      WHERE ${whereShop9} ${shop9Periodo(filtro)} ${extra}
      GROUP BY fl.Nome, cc.Nome, fc.Ordem_Filial
    `);
    const chave = String(filtro.chave).trim();
    let qtd = 0;
    let valor = 0;
    for (const row of (result.recordset ?? []) as Record<string, unknown>[]) {
      if (shop9EmpresaNome(row) !== chave) continue;
      qtd += Math.trunc(toNum(row.qtd));
      valor += toNum(row.valor);
    }
    return { qtd, valor };
  }
  const result = await req.query(`
    SELECT COUNT(*) AS qtd, SUM(${valorExpr}) AS valor
    FROM Financeiro_Contas fc
    ${SHOP9_ADMINISTRADORA_JOIN}
    WHERE ${whereShop9} ${shop9Periodo(filtro)} ${extra}
  `);
  const r = ((result.recordset ?? [])[0] ?? {}) as Record<string, unknown>;
  return { qtd: Math.trunc(toNum(r.qtd)), valor: toNum(r.valor) };
}

export async function listarDetalhePainelInadimplencia(
  filtro: PainelDetalheFiltro,
): Promise<{ data: TituloPainelDto[]; hasMore: boolean; total: number; valorTotal: number }> {
  const janelaTeto = filtro.completo ? 80_000 : 4_000;
  const limitTeto = filtro.completo ? 2_000 : 800;
  const limit = Math.min(Math.max(filtro.limit ?? PAINEL_DETALHE_PAGE, 1), limitTeto);
  const offset = Math.max(filtro.offset ?? 0, 0);
  const windowSize = Math.min(offset + limit + 1, janelaTeto);
  const shop9Take =
    filtro.classe === 'empresa' &&
    (filtro.universo === 'aberto' || filtro.universo === 'atraso_lote' || filtro.universo === 'vencido')
      ? Math.min(windowSize * 8, filtro.completo ? 80_000 : 8_000)
      : windowSize;
  const [nomus, shop9, totalNomus, totalShop9] = await Promise.all([
    filtro.universo === 'aberto'
      ? detalheAbertosNomus(filtro, windowSize, 0)
      : filtro.universo === 'atraso_lote' || filtro.universo === 'vencido'
        ? detalheAtrasoLoteNomus(filtro, windowSize, 0)
        : detalheRecuperadosNomus(filtro, windowSize, 0),
    detalheShop9(filtro, shop9Take, 0),
    offset === 0 ? contarDetalheNomus(filtro) : Promise.resolve({ qtd: -1, valor: -1 }),
    offset === 0 ? contarDetalheShop9(filtro) : Promise.resolve({ qtd: -1, valor: -1 }),
  ]);
  const merged = [...nomus, ...shop9].sort((a, b) => cmpDetalhe(a, b, filtro));
  const page = merged.slice(offset, offset + limit);
  const hasMore = merged.length > offset + limit || (windowSize >= janelaTeto && merged.length >= janelaTeto);
  const mapa = await contatosDosCodigos(page);
  const total = totalNomus.qtd >= 0 && totalShop9.qtd >= 0 ? totalNomus.qtd + totalShop9.qtd : -1;
  const valorTotal = totalNomus.valor >= 0 && totalShop9.valor >= 0 ? totalNomus.valor + totalShop9.valor : -1;
  return { data: aplicarContatos(page, mapa), hasMore, total, valorTotal };
}
