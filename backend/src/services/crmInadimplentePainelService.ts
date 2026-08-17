import sql from 'mssql';
import { prisma } from '../config/prisma.js';
import { getShop9Pool, isShop9Enabled } from '../config/shop9Db.js';
import { isNomusEnabled } from '../config/nomusDb.js';
import {
  buildPainelAbertosCondicaoNomusQuery,
  buildPainelAbertosDetalheNomusQuery,
  buildPainelAbertosEmpresaNomusQuery,
  buildPainelRecuperadoResumoNomusQuery,
  buildPainelRecuperadosDetalheNomusQuery,
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

const DFC_ID_PARA_CRM: Record<number, number> = {
  [DFC_NOMUS_EMPRESA_ACO]: 1,
  [DFC_NOMUS_EMPRESA_MOVEIS]: 2,
  [DFC_NOMUS_EMPRESA_RN_MARQUES]: 3,
  [DFC_NOMUS_EMPRESA_REFRIGERACAO]: 5,
};

export const PAINEL_DETALHE_PAGE = 400;

export type FatiaPainelDto = { chave: string; valor: number; qtd: number };

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

export type PainelInadimplenciaResumo = {
  porEmpresa: FatiaPainelDto[];
  porCondicao: FatiaPainelDto[];
  recuperado: {
    total: FatiaPainelDto;
    mesmoMes: FatiaPainelDto;
    outrosMeses: FatiaPainelDto;
  };
  erros: string[];
};

export type PainelPeriodo = {
  vencimentoDe?: string | null;
  vencimentoAte?: string | null;
};

export type PainelDetalheFiltro = PainelPeriodo & {
  universo: 'aberto' | 'recuperado';
  classe: 'empresa' | 'condicao' | 'total' | 'mesmo_mes' | 'outros_meses';
  chave?: string | null;
  offset?: number;
  limit?: number;
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

function mesclarFatias(grupos: FatiaPainelDto[][]): FatiaPainelDto[] {
  const map = new Map<string, FatiaPainelDto>();
  for (const grupo of grupos) {
    for (const f of grupo) {
      const chave = f.chave.trim() || 'Sem condição';
      const atual = map.get(chave) ?? { chave, valor: 0, qtd: 0 };
      atual.valor += f.valor;
      atual.qtd += f.qtd;
      map.set(chave, atual);
    }
  }
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

function shop9Periodo(opts: PainelPeriodo): string {
  let c = '';
  if (opts.vencimentoDe?.trim()) c += ' AND fc.Data_Vencimento >= @de ';
  if (opts.vencimentoAte?.trim()) c += ' AND fc.Data_Vencimento < DATEADD(day, 1, CONVERT(date, @ate)) ';
  return c;
}

function bindShop9(req: sql.Request, opts: PainelPeriodo): sql.Request {
  if (opts.vencimentoDe?.trim()) req.input('de', sql.VarChar(10), opts.vencimentoDe.trim());
  if (opts.vencimentoAte?.trim()) req.input('ate', sql.VarChar(10), opts.vencimentoAte.trim());
  return req;
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
`;

const SHOP9_RECUP = `
  fc.Pagar_Receber = 'R'
  AND fc.Situacao <> 'A'
  AND fc.Data_Vencimento IS NOT NULL
  AND fc.Data_Quitacao IS NOT NULL
  AND ${sqlPagouAposPrazoEfetivoMssql('fc.Data_Vencimento', 'fc.Data_Quitacao')}
  AND ISNULL(fc.Valor_Total_Calculado, 0) > 0
  AND (fc.Descricao IS NULL OR fc.Descricao NOT LIKE '%conta pai%')
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
          SUM(${SHOP9_VALOR_ABERTO}) AS valor
        FROM Financeiro_Contas fc
        LEFT JOIN Filiais fl ON fl.Ordem = fc.Ordem_Filial
        LEFT JOIN Centro_Custo cc ON cc.Ordem = fc.Ordem_Centro_Custo
        WHERE ${SHOP9_ABERTO} ${periodo}
        GROUP BY fl.Nome, cc.Nome, fc.Ordem_Filial
      `),
      bindShop9(pool.request(), opts).query(`
        SELECT
          ISNULL(NULLIF(LTRIM(RTRIM(fc.Tipo_Conta)), ''), 'Receber') AS chave,
          COUNT(*) AS qtd,
          SUM(${SHOP9_VALOR_ABERTO}) AS valor
        FROM Financeiro_Contas fc
        WHERE ${SHOP9_ABERTO} ${periodo}
        GROUP BY fc.Tipo_Conta
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

export async function obterResumoPainelInadimplencia(opts: PainelPeriodo): Promise<PainelInadimplenciaResumo> {
  const [empNomus, condNomus, recNomus, abShop9, recShop9] = await Promise.all([
    fatiasNomus(buildPainelAbertosEmpresaNomusQuery, opts),
    fatiasNomus(buildPainelAbertosCondicaoNomusQuery, opts),
    recuperadoNomus(opts),
    shop9Abertos(opts),
    shop9Recuperado(opts),
  ]);
  const erros = [empNomus.erro, condNomus.erro, recNomus.erro, abShop9.erro, recShop9.erro].filter(
    (e): e is string => Boolean(e),
  );
  return {
    porEmpresa: mesclarFatias([empNomus.fatias, abShop9.empresa]),
    porCondicao: mesclarFatias([condNomus.fatias, abShop9.condicao]),
    recuperado: {
      total: somarFatia(recNomus.total, recShop9.total, 'Total recuperado'),
      mesmoMes: somarFatia(recNomus.mesmoMes, recShop9.mesmoMes, 'Recuperado no mês'),
      outrosMeses: somarFatia(recNomus.outrosMeses, recShop9.outrosMeses, 'Pago em meses seguintes'),
    },
    erros,
  };
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
    classe,
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
  const recup = filtro.universo === 'recuperado';
  const mesmo = 'YEAR(fc.Data_Vencimento) = YEAR(fc.Data_Quitacao) AND MONTH(fc.Data_Vencimento) = MONTH(fc.Data_Quitacao)';
  let extra = '';
  const req = bindShop9(pool.request(), filtro);
  if (!recup && filtro.classe === 'condicao' && filtro.chave) {
    extra += ' AND ISNULL(NULLIF(LTRIM(RTRIM(fc.Tipo_Conta)), \'\'), \'Receber\') = @chave ';
    req.input('chave', sql.NVarChar(80), filtro.chave);
  }
  if (recup && filtro.classe === 'mesmo_mes') extra += ` AND ${mesmo} `;
  if (recup && filtro.classe === 'outros_meses') extra += ` AND NOT (${mesmo}) `;
  req.input('limit', sql.Int, limit);
  req.input('offset', sql.Int, offset);
  const valorExpr = recup ? SHOP9_VALOR_RECUP : SHOP9_VALOR_ABERTO;
  const result = await req.query(`
    SELECT
      fc.Ordem AS codigoConta,
      CAST(fc.Data_Vencimento AS DATE) AS dataVencimento,
      CAST(fc.Data_Quitacao AS DATE) AS dataQuitacao,
      ${valorExpr} AS valor,
      cf.Nome AS clienteNome,
      cf.Fantasia AS clienteFantasia,
      fc.Ordem_Filial AS ordemFilial,
      fl.Nome AS nomeFilial,
      cc.Nome AS centrocusto,
      fc.Tipo_Conta AS tipoConta
    FROM Financeiro_Contas fc
    LEFT JOIN Cli_For cf ON cf.Ordem = fc.Ordem_Cli_For
    LEFT JOIN Filiais fl ON fl.Ordem = fc.Ordem_Filial
    LEFT JOIN Centro_Custo cc ON cc.Ordem = fc.Ordem_Centro_Custo
    WHERE ${recup ? SHOP9_RECUP : SHOP9_ABERTO} ${shop9Periodo(filtro)} ${extra}
    ORDER BY fc.Data_Vencimento DESC, fc.Ordem DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `);
  let rows = ((result.recordset ?? []) as Record<string, unknown>[]).map((r) => ({
    origem: 'shop9',
    codigoConta: String(r.codigoConta ?? ''),
    clienteNome: String(r.clienteNome ?? r.clienteFantasia ?? '').trim(),
    empresaNome: shop9EmpresaNome(r),
    tipo: r.tipoConta != null ? String(r.tipoConta) : 'Receber',
    vencimento: toYmd(r.dataVencimento),
    pagamento: recup ? toYmd(r.dataQuitacao) : null,
    dataBaixa: recup ? toYmd(r.dataQuitacao) : null,
    valor: Math.abs(toNum(r.valor)),
    contatosCount: 0,
    tarefaId: null,
  }));
  if (!recup && filtro.classe === 'empresa' && filtro.chave) {
    rows = rows.filter((r) => (r.empresaNome ?? 'Sem empresa') === filtro.chave);
  }
  return rows;
}

export async function listarDetalhePainelInadimplencia(
  filtro: PainelDetalheFiltro,
): Promise<{ data: TituloPainelDto[]; hasMore: boolean }> {
  const limit = Math.min(Math.max(filtro.limit ?? PAINEL_DETALHE_PAGE, 1), 800);
  const offset = Math.max(filtro.offset ?? 0, 0);
  const windowSize = Math.min(offset + limit + 1, 4000);
  const shop9Take =
    filtro.universo === 'aberto' && filtro.classe === 'empresa'
      ? Math.min(windowSize * 8, 8000)
      : windowSize;
  const [nomus, shop9] = await Promise.all([
    filtro.universo === 'aberto'
      ? detalheAbertosNomus(filtro, windowSize, 0)
      : detalheRecuperadosNomus(filtro, windowSize, 0),
    detalheShop9(filtro, shop9Take, 0),
  ]);
  const merged = [...nomus, ...shop9].sort((a, b) => {
    const va = a.vencimento ?? '';
    const vb = b.vencimento ?? '';
    if (va !== vb) return vb.localeCompare(va);
    return b.codigoConta.localeCompare(a.codigoConta);
  });
  const page = merged.slice(offset, offset + limit);
  const hasMore = merged.length > offset + limit || windowSize >= 4000;
  const mapa = await contatosDosCodigos(page);
  return { data: aplicarContatos(page, mapa), hasMore };
}
