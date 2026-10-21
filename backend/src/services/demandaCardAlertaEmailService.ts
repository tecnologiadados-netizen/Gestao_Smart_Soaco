/**
 * Alerta por e-mail quando um card das Demandas Internas (RH) muda.
 * Destinatários: os e-mails do próprio card. O tipo em Integração → E-mail liga/desliga o alerta.
 * Mudanças do mesmo card em sequência (ex.: concluir e mover para "Concluído") saem num único e-mail.
 */

import type { PrismaClient } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { resolveAppBaseUrl } from '../config/appBaseUrl.js';
import { envioNotificacoesHabilitado } from '../config/envioNotificacoes.js';
import { buscarTipoEmailPorCode } from '../data/emailNotificacaoRepository.js';
import { formatarPrazo, lerEmails } from '../rh/lib/demandasInternas.js';
import { buildSystemEmailHtml } from './emailHtmlTemplate.js';
import { comExecucaoRegistrada, type OrigemNotificacao } from './notificacaoExecucaoService.js';
import { sendSystemEmail } from './systemEmail.js';

export const DEMANDA_CARD_ALERTA_EMAIL_CODE = 'rh_demanda_card_alteracao';

const AGRUPAR_MS = 30_000;

export type SnapshotCardDemanda = {
  cardId: string;
  quadroId: string;
  titulo: string;
  quadroNome: string;
  listaNome: string;
  prazo: string | null;
  concluido: boolean;
  emails: string[];
  excluido: boolean;
};

type MudancaCard = { descricao: string; por: string; em: Date };

type EnvioPendente = {
  snapshot: SnapshotCardDemanda;
  mudancas: MudancaCard[];
};

const pendentes = new Map<string, EnvioPendente>();

export async function carregarSnapshotCardDemanda(cardId: string): Promise<SnapshotCardDemanda | null> {
  const card = await prisma.rhDemandaCard.findUnique({
    where: { id: cardId },
    include: { lista: { include: { quadro: true } } },
  });
  if (!card) return null;
  return {
    cardId: card.id,
    quadroId: card.quadroId,
    titulo: card.titulo,
    quadroNome: card.lista.quadro.nome,
    listaNome: card.lista.nome,
    prazo: card.prazo || null,
    concluido: card.concluido,
    emails: lerEmails(card.emailsNotificacao),
    excluido: false,
  };
}

/** Acumula as mudanças do card; o e-mail sai uma vez, {@link AGRUPAR_MS} após a primeira. */
export function registrarMudancasCardDemanda(
  snapshot: SnapshotCardDemanda,
  descricoes: string[],
  por: string,
): void {
  if (!descricoes.length) return;
  const atual = pendentes.get(snapshot.cardId);
  if (!atual && !snapshot.emails.length) return;
  const em = new Date();
  const mudancas = descricoes.map((descricao) => ({ descricao, por, em }));
  if (atual) {
    atual.snapshot = snapshot;
    atual.mudancas.push(...mudancas);
    return;
  }
  pendentes.set(snapshot.cardId, { snapshot, mudancas });
  const timer = setTimeout(() => {
    void enviarMudancasPendentes(snapshot.cardId).catch((err) => {
      console.error('[demandaCardAlerta]', err instanceof Error ? err.message : err);
    });
  }, AGRUPAR_MS);
  timer.unref?.();
}

const nomesPorLogin = new Map<string, string>();

async function nomeDoAutor(login: string): Promise<string> {
  const chave = login.trim();
  if (!chave) return 'sistema';
  const conhecido = nomesPorLogin.get(chave);
  if (conhecido) return conhecido;
  const usuario = await prisma.usuario.findUnique({ where: { login: chave }, select: { nome: true } });
  const nome = usuario?.nome?.trim() || chave;
  nomesPorLogin.set(chave, nome);
  return nome;
}

function formatarDataHoraBr(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(d);
}

function linkDoCard(snapshot: SnapshotCardDemanda): string {
  const base = resolveAppBaseUrl();
  return `${base}/rh/demandas-internas/${encodeURIComponent(snapshot.quadroId)}?card=${encodeURIComponent(snapshot.cardId)}`;
}

