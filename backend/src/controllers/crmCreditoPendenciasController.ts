import type { Request, Response } from 'express';
import fs from 'fs';
import { prisma } from '../config/prisma.js';
import { listarAlertasCreditoPendentes } from '../services/financeiroCreditoPedidoAtrasoEmailService.js';
import {
  ACOES_PENDENCIA,
  anexarPdfAssinadoPendenciaCredito,
  confirmarLiberacaoPendenciaCredito,
  listarHistoricoClientePendencias,
  listarPendenciasCredito,
  listarUsuariosParaDestinatarioPendencia,
  obterEmailConfigPendencias,
  obterPdfAssinadoPendenciaCredito,
  removerPdfAssinadoPendenciaCredito,
  salvarAcaoPendenciaCredito,
  salvarEmailConfigPendencias,
  sincronizarPendenciasComAlertasAtuais,
  type AcaoPendenciaCredito,
  type SituacaoFilaPendencia,
} from '../services/crmCreditoPendenciasService.js';

const SITUACOES_FILA: SituacaoFilaPendencia[] = [
  'INADIMPLENTES',
  'REGULARIZADOS',
  'FINALIZADOS',
];

export async function getCrmPendenciasCredito(req: Request, res: Response): Promise<void> {
  try {
    const cliente = typeof req.query.cliente === 'string' ? req.query.cliente : null;
    const syncAlertas = req.query.syncAlertas === '1';
    const syncNomus = req.query.syncNomus !== '0';
    const situacaoRaw =
      typeof req.query.situacao === 'string' ? req.query.situacao.trim().toUpperCase() : '';
    const situacaoFila = SITUACOES_FILA.includes(situacaoRaw as SituacaoFilaPendencia)
      ? (situacaoRaw as SituacaoFilaPendencia)
      : 'INADIMPLENTES';

    if (syncAlertas) {
      try {
        const alertas = await listarAlertasCreditoPendentes();
        await sincronizarPendenciasComAlertasAtuais(prisma, alertas);
      } catch (err) {
        console.warn('Sync alertas → pendências (parcial):', err);
      }
    }

    const { itens, contagens } = await listarPendenciasCredito(prisma, {
      cliente,
      situacaoFila,
      syncNomus,
    });
    res.json({ itens, contagens, situacaoFila });
  } catch (error) {
    console.error('Erro ao listar pendências de crédito:', error);
    res.status(500).json({ error: 'Não foi possível carregar as pendências de crédito.' });
  }
}

export async function postCrmPendenciaAcao(req: Request, res: Response): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }

    const acao = String(req.body?.acao ?? '').trim().toUpperCase() as AcaoPendenciaCredito;
    if (!ACOES_PENDENCIA.includes(acao)) {
      res.status(400).json({
        error: `Ação inválida. Use: ${ACOES_PENDENCIA.join(', ')}.`,
      });
      return;
    }

    const login = req.user?.login ?? null;
    let nome: string | null = null;
    if (login) {
      const u = await prisma.usuario.findUnique({
        where: { login },
        select: { nome: true },
      });
      nome = u?.nome ?? null;
    }

    const resultado = await salvarAcaoPendenciaCredito(prisma, {
      id,
      acao,
      observacao: req.body?.observacao ?? null,
      pedidoDestino: req.body?.pedidoDestino ?? null,
      usuarioLogin: login,
      usuarioNome: nome,
    });

    res.json({
      ...resultado,
      mensagem: resultado.mensagem,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const status =
      msg.includes('destinatário') ||
      msg.includes('destino') ||
      msg.includes('inválida') ||
      msg.includes('Anexe o PDF')
        ? 400
        : msg.includes('não encontrada')
          ? 404
          : 500;
    if (status === 500) console.error('Erro ao salvar ação de pendência:', error);
    res.status(status).json({ error: msg || 'Não foi possível salvar a ação.' });
  }
}

