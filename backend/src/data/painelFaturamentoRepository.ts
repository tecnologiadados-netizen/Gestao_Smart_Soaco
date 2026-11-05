/**
 * Faturamento Só Aço (empresa de saída 1) para o Painel Metas.
 * Mesma regra do faturamento diário: tipos de saída, status da NF,
 * exclusões pontuais e devolução (tm 52) só quando a origem também
 * passaria no filtro de faturamento.
 */

import { getNomusPool } from '../config/nomusDb.js';

const SQL_DEVOLUCAO_ORIGEM_NO_FATURAMENTO = `
  AND (
    ide.idItemOrigemDevolucao IS NULL
    OR EXISTS (
      SELECT 1
      FROM itemdocumentoestoque ide_origem
      INNER JOIN documentoestoque de_origem ON de_origem.id = ide_origem.idDocumentoEstoque
      INNER JOIN tipomovimentacao tm_origem ON tm_origem.id = ide_origem.idTipoMovimentacao
      LEFT JOIN nfe nfe_origem ON nfe_origem.idDocumentoEstoque = de_origem.id
      WHERE ide_origem.id = ide.idItemOrigemDevolucao
        AND (nfe_origem.status IS NULL OR nfe_origem.status IN (1, 3, 4))
        AND tm_origem.id IN (27, 59, 21, 54, 6, 62, 45, 93, 83, 74, 108, 64, 92)
        AND de_origem.idEmpresaSaida = 1
        AND ide_origem.id NOT IN (493134, 493135, 493136, 493137, 493138, 493139, 493140)
        AND de_origem.numeroDocumentoFiscal NOT IN (
          128748, 127108, 133953, 133950, 133948, 133947,
          133956, 133951, 133949, 133957, 133961, 133876
        )
    )
  )
`;

const SQL_FAT_WHERE = `
  WHERE (nfe.status IS NULL OR nfe.status IN (1, 3, 4))
    AND tm.id IN (27, 59, 21, 54, 6, 62, 45, 93, 83, 74, 108, 64, 92)
    AND de.idEmpresaSaida = 1
    AND ide.id NOT IN (493134, 493135, 493136, 493137, 493138, 493139, 493140)
    AND de.numeroDocumentoFiscal NOT IN (
      128748, 127108, 133953, 133950, 133948, 133947,
      133956, 133951, 133949, 133957, 133961, 133876
    )
    AND de.dataEmissao >= ? AND de.dataEmissao < ?
`;

const SQL_DEV_WHERE = `
  WHERE (nfe.status IS NULL OR nfe.status = 4)
    AND tm.id IN (52)
    AND de.dataEmissao >= ? AND de.dataEmissao < ?
    ${SQL_DEVOLUCAO_ORIGEM_NO_FATURAMENTO}
`;

const SQL_JOINS = `
  FROM itemdocumentoestoque ide
  LEFT JOIN tipomovimentacao tm ON ide.idTipoMovimentacao = tm.id
  LEFT JOIN documentoestoque de ON ide.idDocumentoEstoque = de.id
  LEFT JOIN nfe nfe ON nfe.idDocumentoEstoque = de.id
`;

export interface FaturamentoDia {
  dia: string;
  faturado: number;
  desconto: number;
  devolvido: number;
  liquido: number;
}

export interface FaturamentoMesResumo {
  mes: string;
  faturado: number;
  desconto: number;
  devolvido: number;
  liquido: number;
}

export interface FaturamentoDocumento {
  tipo: 'faturamento' | 'devolucao';
  numero: string;
  documento: string;
  pedido: string;
  faturado: number;
  desconto: number;
  devolvido: number;
  liquido: number;
}

export interface FaturamentoConsulta {
  mes: string;
  ini: string;
  fim: string;
  disponivel: { ini: string; fim: string };
  dias: FaturamentoDia[];
  meses: FaturamentoMesResumo[];
  totais: Omit<FaturamentoDia, 'dia'>;
}

