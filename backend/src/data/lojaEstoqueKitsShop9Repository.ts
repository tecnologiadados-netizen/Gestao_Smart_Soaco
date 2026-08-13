/**
 * Consultas Shop9 para Loja — sequências de venda (Movimento.Sequencia).
 */
import sql from 'mssql';
import { getShop9Pool, isShop9Enabled } from '../config/shop9Db.js';
import { termoParaPadraoLikeSql } from '../utils/textoLivreBusca.js';

export type LojaSequenciaShop9 = {
  ordem: number;
  sequencia: number;
  data: string;
  clienteNome: string;
  filialNome: string;
  operacaoNome: string;
};

export type LojaItemSequenciaShop9 = {
  codigo: string;
  descricao: string;
  quantidade: number;
};

const SEQ_INITIAL_LIMIT = 20;
const SEQ_SEARCH_LIMIT = 50;
const SEQ_MIN_SEARCH_CHARS = 2;

function formatDateSql(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : '';
}

function toInt(v: unknown): number {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : 0;
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function buscarSequenciasShop9(options: {
  q?: string;
  limit?: number;
}): Promise<{ sequencias: LojaSequenciaShop9[]; source: 'erp' | 'indisponivel' }> {
  if (!isShop9Enabled()) return { sequencias: [], source: 'indisponivel' };
  const pool = await getShop9Pool();
  if (!pool) return { sequencias: [], source: 'indisponivel' };

  const limit = Math.min(Math.max(options.limit ?? SEQ_INITIAL_LIMIT, 1), SEQ_SEARCH_LIMIT);
  const q = options.q?.trim() ?? '';
  const qDigits = q.replace(/\D/g, '');

  const req = pool.request();
  req.input('limit', sql.Int, limit);
  req.input('qDigits', sql.VarChar(20), qDigits || '');

  let whereExtra = '';
  if (q.length >= SEQ_MIN_SEARCH_CHARS) {
    const like = termoParaPadraoLikeSql(q);
    req.input('like', sql.VarChar(80), like);
    whereExtra = `
      AND (
        CAST(m.Sequencia AS VARCHAR(20)) LIKE @like
        OR CAST(m.Ordem AS VARCHAR(20)) LIKE @like
        OR (@qDigits <> '' AND CAST(m.Sequencia AS VARCHAR(20)) = @qDigits)
        OR (@qDigits <> '' AND CAST(m.Ordem AS VARCHAR(20)) = @qDigits)
      )
    `;
  }

  const result = await req.query(`
    SELECT TOP (@limit)
      m.Ordem,
      m.Sequencia,
      m.Data,
      COALESCE(NULLIF(cf.Nome, ''), NULLIF(m.NFCE_Cupom_Nome_Cliente, ''), '') AS Cliente,
      COALESCE(fl.Nome, '') AS Filial,
      COALESCE(o.Nome, '') AS Operacao
    FROM Movimento m
    LEFT JOIN Cli_For cf ON cf.Ordem = m.Ordem_Cli_For
    LEFT JOIN Filiais fl ON fl.Ordem = m.Ordem_Filial
    LEFT JOIN Operacoes o ON o.Ordem = m.Ordem_Operacao
    WHERE m.Apagado = 0
      AND ISNULL(m.Invalido, 0) = 0
      AND m.Tipo_Operacao = 'VND'
      ${whereExtra}
    ORDER BY
      CASE
        WHEN @qDigits <> '' AND CAST(m.Sequencia AS VARCHAR(20)) = @qDigits THEN 0
        WHEN @qDigits <> '' AND CAST(m.Ordem AS VARCHAR(20)) = @qDigits THEN 1
        ELSE 2
      END,
      m.Data DESC,
      m.Ordem DESC
  `);

  const list = Array.isArray(result.recordset) ? result.recordset : [];
  const sequencias: LojaSequenciaShop9[] = list
    .map((row) => {
      const r = row as Record<string, unknown>;
      return {
        ordem: toInt(r.Ordem),
        sequencia: toInt(r.Sequencia),
        data: formatDateSql(r.Data),
        clienteNome: String(r.Cliente ?? '').trim(),
        filialNome: String(r.Filial ?? '').trim(),
        operacaoNome: String(r.Operacao ?? '').trim(),
      };
    })
    .filter((s) => s.ordem > 0 && s.sequencia > 0);

  return { sequencias, source: 'erp' };
}

export async function buscarItensSequenciaShop9(
  ordemMovimento: number,
): Promise<{ itens: LojaItemSequenciaShop9[]; source: 'erp' | 'indisponivel' }> {
  if (!isShop9Enabled()) return { itens: [], source: 'indisponivel' };
  const pool = await getShop9Pool();
  if (!pool) return { itens: [], source: 'indisponivel' };

  const ordem = Math.trunc(ordemMovimento);
  if (!Number.isFinite(ordem) || ordem <= 0) return { itens: [], source: 'erp' };

  const req = pool.request();
  req.input('ordem', sql.Int, ordem);
  const result = await req.query(`
    SELECT
      ps.Codigo AS codigo,
      COALESCE(NULLIF(ps.Nome, ''), ps.Codigo) AS descricao,
      SUM(mps.Quantidade) AS quantidade
    FROM Movimento_Prod_Serv mps
    INNER JOIN Prod_Serv ps ON ps.Ordem = mps.Ordem_Prod_Serv
    WHERE mps.Ordem_Movimento = @ordem
      AND mps.Linha_Excluida = 0
    GROUP BY ps.Codigo, ps.Nome
    ORDER BY ps.Codigo
  `);

  const list = Array.isArray(result.recordset) ? result.recordset : [];
  const itens: LojaItemSequenciaShop9[] = list.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      codigo: String(r.codigo ?? '').trim(),
      descricao: String(r.descricao ?? '').trim(),
      quantidade: toNum(r.quantidade),
    };
  }).filter((i) => i.codigo);

  return { itens, source: 'erp' };
}

