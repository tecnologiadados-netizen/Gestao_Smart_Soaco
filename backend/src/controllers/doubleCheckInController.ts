/**
 * Double CheckIn — endpoints da tela de conferência de entradas.
 */

import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import {
  analisarOutliersDocumento,
  queryDoubleCheckInComparativoPc,
  queryDoubleCheckInDataEntrada,
  queryDoubleCheckInDashboard,
  queryDoubleCheckInItens,
  queryDoubleCheckInNotas,
  queryDoubleCheckInStatus,
  queryLinhasComparativoPorDocumentos,
  type DoubleCheckInComparativoLinha,
  type DoubleCheckInNota,
} from '../data/doubleCheckInRepository.js';
import {
  DOUBLE_CHECKIN_CAMPOS,
  DOUBLE_CHECKIN_NF_PC_WA_CODE,
  DOUBLE_CHECKIN_WA_CODE,
  atualizarClassificacaoHistoricaConferencia,
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
  criarJustificativaOpcao,
  atualizarJustificativaOpcao,
  excluirJustificativaOpcao,
  listarTodosDocumentosConferidos,
  marcarAlertaEnviado,
  marcarDocumentoConferido,
  reabrirDocumentoConferencia,
  salvarConferenciaPagina,
  setDoubleCheckInDestinatarios,
  setDoubleCheckInLimiarPct,
  upsertDecisaoComparativo,
  adicionarObservacaoComparativoPosConferido,
  type DoubleCheckInCampoComparativo,
  type DoubleCheckInComparativoDecisaoRow,
} from '../data/doubleCheckInLocalRepository.js';
import { resolveAppBaseUrl } from '../config/appBaseUrl.js';
import { registrarDivergenciasApontadas } from '../data/doubleCheckInDivergenciaApontada.js';
import {
  montarMensagemConferenciaWhatsApp,
  montarRelatoConferencia,
  temDivergenciaReal,
} from '../services/doubleCheckInConferenciaRelato.js';
import {
  classificarNaturezaDivergencia,
  observacaoNaturezaDivergencia,
  type NaturezaDivergencia,
} from '../services/doubleCheckInNatureza.js';
import { enviarNotificacaoPorTipo } from '../services/whatsappNotificacaoService.js';
import { contarPendentesComparativoLogica } from '../utils/doubleCheckInPendencias.js';
import {
  regimeConferenciaPorDataEntrada,
  type RegimeConferenciaDoubleCheck,
} from '../services/doubleCheckInConferenciaPeriodo.js';
import { conferenciaDoubleCheckLiberadaParaMesa } from '../services/mesaDoubleCheckGate.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function validarDecisoesCompletas(
  linhas: DoubleCheckInComparativoLinha[],
  decisoes: DoubleCheckInComparativoDecisaoRow[]
): { ok: true } | { ok: false; pendentes: number; error: string } {
  const pendentes = contarPendentesComparativoLogica(
    linhas,
    decisoes.filter((decisao) => decisao.vigente !== false)
  );
  if (pendentes > 0) {
    return {
      ok: false,
      pendentes,
      error: `Há ${pendentes} divergência(s) NF × PC sem decisão (aceitar/recusar + justificativa).`,
    };
  }
  return { ok: true };
}

type DecisaoParaNatureza = Pick<
  DoubleCheckInComparativoDecisaoRow,
  'idItemDocumentoEstoque' | 'idItemPedidoCompra' | 'campo' | 'justificativaCodigo'
> & Pick<Partial<DoubleCheckInComparativoDecisaoRow>, 'vigente'
>;