function toNum(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function liquidoDe(faturado: number, desconto: number, devolvido: number): number {
  return round2(faturado - desconto - devolvido);
}

export function parseMesAno(mes: string): { ano: number; mes: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(mes.trim());
  if (!m) return null;
  const ano = Number(m[1]);
  const mesNum = Number(m[2]);
  if (mesNum < 1 || mesNum > 12 || ano < 2000 || ano > 2100) return null;
  return { ano, mes: mesNum };
}

function chaveDia(v: unknown): string {
  const s = String(v ?? '');
  return s.slice(0, 10);
}

async function extremos(where: string): Promise<{ ini: string; fim: string } | null> {
  const pool = getNomusPool();
  if (!pool) throw new Error('NOMUS_DB_URL não configurado');
  const [rows] = (await pool.query(
    `SELECT DATE_FORMAT(MIN(de.dataEmissao), '%Y-%m-%d') AS ini,
            DATE_FORMAT(MAX(de.dataEmissao), '%Y-%m-%d') AS fim
     ${SQL_JOINS}
     ${where}`
  )) as [Record<string, unknown>[], unknown];
  const row = rows[0];
  const ini = chaveDia(row?.ini);
  const fim = chaveDia(row?.fim);
  if (!ini || ini === 'null' || !fim || fim === 'null') return null;
  return { ini, fim };
}

const SQL_FAT_SEM_DATA = `
  WHERE (nfe.status IS NULL OR nfe.status IN (1, 3, 4))
    AND tm.id IN (27, 59, 21, 54, 6, 62, 45, 93, 83, 74, 108, 64, 92)
    AND de.idEmpresaSaida = 1
    AND ide.id NOT IN (493134, 493135, 493136, 493137, 493138, 493139, 493140)
    AND de.numeroDocumentoFiscal NOT IN (
      128748, 127108, 133953, 133950, 133948, 133947,
      133956, 133951, 133949, 133957, 133961, 133876
    )
`;

const SQL_DEV_SEM_DATA = `
  WHERE (nfe.status IS NULL OR nfe.status = 4)
    AND tm.id IN (52)
    ${SQL_DEVOLUCAO_ORIGEM_NO_FATURAMENTO}
`;

async function periodoDisponivel(): Promise<{ ini: string; fim: string }> {
  const [fat, dev] = await Promise.all([extremos(SQL_FAT_SEM_DATA), extremos(SQL_DEV_SEM_DATA)]);
  const inicios = [fat?.ini, dev?.ini].filter((v): v is string => !!v).sort();
  const fins = [fat?.fim, dev?.fim].filter((v): v is string => !!v).sort();
  if (inicios.length === 0 || fins.length === 0) {
    const hoje = new Date();
    const iso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    return { ini: iso, fim: iso };
  }
  return { ini: inicios[0], fim: fins[fins.length - 1] };
}

async function somarPorDia(
  ini: string,
  fim: string
): Promise<Map<string, { faturado: number; desconto: number; devolvido: number }>> {
  const pool = getNomusPool();
  if (!pool) throw new Error('NOMUS_DB_URL não configurado');

  const [fatRows] = (await pool.query(
    `SELECT DATE_FORMAT(de.dataEmissao, '%Y-%m-%d') AS dia,
            SUM(ide.valorTotal) AS faturado,
            SUM(ide.valorDesconto) AS desconto
     ${SQL_JOINS}
     ${SQL_FAT_WHERE}
     GROUP BY DATE_FORMAT(de.dataEmissao, '%Y-%m-%d')`,
    [ini, fim]
  )) as [Record<string, unknown>[], unknown];

  const [devRows] = (await pool.query(
    `SELECT DATE_FORMAT(de.dataEmissao, '%Y-%m-%d') AS dia,
            SUM(ide.valorTotalComDesconto) AS devolvido
     ${SQL_JOINS}
     ${SQL_DEV_WHERE}
     GROUP BY DATE_FORMAT(de.dataEmissao, '%Y-%m-%d')`,
    [ini, fim]
  )) as [Record<string, unknown>[], unknown];

  const map = new Map<string, { faturado: number; desconto: number; devolvido: number }>();
  for (const row of fatRows) {
    const dia = chaveDia(row.dia);
    map.set(dia, { faturado: toNum(row.faturado), desconto: toNum(row.desconto), devolvido: 0 });
  }
  for (const row of devRows) {
    const dia = chaveDia(row.dia);
    const atual = map.get(dia) ?? { faturado: 0, desconto: 0, devolvido: 0 };
    atual.devolvido = toNum(row.devolvido);
    map.set(dia, atual);
  }
  return map;
}

function paraDia(dia: string, v: { faturado: number; desconto: number; devolvido: number }): FaturamentoDia {
  return {
    dia,
    faturado: round2(v.faturado),
    desconto: round2(v.desconto),
    devolvido: round2(v.devolvido),
    liquido: liquidoDe(v.faturado, v.desconto, v.devolvido),
  };
}

const ISO_DIA = /^\d{4}-\d{2}-\d{2}$/;

export function parsePeriodo(ini: string, fim: string): { ini: string; fimExclusivo: string } | null {
  if (!ISO_DIA.test(ini) || !ISO_DIA.test(fim) || ini > fim) return null;
  const [y, m, d] = fim.split('-').map(Number);
  const seguinte = new Date(y, m - 1, d + 1);
  const fimExclusivo = `${seguinte.getFullYear()}-${String(seguinte.getMonth() + 1).padStart(2, '0')}-${String(seguinte.getDate()).padStart(2, '0')}`;
  return { ini, fimExclusivo };
}

export async function consultarFaturamento(ini: string, fim: string): Promise<FaturamentoConsulta> {
  const periodo = parsePeriodo(ini, fim);
  if (!periodo) throw new Error('Período inválido. Use datas AAAA-MM-DD, com o início até o fim.');

  const [porDia, disponivel] = await Promise.all([
    somarPorDia(periodo.ini, periodo.fimExclusivo),
    periodoDisponivel(),
  ]);

  const dias = [...porDia.entries()]
    .map(([dia, v]) => paraDia(dia, v))
    .sort((a, b) => a.dia.localeCompare(b.dia));

  const mesesMap = new Map<string, { faturado: number; desconto: number; devolvido: number }>();
  const cursor = new Date(`${ini.slice(0, 7)}-01T00:00:00`);
  const limite = new Date(`${fim.slice(0, 7)}-01T00:00:00`);
  while (cursor <= limite) {
    const chave = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    mesesMap.set(chave, { faturado: 0, desconto: 0, devolvido: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  for (const [dia, v] of porDia) {
    const chave = dia.slice(0, 7);
    const atual = mesesMap.get(chave);
    if (!atual) continue;
    atual.faturado += v.faturado;
    atual.desconto += v.desconto;
    atual.devolvido += v.devolvido;
  }
  const meses = [...mesesMap.entries()].map(([chave, v]) => ({
    mes: chave,
    faturado: round2(v.faturado),
    desconto: round2(v.desconto),
    devolvido: round2(v.devolvido),
    liquido: liquidoDe(v.faturado, v.desconto, v.devolvido),
  }));

  const totais = dias.reduce(
    (acc, d) => {
      acc.faturado += d.faturado;
      acc.desconto += d.desconto;
      acc.devolvido += d.devolvido;
      return acc;
    },
    { faturado: 0, desconto: 0, devolvido: 0 }
  );

  return {
    mes: ini.slice(0, 7),
    ini,
    fim,
    disponivel,
    dias,
    meses,
    totais: {
      faturado: round2(totais.faturado),
      desconto: round2(totais.desconto),
      devolvido: round2(totais.devolvido),
      liquido: liquidoDe(totais.faturado, totais.desconto, totais.devolvido),
    },
  };
}

export interface FaturamentoLinha {
  dataEmissao: string;
  nf: string;
  documento: string;
  idTipoMovimentacao: number;
  tipoMovimentacao: string;
  numeroPedido: string;
  codigoProduto: string;
  produto: string;
  faturado: number;
  desconto: number;
  devolvido: number;
  liquido: number;
}

const SQL_DETALHE_JOINS = `
  ${SQL_JOINS}
  LEFT JOIN produto pr ON pr.id = ide.idProduto
  LEFT JOIN itemdocumentoestoque_itempedidovenda ideipv ON ideipv.idItemDocumentoEstoque = ide.id
  LEFT JOIN itempedido ip ON ip.id = ideipv.idItemPedidoVenda
  LEFT JOIN pedido ped ON ped.id = ip.idPedido
`;

function linhaDe(row: Record<string, unknown>, devolucao: boolean): FaturamentoLinha {
  const faturado = devolucao ? 0 : round2(toNum(row.faturado));
  const desconto = devolucao ? 0 : round2(toNum(row.desconto));
  const devolvido = devolucao ? round2(toNum(row.devolvido)) : 0;
  return {
    dataEmissao: String(row.dataEmissao ?? '').slice(0, 10),
    nf: String(row.nf ?? ''),
    documento: String(row.documento ?? ''),
    idTipoMovimentacao: toNum(row.idTipo),
    tipoMovimentacao: String(row.tipo ?? ''),
    numeroPedido: row.numeroPedido == null ? '' : String(row.numeroPedido),
    codigoProduto: String(row.codigoProduto ?? ''),
    produto: String(row.produto ?? ''),
    faturado,
    desconto,
    devolvido,
    liquido: liquidoDe(faturado, desconto, devolvido),
  };
}

/** Uma linha por item de documento, na mesma regra da grade. */
export async function consultarFaturamentoLinhas(ini: string, fim: string): Promise<FaturamentoLinha[]> {
  const periodo = parsePeriodo(ini, fim);
  if (!periodo) throw new Error('Período inválido. Use datas AAAA-MM-DD, com o início até o fim.');
  const pool = getNomusPool();
  if (!pool) throw new Error('NOMUS_DB_URL não configurado');
  const { ini: inicio, fimExclusivo } = periodo;

  const selectBase = `
    SELECT ide.id AS idItem,
           DATE_FORMAT(de.dataEmissao, '%Y-%m-%d') AS dataEmissao,
           MAX(nfe.numero) AS nf,
           MAX(de.numeroDocumentoFiscal) AS documento,
           tm.id AS idTipo,
           tm.nome AS tipo,
           MAX(ped.nome) AS numeroPedido,
           MAX(pr.nome) AS codigoProduto,
           MAX(pr.descricao) AS produto
  `;

  const [fatRows] = (await pool.query(
    `${selectBase},
            MAX(ide.valorTotal) AS faturado,
            MAX(ide.valorDesconto) AS desconto
     ${SQL_DETALHE_JOINS}
     ${SQL_FAT_WHERE}
     GROUP BY ide.id, DATE_FORMAT(de.dataEmissao, '%Y-%m-%d'), tm.id, tm.nome`,
    [inicio, fimExclusivo]
  )) as [Record<string, unknown>[], unknown];

  const [devRows] = (await pool.query(
    `${selectBase},
            MAX(ide.valorTotalComDesconto) AS devolvido
     ${SQL_DETALHE_JOINS}
     ${SQL_DEV_WHERE}
     GROUP BY ide.id, DATE_FORMAT(de.dataEmissao, '%Y-%m-%d'), tm.id, tm.nome`,
    [inicio, fimExclusivo]
  )) as [Record<string, unknown>[], unknown];

  const linhas = [
    ...fatRows.map((row) => linhaDe(row, false)),
    ...devRows.map((row) => linhaDe(row, true)),
  ];
  linhas.sort((a, b) =>
    a.dataEmissao.localeCompare(b.dataEmissao) ||
    a.nf.localeCompare(b.nf, 'pt-BR', { numeric: true }) ||
    a.codigoProduto.localeCompare(b.codigoProduto, 'pt-BR')
  );
  return linhas;
}

export async function consultarFaturamentoDia(dia: string): Promise<FaturamentoDocumento[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new Error('Dia inválido. Use AAAA-MM-DD.');
  const pool = getNomusPool();
  if (!pool) throw new Error('NOMUS_DB_URL não configurado');
  const ini = `${dia} 00:00:00`;
  const fimDate = new Date(`${dia}T00:00:00`);
  fimDate.setDate(fimDate.getDate() + 1);
  const fim = `${fimDate.getFullYear()}-${String(fimDate.getMonth() + 1).padStart(2, '0')}-${String(fimDate.getDate()).padStart(2, '0')} 00:00:00`;

  const pedidoJoin = `
    LEFT JOIN (
      SELECT ideipv.idItemDocumentoEstoque,
             GROUP_CONCAT(DISTINCT ped.nome ORDER BY ped.nome SEPARATOR ', ') AS pedido
      FROM itemdocumentoestoque_itempedidovenda ideipv
      INNER JOIN itempedido ip ON ip.id = ideipv.idItemPedidoVenda
      INNER JOIN pedido ped ON ped.id = ip.idPedido
      GROUP BY ideipv.idItemDocumentoEstoque
    ) pv ON pv.idItemDocumentoEstoque = ide.id
  `;

  const [fatRows] = (await pool.query(
    `SELECT nfe.numero AS numero,
            de.numeroDocumentoFiscal AS documento,
            pv.pedido AS pedido,
            SUM(ide.valorTotal) AS faturado,
            SUM(ide.valorDesconto) AS desconto
     ${SQL_JOINS}
     ${pedidoJoin}
     ${SQL_FAT_WHERE}
     GROUP BY nfe.numero, de.numeroDocumentoFiscal, pv.pedido`,
    [ini, fim]
  )) as [Record<string, unknown>[], unknown];

  const [devRows] = (await pool.query(
    `SELECT nfe.numero AS numero,
            de.numeroDocumentoFiscal AS documento,
            pv.pedido AS pedido,
            SUM(ide.valorTotalComDesconto) AS devolvido
     ${SQL_JOINS}
     ${pedidoJoin}
     ${SQL_DEV_WHERE}
     GROUP BY nfe.numero, de.numeroDocumentoFiscal, pv.pedido`,
    [ini, fim]
  )) as [Record<string, unknown>[], unknown];

  const docs: FaturamentoDocumento[] = [];
  for (const row of fatRows) {
    const faturado = round2(toNum(row.faturado));
    const desconto = round2(toNum(row.desconto));
    docs.push({
      tipo: 'faturamento',
      numero: String(row.numero ?? ''),
      documento: String(row.documento ?? ''),
      pedido: String(row.pedido ?? ''),
      faturado,
      desconto,
      devolvido: 0,
      liquido: liquidoDe(faturado, desconto, 0),
    });
  }
  for (const row of devRows) {
    const devolvido = round2(toNum(row.devolvido));
    docs.push({
      tipo: 'devolucao',
      numero: String(row.numero ?? ''),
      documento: String(row.documento ?? ''),
      pedido: String(row.pedido ?? ''),
      faturado: 0,
      desconto: 0,
      devolvido,
      liquido: liquidoDe(0, 0, devolvido),
    });
  }
  docs.sort((a, b) => a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true }));
  return docs;
}
