/**
 * Gestão entradas — notas destinadas à Só Aço Industrial no Nomus, com documento,
 * Otimiza, Double Check e conferência física.
 */

import { prisma } from '../config/prisma.js';
import { getNomusPool, isNomusEnabled, nomusQueryWithRetry } from '../config/nomusDb.js';
import { formatSqlDateYmd } from './dfcDateUtils.js';
import { listarDocumentosConferidos } from './doubleCheckInLocalRepository.js';
import { consultarStatusesOtimiza } from './doubleCheckInOtimiza.js';
import {
  chamadosExclusivosPorPalavra,
  DESTINADAS_TIPOS_EFETIVOS,
  documentoExibidoDestinada,
  fisicaDeStatus,
  fundirChamadosDestinada,
  preferirFisicaDestinada,
  montarLinhaDestinada,
  avisoConsultaOtimizaDestinadas,
  palavrasDaNota,
  type ChamadoDestinada,
  type DocDestinadaEfetivado,
  type DocDestinadaOrigem,
  type GradeDestinadas,
  type LinhaDestinada,
  type PedidoDestinada,
  type StatusChamadoDestinada,
} from './gestaoEntradasDestinadas.js';
import { consultarChamadosPorPalavra, type ChamadoOtimizaKeyword } from './otimizaLookupChamado.js';
import { listarConferenciasPorDocumentos } from './recebimentoConferenciaRepository.js';
import {
  RECEBIMENTO_ID_EMPRESA_SO_ACO,
  RECEBIMENTO_ID_TIPO_PRE_ENTRADA,
} from './recebimentoNomusRepository.js';

const SQL_NOTAS = `
SELECT
  n.id AS idDestinada,
  TRIM(n.numero) AS numero,
  NULLIF(TRIM(n.serie), '') AS serie,
  NULLIF(TRIM(n.nomeFornecedor), '') AS nomeFornecedor,
  DATE(n.dataHoraEmissao) AS dataEmissao,
  CASE
    WHEN n.xml LIKE '%<vNF>%</vNF>%' THEN
      CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(n.xml, '</vNF>', 1), '<vNF>', -1) AS DECIMAL(18,2))
    ELSE NULL
  END AS valor,
  n.status AS statusNomus,
  n.manifestacao AS manifestacao,
  n.finalidade AS finalidade,
  n.idEmpresa AS idEmpresa,
  NULLIF(TRIM(e.nome), '') AS nomeEmpresa,
  de.id AS idDocumento,
  NULLIF(TRIM(de.numeroDocumentoFiscal), '') AS numeroDocumentoFiscal,
  de.idTipoMovimentacao AS idTipoMovimentacao,
  NULLIF(TRIM(tm.nome), '') AS nomeTipo,
  DATE(de.dataEntrada) AS dataEntrada,
  de.idParceiro AS idParceiro
FROM nfedestinadaimportada n
LEFT JOIN empresa e ON e.id = n.idEmpresa
LEFT JOIN documentoestoque de ON de.id = n.idDocumentoEntrada
LEFT JOIN tipomovimentacao tm ON tm.id = de.idTipoMovimentacao
WHERE n.idEmpresa = ${RECEBIMENTO_ID_EMPRESA_SO_ACO}
  AND DATE(n.dataHoraEmissao) BETWEEN ? AND ?
ORDER BY n.dataHoraEmissao DESC, n.id DESC
LIMIT 2000
`.trim();

const SQL_EFETIVADOS = `
SELECT
  de.id AS idDocumento,
  NULLIF(TRIM(de.numeroDocumentoFiscal), '') AS numeroDocumentoFiscal,
  de.idParceiro AS idParceiro,
  de.idTipoMovimentacao AS idTipoMovimentacao,
  de.idEmpresaEntrada AS idEmpresa,
  NULLIF(TRIM(tm.nome), '') AS nomeTipo,
  DATE(de.dataEntrada) AS dataEntrada
FROM documentoestoque de
INNER JOIN tipomovimentacao tm ON tm.id = de.idTipoMovimentacao
WHERE de.idEmpresaEntrada = ${RECEBIMENTO_ID_EMPRESA_SO_ACO}
  AND de.idTipoMovimentacao IN (${DESTINADAS_TIPOS_EFETIVOS.join(', ')})
  AND NULLIF(TRIM(de.numeroDocumentoFiscal), '') IN (__NUMEROS__)
`.trim();

const SQL_PEDIDOS = `
SELECT
  ide.idDocumentoEstoque AS idDocumento,
  pc.id AS idPedido,
  NULLIF(TRIM(pc.nome), '') AS nomePedido
FROM itemdocumentoestoque ide
INNER JOIN itemdocumentoestoque_itempedidocompra ideipc ON ideipc.idItemDocumentoEstoque = ide.id
INNER JOIN itempedidocompra ipc ON ipc.id = ideipc.idItemPedidoCompra
INNER JOIN pedidocompra pc ON pc.id = ipc.idPedidoCompra
WHERE ide.discriminador = 'ItemDocumentoEntrada'
  AND ide.idDocumentoEstoque IN (__IDS__)
`.trim();

