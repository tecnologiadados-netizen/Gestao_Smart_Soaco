/**
 * XML da NF de entrada e a resposta do conferente (já paga ou boleto externo).
 * O Nomus permanece somente leitura.
 */
import type { Pool } from 'mysql2/promise';
import { prisma } from '../config/prisma.js';
import { getNomusPool, nomusQueryWithRetry } from '../config/nomusDb.js';
import { RECEBIMENTO_ID_TIPO_PRE_ENTRADA } from './recebimentoNomusRepository.js';
import { listarCondicoesPagamentoNomus, listarFormasPagamentoNomus } from './comprasRepository.js';
import {
  extrairPagamentoXmlNfe,
  motivoLancamentoBoletoIncompleto,
  resolverParcelasPreEntrada,
  somaParcelasFechaValorNf,
  type PagamentoPreEntradaResolvido,
  type ParcelaXml,
  type RespostaPagamentoUsuario,
} from './nfeXmlParcelas.js';

type XmlDoc = { xml: string; chave: string | null };

function escolherXml(rows: Record<string, unknown>[]): Map<number, XmlDoc> {
  const melhor = new Map<number, { xml: string; chave: string | null; fornecedor: number; tam: number }>();
  for (const r of rows) {
    const id = Math.trunc(Number(r.idDocumento));
    if (!Number.isFinite(id) || id <= 0) continue;
    const xml = r.xml == null ? '' : String(r.xml);
    const tam = xml.trim().length;
    if (tam === 0) continue;
    const fornecedor = Number(r.isFornecedor) === 1 ? 1 : 0;
    const atual = melhor.get(id);
    if (
      !atual ||
      fornecedor > atual.fornecedor ||
      (fornecedor === atual.fornecedor && tam > atual.tam)
    ) {
      melhor.set(id, {
        xml,
        chave: r.chave == null ? null : String(r.chave).trim() || null,
        fornecedor,
        tam,
      });
    }
  }
  const out = new Map<number, XmlDoc>();
  for (const [id, item] of melhor) out.set(id, { xml: item.xml, chave: item.chave });
  return out;
}

export async function carregarXmlNfePorDocumentos(
  pool: Pool,
  ids: number[]
): Promise<Map<number, XmlDoc>> {
  const unicos = [...new Set(ids.map((id) => Math.trunc(Number(id))).filter((id) => id > 0))];
  const out = new Map<number, XmlDoc>();
  if (unicos.length === 0) return out;
  const ph = unicos.map(() => '?').join(', ');
  const [nfeRows] = await nomusQueryWithRetry<Record<string, unknown>[]>(
    pool,
    `SELECT idDocumentoEstoque AS idDocumento, chave, xml, IFNULL(isFornecedor, 0) AS isFornecedor
     FROM nfe
     WHERE idDocumentoEstoque IN (${ph})`,
    unicos
  );
  const deNfe = escolherXml(Array.isArray(nfeRows) ? nfeRows : []);
  for (const [id, doc] of deNfe) out.set(id, doc);

  const faltam = unicos.filter((id) => !out.has(id));
  if (faltam.length === 0) return out;
  const ph2 = faltam.map(() => '?').join(', ');
  const [destRows] = await nomusQueryWithRetry<Record<string, unknown>[]>(
    pool,
    `SELECT idDocumentoEntrada AS idDocumento, chave, xml, 1 AS isFornecedor
     FROM nfedestinadaimportada
     WHERE idDocumentoEntrada IN (${ph2})`,
    faltam
  );
  const deDest = escolherXml(Array.isArray(destRows) ? destRows : []);
  for (const [id, doc] of deDest) {
    if (!out.has(id)) out.set(id, doc);
  }
  return out;
}

function parseParcelaItem(item: unknown): ParcelaXml | null {
  if (!item || typeof item !== 'object') return null;
  const row = item as Record<string, unknown>;
  const dataVencimento = String(row.dataVencimento ?? '').slice(0, 10);
  const valor = Number(row.valor);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataVencimento) || !Number.isFinite(valor)) return null;
  const paga = row.paga === true ? true : row.paga === false ? false : undefined;
  return { numero: 0, dataVencimento, valor, paga };
}

