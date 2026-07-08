/** Lógica do painel — equivalente a backend/app/dashboard.py */
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { getNomusPool, isNomusEnabled } from '../../config/nomusDb.js';
import {
  dashboardCache,
  setorMapCache,
  yearRowsCache,
  type GondRow,
  type PaRow,
  type PedidoRow,
  type YearRowsBundle,
} from './painelProducaoCache.js';
import {
  PRODUCAO_HISTORICO_INICIO,
  SETOR_EXCLUIDOS,
  SETOR_PEDIDOS_CUTOVER,
  SETOR_PESO,
} from './painelProducaoConstants.js';
import { loadPesoBomMap } from './painelProducaoPesoBom.js';
import {
  ensureCurrentMonth,
  getTarget,
  isSemMeta,
  listMesesMeta,
  listSetoresMeta,
} from './painelProducaoTargetsService.js';

const SQL_PRODUCAO_PA = `
SELECT
    mp.idProduto AS id_produto,
    DATE(mp.data) AS dt,
    CASE WHEN se.id = 28 THEN mp.qtde * (-1) ELSE mp.qtde END AS quantidade
FROM movimentacaoproducao mp
LEFT JOIN setorestoque ss ON mp.idSetorEstoqueSaida = ss.id
LEFT JOIN setorestoque se ON mp.idSetorEstoqueEntrada = se.id
WHERE mp.idTipoMovimentacao = 18
  AND ((se.id = 28) OR (ss.id = 23 AND se.id = 5))
  AND mp.data >= ? AND mp.data < ?
`;

const SQL_GOND_VENDAS = `
SELECT
    ide.idProduto AS id_produto,
    DATE(de.dataEmissao) AS dt,
    ide.qtde AS qtde,
    gp.nome AS grupo_produto
FROM itemdocumentoestoque ide
JOIN tipomovimentacao tm ON ide.idTipoMovimentacao = tm.id
JOIN documentoestoque de ON ide.idDocumentoSaida = de.id
LEFT JOIN nfe nfe ON nfe.idDocumentoEstoque = de.id
JOIN produto pd ON pd.id = ide.idProduto
JOIN grupoproduto gp ON pd.idGrupoProduto = gp.id
WHERE nfe.status IN (1, 3, 4)
  AND (tm.nome LIKE 'Vend%' OR tm.id IN (91, 133))
  AND tm.nome <> 'VENDA DE MERCADORIA  ADQUIRIDA CONS FINAL -  FORA DO ESTADO'
  AND de.dataEmissao >= ? AND de.dataEmissao < ?
  AND (gp.nome = 'Porta Paletes' OR gp.nome LIKE '%Gondola%' OR gp.nome LIKE '%G%ndola%')
  AND nfe.numero <> '77669'
`;

const SQL_PEDIDOS_ATENDIDOS = `
SELECT
    ip.idProduto AS id_produto,
    DATE(pe.dataEmissao) AS dt,
    pe.id AS id_pedido,
    pe.nome AS codigo_pedido,
    COALESCE(pec.nomeRazaoSocial, '—') AS cliente,
    pd.nome AS codigo_produto,
    COALESCE(NULLIF(pd.descricao, ''), NULLIF(pd.descricaoNFe, ''), '—') AS descricao_produto
FROM itempedido ip
INNER JOIN pedido pe ON ip.idPedido = pe.id
LEFT JOIN pessoa pec ON pe.idCliente = pec.id
INNER JOIN produto pd ON ip.idProduto = pd.id
WHERE pe.dataEmissao >= ? AND pe.dataEmissao < ?
  AND ip.status IN (3, 4)
`;

const SQL_SETOR_MAP = `
SELECT p.id, COALESCE(alo.opcao, 'A definir') AS setor
FROM produto p
INNER JOIN (
    SELECT nome, MAX(CAST(revisao AS DECIMAL(10,2))) AS max_rv
    FROM produto GROUP BY nome
) lr ON lr.nome = p.nome AND CAST(p.revisao AS DECIMAL(10,2)) = lr.max_rv
LEFT JOIN atributoprodutovalor apv ON apv.idProduto = p.id AND apv.idAtributo = 679
LEFT JOIN atributolistaopcao alo ON alo.id = apv.idListaOpcao
`;

