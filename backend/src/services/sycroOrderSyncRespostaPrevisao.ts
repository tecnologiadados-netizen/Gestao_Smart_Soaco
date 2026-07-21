import { prisma } from '../config/prisma.js';
import { isUserCommercialTeamByPermsJson } from './sycroOrderAguardaRespostaLabel.js';
import { invalidateSycroCardSinalizacaoCache } from './sycroOrderPedidoSinalizacao.js';

function normalizeLogin(login: string): string {
  return String(login ?? '').trim().toLowerCase();
}

function normalizePersonToken(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function normalizePdDigits(pd: string): string {
  const s = String(pd ?? '').trim();
  const digits = s.replace(/\D+/g, '');
  return digits || s;
}

function orderNumberMatchesPd(orderNumber: string, pd: string): boolean {
  const a = normalizePdDigits(orderNumber);
  const b = normalizePdDigits(pd);
  return a.length > 0 && a === b;
}

function usuarioCorrespondeLabel(args: {
  usuarioLogin: string;
  usuarioNome: string | null | undefined;
  label: string;
}): boolean {
  const labelRaw = args.label.trim();
  if (!labelRaw) return false;
  const login = normalizeLogin(args.usuarioLogin);
  const nome = normalizePersonToken(args.usuarioNome ?? '');
  const labelNorm = normalizePersonToken(labelRaw);

  if (nome && (labelNorm === nome || labelNorm.includes(nome))) return true;
  if (login && (labelNorm === login || labelNorm.includes(login))) return true;
  for (const seg of labelRaw.split(',')) {
    const t = normalizePersonToken(seg);
    if (nome && t === nome) return true;
    if (login && t === login) return true;
  }
  return false;
}

/** Usuário pode sanar pendência rotulada como PCP / josenildo / pessoa nomeada. */
function usuarioPodeResponderAguardaLabel(args: {
  usuarioLogin: string;
  usuarioNome: string | null | undefined;
  usuarioPermsJson: string | null | undefined;
  label: string;
}): boolean {
  const labelRaw = args.label.trim();
  if (!labelRaw) return false;
  const labelNorm = normalizePersonToken(labelRaw);
  const login = normalizeLogin(args.usuarioLogin);
  const ehComercial = isUserCommercialTeamByPermsJson(args.usuarioPermsJson);

  if (labelNorm === 'pcp') {
    if (login === 'pcp') return true;
    return !ehComercial;
  }
  if (labelNorm === 'josenildo') {
    if (login === 'josenildo') return true;
    return !ehComercial;
  }

  return usuarioCorrespondeLabel({
    usuarioLogin: args.usuarioLogin,
    usuarioNome: args.usuarioNome,
    label: labelRaw,
  });
}

/**
 * Quando o PCP altera a previsão no Gerenciador / Sequenciamento:
 * 1) espelha `current_promised_date` em todos os cards abertos do PD;
 * 2) limpa `aguarda_resposta` nos cards pendentes que o usuário pode responder.
 */
export async function responderSycroCardsPorAjusteGerenciador(args: {
  pd: string;
  usuarioLogin: string;
  novaPrevisaoIso: string;
}): Promise<{ cardsAtualizados: number }> {
  const pd = String(args.pd ?? '').trim();
  const usuarioLogin = String(args.usuarioLogin ?? '').trim();
  if (!pd || !usuarioLogin) return { cardsAtualizados: 0 };

  const usuario = await prisma.usuario.findFirst({
    where: { login: { equals: usuarioLogin } },
    select: { nome: true, permissoes: true, ativo: true },
  });
  if (!usuario?.ativo) return { cardsAtualizados: 0 };

  const orders = await prisma.sycroOrderOrder.findMany({
    where: { status: { not: 'FINISHED' } },
    select: {
      id: true,
      order_number: true,
      aguarda_resposta_pendente: true,
      aguarda_resposta_de_label: true,
      current_promised_date: true,
    },
  });

  const alvo = orders.filter((o) => orderNumberMatchesPd(o.order_number, pd));
  const novaIso = args.novaPrevisaoIso.trim().slice(0, 10);
  const dataValida = !!novaIso && /^\d{4}-\d{2}-\d{2}$/.test(novaIso);

  let cardsAtualizados = 0;
  for (const o of alvo) {
    const data: {
      current_promised_date?: string;
      aguarda_resposta_pendente?: number;
      aguarda_resposta_de_label?: string | null;
      aguarda_resposta_destino_time?: string | null;
    } = {};

    if (dataValida && o.current_promised_date !== novaIso) {
      data.current_promised_date = novaIso;
    }

    const pendente = Number(o.aguarda_resposta_pendente) === 1;
    const label = (o.aguarda_resposta_de_label ?? '').trim();
    if (
      pendente &&
      label &&
      usuarioPodeResponderAguardaLabel({
        usuarioLogin,
        usuarioNome: usuario.nome,
        usuarioPermsJson: usuario.permissoes,
        label,
      })
    ) {
      data.aguarda_resposta_pendente = 0;
      data.aguarda_resposta_de_label = null;
      data.aguarda_resposta_destino_time = null;
    }

    if (Object.keys(data).length === 0) continue;

    await prisma.sycroOrderOrder.update({
      where: { id: o.id },
      data,
    });
    cardsAtualizados += 1;
  }

  if (cardsAtualizados > 0) {
    invalidateSycroCardSinalizacaoCache();
  }

  return { cardsAtualizados };
}
