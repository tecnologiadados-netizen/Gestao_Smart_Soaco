/**
 * Carteira Financeira — query Nomus (SQL em arquivo) + filtros externos via subquery.
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getNomusPool, isNomusEnabled } from '../config/nomusDb.js';
import { buscarCoordenadasMunicipio } from './municipioCoordenadaRepository.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadSql(): string {
  return readFileSync(join(__dirname, 'sql', 'carteiraFinanceira.sql'), 'utf-8');
}

export type CarteiraFinanceiraFiltros = {
  dataInicio?: string;
  dataFim?: string;
  uf?: string[];
  cliente?: string[];
  empresa?: string[];
  statusPedido?: string;
  tipoF?: string[];
  condicaoPagamento?: string[];
  municipio?: string[];
};

export type CarteiraFinanceiraLinha = {
  idEmpresa: number;
  id: number;
  Observacoes: string | null;
  RM: string | null;
  'Tipo Pedido': string | null;
  PD: string | null;
  Emissao: string | null;
  Cliente: string | null;
  'Data de entrega': string | null;
  'Metodo de Entrega': string | null;
  'Requisicao de loja do grupo?': string | null;
  UF: string | null;
  'Municipio de entrega': string | null;
  'Forma de Pagamento': string | null;
  'Condicao de pagamento do pedido de venda': string | null;
  'Valor Original Pedido': number;
  'Valor Total': number;
  'Valor Pendente': number;
  'Valor Romaneado': number;
  'Valor Adiantamento': number;
  'Valor Faturado Entrega Futura + IPI': number;
  'Saldo a Faturar Real': number;
  'Data base entrega futura': string | null;
  'Venda por qual empresa?': string | null;
  'Vendedor/Representante': string | null;
  dataParametro: string | null;
  tipoF: string | null;
  StatusPedido: string | null;
};

export type CarteiraFinanceiraResumo = {
  saldoAReceber: number;
  saldoAFaturar: number;
  saldoRomaneado: number;
  totalPedidos: number;
  pedidosAtrasados: number;
  pctAtrasados: number;
  ticketMedio: number;
};

export type CarteiraMapaPonto = {
  municipio: string;
  uf: string;
  lat: number;
  lng: number;
  saldoAReceber: number;
  saldoAFaturar: number;
  saldoRomaneado: number;
  qtdPedidos: number;
  qtdClientes: number;
};

export type CarteiraFinanceiraPayload = {
  linhas: CarteiraFinanceiraLinha[];
  resumo: CarteiraFinanceiraResumo;
  mapaPontos: CarteiraMapaPonto[];
  semLocalizacao: number;
  opcoes: {
    uf: string[];
    cliente: string[];
    empresa: string[];
    condicaoPagamento: string[];
    tipoF: string[];
  };
  erro?: string;
};

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function toDateStr(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function toStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function asList(v: string[] | undefined): string[] {
  if (!v?.length) return [];
  return [...new Set(v.map((x) => String(x).trim()).filter(Boolean))];
}

function mapRow(raw: Record<string, unknown>): CarteiraFinanceiraLinha {
  return {
    idEmpresa: toInt(raw.idEmpresa),
    id: toInt(raw.id),
    Observacoes: toStr(raw.Observacoes),
    RM: toStr(raw.RM),
    'Tipo Pedido': toStr(raw['Tipo Pedido']),
    PD: toStr(raw.PD),
    Emissao: toDateStr(raw.Emissao),
    Cliente: toStr(raw.Cliente),
    'Data de entrega': toDateStr(raw['Data de entrega']),
    'Metodo de Entrega': toStr(raw['Metodo de Entrega']),
    'Requisicao de loja do grupo?': toStr(raw['Requisicao de loja do grupo?']),
    UF: toStr(raw.UF),
    'Municipio de entrega': toStr(raw['Municipio de entrega']),
    'Forma de Pagamento': toStr(raw['Forma de Pagamento']),
    'Condicao de pagamento do pedido de venda': toStr(raw['Condicao de pagamento do pedido de venda']),
    'Valor Original Pedido': toNum(raw['Valor Original Pedido']),
    'Valor Total': toNum(raw['Valor Total']),
    'Valor Pendente': toNum(raw['Valor Pendente']),
    'Valor Romaneado': toNum(raw['Valor Romaneado']),
    'Valor Adiantamento': toNum(raw['Valor Adiantamento']),
    'Valor Faturado Entrega Futura + IPI': toNum(raw['Valor Faturado Entrega Futura + IPI']),
    'Saldo a Faturar Real': toNum(raw['Saldo a Faturar Real']),
    'Data base entrega futura': toStr(raw['Data base entrega futura']),
    'Venda por qual empresa?': toStr(raw['Venda por qual empresa?']),
    'Vendedor/Representante': toStr(raw['Vendedor/Representante']),
    dataParametro: toDateStr(raw.dataParametro),
    tipoF: toStr(raw.tipoF),
    StatusPedido: toStr(raw.StatusPedido),
  };
}

/**
 * Filtros externos com escape() — NÃO usar placeholders `?`.
 * A query base tem aliases com `?` (ex.: "Requisicao de loja do grupo?"), e o mysql2
 * substitui qualquer `?` no SQL, quebrando a sintaxe.
 */
