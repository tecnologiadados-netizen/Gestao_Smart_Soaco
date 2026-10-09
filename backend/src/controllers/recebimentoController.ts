/**
 * Recebimento — Gestão Mesa: fila de pré-entrada, detalhe e deliberação do conferente.
 */

import type { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import {
  queryCabecalhosDocumentosNomus,
  queryDevolucaoCompraPorNfeNomus,
  queryDocumentosPreEntradaNomus,
  queryItensDocumentoPreEntradaNomus,
  movimentacaoDeixouPreEntrada,
  RECEBIMENTO_STATUS,
  RECEBIMENTO_STATUS_LABEL,
  type RecebimentoStatus,
} from '../data/recebimentoNomusRepository.js';
import {
  RECEBIMENTO_CONFERENCIA_WA_CODE,
  ensureRecebimentoConferenciaWhatsappTipo,
  montarMensagemDocumentoEnviadoConferencia,
} from '../config/recebimentoConferenciaAlerta.js';
import { enviarNotificacaoPorTipo } from '../services/whatsappNotificacaoService.js';
import { listarIdsConferenciaDoubleCheckConcluida } from './doubleCheckInController.js';
import {
  concluirConferenciaPorMovimentacaoAlterada,
  deliberarConferente,
  devolverConferenciaParaMesa,
  listarConferenciasPorDocumentos,
  listarConferenciasPorStatus,
  listarConferentesRecebimento,
  listarItensContagem,
  listarPendenciasConferente,
  obterConferenciaPorDocumento,
  listarCiclosConferencia,
  qtdeFisicaConfere,
  normalizarJustificativaAceite,
  registrarAcaoMesa,
  registrarTentativaContagem,
  RECEBIMENTO_TENTATIVAS_MAX,
  vincularDocumentoDevolucao,
  type RecebimentoConferenciaLocal,
  type RecebimentoContagemLinha,
} from '../data/recebimentoConferenciaRepository.js';

function notificarDocumentoEnviadoConferencia(numeroDocumento: string | null, idDocumento: number): void {
  const documento = numeroDocumento?.trim() || String(idDocumento);
  const texto = montarMensagemDocumentoEnviadoConferencia(documento);
  void ensureRecebimentoConferenciaWhatsappTipo()
    .then(() => enviarNotificacaoPorTipo(RECEBIMENTO_CONFERENCIA_WA_CODE, texto))
    .catch((err) => {
      console.error('[recebimento] alerta WhatsApp da conferência:', err);
    });
}

function statusPadrao() {
  return {
    codigo: RECEBIMENTO_STATUS.AGUARDANDO_CONFERENTE,
    label: RECEBIMENTO_STATUS_LABEL[RECEBIMENTO_STATUS.AGUARDANDO_CONFERENTE],
  };
}

function statusAntesDoConferente(doubleCheckConcluido: boolean) {
  if (doubleCheckConcluido) return statusPadrao();
  return {
    codigo: RECEBIMENTO_STATUS.AGUARDANDO_DOUBLE_CHECK,
    label: RECEBIMENTO_STATUS_LABEL[RECEBIMENTO_STATUS.AGUARDANDO_DOUBLE_CHECK],
  };
}

async function idsMesaLiberadosPeloDoubleCheck(
  docs: Array<{ idDocumento: number; dataEntrada: string | null }>
): Promise<Set<number>> {
  if (docs.length === 0) return new Set();
  try {
    return await listarIdsConferenciaDoubleCheckConcluida(docs);
  } catch (err) {
    console.error('[recebimento] leitura da conferência Double Check:', err);
    return new Set();
  }
}

async function sincronizarDevolucaoSeDisponivel(
  local: RecebimentoConferenciaLocal | null,
  numeroNfe: string | null,
  idParceiro: number | null
): Promise<RecebimentoConferenciaLocal | null> {
  if (
    !local ||
    local.status !== RECEBIMENTO_STATUS.AGUARDANDO_DEVOLUCAO ||
    !numeroNfe ||
    !idParceiro
  ) {
    return local;
  }
  const { documento } = await queryDevolucaoCompraPorNfeNomus({ numeroNfe, idParceiro });
  if (!documento) return local;
  return vincularDocumentoDevolucao({
    conferenciaId: local.id,
    idDocumento: documento.idDocumento,
    numeroDocumentoFiscal: documento.numeroDocumentoFiscal,
    numeroNfe: documento.numeroNfe,
  });
}

type RecebimentoConcluidoMovimentacao = {
  idDocumento: number;
  numeroDocumento: string | null;
  tipoMovimentacao: string | null;
};

/**
 * Documentos conferidos sem divergência saem da fila quando o Nomus deixa de estar em pré-entrada.
 * A contagem já gravada permanece como histórico; o status local passa a concluído.
 */
async function concluirConferidosComMovimentacaoAlterada(
  idsTiposPreEntrada: ReadonlySet<number>
): Promise<RecebimentoConcluidoMovimentacao[]> {
  if (idsTiposPreEntrada.size === 0) return [];
  const aguardando = await listarConferenciasPorStatus(RECEBIMENTO_STATUS.CONFERIDO);
  if (aguardando.length === 0) return [];

  const { documentos, erro } = await queryCabecalhosDocumentosNomus(
    aguardando.map((item) => item.idDocumentoEstoque)
  );
  if (erro) return [];

  const porId = new Map(documentos.map((doc) => [doc.idDocumento, doc]));
  const concluidos: RecebimentoConcluidoMovimentacao[] = [];
  for (const local of aguardando) {
    const cabecalho = porId.get(local.idDocumentoEstoque);
    if (!cabecalho || !movimentacaoDeixouPreEntrada(cabecalho.idTipoMovimentacao, idsTiposPreEntrada)) {
      continue;
    }
    await concluirConferenciaPorMovimentacaoAlterada(local.id);
    concluidos.push({
      idDocumento: local.idDocumentoEstoque,
      numeroDocumento: cabecalho.numeroDocumentoFiscal ?? local.numeroDocumento,
      tipoMovimentacao: cabecalho.tipoMovimentacao,
    });
  }
  return concluidos;
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

  const concluidos = await concluirConferidosComMovimentacaoAlterada(
    new Set(tipos.map((tipo) => tipo.id).filter((id) => id > 0))
  );

  const locais = await listarConferenciasPorDocumentos(documentos.map((d) => d.idDocumento));
  await Promise.all(
    documentos.map(async (d) => {
      const local = locais.get(d.idDocumento) ?? null;
      const sincronizado = await sincronizarDevolucaoSeDisponivel(local, d.numeroNfe, d.idParceiro);
      if (sincronizado) locais.set(d.idDocumento, sincronizado);
    })
  );
  const semConferenciaLocal = documentos.filter((d) => !locais.get(d.idDocumento));
  const liberadosDoubleCheck = await idsMesaLiberadosPeloDoubleCheck(
    semConferenciaLocal.map((d) => ({ idDocumento: d.idDocumento, dataEntrada: d.dataEntrada }))
  );
  const lista = documentos.map((d) => {
    const local = locais.get(d.idDocumento);
    const codigo =
      local?.status ?? statusAntesDoConferente(liberadosDoubleCheck.has(d.idDocumento)).codigo;
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
    concluidos,
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

  let local = await obterConferenciaPorDocumento(idDocumento);
  if (local?.status === RECEBIMENTO_STATUS.AGUARDANDO_DEVOLUCAO) {
    const { documentos } = await queryCabecalhosDocumentosNomus([idDocumento]);
    const cabecalho = documentos[0];
    local = await sincronizarDevolucaoSeDisponivel(
      local,
      cabecalho?.numeroNfe ?? null,
      cabecalho?.idParceiro ?? null
    );
  }
  const cicloAtualFinalizado = local?.finalizadoEm != null;
  const ciclosArquivados = local ? await listarCiclosConferencia(local.id) : [];
  const itensPorId = new Map(itens.map((item) => [item.idItem, item]));
  const montarItensHistorico = (linhas: RecebimentoContagemLinha[]) =>
    linhas.map((linha) => {
      const item = linha.idItemDocumento == null ? null : itensPorId.get(linha.idItemDocumento);
      return {
        idItem: linha.idItemDocumento,
        codigoProduto: item?.codigoProduto ?? linha.codigoInformado,
        descricaoProduto: item?.descricaoProduto ?? linha.descricaoProduto,
        unidadeMedida: item?.unidadeMedida ?? linha.unidadeMedida,
        qtdeDocumento: item?.qtde ?? null,
        qtdeInformada: linha.qtdeInformada,
        tentativas: linha.tentativas,
        conferido: linha.conferido,
      };
    });
  const statusPelosItens = (linhas: { conferido: boolean }[]) =>
    linhas.some((linha) => !linha.conferido)
      ? RECEBIMENTO_STATUS.DIVERGENCIA
      : RECEBIMENTO_STATUS.CONFERIDO;
  const historicosConferencia = ciclosArquivados.map((ciclo) => {
    const statusCiclo = statusPelosItens(ciclo.itens);
    return {
      status: statusCiclo,
      statusLabel: RECEBIMENTO_STATUS_LABEL[statusCiclo] ?? statusCiclo,
      retornadoEm: ciclo.finalizadoEm,
      conferenteNome: ciclo.conferenteNome,
      itens: montarItensHistorico(ciclo.itens),
    };
  });
  if (cicloAtualFinalizado && local) {
    const linhasAtuais = await listarItensContagem(local.id);
    const statusAtual = statusPelosItens(linhasAtuais);
    historicosConferencia.push({
      status: statusAtual,
      statusLabel: RECEBIMENTO_STATUS_LABEL[statusAtual] ?? statusAtual,
      retornadoEm: local.finalizadoEm,
      conferenteNome: local.conferenteNome,
      itens: montarItensHistorico(linhasAtuais),
    });
  }
  let codigo = local?.status ?? RECEBIMENTO_STATUS.AGUARDANDO_DOUBLE_CHECK;
  if (!local) {
    const { documentos } = await queryCabecalhosDocumentosNomus([idDocumento]);
    const liberados = await idsMesaLiberadosPeloDoubleCheck([
      { idDocumento, dataEntrada: documentos[0]?.dataEntrada ?? null },
    ]);
    codigo = statusAntesDoConferente(liberados.has(idDocumento)).codigo;
  }
  res.json({
    itens,
    status: codigo,
    statusLabel: RECEBIMENTO_STATUS_LABEL[codigo] ?? codigo,
    conferenteUsuarioId: local?.conferenteUsuarioId ?? null,
    conferenteLogin: local?.conferenteLogin ?? null,
    conferenteNome: local?.conferenteNome ?? null,
    atribuidoEm: local?.atribuidoEm ?? null,
    mesaUltimaAcao: local?.mesaUltimaAcao ?? null,
    mesaAcaoEm: local?.mesaAcaoEm ?? null,
    mesaAcaoPorLogin: local?.mesaAcaoPorLogin ?? null,
    mesaAceiteJustificativa: local?.mesaAceiteJustificativa ?? null,
    devolucao: local?.idDocumentoDevolucaoNomus
      ? {
          idDocumento: local.idDocumentoDevolucaoNomus,
          numeroDocumentoFiscal: local.numeroDocumentoDevolucao,
          numeroNfe: local.numeroNfeDevolucao,
          vinculadaEm: local.devolucaoVinculadaEm,
        }
      : null,
    historicosConferencia,
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

  const conferenciaAtual = await obterConferenciaPorDocumento(idDocumento);
  if (conferenciaAtual?.status === RECEBIMENTO_STATUS.CONFERIDO) {
    res.status(409).json({
      error:
        'A conferência já está ok. Altere o tipo de movimentação no Nomus para concluir o documento.',
    });
    return;
  }
  if (conferenciaAtual?.status === RECEBIMENTO_STATUS.FINALIZADO) {
    res.status(409).json({ error: 'Este documento já foi concluído.' });
    return;
  }
  if (!conferenciaAtual) {
    const { documentos, erro: erroCabecalho } = await queryCabecalhosDocumentosNomus([idDocumento]);
    if (erroCabecalho) {
      res.status(503).json({ error: erroCabecalho });
      return;
    }
    const liberados = await idsMesaLiberadosPeloDoubleCheck([
      { idDocumento, dataEntrada: documentos[0]?.dataEntrada ?? null },
    ]);
    if (!liberados.has(idDocumento)) {
      res.status(409).json({
        error: 'Conclua a conferência no Double Check antes de deliberar o conferente.',
      });
      return;
    }
  }

  try {
    const local = await deliberarConferente({
      idDocumentoEstoque: idDocumento,
      numeroDocumento: numeroDocumento || null,
      conferente: { id: conferente.id, login: conferente.login, nome: conferente.nome },
      atribuidoPor: mesa,
    });
    notificarDocumentoEnviadoConferencia(local.numeroDocumento ?? numeroDocumento, idDocumento);
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

/**
 * POST /api/recebimento/mesa/documentos/:id/acao
 * body: { acao: TRATAMENTO_COMPRAS | REENVIAR_CONFERENCIA | DEVOLVER_MATERIAL | ACEITAR_COMO_ESTA,
 *         conferenteUsuarioId?: number, justificativa?: string }
 */
export async function postRecebimentoMesaAcao(req: Request, res: Response): Promise<void> {
  const usuario = await usuarioLogado(req);
  if (!usuario) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }
  const idDocumento = Math.trunc(Number(req.params.id));
  const acao = typeof req.body?.acao === 'string' ? req.body.acao.trim().toUpperCase() : '';
  if (!Number.isFinite(idDocumento) || idDocumento <= 0) {
    res.status(400).json({ error: 'idDocumento inválido.' });
    return;
  }
  if (
    !['TRATAMENTO_COMPRAS', 'REENVIAR_CONFERENCIA', 'DEVOLVER_MATERIAL', 'ACEITAR_COMO_ESTA'].includes(
      acao
    )
  ) {
    res.status(400).json({ error: 'Selecione uma ação válida.' });
    return;
  }

  const local = await obterConferenciaPorDocumento(idDocumento);
  const statusesAlteraveis: RecebimentoStatus[] = [
    RECEBIMENTO_STATUS.DIVERGENCIA,
    RECEBIMENTO_STATUS.TRATAMENTO_COMPRAS,
    RECEBIMENTO_STATUS.AGUARDANDO_DEVOLUCAO,
    RECEBIMENTO_STATUS.DEVOLUCAO_VINCULADA,
  ];
  if (!local || !statusesAlteraveis.includes(local.status)) {
    res.status(409).json({
      error: 'A ação pode ser alterada enquanto o documento está na Mesa após a divergência.',
    });
    return;
  }

  let atualizado: RecebimentoConferenciaLocal;
  if (acao === 'TRATAMENTO_COMPRAS') {
    atualizado = await registrarAcaoMesa({
      conferenciaId: local.id,
      acao,
      status: RECEBIMENTO_STATUS.TRATAMENTO_COMPRAS,
      usuario,
    });
  } else if (acao === 'REENVIAR_CONFERENCIA') {
    const conferenteUsuarioId = Math.trunc(
      Number(req.body?.conferenteUsuarioId ?? local.conferenteUsuarioId)
    );
    const conferente = await prisma.usuario.findUnique({
      where: { id: conferenteUsuarioId },
      select: { id: true, login: true, nome: true, ativo: true },
    });
    const permitidos = await listarConferentesRecebimento();
    if (
      !conferente ||
      conferente.ativo === false ||
      !permitidos.some((item) => item.id === conferente.id)
    ) {
      res.status(400).json({ error: 'Selecione um conferente válido.' });
      return;
    }
    atualizado = await deliberarConferente({
      idDocumentoEstoque: idDocumento,
      numeroDocumento: local.numeroDocumento,
      conferente: { id: conferente.id, login: conferente.login, nome: conferente.nome },
      atribuidoPor: usuario,
      mesaAcao: acao,
      preservarItensConferidos: true,
    });
    notificarDocumentoEnviadoConferencia(atualizado.numeroDocumento ?? local.numeroDocumento, idDocumento);
  } else if (acao === 'ACEITAR_COMO_ESTA') {
    const justificativa = normalizarJustificativaAceite(req.body?.justificativa);
    if (!justificativa.ok) {
      res.status(400).json({ error: justificativa.erro });
      return;
    }
    atualizado = await registrarAcaoMesa({
      conferenciaId: local.id,
      acao,
      status: RECEBIMENTO_STATUS.CONFERIDO,
      usuario,
      justificativa: justificativa.texto,
    });
  } else {
    const { documentos, erro } = await queryCabecalhosDocumentosNomus([idDocumento]);
    if (erro) {
      res.status(503).json({ error: erro });
      return;
    }
    const cabecalho = documentos[0];
    if (!cabecalho?.numeroNfe || !cabecalho.idParceiro) {
      res.status(400).json({
        error: 'O documento não possui NF-e e fornecedor válidos para localizar a devolução.',
      });
      return;
    }
    const busca = await queryDevolucaoCompraPorNfeNomus({
      numeroNfe: cabecalho.numeroNfe,
      idParceiro: cabecalho.idParceiro,
    });
    if (busca.erro) {
      res.status(503).json({ error: busca.erro });
      return;
    }
    atualizado = await registrarAcaoMesa({
      conferenciaId: local.id,
      acao,
      status: busca.documento
        ? RECEBIMENTO_STATUS.DEVOLUCAO_VINCULADA
        : RECEBIMENTO_STATUS.AGUARDANDO_DEVOLUCAO,
      usuario,
      devolucao: busca.documento,
    });
  }

  res.json({
    ok: true,
    status: atualizado.status,
    statusLabel: RECEBIMENTO_STATUS_LABEL[atualizado.status] ?? atualizado.status,
    mesaUltimaAcao: atualizado.mesaUltimaAcao,
    mesaAcaoEm: atualizado.mesaAcaoEm,
    mesaAcaoPorLogin: atualizado.mesaAcaoPorLogin,
    mesaAceiteJustificativa: atualizado.mesaAceiteJustificativa,
    conferenteUsuarioId: atualizado.conferenteUsuarioId,
    conferenteLogin: atualizado.conferenteLogin,
    conferenteNome: atualizado.conferenteNome,
    atribuidoEm: atualizado.atribuidoEm,
    devolucao: atualizado.idDocumentoDevolucaoNomus
      ? {
          idDocumento: atualizado.idDocumentoDevolucaoNomus,
          numeroDocumentoFiscal: atualizado.numeroDocumentoDevolucao,
          numeroNfe: atualizado.numeroNfeDevolucao,
          vinculadaEm: atualizado.devolucaoVinculadaEm,
        }
      : null,
  });
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
  esgotado: boolean;
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
  const tentativasUsadas = local?.tentativas ?? 0;
  const esgotado = !conferido && tentativasUsadas >= RECEBIMENTO_TENTATIVAS_MAX;
  return {
    idItem: item.idItem,
    idProduto: item.idProduto,
    codigoProduto: item.codigoProduto,
    descricaoProduto: item.descricaoProduto,
    unidadeMedida: item.unidadeMedida,
    tentativasUsadas,
    tentativasMax: RECEBIMENTO_TENTATIVAS_MAX,
    conferido,
    esgotado,
    qtdeInformada: local && (conferido || esgotado) ? local.qtdeInformada : null,
  };
}

function situacaoItensConferencia(
  itensNomus: { idItem: number }[],
  linhas: RecebimentoContagemLinha[]
): { todosEncerrados: boolean; temDivergencia: boolean } {
  const porItem = new Map(
    linhas.filter((l) => l.idItemDocumento != null).map((l) => [l.idItemDocumento as number, l])
  );
  const todosEncerrados =
    itensNomus.length > 0 &&
    itensNomus.every((it) => {
      const linha = porItem.get(it.idItem);
      return linha?.conferido === true || (linha?.tentativas ?? 0) >= RECEBIMENTO_TENTATIVAS_MAX;
    });
  const temDivergencia = itensNomus.some((it) => porItem.get(it.idItem)?.conferido !== true);
  return { todosEncerrados, temDivergencia };
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

  const linhasApos = await listarItensContagem(local.id);
  const { todosEncerrados, temDivergencia } = situacaoItensConferencia(itens, linhasApos);
  let status = local.status;
  let retornouMesa = false;
  if (todosEncerrados) {
    const atualizado = await devolverConferenciaParaMesa(
      local.id,
      temDivergencia ? RECEBIMENTO_STATUS.DIVERGENCIA : RECEBIMENTO_STATUS.CONFERIDO
    );
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
  const { todosEncerrados, temDivergencia } = situacaoItensConferencia(itens, linhas);
  if (!todosEncerrados) {
    res.status(400).json({ error: 'Confera todos os itens antes de devolver à Mesa.' });
    return;
  }

  const atualizado = await devolverConferenciaParaMesa(
    local.id,
    temDivergencia ? RECEBIMENTO_STATUS.DIVERGENCIA : RECEBIMENTO_STATUS.CONFERIDO
  );
  res.json({
    ok: true,
    status: atualizado.status,
    statusLabel: RECEBIMENTO_STATUS_LABEL[atualizado.status],
  });
}