export async function montarEmailMudancasCard(
  snapshot: SnapshotCardDemanda,
  mudancas: MudancaCard[],
): Promise<{ subject: string; html: string }> {
  const concluiu = !snapshot.excluido && snapshot.concluido && mudancas.some((m) => m.descricao === 'Card concluído.');
  const titulo = snapshot.excluido ? 'Demanda excluída' : concluiu ? 'Demanda concluída' : 'Demanda atualizada';
  const subject = `[Gestão Smart] ${titulo} — ${snapshot.titulo}`;

  const linhas = [];
  for (const mudanca of mudancas) {
    linhas.push({
      label: `${formatarDataHoraBr(mudanca.em)} · ${await nomeDoAutor(mudanca.por)}`,
      value: mudanca.descricao,
    });
  }

  const html = buildSystemEmailHtml({
    badge: 'RH · Demandas Internas',
    title: titulo,
    subtitle: snapshot.titulo,
    intro: snapshot.excluido
      ? 'Um card que você acompanha nas Demandas Internas foi excluído.'
      : 'Um card que você acompanha nas Demandas Internas foi alterado.',
    sections: [
      {
        heading: 'Card',
        rows: [
          { label: 'Título', value: snapshot.titulo },
          { label: 'Quadro', value: snapshot.quadroNome },
          { label: snapshot.excluido ? 'Última lista' : 'Lista atual', value: snapshot.listaNome },
          { label: 'Situação', value: snapshot.excluido ? 'Excluído' : snapshot.concluido ? 'Concluído' : 'Em aberto' },
          { label: 'Prazo', value: formatarPrazo(snapshot.prazo) },
        ],
      },
      { heading: mudancas.length === 1 ? 'Alteração' : 'Alterações', rows: linhas },
    ],
    cta: snapshot.excluido ? undefined : { label: 'Abrir card', href: linkDoCard(snapshot) },
    footerNote:
      'Você recebe este aviso porque seu e-mail está no campo "Notificar por e-mail" deste card. Por favor, não responda este e-mail.',
  });
  return { subject, html };
}

async function enviarMudancasPendentes(cardId: string, origem: OrigemNotificacao = 'evento'): Promise<void> {
  const pendente = pendentes.get(cardId);
  pendentes.delete(cardId);
  if (!pendente) return;

  const atual = pendente.snapshot.excluido ? null : await carregarSnapshotCardDemanda(cardId);
  const snapshot = atual ?? { ...pendente.snapshot, excluido: true };
  if (!snapshot.emails.length) return;

  const tipo = await buscarTipoEmailPorCode(DEMANDA_CARD_ALERTA_EMAIL_CODE);
  if (!tipo || !tipo.ativo) return;

  await comExecucaoRegistrada(
    { canal: 'email', tipoCode: tipo.code, tipoId: tipo.id, origem },
    async () => {
      const { subject, html } = await montarEmailMudancasCard(snapshot, pendente.mudancas);
      const dryRun = !envioNotificacoesHabilitado();
      try {
        await sendSystemEmail(prisma, { to: snapshot.emails, subject, html });
        console.log(
          `[demandaCardAlerta] ${dryRun ? 'dry-run' : 'enviado'} para ${snapshot.emails.join(', ')} — ${subject}`,
        );
        return {
          result: undefined as void,
          tentativas: snapshot.emails.map((email) => ({ canal: 'email' as const, destinatario: email, ok: true, dryRun })),
          metadados: { cardId, quadroId: snapshot.quadroId, alteracoes: pendente.mudancas.length, dryRun },
          resumo: `${pendente.mudancas.length} alteração(ões) em “${snapshot.titulo}”`,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[demandaCardAlerta] Falha no envio:', msg);
        return {
          result: undefined as void,
          status: 'failed' as const,
          erroMensagem: msg,
          resumo: 'Falha no envio',
          tentativas: snapshot.emails.map((email) => ({ canal: 'email' as const, destinatario: email, ok: false, erro: msg })),
        };
      }
    },
  );
}

const AMOSTRA: SnapshotCardDemanda = {
  cardId: 'exemplo',
  quadroId: 'exemplo',
  titulo: 'PCMSO — acompanhamento Athos x Auditar',
  quadroNome: 'Diretoria vs RH',
  listaNome: 'Concluído',
  prazo: '2026-10-20',
  concluido: true,
  emails: [],
  excluido: false,
};

function mudancasAmostra(): MudancaCard[] {
  const em = new Date();
  return [
    { descricao: 'Card concluído.', por: 'usuario.exemplo', em },
    { descricao: 'Movido de “Em andamento” para “Concluído”.', por: 'usuario.exemplo', em },
  ];
}

export async function previewAlertaDemandaCard(): Promise<{
  subject: string;
  html: string;
  resumo: string;
  quantidade: number;
}> {
  const { subject, html } = await montarEmailMudancasCard(AMOSTRA, mudancasAmostra());
  return {
    subject,
    html,
    resumo: 'Preview de exemplo (disparo por evento quando um card com e-mails cadastrados é alterado).',
    quantidade: 1,
  };
}

export async function executarAlertaDemandaCardAmostra(
  _prismaClient: PrismaClient,
  destinatarios: string[],
): Promise<{ enviados: number; ignorados: number; erros: string[] }> {
  const emails = [...new Set(destinatarios.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@')))];
  if (emails.length === 0) return { enviados: 0, ignorados: 0, erros: ['Nenhum destinatário com e-mail válido.'] };
  const { subject, html } = await montarEmailMudancasCard(AMOSTRA, mudancasAmostra());
  try {
    await sendSystemEmail(prisma, { to: emails, subject, html });
    return { enviados: 1, ignorados: 0, erros: [] };
  } catch (err) {
    return { enviados: 0, ignorados: 0, erros: [err instanceof Error ? err.message : String(err)] };
  }
}