function buildOuterFilters(
  filtros: CarteiraFinanceiraFiltros,
  escape: (v: unknown) => string
): string {
  const parts: string[] = [];

  if (filtros.dataInicio && /^\d{4}-\d{2}-\d{2}$/.test(filtros.dataInicio)) {
    parts.push(`DATE(c.\`Emissao\`) >= ${escape(filtros.dataInicio)}`);
  }
  if (filtros.dataFim && /^\d{4}-\d{2}-\d{2}$/.test(filtros.dataFim)) {
    parts.push(`DATE(c.\`Emissao\`) <= ${escape(filtros.dataFim)}`);
  }

  const uf = asList(filtros.uf);
  if (uf.length) {
    parts.push(`c.\`UF\` IN (${uf.map((v) => escape(v)).join(', ')})`);
  }

  const cliente = asList(filtros.cliente);
  if (cliente.length) {
    parts.push(`c.\`Cliente\` IN (${cliente.map((v) => escape(v)).join(', ')})`);
  }

  const empresa = asList(filtros.empresa);
  if (empresa.length) {
    parts.push(`c.\`Venda por qual empresa?\` IN (${empresa.map((v) => escape(v)).join(', ')})`);
  }

  const status = (filtros.statusPedido ?? '').trim();
  if (status === 'Atrasado' || status === 'Em dia') {
    parts.push(`c.\`StatusPedido\` = ${escape(status)}`);
  }

  const tipoF = asList(filtros.tipoF);
  if (tipoF.length) {
    parts.push(`c.\`tipoF\` IN (${tipoF.map((v) => escape(v)).join(', ')})`);
  }

  const condicao = asList(filtros.condicaoPagamento);
  if (condicao.length) {
    parts.push(
      `c.\`Condicao de pagamento do pedido de venda\` IN (${condicao.map((v) => escape(v)).join(', ')})`
    );
  }

  const municipio = asList(filtros.municipio);
  if (municipio.length) {
    parts.push(`c.\`Municipio de entrega\` IN (${municipio.map((v) => escape(v)).join(', ')})`);
  }

  return parts.length ? `WHERE ${parts.join(' AND ')}` : '';
}

function calcResumo(linhas: CarteiraFinanceiraLinha[]): CarteiraFinanceiraResumo {
  let saldoAReceber = 0;
  let saldoAFaturar = 0;
  let saldoRomaneado = 0;
  const pds = new Set<string>();
  const pdsAtrasados = new Set<string>();

  for (const l of linhas) {
    saldoAReceber += l['Saldo a Faturar Real'];
    saldoAFaturar += l['Valor Pendente'];
    saldoRomaneado += l['Valor Romaneado'];
    const pd = l.PD ?? String(l.id);
    pds.add(pd);
    if (l.StatusPedido === 'Atrasado') pdsAtrasados.add(pd);
  }

  const totalPedidos = pds.size;
  const pedidosAtrasados = pdsAtrasados.size;
  return {
    saldoAReceber,
    saldoAFaturar,
    saldoRomaneado,
    totalPedidos,
    pedidosAtrasados,
    pctAtrasados: totalPedidos > 0 ? (pedidosAtrasados / totalPedidos) * 100 : 0,
    ticketMedio: totalPedidos > 0 ? saldoAReceber / totalPedidos : 0,
  };
}