function linhasComNatureza(
  linhas: DoubleCheckInComparativoLinha[],
  decisoes: DecisaoParaNatureza[]
): Array<DoubleCheckInComparativoLinha & {
  naturezaDivergencias: Partial<Record<DoubleCheckInCampoComparativo, NaturezaDivergencia>>;
  observacaoNaturezaDivergencias: Partial<Record<DoubleCheckInCampoComparativo, string>>;
}> {
  const decisoesMap = new Map(
    decisoes.map((d) => [
      `${d.idItemDocumentoEstoque}:${d.idItemPedidoCompra}:${d.campo}`,
      d,
    ])
  );
  return linhas.map((linha) => {
    const naturezaDivergencias: Partial<
      Record<DoubleCheckInCampoComparativo, NaturezaDivergencia>
    > = {};
    const observacaoNaturezaDivergencias: Partial<
      Record<DoubleCheckInCampoComparativo, string>
    > = {};
    for (const campo of DOUBLE_CHECKIN_CAMPOS) {
      const flag =
        campo === 'valor_unitario'
          ? linha.divergValorUnitario
          : campo === 'qtde'
            ? linha.divergQtde
            : campo === 'ipi'
              ? linha.divergIpi
              : linha.divergCondicaoPagamento;
      if (!flag) continue;
      const decisao = decisoesMap.get(
        `${linha.idItemDocumentoEstoque}:${linha.idItemPedidoCompra}:${campo}`
      );
      naturezaDivergencias[campo] = classificarNaturezaDivergencia({
        linha,
        campo,
        justificativaCodigo: decisao?.vigente === false ? null : decisao?.justificativaCodigo,
      });
      const obs = observacaoNaturezaDivergencia({ linha, campo });
      if (obs) observacaoNaturezaDivergencias[campo] = obs;
    }
    return { ...linha, naturezaDivergencias, observacaoNaturezaDivergencias };
  });
}

type ResumoDivergenciasAtuais = {
  temQualquer: boolean;
  temReal: boolean;
  temBenigna: boolean;
  pendencias: number;
};

async function carregarResumosDivergenciasAtuais(
  ids: number[]
): Promise<Map<number, ResumoDivergenciasAtuais>> {
  const resumos = new Map<number, ResumoDivergenciasAtuais>();
  if (ids.length === 0) return resumos;

  const [linhasResp, decisoesRaw] = await Promise.all([
    queryLinhasComparativoPorDocumentos(ids),
    prisma.doubleCheckInComparativoDecisao.findMany({
      where: { idDocumentoEstoque: { in: ids } },
      select: {
        idDocumentoEstoque: true,
        idItemDocumentoEstoque: true,
        idItemPedidoCompra: true,
        campo: true,
        justificativaOpcao: { select: { codigo: true } },
      },
    }),
  ]);
  if (linhasResp.erro) throw new Error(linhasResp.erro);

  const decisoesPorDocumento = new Map<number, DecisaoParaNatureza[]>();
  for (const decisao of decisoesRaw) {
    const lista = decisoesPorDocumento.get(decisao.idDocumentoEstoque) ?? [];
    lista.push({
      idItemDocumentoEstoque: decisao.idItemDocumentoEstoque,
      idItemPedidoCompra: decisao.idItemPedidoCompra,
      campo: decisao.campo as DoubleCheckInCampoComparativo,
      justificativaCodigo: decisao.justificativaOpcao.codigo,
    });
    decisoesPorDocumento.set(decisao.idDocumentoEstoque, lista);
  }

  await registrarDivergenciasApontadas(linhasResp.linhasPorDocumento);

  for (const id of ids) {
    const linhas = linhasResp.linhasPorDocumento.get(id) ?? [];
    const naturezas = linhasComNatureza(linhas, decisoesPorDocumento.get(id) ?? [])
      .flatMap((linha) => Object.values(linha.naturezaDivergencias));
    resumos.set(id, {
      temQualquer: linhas.some((linha) => linha.temDivergencia),
      temReal: naturezas.includes('real'),
      temBenigna: naturezas.includes('benigna'),
      pendencias: contarPendentesComparativoLogica(
        linhas,
        decisoesPorDocumento.get(id) ?? []
      ),
    });
  }
  return resumos;
}

export type DoubleCheckInNotaComConferencia = DoubleCheckInNota & {
  regimeConferencia: RegimeConferenciaDoubleCheck;
  conferido: boolean;
  conferidoEm: string | null;
  conferidoPor: string | null;
  /** Tinha conferência, mas uma divergência atual ainda não possui decisão. */
  conferenciaReaberta: boolean;
  /** Conferido e a NF ainda diverge do pedido de compra. */
  conferidoComDivergencia: boolean;
  temDivergenciaRealAtual: boolean;
  temDivergenciaBenignaAtual: boolean;
  temDivergenciaRealHistorica: boolean;
  totalDivergenciasReaisHistorica: number;
};