function parseMes(mes: string): Date {
  const [y, m] = mes.split('-');
  return new Date(Number(y), Number(m) - 1, 1);
}

function mesLabel(d: Date): string {
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${meses[d.getMonth()]} ${d.getFullYear()}`;
}

function corTarget(pct: number): 'green' | 'amber' | 'red' {
  if (pct >= 0.8) return 'green';
  if (pct >= 0.5) return 'amber';
  return 'red';
}

function normalizeDt(dt: Date | string): Date {
  if (typeof dt === 'string') {
    const parsed = new Date(dt);
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function usesPedidos(setor: string, mesDt: Date): boolean {
  return SETOR_PESO.has(setor) && mesDt >= SETOR_PEDIDOS_CUTOVER;
}

async function loadSetorMap(pool: Pool): Promise<Map<number, string>> {
  const [rows] = await pool.query<RowDataPacket[]>(SQL_SETOR_MAP);
  const mapping = new Map<number, string>();
  for (const row of rows) {
    mapping.set(Number(row.id), String(row.setor));
  }
  return mapping;
}

async function getSetorMap(pool: Pool): Promise<Map<number, string>> {
  const cached = setorMapCache.get('map');
  if (cached) return cached;
  const mapping = await loadSetorMap(pool);
  setorMapCache.set('map', mapping);
  return mapping;
}

function monthEnd(start: Date): Date {
  if (start.getMonth() === 11) return new Date(start.getFullYear() + 1, 0, 1);
  return new Date(start.getFullYear(), start.getMonth() + 1, 1);
}

function yearBounds(ano: number): [Date, Date] {
  return [new Date(ano, 0, 1), new Date(ano + 1, 0, 1)];
}

async function fetchPaRows(pool: Pool, inicio: Date, fim: Date): Promise<PaRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(SQL_PRODUCAO_PA, [inicio, fim]);
  return rows.map((r) => ({
    id_produto: Number(r.id_produto),
    dt: r.dt,
    quantidade: Number(r.quantidade ?? 0),
  }));
}

async function fetchGondRows(pool: Pool, inicio: Date, fim: Date): Promise<GondRow[]> {
  const pesoMap = await loadPesoBomMap(pool);
  const [raw] = await pool.query<RowDataPacket[]>(SQL_GOND_VENDAS, [inicio, fim]);
  return raw.map((row) => {
    const qtde = Number(row.qtde ?? 0);
    const pesoUnit = Number(pesoMap.get(Number(row.id_produto)) ?? 0);
    return {
      id_produto: Number(row.id_produto),
      dt: row.dt,
      qtde,
      grupo_produto: String(row.grupo_produto ?? ''),
      peso_total: qtde * pesoUnit,
    };
  });
}

async function fetchPedidoRows(pool: Pool, inicio: Date, fim: Date): Promise<PedidoRow[]> {
  const [rows] = await pool.query<RowDataPacket[]>(SQL_PEDIDOS_ATENDIDOS, [inicio, fim]);
  return rows.map((r) => ({
    id_produto: Number(r.id_produto),
    dt: r.dt,
    id_pedido: Number(r.id_pedido),
    codigo_pedido: String(r.codigo_pedido ?? '—'),
    cliente: String(r.cliente ?? '—'),
    codigo_produto: String(r.codigo_produto ?? '—'),
    descricao_produto: String(r.descricao_produto ?? '—'),
  }));
}

async function fetchYearRows(pool: Pool, ano: number): Promise<YearRowsBundle> {
  const cacheKey = `year:${ano}`;
  const cached = yearRowsCache.get(cacheKey);
  if (cached) return cached;

  const [inicio, fim] = yearBounds(ano);
  const paRows = await fetchPaRows(pool, inicio, fim);
  const gondRows = await fetchGondRows(pool, inicio, fim);
  const pedidoRows = await fetchPedidoRows(pool, inicio, fim);
  const result: YearRowsBundle = [paRows, gondRows, pedidoRows];
  yearRowsCache.set(cacheKey, result);
  return result;
}

async function fetchHistoricoRows(pool: Pool, anoLimite: number): Promise<YearRowsBundle> {
  const inicioAno = PRODUCAO_HISTORICO_INICIO.getFullYear();
  const cacheKey = `hist:${inicioAno}:${anoLimite}`;
  const cached = yearRowsCache.get(cacheKey);
  if (cached) return cached;

  const paRows: PaRow[] = [];
  const gondRows: GondRow[] = [];
  const pedidoRows: PedidoRow[] = [];

  for (let ano = inicioAno; ano <= anoLimite; ano++) {
    const [pa, gond, ped] = await fetchYearRows(pool, ano);
    paRows.push(...pa);
    gondRows.push(...gond);
    pedidoRows.push(...ped);
  }

  const result: YearRowsBundle = [paRows, gondRows, pedidoRows];
  yearRowsCache.set(cacheKey, result);
  return result;
}

function rowSetor(setorMap: Map<number, string>, idProduto: number): string {
  return setorMap.get(idProduto) ?? 'A definir';
}

function sumRows(
  rows: Array<{ id_produto: number; dt: Date | string; [key: string]: unknown }>,
  setorMap: Map<number, string>,
  setor: string,
  valKey: string,
  inicio?: Date,
  fim?: Date,
): number {
  let total = 0;
  for (const row of rows) {
    if (rowSetor(setorMap, row.id_produto) !== setor) continue;
    if (inicio !== undefined && fim !== undefined) {
      const dt = normalizeDt(row.dt);
      if (dt < inicio || dt >= fim) continue;
    }
    total += Number(row[valKey] ?? 0);
  }
  return total;
}

function sumPedidosDistintos(
  pedidoRows: PedidoRow[],
  setorMap: Map<number, string>,
  setor: string,
  inicio: Date,
  fim: Date,
): number {
  const pedidos = new Set<number>();
  for (const row of pedidoRows) {
    if (rowSetor(setorMap, row.id_produto) !== setor) continue;
    const dt = normalizeDt(row.dt);
    if (dt < inicio || dt >= fim) continue;
    pedidos.add(row.id_pedido);
  }
  return pedidos.size;
}

function pedidosDetalhe(
  pedidoRows: PedidoRow[],
  setorMap: Map<number, string>,
  setor: string,
  inicio: Date,
  fim: Date,
) {
  const byPedido = new Map<
    number,
    {
      codigo_pedido: string;
      cliente: string;
      itens: { codigo: string; descricao: string }[];
      _itemKeys: Set<string>;
    }
  >();

  for (const row of pedidoRows) {
    if (rowSetor(setorMap, row.id_produto) !== setor) continue;
    const dt = normalizeDt(row.dt);
    if (dt < inicio || dt >= fim) continue;

    const pid = row.id_pedido;
    if (!byPedido.has(pid)) {
      byPedido.set(pid, {
        codigo_pedido: row.codigo_pedido || '—',
        cliente: row.cliente || '—',
        itens: [],
        _itemKeys: new Set(),
      });
    }

    const entry = byPedido.get(pid)!;
    const codigo = row.codigo_produto || '—';
    const descricao = row.descricao_produto || '—';
    const itemKey = `${codigo}\0${descricao}`;
    if (entry._itemKeys.has(itemKey)) continue;
    entry._itemKeys.add(itemKey);
    entry.itens.push({ codigo, descricao });
  }

  const result = [...byPedido.values()].map(({ _itemKeys, ...rest }) => rest);
  result.sort((a, b) => String(a.codigo_pedido).localeCompare(String(b.codigo_pedido)));
  return result;
}

function sumProducao(
  paRows: PaRow[],
  gondRows: GondRow[],
  pedidoRows: PedidoRow[],
  setorMap: Map<number, string>,
  setor: string,
  inicio: Date,
  fim: Date,
): number {
  if (SETOR_PESO.has(setor)) {
    if (usesPedidos(setor, inicio)) {
      return sumPedidosDistintos(pedidoRows, setorMap, setor, inicio, fim);
    }
    return sumRows(gondRows, setorMap, setor, 'peso_total', inicio, fim);
  }
  return sumRows(paRows, setorMap, setor, 'quantidade', inicio, fim);
}

function producaoPorDia(
  paRows: PaRow[],
  gondRows: GondRow[],
  pedidoRows: PedidoRow[],
  setorMap: Map<number, string>,
  setor: string,
  inicio: Date,
  fim: Date,
) {
  if (SETOR_PESO.has(setor) && usesPedidos(setor, inicio)) {
    const buckets = new Map<number, Set<number>>();
    for (const row of pedidoRows) {
      if (rowSetor(setorMap, row.id_produto) !== setor) continue;
      const dt = normalizeDt(row.dt);
      if (dt < inicio || dt >= fim) continue;
      const day = dt.getDate();
      if (!buckets.has(day)) buckets.set(day, new Set());
      buckets.get(day)!.add(row.id_pedido);
    }
    const days = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => {
      const d = i + 1;
      return { label: String(d), valor: buckets.get(d)?.size ?? 0 };
    });
  }

  const source = SETOR_PESO.has(setor) ? gondRows : paRows;
  const valKey = SETOR_PESO.has(setor) ? 'peso_total' : 'quantidade';
  const bucketsQty = new Map<number, number>();

  for (const row of source) {
    if (rowSetor(setorMap, row.id_produto) !== setor) continue;
    const dt = normalizeDt(row.dt);
    if (dt < inicio || dt >= fim) continue;
    const day = dt.getDate();
    bucketsQty.set(day, (bucketsQty.get(day) ?? 0) + Number(row[valKey as keyof typeof row] ?? 0));
  }

  const days = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0).getDate();
  return Array.from({ length: days }, (_, i) => {
    const d = i + 1;
    return { label: String(d), valor: Math.round((bucketsQty.get(d) ?? 0) * 100) / 100 };
  });
}

async function producaoPorMesHistorico(
  paRows: PaRow[],
  gondRows: GondRow[],
  pedidoRows: PedidoRow[],
  setorMap: Map<number, string>,
  setor: string,
  inicio: Date,
  ateMes: Date,
) {
  async function metaDoMes(mesStart: Date): Promise<number | null> {
    if (await isSemMeta(setor, mesStart)) return null;
    const meta = await getTarget(setor, mesStart);
    return meta > 0 ? meta : null;
  }

  const result: { label: string; valor: number; meta: number | null }[] = [];
  let cur = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const ultimo = new Date(ateMes.getFullYear(), ateMes.getMonth(), 1);

  while (cur <= ultimo) {
    const mesEnd = monthEnd(cur);
    let val: number;
    if (SETOR_PESO.has(setor)) {
      if (usesPedidos(setor, cur)) {
        val = sumPedidosDistintos(pedidoRows, setorMap, setor, cur, mesEnd);
      } else {
        val = sumRows(gondRows, setorMap, setor, 'peso_total', cur, mesEnd);
      }
    } else {
      val = sumRows(paRows, setorMap, setor, 'quantidade', cur, mesEnd);
    }
    result.push({
      label: mesLabel(cur),
      valor: Math.round(val * 100) / 100,
      meta: await metaDoMes(cur),
    });
    cur = mesEnd;
  }

  return result;
}

async function rankingMes(
  paRows: PaRow[],
  gondRows: GondRow[],
  pedidoRows: PedidoRow[],
  setorMap: Map<number, string>,
  mes: Date,
  fim: Date,
) {
  const setores = (await listSetoresMeta()).filter((s) => !SETOR_EXCLUIDOS.has(s));
  const totals: Record<string, number> = Object.fromEntries(setores.map((s) => [s, 0]));

  for (const row of paRows) {
    const dt = normalizeDt(row.dt);
    if (dt < mes || dt >= fim) continue;
    const setor = rowSetor(setorMap, row.id_produto);
    if (setor in totals && !SETOR_PESO.has(setor)) {
      totals[setor] += Number(row.quantidade ?? 0);
    }
  }

  const pedidosPorSetor: Record<string, Set<number>> = Object.fromEntries(
    setores.filter((s) => SETOR_PESO.has(s)).map((s) => [s, new Set<number>()]),
  );

  for (const row of gondRows) {
    const dt = normalizeDt(row.dt);
    if (dt < mes || dt >= fim) continue;
    const setor = rowSetor(setorMap, row.id_produto);
    if (setor in totals && SETOR_PESO.has(setor) && !usesPedidos(setor, mes)) {
      totals[setor] += Number(row.peso_total ?? 0);
    }
  }

  for (const row of pedidoRows) {
    const dt = normalizeDt(row.dt);
    if (dt < mes || dt >= fim) continue;
    const setor = rowSetor(setorMap, row.id_produto);
    if (setor in pedidosPorSetor && usesPedidos(setor, mes)) {
      pedidosPorSetor[setor].add(row.id_pedido);
    }
  }

  for (const [setor, pedidos] of Object.entries(pedidosPorSetor)) {
    if (usesPedidos(setor, mes)) {
      totals[setor] = pedidos.size;
    }
  }

  const rows: {
    setor: string;
    producao: number;
    meta: number;
    percentual_meta: number;
    ranking?: number;
  }[] = [];

  for (const setor of setores) {
    if (await isSemMeta(setor, mes)) continue;
    const prod = totals[setor];
    const meta = await getTarget(setor, mes);
    const pct = meta ? prod / meta : 0;
    rows.push({
      setor,
      producao: Math.round(prod * 100) / 100,
      meta,
      percentual_meta: Math.round(pct * 10000) / 100,
    });
  }

  rows.sort((a, b) => {
    if (b.percentual_meta !== a.percentual_meta) return b.percentual_meta - a.percentual_meta;
    return b.producao - a.producao;
  });
  rows.forEach((row, i) => {
    row.ranking = i + 1;
  });
  return rows;
}

async function buildDashboard(setor: string, mes: string) {
  const pool = getNomusPool();
  if (!pool) {
    throw new Error('Conexão Nomus não configurada (NOMUS_DB_URL).');
  }

  const mesDt = parseMes(mes);
  const fim = monthEnd(mesDt);
  const ano = mesDt.getFullYear();

  const setorMap = await getSetorMap(pool);
  const [paRows, gondRows, pedidoRows] = await fetchYearRows(pool, ano);
  const [paHist, gondHist, pedHist] = await fetchHistoricoRows(pool, ano);

  const producao = sumProducao(paRows, gondRows, pedidoRows, setorMap, setor, mesDt, fim);
  const porDia = producaoPorDia(paRows, gondRows, pedidoRows, setorMap, setor, mesDt, fim);
  const porMes = await producaoPorMesHistorico(
    paHist,
    gondHist,
    pedHist,
    setorMap,
    setor,
    PRODUCAO_HISTORICO_INICIO,
    mesDt,
  );
  const ranking = await rankingMes(paRows, gondRows, pedidoRows, setorMap, mesDt, fim);

  const semMeta = await isSemMeta(setor, mesDt);
  const meta = await getTarget(setor, mesDt);
  const pctRatio = semMeta ? 0 : meta ? producao / meta : 0;
  const pctDisplay = pctRatio * 100;
  const unidade = SETOR_PESO.has(setor)
    ? usesPedidos(setor, mesDt)
      ? 'pedidos'
      : 'kg'
    : 'un';

  const payload: Record<string, unknown> = {
    setor,
    mes,
    mes_label: mesLabel(mesDt),
    titulo: `SETOR DE ${setor.toUpperCase()}`,
    producao: Math.round(producao * 100) / 100,
    meta,
    sem_meta: semMeta,
    percentual_meta: Math.round(pctDisplay * 100) / 100,
    cor_target: semMeta ? null : corTarget(pctRatio),
    unidade,
    ranking,
    por_dia: porDia,
    por_mes: porMes,
    marcador_progresso: Math.round(Math.min(pctRatio, 1) * 10000) / 10000,
  };

  if (unidade === 'pedidos') {
    payload.pedidos_detalhe = pedidosDetalhe(pedidoRows, setorMap, setor, mesDt, fim);
  }

  return payload;
}

export async function getDashboard(setor: string, mes: string) {
  const cacheKey = `dashboard:${setor}:${mes}`;
  const cached = dashboardCache.get(cacheKey);
  if (cached) return cached;

  const payload = await buildDashboard(setor, mes);
  dashboardCache.set(cacheKey, payload);
  return payload;
}

export async function getFilters() {
  await ensureCurrentMonth();
  const setoresAll = await listSetoresMeta();
  const setores = setoresAll.filter((s) => !SETOR_EXCLUIDOS.has(s));
  const meses = await listMesesMeta();
  const hoje = new Date();
  const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  const defaultSetor = setores.includes('Bebedouros')
    ? 'Bebedouros'
    : setores[0] ?? '';
  const defaultMes = meses.includes(hojeStr) ? hojeStr : meses[0] ?? hojeStr;
  return {
    setores,
    meses,
    default_setor: defaultSetor,
    default_mes: defaultMes,
    nomus_enabled: isNomusEnabled(),
  };
}
