/**
 * Recebimento — Gestão Mesa: fila de pré-entrada, detalhe e deliberação do conferente.
 */

import type { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import {
  queryCabecalhosDocumentosNomus,
  queryDocumentosPreEntradaNomus,
  queryItensDocumentoPreEntradaNomus,
  RECEBIMENTO_STATUS,
  RECEBIMENTO_STATUS_LABEL,
} from '../data/recebimentoNomusRepository.js';
import {
  deliberarConferente,
  devolverConferenciaParaMesa,
  listarConferenciasPorDocumentos,
  listarConferentesRecebimento,
  listarItensContagem,
  listarPendenciasConferente,
  obterConferenciaPorDocumento,
  qtdeFisicaConfere,
  registrarTentativaContagem,
  RECEBIMENTO_TENTATIVAS_MAX,
  type RecebimentoConferenciaLocal,
  type RecebimentoContagemLinha,
} from '../data/recebimentoConferenciaRepository.js';

function statusPadrao() {
  return {
    codigo: RECEBIMENTO_STATUS.AGUARDANDO_CONFERENTE,
    label: RECEBIMENTO_STATUS_LABEL[RECEBIMENTO_STATUS.AGUARDANDO_CONFERENTE],
  };
}

/**
 * GET /api/recebimento/mesa/documentos
 */
export async function getRecebimentoMesaDocumentos(_req: Request, res: Response): Promise<void> {
  const { documentos, tipos, erro } = await queryDocumentosPreEntradaNomus();
  if (erro && documentos.length === 0) {
    res.status(503).json({ error: erro, documentos: [], tipos });
    return;
  }

  const locais = await listarConferenciasPorDocumentos(documentos.map((d) => d.idDocumento));
  const lista = documentos.map((d) => {
    const local = locais.get(d.idDocumento);
    const codigo = local?.status ?? RECEBIMENTO_STATUS.AGUARDANDO_CONFERENTE;
    return {
      ...d,
      status: codigo,
      statusLabel: RECEBIMENTO_STATUS_LABEL[codigo] ?? codigo,
      conferenteUsuarioId: local?.conferenteUsuarioId ?? null,
      conferenteLogin: local?.conferenteLogin ?? null,
      conferenteNome: local?.conferenteNome ?? null,
      atribuidoEm: local?.atribuidoEm ?? null,
    };
  });

  res.json({
    documentos: lista,
    tipos,
    erro: erro || undefined,
  });
}

/**
 * GET /api/recebimento/mesa/documentos/:id/itens
 */
export async function getRecebimentoMesaItens(req: Request, res: Response): Promise<void> {
  const idDocumento = Math.trunc(Number(req.params.id));
  if (!Number.isFinite(idDocumento) || idDocumento <= 0) {
    res.status(400).json({ error: 'idDocumento inválido.' });
    return;
  }

  const { itens, erro } = await queryItensDocumentoPreEntradaNomus(idDocumento);
  if (erro) {
    res.status(503).json({ error: erro, itens: [] });
    return;
  }

  const local = await obterConferenciaPorDocumento(idDocumento);
  const codigo = local?.status ?? statusPadrao().codigo;
  res.json({
    itens,
    status: codigo,
    statusLabel: RECEBIMENTO_STATUS_LABEL[codigo] ?? codigo,
    conferenteUsuarioId: local?.conferenteUsuarioId ?? null,
    conferenteLogin: local?.conferenteLogin ?? null,
    conferenteNome: local?.conferenteNome ?? null,
    atribuidoEm: local?.atribuidoEm ?? null,
  });
}

/**
 * GET /api/recebimento/mesa/conferentes
 */
export async function getRecebimentoMesaConferentes(_req: Request, res: Response): Promise<void> {
  const conferentes = await listarConferentesRecebimento();
  res.json({ conferentes });
}

/**
 * POST /api/recebimento/mesa/documentos/:id/deliberar
 * body: { conferenteUsuarioId: number, numeroDocumento?: string }
 */
export async function postRecebimentoMesaDeliberar(req: Request, res: Response): Promise<void> {
  const idDocumento = Math.trunc(Number(req.params.id));
  const conferenteUsuarioId = Math.trunc(Number(req.body?.conferenteUsuarioId));
  const numeroDocumento =
    typeof req.body?.numeroDocumento === 'string' ? req.body.numeroDocumento.trim() : null;

  if (!Number.isFinite(idDocumento) || idDocumento <= 0) {
    res.status(400).json({ error: 'idDocumento inválido.' });
    return;
  }
  if (!Number.isFinite(conferenteUsuarioId) || conferenteUsuarioId <= 0) {
    res.status(400).json({ error: 'Selecione um conferente.' });
    return;
  }
  const login = req.user?.login;
  if (!login) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }

  const [mesa, conferente] = await Promise.all([
    prisma.usuario.findUnique({ where: { login }, select: { id: true, login: true } }),
    prisma.usuario.findUnique({
      where: { id: conferenteUsuarioId },
      select: { id: true, login: true, nome: true, ativo: true },
    }),
  ]);
  if (!mesa) {
    res.status(401).json({ error: 'Usuário não encontrado.' });
    return;
  }
  if (!conferente || conferente.ativo === false) {
    res.status(400).json({ error: 'Conferente inválido ou inativo.' });
    return;
  }

  const permitidos = await listarConferentesRecebimento();
  if (!permitidos.some((c) => c.id === conferente.id)) {
    res.status(400).json({
      error: 'Este usuário não tem permissão de conferente. Atribua a permissão no grupo.',
    });
    return;
  }

  try {
    const local = await deliberarConferente({
      idDocumentoEstoque: idDocumento,
      numeroDocumento: numeroDocumento || null,
      conferente: { id: conferente.id, login: conferente.login, nome: conferente.nome },
      atribuidoPor: mesa,
    });
    res.json({
      ok: true,
      status: local.status,
      statusLabel: RECEBIMENTO_STATUS_LABEL[local.status],
      conferenteUsuarioId: local.conferenteUsuarioId,
      conferenteLogin: local.conferenteLogin,
      conferenteNome: local.conferenteNome,
      atribuidoEm: local.atribuidoEm,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
}

async function usuarioLogado(req: Request): Promise<{ id: number; login: string } | null> {
  const login = req.user?.login;
  if (!login) return null;
  const u = await prisma.usuario.findUnique({ where: { login }, select: { id: true, login: true } });
  return u;
}

function conferenciaDoConferente(
  local: RecebimentoConferenciaLocal | null,
  usuarioId: number
): local is RecebimentoConferenciaLocal {
  if (!local) return false;
  if (local.conferenteUsuarioId !== usuarioId) return false;
  return local.status === RECEBIMENTO_STATUS.EM_CONFERENCIA;
}

type ProdutoConferenteDto = {
  idItem: number;
  idProduto: number;
  codigoProduto: string | null;
  descricaoProduto: string | null;
  unidadeMedida: string | null;
  tentativasUsadas: number;
  tentativasMax: number;
  conferido: boolean;
  qtdeInformada: number | null;
};

function produtoParaConferente(
  item: {
    idItem: number;
    idProduto: number;
    codigoProduto: string | null;
    descricaoProduto: string | null;
    unidadeMedida: string | null;
  },
  local: RecebimentoContagemLinha | undefined
): ProdutoConferenteDto {
  const conferido = local?.conferido === true;
  return {
    idItem: item.idItem,
    idProduto: item.idProduto,
    codigoProduto: item.codigoProduto,
    descricaoProduto: item.descricaoProduto,
    unidadeMedida: item.unidadeMedida,
    tentativasUsadas: local?.tentativas ?? 0,
    tentativasMax: RECEBIMENTO_TENTATIVAS_MAX,
    conferido,
    qtdeInformada: conferido && local ? local.qtdeInformada : null,
  };
}

/**
 * GET /api/recebimento/digitacao/pendencias
 */
export async function getRecebimentoDigitacaoPendencias(req: Request, res: Response): Promise<void> {
  const usuario = await usuarioLogado(req);
  if (!usuario) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }

  const locais = await listarPendenciasConferente(usuario.id);
  const ids = locais.map((l) => l.idDocumentoEstoque);
  const { documentos: cabecalhos, erro } = await queryCabecalhosDocumentosNomus(ids);
  const porId = new Map(cabecalhos.map((d) => [d.idDocumento, d]));

  const pendencias = locais.map((l) => {
    const cab = porId.get(l.idDocumentoEstoque);
    return {
      idDocumento: l.idDocumentoEstoque,
      numeroDocumentoFiscal: cab?.numeroDocumentoFiscal ?? l.numeroDocumento,
      numeroNfe: cab?.numeroNfe ?? null,
      dataEmissao: cab?.dataEmissao ?? null,
      dataEntrada: cab?.dataEntrada ?? null,
      nomeParceiro: cab?.nomeParceiro ?? null,
      tipoMovimentacao: cab?.tipoMovimentacao ?? null,
      status: l.status,
      statusLabel: RECEBIMENTO_STATUS_LABEL[l.status] ?? l.status,
      atribuidoEm: l.atribuidoEm,
    };
  });

  res.json({
    pendencias,
    erro: erro || undefined,
  });
}

/**
 * GET /api/recebimento/digitacao/documentos/:id
 */
export async function getRecebimentoDigitacaoDocumento(req: Request, res: Response): Promise<void> {
  const usuario = await usuarioLogado(req);
  if (!usuario) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }
  const idDocumento = Math.trunc(Number(req.params.id));
  if (!Number.isFinite(idDocumento) || idDocumento <= 0) {
    res.status(400).json({ error: 'idDocumento inválido.' });
    return;
  }

  const local = await obterConferenciaPorDocumento(idDocumento);
  if (!conferenciaDoConferente(local, usuario.id)) {
    res.status(403).json({ error: 'Esta conferência não está atribuída a você.' });
    return;
  }

  const [{ documentos: cabecalhos, erro: erroCab }, { itens, erro: erroItens }, linhas] = await Promise.all([
    queryCabecalhosDocumentosNomus([idDocumento]),
    queryItensDocumentoPreEntradaNomus(idDocumento),
    listarItensContagem(local.id),
  ]);
  const cab = cabecalhos[0] ?? null;
  const erro = erroCab || erroItens;
  const porItem = new Map(
    linhas.filter((l) => l.idItemDocumento != null).map((l) => [l.idItemDocumento as number, l])
  );

  res.json({
    idDocumento,
    numeroDocumentoFiscal: cab?.numeroDocumentoFiscal ?? local.numeroDocumento,
    numeroNfe: cab?.numeroNfe ?? null,
    dataEmissao: cab?.dataEmissao ?? null,
    dataEntrada: cab?.dataEntrada ?? null,
    nomeParceiro: cab?.nomeParceiro ?? null,
    tipoMovimentacao: cab?.tipoMovimentacao ?? null,
    status: local.status,
    statusLabel: RECEBIMENTO_STATUS_LABEL[local.status] ?? local.status,
    atribuidoEm: local.atribuidoEm,
    produtos: itens.map((it) => produtoParaConferente(it, porItem.get(it.idItem))),
    erro: erro || undefined,
  });
}

/**
 * POST /api/recebimento/digitacao/documentos/:id/itens
 * body: { idItem: number, qtde: number }
 */
export async function postRecebimentoDigitacaoItem(req: Request, res: Response): Promise<void> {
  const usuario = await usuarioLogado(req);
  if (!usuario) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }
  const idDocumento = Math.trunc(Number(req.params.id));
  const idItem = Math.trunc(Number(req.body?.idItem));
  const qtde = Number(req.body?.qtde);

  if (!Number.isFinite(idDocumento) || idDocumento <= 0) {
    res.status(400).json({ error: 'idDocumento inválido.' });
    return;
  }
  if (!Number.isFinite(idItem) || idItem <= 0) {
    res.status(400).json({ error: 'Selecione o produto do documento.' });
    return;
  }
  if (!Number.isFinite(qtde) || qtde <= 0) {
    res.status(400).json({ error: 'Informe a quantidade física maior que zero.' });
    return;
  }

  const local = await obterConferenciaPorDocumento(idDocumento);
  if (!conferenciaDoConferente(local, usuario.id)) {
    res.status(403).json({ error: 'Esta conferência não está atribuída a você.' });
    return;
  }

  const { itens, erro } = await queryItensDocumentoPreEntradaNomus(idDocumento);
  if (erro) {
    res.status(503).json({ error: erro });
    return;
  }
  const itemNomus = itens.find((it) => it.idItem === idItem);
  if (!itemNomus) {
    res.status(400).json({ error: 'Este produto não pertence ao documento.' });
    return;
  }

  const acertou = qtdeFisicaConfere(qtde, itemNomus.qtde);
  let tentativa: { tentativas: number; conferido: boolean; esgotado: boolean };
  try {
    tentativa = await registrarTentativaContagem({
      conferenciaId: local.id,
      idItemDocumento: itemNomus.idItem,
      codigoInformado: itemNomus.codigoProduto ?? String(itemNomus.idProduto),
      qtdeInformada: qtde,
      idProduto: itemNomus.idProduto,
      descricaoProduto: itemNomus.descricaoProduto,
      unidadeMedida: itemNomus.unidadeMedida,
      acertou,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
    return;
  }

  let status = local.status;
  let retornouMesa = false;
  if (tentativa.esgotado) {
    const atualizado = await devolverConferenciaParaMesa(local.id, RECEBIMENTO_STATUS.DIVERGENCIA);
    status = atualizado.status;
    retornouMesa = true;
  }

  const produto = produtoParaConferente(itemNomus, {
    id: 0,
    codigoInformado: itemNomus.codigoProduto ?? String(itemNomus.idProduto),
    qtdeInformada: qtde,
    idItemDocumento: itemNomus.idItem,
    idProduto: itemNomus.idProduto,
    descricaoProduto: itemNomus.descricaoProduto,
    unidadeMedida: itemNomus.unidadeMedida,
    tentativas: tentativa.tentativas,
    conferido: tentativa.conferido,
  });

  res.json({
    ok: true,
    acertou,
    tentativasUsadas: tentativa.tentativas,
    tentativasRestantes: Math.max(0, RECEBIMENTO_TENTATIVAS_MAX - tentativa.tentativas),
    conferido: tentativa.conferido,
    esgotado: tentativa.esgotado,
    retornouMesa,
    status,
    statusLabel: RECEBIMENTO_STATUS_LABEL[status] ?? status,
    produto,
  });
}

/**
 * POST /api/recebimento/digitacao/documentos/:id/devolver
 */
export async function postRecebimentoDigitacaoDevolver(req: Request, res: Response): Promise<void> {
  const usuario = await usuarioLogado(req);
  if (!usuario) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }
  const idDocumento = Math.trunc(Number(req.params.id));
  if (!Number.isFinite(idDocumento) || idDocumento <= 0) {
    res.status(400).json({ error: 'idDocumento inválido.' });
    return;
  }

  const local = await obterConferenciaPorDocumento(idDocumento);
  if (!conferenciaDoConferente(local, usuario.id)) {
    res.status(403).json({ error: 'Esta conferência não está atribuída a você.' });
    return;
  }

  const [{ itens, erro }, linhas] = await Promise.all([
    queryItensDocumentoPreEntradaNomus(idDocumento),
    listarItensContagem(local.id),
  ]);
  if (erro) {
    res.status(503).json({ error: erro });
    return;
  }
  if (itens.length === 0) {
    res.status(400).json({ error: 'Não há itens neste documento para devolver.' });
    return;
  }
  const conferidos = new Set(
    linhas.filter((l) => l.conferido && l.idItemDocumento != null).map((l) => l.idItemDocumento as number)
  );
  if (itens.some((it) => !conferidos.has(it.idItem))) {
    res.status(400).json({ error: 'Confera todos os itens antes de devolver à Mesa.' });
    return;
  }

  const atualizado = await devolverConferenciaParaMesa(local.id, RECEBIMENTO_STATUS.CONFERIDO);
  res.json({
    ok: true,
    status: atualizado.status,
    statusLabel: RECEBIMENTO_STATUS_LABEL[atualizado.status],
  });
}