function parseRespostaJson(
  situacao: 'ja_paga' | 'boleto_externo',
  raw: string | null | undefined
): RespostaPagamentoUsuario {
  const vazio: RespostaPagamentoUsuario = {
    situacao,
    parcelas: [],
    condicaoPagamento: null,
    formaPagamento: null,
    regra: null,
    dataBase: null,
  };
  if (!raw) return vazio;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const lista = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { parcelas?: unknown }).parcelas)
        ? (parsed as { parcelas: unknown[] }).parcelas
        : [];
    const extra =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as {
            condicaoPagamento?: unknown;
            formaPagamento?: unknown;
            regra?: unknown;
            dataBase?: unknown;
          })
        : {};
    const parcelas = lista
      .map(parseParcelaItem)
      .filter((p): p is ParcelaXml => p != null)
      .map((p, i) => ({ ...p, numero: i + 1 }));
    return {
      situacao,
      parcelas,
      condicaoPagamento: typeof extra.condicaoPagamento === 'string' ? extra.condicaoPagamento : null,
      formaPagamento: typeof extra.formaPagamento === 'string' ? extra.formaPagamento : null,
      regra: typeof extra.regra === 'string' ? extra.regra : null,
      dataBase: typeof extra.dataBase === 'string' ? extra.dataBase.slice(0, 10) : null,
    };
  } catch {
    return vazio;
  }
}

function nomeDoCatalogo(informado: string, opcoes: { nome: string }[]): string | null {
  const alvo = informado.trim().toLocaleLowerCase('pt-BR');
  if (!alvo) return null;
  const achou = opcoes.find((o) => o.nome.trim().toLocaleLowerCase('pt-BR') === alvo);
  return achou?.nome?.trim() || null;
}

export async function listarRespostasPagamentoXml(
  ids: number[]
): Promise<Map<number, RespostaPagamentoUsuario>> {
  const unicos = [...new Set(ids.map((id) => Math.trunc(Number(id))).filter((id) => id > 0))];
  const out = new Map<number, RespostaPagamentoUsuario>();
  if (unicos.length === 0) return out;
  const rows = await prisma.doubleCheckInPagamentoXml.findMany({
    where: { idDocumentoEstoque: { in: unicos } },
  });
  for (const row of rows) {
    if (row.situacao !== 'ja_paga' && row.situacao !== 'boleto_externo') continue;
    out.set(row.idDocumentoEstoque, parseRespostaJson(row.situacao, row.parcelasJson));
  }
  return out;
}

export async function resolverPagamentoPreEntradaLote(params: {
  pool: Pool;
  ids: number[];
  dataBasePorDocumento: Map<number, string | null>;
}): Promise<Map<number, PagamentoPreEntradaResolvido>> {
  const out = new Map<number, PagamentoPreEntradaResolvido>();
  const ids = [...new Set(params.ids.map((id) => Math.trunc(Number(id))).filter((id) => id > 0))];
  if (ids.length === 0) return out;
  const [xmls, respostas] = await Promise.all([
    carregarXmlNfePorDocumentos(params.pool, ids),
    listarRespostasPagamentoXml(ids),
  ]);
  for (const id of ids) {
    out.set(
      id,
      resolverParcelasPreEntrada({
        xml: xmls.get(id)?.xml ?? null,
        resposta: respostas.get(id) ?? null,
        dataBaseDocumento: params.dataBasePorDocumento.get(id) ?? null,
      })
    );
  }
  return out;
}

