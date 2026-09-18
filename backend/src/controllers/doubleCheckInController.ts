/**
 * Double CheckIn — endpoints da tela de conferência de entradas.
 */

import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import {
  analisarOutliersDocumento,
  queryDoubleCheckInComparativoPc,
  queryDoubleCheckInDashboard,
  queryDoubleCheckInItens,
  queryDoubleCheckInNotas,
  queryDoubleCheckInStatus,
  type DoubleCheckInComparativoLinha,
  type DoubleCheckInNota,
} from '../data/doubleCheckInRepository.js';
import {
  DOUBLE_CHECKIN_CAMPOS,
  DOUBLE_CHECKIN_NF_PC_WA_CODE,
  DOUBLE_CHECKIN_WA_CODE,
  ensureDoubleCheckInJustificativaOpcoes,
  ensureDoubleCheckInNfPcWhatsappTipo,
  getDocumentoConferido,
  getDoubleCheckInDestinatarios,
  getDoubleCheckInLimiarPct,
  getOrCreateDoubleCheckInAlertaDesdeYmd,
  listarDecisoesComparativo,
  listarDocumentosConferidos,
  listarDocumentosJaAlertados,
  listarIdsComAtencaoDetectada,
  listarJustificativaOpcoes,
  listarTodosDocumentosConferidos,
  marcarAlertaEnviado,
  marcarDocumentoConferido,
  setDoubleCheckInDestinatarios,
  setDoubleCheckInLimiarPct,
  upsertDecisaoComparativo,
  type DoubleCheckInCampoComparativo,
  type DoubleCheckInComparativoDecisaoRow,
} from '../data/doubleCheckInLocalRepository.js';
import { enviarNotificacaoPorTipo } from '../services/whatsappNotificacaoService.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const CAMPO_LABEL: Record<DoubleCheckInCampoComparativo, string> = {
  valor_unitario: 'Vl. unitário',
  qtde: 'Quantidade',
  valor_total: 'Vl. total',
  ipi: 'IPI',
};

function parseYmd(v: unknown): string | null {
  const s = String(v ?? '').trim().slice(0, 10);
  return DATE_RE.test(s) ? s : null;
}

function fmtBrl(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPct(n: number): string {
  const sinal = n > 0 ? '+' : '';
  return `${sinal}${n.toFixed(1).replace('.', ',')}%`;
}

function fmtNum(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 4 });
}

function chaveDecisao(
  idItemDocumentoEstoque: number,
  idItemPedidoCompra: number,
  campo: string
): string {
  return `${idItemDocumentoEstoque}:${idItemPedidoCompra}:${campo}`;
}

function camposDivergentesDaLinha(
  linha: DoubleCheckInComparativoLinha
): DoubleCheckInCampoComparativo[] {
  const out: DoubleCheckInCampoComparativo[] = [];
  if (linha.divergValorUnitario) out.push('valor_unitario');
  if (linha.divergQtde) out.push('qtde');
  if (linha.divergValorTotal) out.push('valor_total');
  if (linha.divergIpi) out.push('ipi');
  return out;
}

function valoresCampo(
  linha: DoubleCheckInComparativoLinha,
  campo: DoubleCheckInCampoComparativo
): { nf: number; pc: number; fmt: (n: number) => string } {
  switch (campo) {
    case 'valor_unitario':
      return { nf: linha.valorUnitarioNF, pc: linha.valorUnitarioPC, fmt: fmtBrl };
    case 'qtde':
      return { nf: linha.qtdeNF, pc: linha.qtdePC, fmt: fmtNum };
    case 'valor_total':
      return { nf: linha.valorTotalNF, pc: linha.valorTotalPC, fmt: fmtBrl };
    case 'ipi':
      return { nf: linha.valorIpiNF, pc: linha.valorIpiPC, fmt: fmtBrl };
  }
}

function validarDecisoesCompletas(
  linhas: DoubleCheckInComparativoLinha[],
  decisoes: DoubleCheckInComparativoDecisaoRow[]
): { ok: true } | { ok: false; pendentes: number; error: string } {
  const map = new Map(
    decisoes.map((d) => [chaveDecisao(d.idItemDocumentoEstoque, d.idItemPedidoCompra, d.campo), d])
  );
  let pendentes = 0;
  for (const linha of linhas) {
    for (const campo of camposDivergentesDaLinha(linha)) {
      if (!map.has(chaveDecisao(linha.idItemDocumentoEstoque, linha.idItemPedidoCompra, campo))) {
        pendentes += 1;
      }
    }
  }
  if (pendentes > 0) {
    return {
      ok: false,
      pendentes,
      error: `Há ${pendentes} divergência(s) NF × PC sem decisão (aceitar/recusar + justificativa).`,
    };
  }
  return { ok: true };
}