type NotaBruta = {
  idDestinada: number;
  numero: string;
  serie: string | null;
  nomeFornecedor: string | null;
  dataEmissao: string | null;
  valor: number | null;
  statusNomus: number | null;
  manifestacao: number | null;
  finalidade: number | null;
  idEmpresa: number | null;
  nomeEmpresa: string | null;
  origem: DocDestinadaOrigem;
};

function toInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function toIntOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function toValor(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function statusChamado(valor: string | null | undefined): StatusChamadoDestinada {
  if (valor === 'in_progress' || valor === 'completed' || valor === 'cancelled') return valor;
  return null;
}

function chamadoDeKeyword(item: ChamadoOtimizaKeyword): ChamadoDestinada {
  return {
    numero: item.numero,
    status: item.status,
    responsavel: item.responsavel,
    processo: item.processo,
  };
}

function mapNota(r: Record<string, unknown>): NotaBruta | null {
  const idDestinada = toInt(r.idDestinada);
  const numero = strOrNull(r.numero);
  if (idDestinada <= 0 || !numero) return null;
  const idDocumento = toIntOrNull(r.idDocumento);
  return {
    idDestinada,
    numero,
    serie: strOrNull(r.serie),
    nomeFornecedor: strOrNull(r.nomeFornecedor),
    dataEmissao: formatSqlDateYmd(r.dataEmissao),
    valor: toValor(r.valor),
    statusNomus: toIntOrNull(r.statusNomus),
    manifestacao: toIntOrNull(r.manifestacao),
    finalidade: toIntOrNull(r.finalidade),
    idEmpresa: toIntOrNull(r.idEmpresa),
    nomeEmpresa: strOrNull(r.nomeEmpresa),
    origem: {
      idDocumento: idDocumento != null && idDocumento > 0 ? idDocumento : null,
      numeroDocumentoFiscal: strOrNull(r.numeroDocumentoFiscal),
      idTipoMovimentacao: toIntOrNull(r.idTipoMovimentacao),
      nomeTipo: strOrNull(r.nomeTipo),
      dataEntrada: formatSqlDateYmd(r.dataEntrada),
      idParceiro: toIntOrNull(r.idParceiro),
    },
  };
}

function chaveFiscal(numero: string | null, idParceiro: number | null, idEmpresa: number | null): string {
  return `${(numero ?? '').trim().toUpperCase()}|${idParceiro ?? 0}|${idEmpresa ?? 0}`;
}

async function queryNotas(
  dataInicio: string,
  dataFim: string
): Promise<{ notas: NotaBruta[]; erro?: string }> {
  if (!isNomusEnabled()) return { notas: [], erro: 'NOMUS_DB_URL não configurado' };
  const pool = getNomusPool();
  if (!pool) return { notas: [], erro: 'NOMUS_DB_URL não configurado' };
  try {
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, SQL_NOTAS, [
      dataInicio,
      dataFim,
    ]);
    const notas = (Array.isArray(rows) ? rows : [])
      .map(mapNota)
      .filter((nota): nota is NotaBruta => nota != null);
    return { notas };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[gestaoEntradasDestinadas] notas:', msg);
    return { notas: [], erro: 'Falha ao ler as notas destinadas no Nomus.' };
  }
}

async function queryEfetivados(numeros: string[]): Promise<Map<string, DocDestinadaEfetivado>> {
  const mapa = new Map<string, DocDestinadaEfetivado>();
  const unicos = [...new Set(numeros.map((numero) => numero.trim()).filter((numero) => numero.length > 0))];
  if (unicos.length === 0 || !isNomusEnabled()) return mapa;
  const pool = getNomusPool();
  if (!pool) return mapa;
  for (const parte of chunk(unicos, 200)) {
    const sql = SQL_EFETIVADOS.replace('__NUMEROS__', parte.map(() => '?').join(', '));
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql, parte);
    for (const row of Array.isArray(rows) ? rows : []) {
      const idDocumento = toInt(row.idDocumento);
      const numeroDocumentoFiscal = strOrNull(row.numeroDocumentoFiscal);
      const idTipoMovimentacao = toInt(row.idTipoMovimentacao);
      if (idDocumento <= 0 || !numeroDocumentoFiscal || idTipoMovimentacao <= 0) continue;
      const efetivado: DocDestinadaEfetivado = {
        idDocumento,
        numeroDocumentoFiscal,
        idParceiro: toIntOrNull(row.idParceiro),
        idTipoMovimentacao,
        nomeTipo: strOrNull(row.nomeTipo),
        dataEntrada: formatSqlDateYmd(row.dataEntrada),
      };
      const chave = chaveFiscal(numeroDocumentoFiscal, efetivado.idParceiro, toIntOrNull(row.idEmpresa));
      const atual = mapa.get(chave);
      if (!atual || atual.idDocumento < idDocumento) mapa.set(chave, efetivado);
    }
  }
  return mapa;
}