export async function salvarRespostaPagamentoPreEntrada(params: {
  idDocumento: number;
  situacao: 'ja_paga' | 'boleto_externo';
  parcelas: ParcelaXml[];
  condicaoPagamento?: string | null;
  formaPagamento?: string | null;
  regra?: string | null;
  dataBase?: string | null;
  usuarioId: number;
  usuarioLogin: string;
}): Promise<{ ok: true } | { ok: false; erro: string }> {
  const pool = getNomusPool();
  if (!pool) return { ok: false, erro: 'Nomus não configurado.' };
  const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(
    pool,
    `SELECT idTipoMovimentacao FROM documentoestoque WHERE id = ? LIMIT 1`,
    [params.idDocumento]
  );
  const row = Array.isArray(rows) ? rows[0] : undefined;
  if (!row) return { ok: false, erro: 'Documento de entrada não encontrado.' };
  if (Math.trunc(Number(row.idTipoMovimentacao)) !== RECEBIMENTO_ID_TIPO_PRE_ENTRADA) {
    return { ok: false, erro: 'O lançamento de parcelas vale só enquanto o documento está em pré-entrada.' };
  }
  const xmls = await carregarXmlNfePorDocumentos(pool, [params.idDocumento]);
  const xml = xmls.get(params.idDocumento);
  const extraido = extrairPagamentoXmlNfe(xml?.xml);
  if (extraido.temFatura) {
    return { ok: false, erro: 'Esta NF já tem fatura no XML. As parcelas são lidas de lá.' };
  }
  const parcelas = params.situacao === 'ja_paga' ? [] : params.parcelas;
  let condicaoPagamento: string | null = null;
  let formaPagamento: string | null = null;
  if (params.situacao === 'boleto_externo') {
    const incompleto = motivoLancamentoBoletoIncompleto({
      condicaoPagamento: params.condicaoPagamento,
      formaPagamento: params.formaPagamento,
      regra: params.regra,
      parcelas,
    });
    if (incompleto) return { ok: false, erro: incompleto };
    const [condicoes, formas] = await Promise.all([
      listarCondicoesPagamentoNomus(),
      listarFormasPagamentoNomus(),
    ]);
    if (condicoes.erro || formas.erro) {
      return { ok: false, erro: condicoes.erro || formas.erro || 'Não foi possível ler condição e forma de pagamento.' };
    }
    condicaoPagamento = nomeDoCatalogo(params.condicaoPagamento ?? '', condicoes.data);
    formaPagamento = nomeDoCatalogo(params.formaPagamento ?? '', formas.data);
    if (!condicaoPagamento) return { ok: false, erro: 'Escolha uma condição de pagamento cadastrada.' };
    if (!formaPagamento) return { ok: false, erro: 'Escolha uma forma de pagamento cadastrada.' };
    const condicaoRow = condicoes.data.find(
      (c) => c.nome.trim().toLocaleLowerCase('pt-BR') === condicaoPagamento!.trim().toLocaleLowerCase('pt-BR')
    );
    if (condicaoRow?.idsFormaPagamento) {
      const formaRow = formas.data.find(
        (f) => f.nome.trim().toLocaleLowerCase('pt-BR') === formaPagamento!.trim().toLocaleLowerCase('pt-BR')
      );
      if (!formaRow || !condicaoRow.idsFormaPagamento.includes(formaRow.id)) {
        return { ok: false, erro: 'Esta forma de pagamento não está disponível para a condição escolhida.' };
      }
    }
    if (!somaParcelasFechaValorNf(parcelas, extraido.vNF)) {
      const total = (extraido.vNF ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      return { ok: false, erro: `A soma das parcelas precisa fechar o total da NF (${total}).` };
    }
  }
  await salvarPagamentoXml({
    idDocumentoEstoque: params.idDocumento,
    chaveNfe: xml?.chave ?? null,
    situacao: params.situacao,
    parcelas,
    condicaoPagamento,
    formaPagamento,
    regra: params.regra,
    dataBase: params.dataBase,
    usuarioId: params.usuarioId,
    usuarioLogin: params.usuarioLogin,
  });
  return { ok: true };
}

export async function salvarPagamentoXml(params: {
  idDocumentoEstoque: number;
  chaveNfe: string | null;
  situacao: 'ja_paga' | 'boleto_externo';
  parcelas: ParcelaXml[];
  condicaoPagamento?: string | null;
  formaPagamento?: string | null;
  regra?: string | null;
  dataBase?: string | null;
  usuarioId: number;
  usuarioLogin: string;
}): Promise<void> {
  const parcelasJson = JSON.stringify({
    condicaoPagamento: params.condicaoPagamento ?? null,
    formaPagamento: params.formaPagamento ?? null,
    regra: params.regra ?? null,
    dataBase: params.dataBase ?? null,
    parcelas: params.parcelas.map((p, i) => ({
      numero: i + 1,
      dataVencimento: p.dataVencimento,
      valor: p.valor,
      paga: p.paga === true,
    })),
  });
  await prisma.doubleCheckInPagamentoXml.upsert({
    where: { idDocumentoEstoque: params.idDocumentoEstoque },
    create: {
      idDocumentoEstoque: params.idDocumentoEstoque,
      chaveNfe: params.chaveNfe,
      situacao: params.situacao,
      parcelasJson,
      usuarioId: params.usuarioId,
      usuarioLogin: params.usuarioLogin,
    },
    update: {
      chaveNfe: params.chaveNfe,
      situacao: params.situacao,
      parcelasJson,
      usuarioId: params.usuarioId,
      usuarioLogin: params.usuarioLogin,
    },
  });
}