function montarMensagemNfPc(params: {
  meta: {
    numeroNfe: string | null;
    numeroDocumentoFiscal: string | null;
    nomeParceiro: string | null;
  };
  conferidoPor: string;
  linhas: DoubleCheckInComparativoLinha[];
  decisoes: DoubleCheckInComparativoDecisaoRow[];
}): string | null {
  const map = new Map(
    params.decisoes.map((d) => [
      chaveDecisao(d.idItemDocumentoEstoque, d.idItemPedidoCompra, d.campo),
      d,
    ])
  );
  const bullets: string[] = [];
  for (const linha of params.linhas) {
    const prod =
      linha.codigoProduto ??
      (linha.idProduto != null ? String(linha.idProduto) : 'Produto');
    for (const campo of camposDivergentesDaLinha(linha)) {
      const dec = map.get(
        chaveDecisao(linha.idItemDocumentoEstoque, linha.idItemPedidoCompra, campo)
      );
      if (!dec) continue;
      const v = valoresCampo(linha, campo);
      const um =
        campo === 'qtde'
          ? ` (${linha.umNF ?? '—'} / ${linha.umPC ?? '—'})`
          : '';
      const pcLabel = linha.nomePedidoCompra ?? (linha.idPedidoCompra != null ? `PC ${linha.idPedidoCompra}` : 'PC');
      bullets.push(
        `• ${prod} · ${pcLabel} — ${CAMPO_LABEL[campo]}${um}: NF ${v.fmt(v.nf)} × PC ${v.fmt(v.pc)} — ` +
          `${dec.decisao === 'aceita' ? 'ACEITA' : 'RECUSADA'} — ${dec.justificativaLabel}` +
          (dec.observacao ? ` (${dec.observacao})` : '')
      );
    }
  }
  if (bullets.length === 0) return null;
  return [
    '*Double CheckIn — NF × Pedido de compra*',
    `NF/Doc: ${params.meta.numeroNfe ?? '—'} / ${params.meta.numeroDocumentoFiscal ?? '—'}`,
    `Parceiro: ${params.meta.nomeParceiro ?? '—'}`,
    `Conferido por: ${params.conferidoPor}`,
    '',
    'Divergências:',
    ...bullets.slice(0, 20),
    bullets.length > 20 ? `… e mais ${bullets.length - 20} divergência(s).` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export type DoubleCheckInNotaComConferencia = DoubleCheckInNota & {
  conferido: boolean;
  conferidoEm: string | null;
  conferidoPor: string | null;
};

async function enriquecerNotasComConferencia(
  notas: DoubleCheckInNota[]
): Promise<DoubleCheckInNotaComConferencia[]> {
  const map = await listarDocumentosConferidos(notas.map((n) => n.idDocumento));
  return notas.map((n) => {
    const c = map.get(n.idDocumento);
    return {
      ...n,
      conferido: Boolean(c),
      conferidoEm: c?.conferidoEm ?? null,
      conferidoPor: c?.usuarioLogin ?? null,
    };
  });
}

/**
 * GET /api/compras/double-checkin/notas?dataInicio=&dataFim=
 * Período filtra por dataEntrada do documentoestoque.
 */
export async function getDoubleCheckInNotas(req: Request, res: Response): Promise<void> {
  const dataInicio = parseYmd(req.query.dataInicio) ?? '2024-01-01';
  const dataFim = parseYmd(req.query.dataFim);
  if (!dataFim) {
    res.status(400).json({ error: 'Informe dataFim (YYYY-MM-DD).' });
    return;
  }
  if (dataFim < dataInicio) {
    res.status(400).json({ error: 'dataFim deve ser >= dataInicio.' });
    return;
  }

  const { notas, erro } = await queryDoubleCheckInNotas({ dataInicio, dataFim });
  if (erro) {
    res.status(503).json({ notas: [], erro, error: erro });
    return;
  }
  const notasComConf = await enriquecerNotasComConferencia(notas);
  res.json({ notas: notasComConf, dataInicio, dataFim });
}

/**
 * GET /api/compras/double-checkin/notas/:idDocumento/itens
 */
export async function getDoubleCheckInItens(req: Request, res: Response): Promise<void> {
  const idDocumento = Math.trunc(Number(req.params.idDocumento));
  if (!Number.isFinite(idDocumento) || idDocumento <= 0) {
    res.status(400).json({ error: 'idDocumento inválido.' });
    return;
  }
  const limiarPct = await getDoubleCheckInLimiarPct();
  const { itens, dataEmissao, erro } = await queryDoubleCheckInItens({ idDocumento, limiarPct });
  if (erro) {
    res.status(503).json({ itens: [], limiarPct, erro, error: erro });
    return;
  }
  res.json({ itens, dataEmissao, limiarPct, idDocumento });
}

/**
 * GET /api/compras/double-checkin/notas/:idDocumento/comparativo-pc
 */
export async function getDoubleCheckInComparativoPc(req: Request, res: Response): Promise<void> {
  const idDocumento = Math.trunc(Number(req.params.idDocumento));
  if (!Number.isFinite(idDocumento) || idDocumento <= 0) {
    res.status(400).json({ error: 'idDocumento inválido.' });
    return;
  }
  try {
    await ensureDoubleCheckInJustificativaOpcoes();
    const [{ linhas, erro }, decisoes, justificativas] = await Promise.all([
      queryDoubleCheckInComparativoPc({ idDocumento }),
      listarDecisoesComparativo(idDocumento),
      listarJustificativaOpcoes(true),
    ]);
    if (erro) {
      res.status(503).json({ linhas: [], decisoes: [], justificativas, erro, error: erro });
      return;
    }
    const validacao = validarDecisoesCompletas(linhas, decisoes);
    res.json({
      linhas,
      decisoes,
      justificativas,
      pendentes: validacao.ok ? 0 : validacao.pendentes,
      idDocumento,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[getDoubleCheckInComparativoPc]', msg);
    res.status(503).json({ error: msg });
  }
}

/**
 * PUT /api/compras/double-checkin/comparativo-decisao
 * body: { idDocumento, idItemDocumentoEstoque, idItemPedidoCompra, campo, decisao, justificativaOpcaoId, observacao? }
 */
export async function putDoubleCheckInComparativoDecisao(req: Request, res: Response): Promise<void> {
  const login = req.user?.login;
  if (!login) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }
  const idDocumento = Math.trunc(Number(req.body?.idDocumento));
  const idItemDocumentoEstoque = Math.trunc(Number(req.body?.idItemDocumentoEstoque));
  const idItemPedidoCompra = Math.trunc(Number(req.body?.idItemPedidoCompra));
  const campo = String(req.body?.campo ?? '').trim() as DoubleCheckInCampoComparativo;
  const decisaoRaw = String(req.body?.decisao ?? '').trim();
  const justificativaOpcaoId = Math.trunc(Number(req.body?.justificativaOpcaoId));
  const observacao =
    typeof req.body?.observacao === 'string' ? req.body.observacao : null;

  if (!Number.isFinite(idDocumento) || idDocumento <= 0) {
    res.status(400).json({ error: 'idDocumento inválido.' });
    return;
  }
  if (!Number.isFinite(idItemDocumentoEstoque) || idItemDocumentoEstoque <= 0) {
    res.status(400).json({ error: 'idItemDocumentoEstoque inválido.' });
    return;
  }
  if (!Number.isFinite(idItemPedidoCompra) || idItemPedidoCompra <= 0) {
    res.status(400).json({ error: 'idItemPedidoCompra inválido.' });
    return;
  }
  if (!(DOUBLE_CHECKIN_CAMPOS as readonly string[]).includes(campo)) {
    res.status(400).json({ error: 'campo inválido.' });
    return;
  }
  if (decisaoRaw !== 'aceita' && decisaoRaw !== 'recusa') {
    res.status(400).json({ error: 'decisao deve ser aceita ou recusa.' });
    return;
  }
  if (!Number.isFinite(justificativaOpcaoId) || justificativaOpcaoId <= 0) {
    res.status(400).json({ error: 'justificativaOpcaoId inválido.' });
    return;
  }

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { login },
      select: { id: true, login: true },
    });
    if (!usuario) {
      res.status(401).json({ error: 'Usuário não encontrado.' });
      return;
    }
    const ja = await getDocumentoConferido(idDocumento);
    if (ja) {
      res.status(400).json({ error: 'NF já conferida — decisões não podem ser alteradas.' });
      return;
    }
    const decisao = await upsertDecisaoComparativo({
      idDocumentoEstoque: idDocumento,
      idItemDocumentoEstoque,
      idItemPedidoCompra,
      campo,
      decisao: decisaoRaw,
      justificativaOpcaoId,
      observacao,
      usuarioId: usuario.id,
      usuarioLogin: usuario.login,
    });
    res.json({ ok: true, decisao });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
}

/**
 * GET /api/compras/double-checkin/justificativas
 */
export async function getDoubleCheckInJustificativas(_req: Request, res: Response): Promise<void> {
  try {
    const justificativas = await listarJustificativaOpcoes(true);
    res.json({ justificativas });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(503).json({ error: msg });
  }
}

/**
 * POST /api/compras/double-checkin/status  body: { ids: number[] }
 * Status fora-limiar para IDs da página (mesma regra do modal).
 */
export async function postDoubleCheckInStatus(req: Request, res: Response): Promise<void> {
  const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const ids = rawIds.map((n: unknown) => Math.trunc(Number(n))).filter((n: number) => n > 0);
  if (ids.length === 0) {
    res.status(400).json({ error: 'Informe ids (array de idDocumento).' });
    return;
  }
  const limiarPct = await getDoubleCheckInLimiarPct();
  const { status, erro } = await queryDoubleCheckInStatus({ ids, limiarPct });
  if (erro) {
    res.status(503).json({ status: [], limiarPct, erro, error: erro });
    return;
  }
  res.json({ status, limiarPct });
}

/**
 * GET /api/compras/double-checkin/dashboard?dataInicio=&dataFim=
 */
export async function getDoubleCheckInDashboard(req: Request, res: Response): Promise<void> {
  const dataInicio = parseYmd(req.query.dataInicio);
  const dataFim = parseYmd(req.query.dataFim);
  if (!dataInicio || !dataFim) {
    res.status(400).json({ error: 'Informe dataInicio e dataFim (YYYY-MM-DD).' });
    return;
  }
  if (dataFim < dataInicio) {
    res.status(400).json({ error: 'dataFim deve ser >= dataInicio.' });
    return;
  }

  try {
    const [conferidos, idsComAtencao] = await Promise.all([
      listarTodosDocumentosConferidos(),
      listarIdsComAtencaoDetectada(),
    ]);
    const confMap = new Map<number, { conferidoEm: string }>();
    for (const [id, c] of conferidos) {
      confMap.set(id, { conferidoEm: c.conferidoEm });
    }
    const { data, erro } = await queryDoubleCheckInDashboard({
      dataInicio,
      dataFim,
      conferidos: confMap,
      idsComAtencao,
    });
    if (erro || !data) {
      res.status(503).json({ error: erro ?? 'Falha ao montar dashboard.', erro });
      return;
    }
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[getDoubleCheckInDashboard]', msg);
    res.status(503).json({ error: msg });
  }
}

/**
 * POST /api/compras/double-checkin/conferir
 * body: { idDocumento, senha, numeroNfe?, numeroDocumentoFiscal?, nomeParceiro? }
 * Bloqueia se houver divergência NF×PC sem decisão. Envia WhatsApp só das divergências.
 */
export async function postDoubleCheckInConferir(req: Request, res: Response): Promise<void> {
  const idDocumento = Math.trunc(Number(req.body?.idDocumento));
  const senha = typeof req.body?.senha === 'string' ? req.body.senha.trim() : '';
  if (!Number.isFinite(idDocumento) || idDocumento <= 0) {
    res.status(400).json({ error: 'idDocumento inválido.' });
    return;
  }
  if (!senha) {
    res.status(400).json({ error: 'Informe sua senha para confirmar a conferência.' });
    return;
  }
  const login = req.user?.login;
  if (!login) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { login },
      select: { id: true, login: true, senhaHash: true },
    });
    if (!usuario) {
      res.status(401).json({ error: 'Usuário não encontrado.' });
      return;
    }
    const senhaOk = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaOk) {
      res.status(401).json({ error: 'Senha incorreta. Não foi possível confirmar a conferência.' });
      return;
    }

    const ja = await getDocumentoConferido(idDocumento);
    if (ja) {
      res.json({
        ok: true,
        jaConferido: true,
        conferido: true,
        conferidoEm: ja.conferidoEm,
        conferidoPor: ja.usuarioLogin,
        idDocumento,
      });
      return;
    }

    const { linhas, erro: erroComp } = await queryDoubleCheckInComparativoPc({ idDocumento });
    if (erroComp) {
      res.status(503).json({ error: erroComp });
      return;
    }
    const decisoes = await listarDecisoesComparativo(idDocumento);
    const validacao = validarDecisoesCompletas(linhas, decisoes);
    if (!validacao.ok) {
      res.status(400).json({ error: validacao.error, pendentes: validacao.pendentes });
      return;
    }

    const created = await marcarDocumentoConferido({
      idDocumentoEstoque: idDocumento,
      usuarioId: usuario.id,
      usuarioLogin: usuario.login,
    });

    let alertaNfPcEnviado = false;
    try {
      await ensureDoubleCheckInNfPcWhatsappTipo();
      const textoFinal = montarMensagemNfPc({
        meta: {
          numeroNfe: typeof req.body?.numeroNfe === 'string' ? req.body.numeroNfe : null,
          numeroDocumentoFiscal:
            typeof req.body?.numeroDocumentoFiscal === 'string'
              ? req.body.numeroDocumentoFiscal
              : null,
          nomeParceiro: typeof req.body?.nomeParceiro === 'string' ? req.body.nomeParceiro : null,
        },
        conferidoPor: created.usuarioLogin,
        linhas,
        decisoes,
      });
      if (textoFinal) {
        await enviarNotificacaoPorTipo(DOUBLE_CHECKIN_NF_PC_WA_CODE, textoFinal);
        alertaNfPcEnviado = true;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[postDoubleCheckInConferir] alerta NF×PC', msg);
    }

    res.status(201).json({
      ok: true,
      jaConferido: false,
      conferido: true,
      conferidoEm: created.conferidoEm,
      conferidoPor: created.usuarioLogin,
      idDocumento,
      alertaNfPcEnviado,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[postDoubleCheckInConferir]', msg);
    res.status(503).json({ error: msg });
  }
}

/**
 * GET /api/compras/double-checkin/parametros
 */
export async function getDoubleCheckInParametros(_req: Request, res: Response): Promise<void> {
  const [limiarPct, alertaDesde] = await Promise.all([
    getDoubleCheckInLimiarPct(),
    getOrCreateDoubleCheckInAlertaDesdeYmd(),
  ]);
  res.json({ limiarPct, alertaDesde });
}

/**
 * PUT /api/compras/double-checkin/parametros  body: { limiarPct }
 */
export async function putDoubleCheckInParametros(req: Request, res: Response): Promise<void> {
  try {
    const limiarPct = await setDoubleCheckInLimiarPct(Number(req.body?.limiarPct));
    res.json({ limiarPct });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
}

/**
 * GET /api/compras/double-checkin/destinatarios
 */
export async function getDoubleCheckInDestinatariosCtrl(_req: Request, res: Response): Promise<void> {
  try {
    const data = await getDoubleCheckInDestinatarios();
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[getDoubleCheckInDestinatarios]', msg);
    res.status(503).json({ error: msg });
  }
}

/**
 * PUT /api/compras/double-checkin/destinatarios  body: { usuarioIds, grupos? }
 */
export async function putDoubleCheckInDestinatarios(req: Request, res: Response): Promise<void> {
  try {
    const usuarioIds = Array.isArray(req.body?.usuarioIds)
      ? req.body.usuarioIds.map((n: unknown) => Math.trunc(Number(n))).filter((n: number) => n > 0)
      : [];
    const grupos = Array.isArray(req.body?.grupos) ? req.body.grupos : [];
    const data = await setDoubleCheckInDestinatarios(usuarioIds, grupos);
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
}

/**
 * POST /api/compras/double-checkin/sincronizar
 * body/query: dataInicio, dataFim (filtro por dataEntrada)
 * Retorna notas + processa alertas WhatsApp só para NFs com emissão >= go-live.
 * Histórico anterior é marcado sem envio (evita flood / bloqueio do número).
 */
export async function postDoubleCheckInSincronizar(req: Request, res: Response): Promise<void> {
  const dataInicio =
    parseYmd(req.body?.dataInicio) ?? parseYmd(req.query.dataInicio) ?? '2024-01-01';
  const dataFim = parseYmd(req.body?.dataFim) ?? parseYmd(req.query.dataFim);
  if (!dataFim) {
    res.status(400).json({ error: 'Informe dataFim (YYYY-MM-DD).' });
    return;
  }
  if (dataFim < dataInicio) {
    res.status(400).json({ error: 'dataFim deve ser >= dataInicio.' });
    return;
  }

  const { notas, erro } = await queryDoubleCheckInNotas({ dataInicio, dataFim });
  if (erro) {
    res.status(503).json({
      notas: [],
      alertasEnviados: 0,
      alertasIgnorados: 0,
      alertasBaseline: 0,
      erro,
      error: erro,
    });
    return;
  }

  const [limiarPct, alertaDesde] = await Promise.all([
    getDoubleCheckInLimiarPct(),
    getOrCreateDoubleCheckInAlertaDesdeYmd(),
  ]);
  const ids = notas.map((n) => n.idDocumento);
  const jaAlertados = await listarDocumentosJaAlertados(ids);
  const candidatos = notas.filter((n) => !jaAlertados.has(n.idDocumento));

  const historicos = candidatos.filter((n) => !n.dataEmissao || n.dataEmissao < alertaDesde);
  const elegiveis = candidatos.filter((n) => n.dataEmissao != null && n.dataEmissao >= alertaDesde);

  let alertasEnviados = 0;
  let alertasIgnorados = 0;
  let alertasBaseline = 0;
  const errosAlerta: string[] = [];

  // Histórico: só marca (sem Nomus/WA) — limpa backlog de uma vez.
  for (const nota of historicos) {
    try {
      await marcarAlertaEnviado(nota.idDocumento, `baseline-sem-envio(<${alertaDesde})`);
      alertasBaseline += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errosAlerta.push(`Doc ${nota.idDocumento}: ${msg}`);
    }
  }

  // Limita análise Nomus por sync (mais recentes primeiro na query).
  const MAX_ANALISE = 40;
  for (const nota of elegiveis.slice(0, MAX_ANALISE)) {
    try {
      const analise = await analisarOutliersDocumento({
        idDocumento: nota.idDocumento,
        limiarPct,
      });
      if (analise.erro) {
        errosAlerta.push(`Doc ${nota.idDocumento}: ${analise.erro}`);
        continue;
      }
      if (!analise.temOutlier || analise.outliers.length === 0) {
        await marcarAlertaEnviado(nota.idDocumento, 'sem-outlier');
        alertasIgnorados += 1;
        continue;
      }

      const meta = analise.meta;
      const linhasOut = analise.outliers
        .slice(0, 8)
        .map(
          (o) =>
            `• ${o.descricao}: ${fmtBrl(o.valorUnitario)} (${fmtPct(o.variacaoPct)}` +
            (o.valorAnterior != null ? ` vs ${fmtBrl(o.valorAnterior)}` : '') +
            ')'
        )
        .join('\n');
      const texto = [
        '*Double CheckIn — variação de preço*',
        `NF/Doc: ${meta.numeroNfe ?? '—'} / ${meta.numeroDocumentoFiscal ?? '—'}`,
        `Emissão: ${meta.dataEmissao ?? '—'}`,
        `Parceiro: ${meta.nomeParceiro ?? '—'}`,
        `Limiar: ±${limiarPct}%`,
        '',
        'Itens fora do parâmetro:',
        linhasOut,
        analise.outliers.length > 8 ? `… e mais ${analise.outliers.length - 8} item(ns).` : '',
      ]
        .filter(Boolean)
        .join('\n');

      await enviarNotificacaoPorTipo(DOUBLE_CHECKIN_WA_CODE, texto);
      await marcarAlertaEnviado(
        nota.idDocumento,
        analise.outliers.map((o) => `${o.idProduto}:${o.variacaoPct.toFixed(1)}%`).join('; ')
      );
      alertasEnviados += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errosAlerta.push(`Doc ${nota.idDocumento}: ${msg}`);
      console.error('[postDoubleCheckInSincronizar] alerta', msg);
    }
  }

  const notasComConf = await enriquecerNotasComConferencia(notas);

  res.json({
    notas: notasComConf,
    dataInicio,
    dataFim,
    limiarPct,
    alertaDesde,
    alertasEnviados,
    alertasIgnorados,
    alertasBaseline,
    candidatosAnalisados: Math.min(elegiveis.length, MAX_ANALISE),
    candidatosPendentes: Math.max(0, elegiveis.length - MAX_ANALISE),
    errosAlerta: errosAlerta.length > 0 ? errosAlerta.slice(0, 10) : undefined,
  });
}