export async function postCrmPendenciaPdfAssinado(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }

    const fileName = String(req.body?.fileName ?? '').trim();
    const mimeType = String(req.body?.mimeType ?? '').trim();
    const contentBase64 = String(req.body?.contentBase64 ?? '').trim();
    if (!fileName || !contentBase64) {
      res.status(400).json({ error: 'Informe o arquivo PDF (fileName e contentBase64).' });
      return;
    }

    const pendencia = await anexarPdfAssinadoPendenciaCredito(prisma, {
      id,
      fileName,
      mimeType: mimeType || 'application/pdf',
      contentBase64,
      usuarioLogin: req.user?.login ?? null,
    });
    res.json({ pendencia, mensagem: 'PDF assinado anexado com sucesso.' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const status =
      msg.includes('apenas PDF') ||
      msg.includes('excede') ||
      msg.includes('vazio') ||
      msg.includes('encerrada')
        ? 400
        : msg.includes('não encontrada')
          ? 404
          : 500;
    if (status === 500) console.error('Erro ao anexar PDF assinado:', error);
    res.status(status).json({ error: msg || 'Não foi possível anexar o PDF.' });
  }
}

export async function getCrmPendenciaPdfAssinado(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }

    const file = await obterPdfAssinadoPendenciaCredito(prisma, id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${file.fileName.replace(/"/g, '')}"`
    );
    fs.createReadStream(file.absPath).pipe(res);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const status =
      msg.includes('não encontrada') || msg.includes('não encontrado')
        ? 404
        : msg.includes('Nenhum PDF')
          ? 404
          : 500;
    if (status === 500) console.error('Erro ao baixar PDF assinado:', error);
    res.status(status).json({ error: msg || 'Não foi possível baixar o PDF.' });
  }
}

export async function deleteCrmPendenciaPdfAssinado(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }

    const pendencia = await removerPdfAssinadoPendenciaCredito(prisma, {
      id,
      usuarioLogin: req.user?.login ?? null,
    });
    res.json({ pendencia, mensagem: 'PDF assinado removido.' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const status =
      msg.includes('Não é possível') || msg.includes('encerrada')
        ? 400
        : msg.includes('não encontrada')
          ? 404
          : 500;
    if (status === 500) console.error('Erro ao remover PDF assinado:', error);
    res.status(status).json({ error: msg || 'Não foi possível remover o PDF.' });
  }
}

export async function postCrmPendenciaConfirmarLiberacao(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'ID inválido.' });
      return;
    }

    const login = req.user?.login ?? null;
    let nome: string | null = null;
    if (login) {
      const u = await prisma.usuario.findUnique({
        where: { login },
        select: { nome: true },
      });
      nome = u?.nome ?? null;
    }

    const resultado = await confirmarLiberacaoPendenciaCredito(prisma, {
      id,
      usuarioLogin: login,
      usuarioNome: nome,
    });
    res.json(resultado);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const status =
      msg.includes('Só é possível') || msg.includes('já está')
        ? 400
        : msg.includes('não encontrada')
          ? 404
          : 500;
    if (status === 500) console.error('Erro ao confirmar liberação:', error);
    res.status(status).json({ error: msg || 'Não foi possível confirmar a liberação.' });
  }
}

export async function getCrmPendenciasEmailConfig(_req: Request, res: Response): Promise<void> {
  try {
    const config = await obterEmailConfigPendencias(prisma);
    res.json(config);
  } catch (error) {
    console.error('Erro ao ler config e-mail pendências:', error);
    res.status(500).json({ error: 'Não foi possível carregar os destinatários.' });
  }
}

export async function putCrmPendenciasEmailConfig(req: Request, res: Response): Promise<void> {
  try {
    const saved = await salvarEmailConfigPendencias(
      prisma,
      {
        usuarioIdsTo: req.body?.usuarioIdsTo ?? req.body?.destinatariosTo,
        usuarioIdsCc: req.body?.usuarioIdsCc ?? req.body?.destinatariosCc,
        prazoHorasSemAcao: req.body?.prazoHorasSemAcao,
        alertaPrazoAtivo: req.body?.alertaPrazoAtivo,
        usuarioIdsGestorTo: req.body?.usuarioIdsGestorTo,
        usuarioIdsGestorCc: req.body?.usuarioIdsGestorCc,
      },
      req.user?.login ?? null
    );
    res.json(saved);
  } catch (error) {
    console.error('Erro ao salvar config e-mail pendências:', error);
    res.status(500).json({ error: 'Não foi possível salvar os destinatários.' });
  }
}

export async function getCrmPendenciasUsuarios(_req: Request, res: Response): Promise<void> {
  try {
    const usuarios = await listarUsuariosParaDestinatarioPendencia(prisma);
    res.json(usuarios);
  } catch (error) {
    console.error('Erro ao listar usuários para destinatários:', error);
    res.status(500).json({ error: 'Não foi possível carregar os usuários.' });
  }
}

export async function getCrmPendenciasHistorico(req: Request, res: Response): Promise<void> {
  try {
    const cliente =
      typeof req.query.cliente === 'string'
        ? req.query.cliente
        : typeof req.query.clienteChave === 'string'
          ? req.query.clienteChave
          : '';
    if (!cliente.trim()) {
      res.status(400).json({ error: 'Informe o cliente.' });
      return;
    }
    const historico = await listarHistoricoClientePendencias(prisma, cliente);
    res.json(historico);
  } catch (error) {
    console.error('Erro ao listar histórico de pendências:', error);
    res.status(500).json({ error: 'Não foi possível carregar o histórico.' });
  }
}

export async function getCrmPendenciasContasCliente(req: Request, res: Response): Promise<void> {
  try {
    const cliente =
      typeof req.query.cliente === 'string'
        ? req.query.cliente
        : typeof req.query.clienteChave === 'string'
          ? req.query.clienteChave
          : '';
    if (!cliente.trim()) {
      res.status(400).json({ error: 'Informe o cliente.' });
      return;
    }
    const { obterMonitorRegularizacaoCliente, reconciliarMonitoresRegularizacao } = await import(
      '../services/crmCreditoRegularizacaoService.js'
    );
    await reconciliarMonitoresRegularizacao(prisma);
    const monitor = await obterMonitorRegularizacaoCliente(prisma, cliente);
    res.json({
      monitor,
      clienteNome: monitor?.clienteNome ?? cliente.trim(),
    });
  } catch (error) {
    console.error('Erro ao listar contas do monitoramento:', error);
    res.status(500).json({ error: 'Não foi possível carregar as contas do cliente.' });
  }
}

export async function getCrmPendenciasPedidosDestino(req: Request, res: Response): Promise<void> {
  try {
    const busca =
      typeof req.query.busca === 'string'
        ? req.query.busca.trim()
        : typeof req.query.q === 'string'
          ? req.query.q.trim()
          : '';
    if (busca.length < 2) {
      res.status(400).json({
        error: 'Digite ao menos 2 caracteres para buscar o pedido/cliente destino.',
      });
      return;
    }

    const excluirRaw = req.query.excluirIdPedido;
    const excluirIdPedido =
      typeof excluirRaw === 'string' && excluirRaw.trim() ? Number(excluirRaw) : null;
    const excluirCliente =
      typeof req.query.excluirCliente === 'string' ? req.query.excluirCliente.trim() : null;

    const { buscarPedidosAbertosParaRealocacao } = await import(
      '../data/financeiroCreditoPedidoQuery.js'
    );
    const pedidos = await buscarPedidosAbertosParaRealocacao({
      busca,
      excluirIdPedido: Number.isFinite(excluirIdPedido) ? excluirIdPedido : null,
      excluirClienteNome: excluirCliente,
    });
    res.json({ pedidos });
  } catch (error) {
    console.error('Erro ao listar pedidos destino:', error);
    res.status(500).json({
      error: 'Não foi possível buscar pedidos de outros clientes para realocação.',
    });
  }
}