async function enriquecerNotasComConferencia(
  notas: DoubleCheckInNota[]
): Promise<DoubleCheckInNotaComConferencia[]> {
  const ids = notas.map((n) => n.idDocumento);
  const idsConferenciaCompleta = notas
    .filter((n) => regimeConferenciaPorDataEntrada(n.dataEntrada) === 'completa')
    .map((n) => n.idDocumento);
  const [map, resumosAtuais] = await Promise.all([
    listarDocumentosConferidos(ids),
    carregarResumosDivergenciasAtuais(idsConferenciaCompleta),
  ]);
  return notas.map((n) => {
    const regimeConferencia = regimeConferenciaPorDataEntrada(n.dataEntrada);
    const c = map.get(n.idDocumento);
    const atual = resumosAtuais.get(n.idDocumento);
    const pendencias = Number(atual?.pendencias ?? 0);
    const conferenciaReaberta =
      regimeConferencia !== 'nao_aplicada' &&
      Boolean(c) &&
      regimeConferencia === 'completa' &&
      pendencias > 0;
    const conferido = conferenciaDoubleCheckLiberadaParaMesa({
      regime: regimeConferencia,
      possuiConferenciaValida: Boolean(c),
      pendenciasSemDecisao: pendencias,
    }) && regimeConferencia !== 'nao_aplicada';
    return {
      ...n,
      regimeConferencia,
      conferido,
      conferidoEm: c?.conferidoEm ?? null,
      conferidoPor: c?.usuarioLogin ?? null,
      conferenciaReaberta,
      conferidoComDivergencia:
        regimeConferencia === 'completa' && conferido && Boolean(atual?.temQualquer),
      temDivergenciaRealAtual:
        regimeConferencia === 'completa' && Boolean(atual?.temReal),
      temDivergenciaBenignaAtual:
        regimeConferencia === 'completa' && Boolean(atual?.temBenigna),
      temDivergenciaRealHistorica: Boolean(c?.temDivergenciaRealHistorica),
      totalDivergenciasReaisHistorica: c?.totalDivergenciasReaisHistorica ?? 0,
    };
  });
}

/**
 * Documentos cuja conferência no Double Check já libera a Mesa.
 * Entrada anterior a 19/09/2026 entra no conjunto: essa etapa não se aplica.
 */
