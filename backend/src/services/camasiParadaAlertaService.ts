/**
 * Avalia o estado ao vivo da Camasi e dispara o WhatsApp de parada (Integração → SMS).
 */

import { prisma } from '../config/prisma.js';
import {
  CAMASI_PARADA_ALERTA_WA_CODE,
  ensureCamasiParadaAlertaWhatsappTipo,
} from '../config/camasiParadaAlertaNotificacao.js';
import { listCamasiTempoProducaoFromCache } from '../data/camasiTempoProducaoCacheRepository.js';
import {
  escalaEfetivaDoRecurso,
  getRecursoPainelCamasi,
} from '../data/programacaoProducaoRecursosRepository.js';
import {
  avaliarAlertaParadaCamasi,
  ymdLocalDeMs,
  type CamasiParadaAlertaEstadoMem,
} from '../utils/camasiParadaAlerta.js';
import {
  enviarNotificacaoPorTipo,
  listarDestinosWhatsApp,
} from './whatsappNotificacaoService.js';
import { buscarTipoPorCode } from '../data/whatsappNotificacaoRepository.js';

async function lerEstado(): Promise<CamasiParadaAlertaEstadoMem | null> {
  const row = await prisma.camasiParadaAlertaEstado.findUnique({ where: { id: 1 } });
  if (!row) return null;
  return {
    data: row.data,
    inicioEnviado: row.inicioEnviado,
    ultimaProducaoFim: row.ultimaProducaoFim,
    posProducaoEnviado: row.posProducaoEnviado,
  };
}

async function gravarEstado(
  next: CamasiParadaAlertaEstadoMem,
  sent: boolean
): Promise<void> {
  await prisma.camasiParadaAlertaEstado.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      data: next.data,
      inicioEnviado: next.inicioEnviado,
      ultimaProducaoFim: next.ultimaProducaoFim,
      posProducaoEnviado: next.posProducaoEnviado,
      lastSentAt: sent ? new Date() : null,
    },
    update: {
      data: next.data,
      inicioEnviado: next.inicioEnviado,
      ultimaProducaoFim: next.ultimaProducaoFim,
      posProducaoEnviado: next.posProducaoEnviado,
      ...(sent ? { lastSentAt: new Date() } : {}),
    },
  });
}

export async function avaliarEEnviarAlertaParadaCamasi(agoraMs: number = Date.now()): Promise<{
  acao: 'skip' | 'send' | 'noop';
  motivo: string;
}> {
  await ensureCamasiParadaAlertaWhatsappTipo();
  const tipo = await buscarTipoPorCode(CAMASI_PARADA_ALERTA_WA_CODE);
  if (!tipo || !tipo.ativo) {
    return { acao: 'noop', motivo: 'tipo_inativo' };
  }

  const recurso = getRecursoPainelCamasi();
  const escala = recurso ? escalaEfetivaDoRecurso(recurso) : null;
  const ymd = ymdLocalDeMs(agoraMs);
  const rows = await listCamasiTempoProducaoFromCache(ymd, ymd);
  const estado = await lerEstado();

  const decisao = avaliarAlertaParadaCamasi({
    agoraMs,
    escala,
    rows,
    estado,
    maquina: recurso?.nome || 'Perfiladeira',
    // Sync Camasi é 1 min: dá folga para o FIM_PRODUCAO ao vivo não parecer congelado.
    vivoMs: 120_000,
  });

  if (decisao.acao !== 'send' || !decisao.mensagem) {
    const mudou =
      !estado ||
      estado.data !== decisao.next.data ||
      estado.inicioEnviado !== decisao.next.inicioEnviado ||
      estado.ultimaProducaoFim !== decisao.next.ultimaProducaoFim ||
      estado.posProducaoEnviado !== decisao.next.posProducaoEnviado;
    if (mudou) await gravarEstado(decisao.next, false);
    return { acao: 'skip', motivo: decisao.motivo };
  }

  const destinos = listarDestinosWhatsApp(tipo);
  if (destinos.length === 0) {
    console.warn(
      `[camasiParadaAlerta] "${CAMASI_PARADA_ALERTA_WA_CODE}": sem destinatário com telefone/grupo. Configure em Integração → SMS.`
    );
    return { acao: 'skip', motivo: 'sem_destinatarios' };
  }

  await enviarNotificacaoPorTipo(CAMASI_PARADA_ALERTA_WA_CODE, decisao.mensagem);
  await gravarEstado(decisao.next, true);
  console.log(`[camasiParadaAlerta] enviado (${decisao.tipoEnvio}): ${decisao.motivo}`);
  return { acao: 'send', motivo: decisao.motivo };
}