async function queryPedidos(ids: number[]): Promise<Map<number, PedidoDestinada[]>> {
  const mapa = new Map<number, Map<number, string>>();
  const unicos = [...new Set(ids.filter((id) => id > 0))];
  if (unicos.length === 0 || !isNomusEnabled()) return new Map();
  const pool = getNomusPool();
  if (!pool) return new Map();
  for (const parte of chunk(unicos, 400)) {
    const sql = SQL_PEDIDOS.replace('__IDS__', parte.join(', '));
    const [rows] = await nomusQueryWithRetry<Record<string, unknown>[]>(pool, sql);
    for (const row of Array.isArray(rows) ? rows : []) {
      const idDocumento = toInt(row.idDocumento);
      const idPedido = toInt(row.idPedido);
      if (idDocumento <= 0 || idPedido <= 0) continue;
      const pedidos = mapa.get(idDocumento) ?? new Map<number, string>();
      const nome = strOrNull(row.nomePedido) || `Pedido ${idPedido}`;
      if (!pedidos.has(idPedido)) pedidos.set(idPedido, nome);
      mapa.set(idDocumento, pedidos);
    }
  }
  const saida = new Map<number, PedidoDestinada[]>();
  for (const [idDocumento, pedidos] of mapa) {
    saida.set(
      idDocumento,
      [...pedidos.entries()]
        .map(([idPedido, nome]) => ({ idPedido, nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.idPedido - b.idPedido)
    );
  }
  return saida;
}

export async function queryGestaoEntradasDestinadas(params: {
  dataInicio: string;
  dataFim: string;
}): Promise<{ data?: GradeDestinadas; erro?: string }> {
  const { notas, erro } = await queryNotas(params.dataInicio, params.dataFim);
  if (erro) return { erro };

  const preEntradas = notas.filter(
    (nota) =>
      nota.origem.idDocumento != null &&
      nota.origem.idTipoMovimentacao === RECEBIMENTO_ID_TIPO_PRE_ENTRADA &&
      nota.origem.numeroDocumentoFiscal
  );
  const efetivados = await queryEfetivados(
    preEntradas.map((nota) => nota.origem.numeroDocumentoFiscal || '')
  );

  const ids = new Set<number>();
  for (const nota of notas) {
    const irmao = nota.origem.numeroDocumentoFiscal
      ? efetivados.get(chaveFiscal(nota.origem.numeroDocumentoFiscal, nota.origem.idParceiro, nota.idEmpresa)) ?? null
      : null;
    const exibido = documentoExibidoDestinada(nota.origem, irmao && irmao.idDocumento !== nota.origem.idDocumento ? irmao : null);
    if (nota.origem.idDocumento) ids.add(nota.origem.idDocumento);
    if (exibido.idDocumento) ids.add(exibido.idDocumento);
  }
  const listaIds = [...ids];

  const [pedidos, conferidos, solicitacoes, fisicas] = await Promise.all([
    queryPedidos(listaIds),
    listarDocumentosConferidos(listaIds),
    prisma.doubleCheckInSolicitacaoOtimiza.findMany({
      where: { idDocumentoEstoque: { in: listaIds.length > 0 ? listaIds : [-1] } },
      select: { idDocumentoEstoque: true, numero: true, status: true },
    }),
    listarConferenciasPorDocumentos(listaIds),
  ]);

  const gravadosPorDoc = new Map<number, ChamadoDestinada[]>();
  for (const row of solicitacoes) {
    const lista = gravadosPorDoc.get(row.idDocumentoEstoque) ?? [];
    if (!lista.some((item) => item.numero === row.numero)) {
      lista.push({
        numero: row.numero,
        status: statusChamado(row.status),
        responsavel: null,
        processo: null,
      });
    }
    gravadosPorDoc.set(row.idDocumentoEstoque, lista);
  }

  const numerosAtualizar = [
    ...new Set(
      [...gravadosPorDoc.values()]
        .flat()
        .filter((item) => item.status == null || item.status === 'in_progress')
        .map((item) => item.numero)
    ),
  ];
  const statusFrescos = await consultarStatusesOtimiza(numerosAtualizar);
  for (const lista of gravadosPorDoc.values()) {
    for (const item of lista) {
      const fresco = statusFrescos.get(item.numero);
      if (!fresco?.found) continue;
      if (fresco.status) item.status = fresco.status;
      if (fresco.currentResponsible) item.responsavel = fresco.currentResponsible;
    }
  }

  const palavras = notas.flatMap((nota) => {
    const irmao = nota.origem.numeroDocumentoFiscal
      ? efetivados.get(chaveFiscal(nota.origem.numeroDocumentoFiscal, nota.origem.idParceiro, nota.idEmpresa)) ?? null
      : null;
    const exibido = documentoExibidoDestinada(
      nota.origem,
      irmao && irmao.idDocumento !== nota.origem.idDocumento ? irmao : null
    );
    return palavrasDaNota(nota.numero, [nota.origem.numeroDocumentoFiscal, exibido.numeroDocumentoFiscal]);
  });

  let porPalavra = new Map<string, ChamadoDestinada[]>();
  let otimizaIndisponivel = false;
  let otimizaAviso: string | null = null;
  try {
    const consulta = await consultarChamadosPorPalavra(palavras);
    const exclusivos = chamadosExclusivosPorPalavra(consulta);
    porPalavra = new Map(
      [...exclusivos.entries()].map(([palavra, lista]) => [palavra, lista.map(chamadoDeKeyword)])
    );
  } catch (err) {
    otimizaIndisponivel = true;
    otimizaAviso = avisoConsultaOtimizaDestinadas(err);
    console.error(
      '[gestaoEntradasDestinadas] otimiza:',
      err instanceof Error ? err.message : String(err)
    );
  }

  const nomes = new Map<number, string>();
  const idsUsuario = [...new Set([...conferidos.values()].map((item) => item.usuarioId).filter((id) => id > 0))];
  if (idsUsuario.length > 0) {
    const usuarios = await prisma.usuario.findMany({
      where: { id: { in: idsUsuario } },
      select: { id: true, nome: true, login: true },
    });
    for (const usuario of usuarios) {
      nomes.set(usuario.id, usuario.nome?.trim() || usuario.login);
    }
  }

  const linhas: LinhaDestinada[] = notas.map((nota) => {
    const irmaoBruto = nota.origem.numeroDocumentoFiscal
      ? efetivados.get(chaveFiscal(nota.origem.numeroDocumentoFiscal, nota.origem.idParceiro, nota.idEmpresa)) ?? null
      : null;
    const irmao =
      irmaoBruto && irmaoBruto.idDocumento !== nota.origem.idDocumento ? irmaoBruto : null;
    const exibido = documentoExibidoDestinada(nota.origem, irmao);
    const idsLinha = [nota.origem.idDocumento, exibido.idDocumento].filter(
      (id): id is number => id != null && id > 0
    );
    const conferido = idsLinha.some((id) => conferidos.has(id));
    const infoConferido = idsLinha.map((id) => conferidos.get(id)).find(Boolean) ?? null;
    const fisicaOrigem = nota.origem.idDocumento ? fisicas.get(nota.origem.idDocumento) : undefined;
    const fisicaAtual =
      exibido.idDocumento && exibido.idDocumento !== nota.origem.idDocumento
        ? fisicas.get(exibido.idDocumento)
        : undefined;
    const gravados = idsLinha.flatMap((id) => gravadosPorDoc.get(id) ?? []);
    const porNome = palavrasDaNota(nota.numero, [
      nota.origem.numeroDocumentoFiscal,
      exibido.numeroDocumentoFiscal,
    ]).flatMap((palavra) => porPalavra.get(palavra.toUpperCase()) ?? []);
    return montarLinhaDestinada({
      idDestinada: nota.idDestinada,
      numero: nota.numero,
      serie: nota.serie,
      nomeFornecedor: nota.nomeFornecedor,
      dataEmissao: nota.dataEmissao,
      valor: nota.valor,
      statusNomus: nota.statusNomus,
      manifestacao: nota.manifestacao,
      finalidade: nota.finalidade,
      idEmpresa: nota.idEmpresa,
      nomeEmpresa: nota.nomeEmpresa,
      origem: nota.origem,
      irmao,
      pedidosOrigem: nota.origem.idDocumento ? pedidos.get(nota.origem.idDocumento) ?? [] : [],
      pedidosAtual: exibido.idDocumento ? pedidos.get(exibido.idDocumento) ?? [] : [],
      conferido,
      conferidoPor: infoConferido
        ? nomes.get(infoConferido.usuarioId) || infoConferido.usuarioLogin
        : null,
      fisica: preferirFisicaDestinada(
        fisicaDeStatus(fisicaOrigem?.status),
        fisicaDeStatus(fisicaAtual?.status)
      ),
      chamados: fundirChamadosDestinada(porNome, gravados),
    });
  });

  return {
    data: {
      dataInicio: params.dataInicio,
      dataFim: params.dataFim,
      otimizaIndisponivel,
      otimizaAviso,
      linhas,
    },
  };
}