export async function listarIdsConferenciaDoubleCheckConcluida(
  docs: Array<{ idDocumento: number; dataEntrada: string | null }>
): Promise<Set<number>> {
  const ids = [...new Set(docs.map((d) => d.idDocumento).filter((id) => id > 0))];
  const conferidos = await listarDocumentosConferidos(ids);
  const completaComRegistro = docs
    .filter(
      (d) =>
        conferidos.has(d.idDocumento) &&
        regimeConferenciaPorDataEntrada(d.dataEntrada) === 'completa'
    )
    .map((d) => d.idDocumento);
  const resumos = await carregarResumosDivergenciasAtuais([...new Set(completaComRegistro)]);
  const liberados = new Set<number>();
  for (const doc of docs) {
    const regime = regimeConferenciaPorDataEntrada(doc.dataEntrada);
    const ok = conferenciaDoubleCheckLiberadaParaMesa({
      regime,
      possuiConferenciaValida: conferidos.has(doc.idDocumento),
      pendenciasSemDecisao: resumos.get(doc.idDocumento)?.pendencias ?? 0,
    });
    if (ok) liberados.add(doc.idDocumento);
  }
  return liberados;
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
    const [{ linhas, erro }, decisoes, justificativas, dataDocumento] = await Promise.all([
      queryDoubleCheckInComparativoPc({ idDocumento }),
      listarDecisoesComparativo(idDocumento),
      listarJustificativaOpcoes(true),
      queryDoubleCheckInDataEntrada(idDocumento),
    ]);
    if (erro) {
      res.status(503).json({ linhas: [], decisoes: [], justificativas, erro, error: erro });
      return;
    }
    if (regimeConferenciaPorDataEntrada(dataDocumento.dataEntrada) === 'completa') {
      await registrarDivergenciasApontadas(new Map([[idDocumento, linhas]]));
    }
    const validacao = validarDecisoesCompletas(linhas, decisoes);
    res.json({
      linhas: linhasComNatureza(linhas, decisoes),
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
    const dataDocumento = await queryDoubleCheckInDataEntrada(idDocumento);
    if (dataDocumento.erro) {
      res.status(503).json({ error: dataDocumento.erro });
      return;
    }
    if (regimeConferenciaPorDataEntrada(dataDocumento.dataEntrada) !== 'completa') {
      res.status(400).json({
        error:
          'Para entradas anteriores a 21/09/2026, o comparativo NF × PC é somente leitura.',
      });
      return;
    }

    const usuario = await prisma.usuario.findUnique({
      where: { login },
      select: { id: true, login: true },
    });
    if (!usuario) {
      res.status(401).json({ error: 'Usuário não encontrado.' });
      return;
    }
    const ja = await getDocumentoConferido(idDocumento);
    let decisoesAntes: DoubleCheckInComparativoDecisaoRow[] = [];
    if (ja) {
      decisoesAntes = await listarDecisoesComparativo(idDocumento);
      const decisaoExistente = decisoesAntes.find(
        (item) =>
          item.vigente !== false &&
          item.idItemDocumentoEstoque === idItemDocumentoEstoque &&
          item.idItemPedidoCompra === idItemPedidoCompra &&
          item.campo === campo
      );
      if (decisaoExistente) {
        res.status(400).json({
          error:
            'Esta divergência já possui decisão. Reabra a conferência para alterá-la.',
        });
        return;
      }
    }

    const baseParams = {
      idDocumentoEstoque: idDocumento,
      campo,
      decisao: decisaoRaw as 'aceita' | 'recusa',
      justificativaOpcaoId,
      observacao,
      usuarioId: usuario.id,
      usuarioLogin: usuario.login,
    };

    let decisao = await upsertDecisaoComparativo({
      ...baseParams,
      idItemDocumentoEstoque,
      idItemPedidoCompra,
    });

    // Cond. pagamento é do documento×PC: replica a decisão em todos os vínculos do mesmo PC.
    let decisoesReplicadas: DoubleCheckInComparativoDecisaoRow[] | undefined;
    if (campo === 'condicao_pagamento') {
      const { linhas } = await queryDoubleCheckInComparativoPc({ idDocumento });
      const origem = linhas.find(
        (l) =>
          l.idItemDocumentoEstoque === idItemDocumentoEstoque &&
          l.idItemPedidoCompra === idItemPedidoCompra
      );
      const idPc = origem?.idPedidoCompra ?? null;
      const irmaos = linhas.filter(
        (l) =>
          l.divergCondicaoPagamento &&
          l.idPedidoCompra === idPc &&
          !(
            l.idItemDocumentoEstoque === idItemDocumentoEstoque &&
            l.idItemPedidoCompra === idItemPedidoCompra
          )
      );
      if (irmaos.length > 0) {
        decisoesReplicadas = [];
        for (const irmao of irmaos) {
          const irmaoJaDecidido =
            Boolean(ja) &&
            decisoesAntes.some(
              (item) =>
                item.vigente !== false &&
                item.idItemDocumentoEstoque === irmao.idItemDocumentoEstoque &&
                item.idItemPedidoCompra === irmao.idItemPedidoCompra &&
                item.campo === campo
            );
          if (irmaoJaDecidido) continue;
          const d = await upsertDecisaoComparativo({
            ...baseParams,
            idItemDocumentoEstoque: irmao.idItemDocumentoEstoque,
            idItemPedidoCompra: irmao.idItemPedidoCompra,
          });
          decisoesReplicadas.push(d);
        }
      }
    }

    res.json({
      ok: true,
      decisao,
      decisoesReplicadas: decisoesReplicadas ?? [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
}

/**
 * POST /api/compras/double-checkin/comparativo-observacao
 * Acrescenta observação ao histórico após a NF já conferida.
 * body: { idDocumento, idItemDocumentoEstoque, idItemPedidoCompra, campo, texto }
 */
export async function postDoubleCheckInComparativoObservacao(
  req: Request,
  res: Response
): Promise<void> {
  const login = req.user?.login;
  if (!login) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }
  const idDocumento = Math.trunc(Number(req.body?.idDocumento));
  const idItemDocumentoEstoque = Math.trunc(Number(req.body?.idItemDocumentoEstoque));
  const idItemPedidoCompra = Math.trunc(Number(req.body?.idItemPedidoCompra));
  const campo = String(req.body?.campo ?? '').trim() as DoubleCheckInCampoComparativo;
  const texto = typeof req.body?.texto === 'string' ? req.body.texto : '';

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
  if (!texto.trim()) {
    res.status(400).json({ error: 'Informe a observação.' });
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
    const result = await adicionarObservacaoComparativoPosConferido({
      idDocumentoEstoque: idDocumento,
      idItemDocumentoEstoque,
      idItemPedidoCompra,
      campo,
      texto,
      usuarioId: usuario.id,
      usuarioLogin: usuario.login,
    });
    res.json({ ok: true, entrada: result.entrada, decisao: result.decisao });
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

/** GET /api/compras/double-checkin/justificativas/gestao — inclui inativos. */
export async function getDoubleCheckInJustificativasGestao(_req: Request, res: Response): Promise<void> {
  try {
    const justificativas = await listarJustificativaOpcoes(false);
    res.json({ justificativas });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(503).json({ error: msg });
  }
}

/** POST /api/compras/double-checkin/justificativas */
export async function postDoubleCheckInJustificativa(req: Request, res: Response): Promise<void> {
  try {
    const justificativa = await criarJustificativaOpcao({
      label: String(req.body?.label ?? ''),
      campos: req.body?.campos,
      ativo: req.body?.ativo !== false,
    });
    res.status(201).json({ justificativa });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg === 'Motivo não encontrado.' ? 404 : 400;
    res.status(status).json({ error: msg });
  }
}

/** PUT /api/compras/double-checkin/justificativas/:id */
export async function putDoubleCheckInJustificativa(req: Request, res: Response): Promise<void> {
  const id = Math.trunc(Number(req.params.id));
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'Motivo inválido.' });
    return;
  }
  try {
    const justificativa = await atualizarJustificativaOpcao({
      id,
      label: String(req.body?.label ?? ''),
      campos: req.body?.campos,
      ativo: req.body?.ativo !== false,
    });
    res.json({ justificativa });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(msg === 'Motivo não encontrado.' ? 404 : 400).json({ error: msg });
  }
}

/** DELETE /api/compras/double-checkin/justificativas/:id */
export async function deleteDoubleCheckInJustificativa(req: Request, res: Response): Promise<void> {
  const id = Math.trunc(Number(req.params.id));
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: 'Motivo inválido.' });
    return;
  }
  try {
    await excluirJustificativaOpcao(id);
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg === 'Motivo não encontrado.' ? 404 : msg.includes('já foi usado') ? 409 : 400;
    res.status(status).json({ error: msg });
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
 * body: { idDocumento, senha, numeroNfe?, numeroDocumentoFiscal?, nomeParceiro?, reconferencia? }
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

    const dataDocumento = await queryDoubleCheckInDataEntrada(idDocumento);
    if (dataDocumento.erro) {
      res.status(503).json({ error: dataDocumento.erro });
      return;
    }
    const regimeConferencia = regimeConferenciaPorDataEntrada(dataDocumento.dataEntrada);
    if (regimeConferencia === 'nao_aplicada') {
      res.status(400).json({
        error: 'A conferência não se aplica a entradas até 18/09/2026.',
      });
      return;
    }

    const ja = await getDocumentoConferido(idDocumento);
    const reconferenciaSolicitada = Boolean(req.body?.reconferencia);
    if (regimeConferencia === 'simples') {
      const simples =
        ja && !reconferenciaSolicitada
          ? ja
          : await marcarDocumentoConferido({
              idDocumentoEstoque: idDocumento,
              usuarioId: usuario.id,
              usuarioLogin: usuario.login,
              renovar: Boolean(ja && reconferenciaSolicitada),
            });
      await atualizarClassificacaoHistoricaConferencia({
        idDocumentoEstoque: idDocumento,
        totalReais: 0,
        totalBenignas: 0,
        fonte: 'conferencia_simples',
      });
      res.status(ja && !reconferenciaSolicitada ? 200 : 201).json({
        ok: true,
        jaConferido: Boolean(ja && !reconferenciaSolicitada),
        reconferido: Boolean(ja && reconferenciaSolicitada),
        conferido: true,
        conferidoEm: simples.conferidoEm,
        conferidoPor: simples.usuarioLogin,
        conferidoComDivergencia: false,
        temDivergenciaRealAtual: false,
        temDivergenciaBenignaAtual: false,
        temDivergenciaRealHistorica: false,
        totalDivergenciasReaisHistorica: 0,
        idDocumento,
        alertaNfPcEnviado: false,
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

    if (ja && !reconferenciaSolicitada) {
      const resumoAtual = (await carregarResumosDivergenciasAtuais([idDocumento])).get(
        idDocumento
      );
      res.json({
        ok: true,
        jaConferido: true,
        conferido: true,
        conferidoEm: ja.conferidoEm,
        conferidoPor: ja.usuarioLogin,
        conferidoComDivergencia: Boolean(resumoAtual?.temQualquer),
        temDivergenciaRealAtual: Boolean(resumoAtual?.temReal),
        temDivergenciaBenignaAtual: Boolean(resumoAtual?.temBenigna),
        temDivergenciaRealHistorica: ja.temDivergenciaRealHistorica,
        totalDivergenciasReaisHistorica: ja.totalDivergenciasReaisHistorica,
        idDocumento,
      });
      return;
    }

    const created = await marcarDocumentoConferido({
      idDocumentoEstoque: idDocumento,
      usuarioId: usuario.id,
      usuarioLogin: usuario.login,
      renovar: Boolean(ja && reconferenciaSolicitada),
    });

    const conferidoComDivergencia = linhas.some((l) => l.temDivergencia);
    const relato = montarRelatoConferencia({
      meta: {
        numeroNfe: typeof req.body?.numeroNfe === 'string' ? req.body.numeroNfe : null,
        numeroDocumentoFiscal:
          typeof req.body?.numeroDocumentoFiscal === 'string'
            ? req.body.numeroDocumentoFiscal
            : null,
        nomeParceiro: typeof req.body?.nomeParceiro === 'string' ? req.body.nomeParceiro : null,
      },
      conferidoPor: created.usuarioLogin,
      conferidoEm: created.conferidoEm,
      linhas,
      decisoes,
    });
    const totalReaisHistorica = relato?.totalDivergenciasReais ?? 0;
    const totalBenignasHistorica = relato?.totalDivergenciasBenignas ?? 0;
    let alertaNfPcEnviado = false;
    try {
      await atualizarClassificacaoHistoricaConferencia({
        idDocumentoEstoque: idDocumento,
        totalReais: totalReaisHistorica,
        totalBenignas: totalBenignasHistorica,
        fonte: relato ? 'snapshot' : 'sem_decisoes',
      });
      let url: string | null = null;
      if (relato) {
        try {
          const token = await salvarConferenciaPagina(idDocumento, JSON.stringify(relato));
          url = `${resolveAppBaseUrl()}/c/${token}`;
        } catch (errPagina) {
          const msgPagina = errPagina instanceof Error ? errPagina.message : String(errPagina);
          console.error('[postDoubleCheckInConferir] página da conferência', msgPagina);
        }
      }
      if (relato && temDivergenciaReal(relato)) {
        await ensureDoubleCheckInNfPcWhatsappTipo();
        const mensagem = montarMensagemConferenciaWhatsApp(relato, url);
        if (mensagem) {
          await enviarNotificacaoPorTipo(DOUBLE_CHECKIN_NF_PC_WA_CODE, mensagem);
          alertaNfPcEnviado = true;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[postDoubleCheckInConferir] alerta NF×PC', msg);
    }

    res.status(201).json({
      ok: true,
      jaConferido: false,
      reconferido: Boolean(ja && reconferenciaSolicitada),
      conferido: true,
      conferidoEm: created.conferidoEm,
      conferidoPor: created.usuarioLogin,
      conferidoComDivergencia,
      temDivergenciaRealAtual: totalReaisHistorica > 0,
      temDivergenciaBenignaAtual: totalBenignasHistorica > 0,
      temDivergenciaRealHistorica: totalReaisHistorica > 0,
      totalDivergenciasReaisHistorica: totalReaisHistorica,
      idDocumento,
      alertaNfPcEnviado,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[postDoubleCheckInConferir]', msg);
    res.status(503).json({ error: msg });
  }
}

/** POST /api/compras/double-checkin/reabrir */
export async function postDoubleCheckInReabrir(req: Request, res: Response): Promise<void> {
  const idDocumento = Math.trunc(Number(req.body?.idDocumento));
  const login = req.user?.login;
  if (!Number.isFinite(idDocumento) || idDocumento <= 0) {
    res.status(400).json({ error: 'idDocumento inválido.' });
    return;
  }
  if (!login) {
    res.status(401).json({ error: 'Não autorizado.' });
    return;
  }
  const usuario = await prisma.usuario.findUnique({
    where: { login },
    select: { id: true, login: true },
  });
  if (!usuario) {
    res.status(401).json({ error: 'Usuário não encontrado.' });
    return;
  }
  try {
    const reabertura = await reabrirDocumentoConferencia({
      idDocumentoEstoque: idDocumento,
      usuarioId: usuario.id,
      usuarioLogin: usuario.login,
    });
    res.json({ ok: true, idDocumento, ...reabertura });
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    res.status(409).json({ error: mensagem });
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