export async function obterSequenciaShop9PorOrdem(
  ordemMovimento: number,
): Promise<{ sequencia: LojaSequenciaShop9 | null; source: 'erp' | 'indisponivel' }> {
  if (!isShop9Enabled()) return { sequencia: null, source: 'indisponivel' };
  const pool = await getShop9Pool();
  if (!pool) return { sequencia: null, source: 'indisponivel' };

  const ordem = Math.trunc(ordemMovimento);
  if (!Number.isFinite(ordem) || ordem <= 0) return { sequencia: null, source: 'erp' };

  const req = pool.request();
  req.input('ordem', sql.Int, ordem);
  const result = await req.query(`
    SELECT TOP 1
      m.Ordem,
      m.Sequencia,
      m.Data,
      COALESCE(NULLIF(cf.Nome, ''), NULLIF(m.NFCE_Cupom_Nome_Cliente, ''), '') AS Cliente,
      COALESCE(fl.Nome, '') AS Filial,
      COALESCE(o.Nome, '') AS Operacao
    FROM Movimento m
    LEFT JOIN Cli_For cf ON cf.Ordem = m.Ordem_Cli_For
    LEFT JOIN Filiais fl ON fl.Ordem = m.Ordem_Filial
    LEFT JOIN Operacoes o ON o.Ordem = m.Ordem_Operacao
    WHERE m.Ordem = @ordem
      AND m.Apagado = 0
      AND ISNULL(m.Invalido, 0) = 0
      AND m.Tipo_Operacao = 'VND'
  `);

  const row = Array.isArray(result.recordset) ? result.recordset[0] : undefined;
  if (!row) return { sequencia: null, source: 'erp' };
  const r = row as Record<string, unknown>;
  return {
    sequencia: {
      ordem: toInt(r.Ordem),
      sequencia: toInt(r.Sequencia),
      data: formatDateSql(r.Data),
      clienteNome: String(r.Cliente ?? '').trim(),
      filialNome: String(r.Filial ?? '').trim(),
      operacaoNome: String(r.Operacao ?? '').trim(),
    },
    source: 'erp',
  };
}