function uniqueSorted(vals: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  for (const v of vals) {
    if (v?.trim()) set.add(v.trim());
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

async function montarMapaPontos(
  linhas: CarteiraFinanceiraLinha[]
): Promise<{ pontos: CarteiraMapaPonto[]; semLocalizacao: number }> {
  type Agg = {
    municipio: string;
    uf: string;
    saldoAReceber: number;
    saldoAFaturar: number;
    saldoRomaneado: number;
    pds: Set<string>;
    clientes: Set<string>;
  };
  const byKey = new Map<string, Agg>();

  for (const l of linhas) {
    const municipio = (l['Municipio de entrega'] ?? '').trim();
    const uf = (l.UF ?? '').trim().toUpperCase();
    if (!municipio) continue;
    const key = `${municipio.toUpperCase()}|${uf}`;
    let agg = byKey.get(key);
    if (!agg) {
      agg = {
        municipio,
        uf,
        saldoAReceber: 0,
        saldoAFaturar: 0,
        saldoRomaneado: 0,
        pds: new Set(),
        clientes: new Set(),
      };
      byKey.set(key, agg);
    }
    agg.saldoAReceber += l['Saldo a Faturar Real'];
    agg.saldoAFaturar += l['Valor Pendente'];
    agg.saldoRomaneado += l['Valor Romaneado'];
    agg.pds.add(l.PD ?? String(l.id));
    if (l.Cliente) agg.clientes.add(l.Cliente);
  }

  const pontos: CarteiraMapaPonto[] = [];
  let semLocalizacao = 0;

  for (const agg of byKey.values()) {
    // Só banco local (municipio_coordenada) — evita Nominatim no hot path.
    const coords = await buscarCoordenadasMunicipio(agg.municipio, agg.uf);
    if (!coords) {
      semLocalizacao += 1;
      continue;
    }
    pontos.push({
      municipio: agg.municipio,
      uf: agg.uf,
      lat: coords.lat,
      lng: coords.lng,
      saldoAReceber: agg.saldoAReceber,
      saldoAFaturar: agg.saldoAFaturar,
      saldoRomaneado: agg.saldoRomaneado,
      qtdPedidos: agg.pds.size,
      qtdClientes: agg.clientes.size,
    });
  }

  return { pontos, semLocalizacao };
}

const RESUMO_VAZIO: CarteiraFinanceiraResumo = {
  saldoAReceber: 0,
  saldoAFaturar: 0,
  saldoRomaneado: 0,
  totalPedidos: 0,
  pedidosAtrasados: 0,
  pctAtrasados: 0,
  ticketMedio: 0,
};

export async function queryCarteiraFinanceira(
  filtros: CarteiraFinanceiraFiltros = {}
): Promise<CarteiraFinanceiraPayload> {
  if (!isNomusEnabled()) {
    return {
      linhas: [],
      resumo: RESUMO_VAZIO,
      mapaPontos: [],
      semLocalizacao: 0,
      opcoes: { uf: [], cliente: [], empresa: [], condicaoPagamento: [], tipoF: [] },
      erro: 'Nomus não configurado (NOMUS_DB_URL).',
    };
  }
  const pool = getNomusPool();
  if (!pool) {
    return {
      linhas: [],
      resumo: RESUMO_VAZIO,
      mapaPontos: [],
      semLocalizacao: 0,
      opcoes: { uf: [], cliente: [], empresa: [], condicaoPagamento: [], tipoF: [] },
      erro: 'Pool Nomus indisponível.',
    };
  }

  const baseSql = loadSql().trim().replace(/;\s*$/, '');
  const where = buildOuterFilters(filtros, (v) => pool.escape(v));
  const sql = `
SELECT * FROM (
${baseSql}
) AS c
${where}
`.trim();

  try {
    // Sem params: aliases da query base contêm "?" (mysql2 interpretaria como placeholder).
    const [rows] = await pool.query(sql);
    const rawList = Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
    const linhas = rawList.map(mapRow);
    const resumo = calcResumo(linhas);
    const { pontos: mapaPontos, semLocalizacao } = await montarMapaPontos(linhas);

    return {
      linhas,
      resumo,
      mapaPontos,
      semLocalizacao,
      opcoes: {
        uf: uniqueSorted(linhas.map((l) => l.UF)),
        cliente: uniqueSorted(linhas.map((l) => l.Cliente)),
        empresa: uniqueSorted(linhas.map((l) => l['Venda por qual empresa?'])),
        condicaoPagamento: uniqueSorted(
          linhas.map((l) => l['Condicao de pagamento do pedido de venda'])
        ),
        tipoF: uniqueSorted(linhas.map((l) => l.tipoF)),
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[queryCarteiraFinanceira]', msg);
    return {
      linhas: [],
      resumo: RESUMO_VAZIO,
      mapaPontos: [],
      semLocalizacao: 0,
      opcoes: { uf: [], cliente: [], empresa: [], condicaoPagamento: [], tipoF: [] },
      erro: msg,
    };
  }
}
