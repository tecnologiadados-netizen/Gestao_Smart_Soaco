import { prisma } from '../config/prisma.js';

export const TZ_RETRATO = 'America/Fortaleza';
export const JANELA_FECHAMENTO_DIAS = 3;

export type FonteInadimplente = 'retrato' | 'ao_vivo';

export type PontoSerieRetrato = {
  mes: string;
  valorVencido: number;
  qtdVencido: number;
  valorAtraso: number;
  qtdAtraso: number;
  valorAberto: number;
  qtdAberto: number;
  pctAtraso: number;
  pctInadimplente: number;
  fonteInadimplente?: FonteInadimplente;
  retratoCapturadoEm?: string | null;
};

export type RetratoMensal = {
  mes: string;
  valorVencido: number;
  qtdVencido: number;
  valorAberto: number;
  qtdAberto: number;
  pctInadimplente: number;
  valorAtraso: number;
  qtdAtraso: number;
  pctAtraso: number;
  oficial: boolean;
  atrasado: boolean;
  capturadoEm: Date;
};

export type DecisaoFechamento =
  | { acao: 'ignorar'; motivo: 'ja_oficial' }
  | { acao: 'promover' }
  | { acao: 'capturar_vivo'; atrasado: boolean }
  | { acao: 'adiar'; motivo: 'sem_trabalho_e_fora_da_janela' };

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Data civil em America/Fortaleza (independe do TZ do processo). */
export function dataCivilFortaleza(agora = new Date()): { ymd: string; mes: string; dia: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_RETRATO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(agora);
  const y = partes.find((p) => p.type === 'year')?.value ?? '1970';
  const m = partes.find((p) => p.type === 'month')?.value ?? '01';
  const d = partes.find((p) => p.type === 'day')?.value ?? '01';
  return { ymd: `${y}-${m}-${d}`, mes: `${y}-${m}`, dia: Number(d) };
}

export function mesAnteriorDe(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number);
  const d = new Date(y, (m ?? 1) - 2, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function limitesMes(yyyyMm: string): { de: string; ate: string } {
  const [y, m] = yyyyMm.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { de: `${yyyyMm}-01`, ate: `${yyyyMm}-${pad2(last)}` };
}

export function decidirFechamentoMesAnterior(opts: {
  existe: boolean;
  oficial: boolean;
  diaDoMesAtual: number;
  janelaDias?: number;
}): DecisaoFechamento {
  const janela = opts.janelaDias ?? JANELA_FECHAMENTO_DIAS;
  if (opts.existe && opts.oficial) return { acao: 'ignorar', motivo: 'ja_oficial' };
  if (opts.existe && !opts.oficial) return { acao: 'promover' };
  if (opts.diaDoMesAtual <= janela) {
    return { acao: 'capturar_vivo', atrasado: opts.diaDoMesAtual > 1 };
  }
  return { acao: 'adiar', motivo: 'sem_trabalho_e_fora_da_janela' };
}

export function aplicarRetratoNaSerie<T extends PontoSerieRetrato>(
  serie: T[],
  retratos: Map<string, RetratoMensal>,
  mesAtual: string,
): T[] {
  return serie.map((ponto) => {
    const retrato = retratos.get(ponto.mes);
    if (!retrato?.oficial || ponto.mes >= mesAtual) {
      return { ...ponto, fonteInadimplente: 'ao_vivo' as const };
    }
    return {
      ...ponto,
      valorAberto: retrato.valorAberto,
      qtdAberto: retrato.qtdAberto,
      pctInadimplente: retrato.pctInadimplente,
      fonteInadimplente: 'retrato' as const,
      retratoCapturadoEm: retrato.capturadoEm.toISOString(),
    };
  });
}

function toRetrato(row: {
  mes: string;
  valorVencido: number;
  qtdVencido: number;
  valorAberto: number;
  qtdAberto: number;
  pctInadimplente: number;
  valorAtraso: number;
  qtdAtraso: number;
  pctAtraso: number;
  oficial: boolean;
  atrasado: boolean;
  capturadoEm: Date;
}): RetratoMensal {
  return {
    mes: row.mes,
    valorVencido: row.valorVencido,
    qtdVencido: row.qtdVencido,
    valorAberto: row.valorAberto,
    qtdAberto: row.qtdAberto,
    pctInadimplente: row.pctInadimplente,
    valorAtraso: row.valorAtraso,
    qtdAtraso: row.qtdAtraso,
    pctAtraso: row.pctAtraso,
    oficial: row.oficial,
    atrasado: row.atrasado,
    capturadoEm: row.capturadoEm,
  };
}

export async function listarRetratosOficiais(): Promise<Map<string, RetratoMensal>> {
  const rows = await prisma.crmInadimplenciaMesRetrato.findMany({
    where: { oficial: true },
  });
  return new Map(rows.map((r) => [r.mes, toRetrato(r)]));
}

export async function obterRetratoMes(mes: string): Promise<RetratoMensal | null> {
  const row = await prisma.crmInadimplenciaMesRetrato.findUnique({ where: { mes } });
  return row ? toRetrato(row) : null;
}

export async function upsertRetratoTrabalho(ponto: PontoSerieRetrato, agora = new Date()): Promise<void> {
  const atual = await prisma.crmInadimplenciaMesRetrato.findUnique({ where: { mes: ponto.mes } });
  if (atual?.oficial) return;
  await prisma.crmInadimplenciaMesRetrato.upsert({
    where: { mes: ponto.mes },
    create: {
      mes: ponto.mes,
      valorVencido: ponto.valorVencido,
      qtdVencido: ponto.qtdVencido,
      valorAberto: ponto.valorAberto,
      qtdAberto: ponto.qtdAberto,
      pctInadimplente: ponto.pctInadimplente,
      valorAtraso: ponto.valorAtraso,
      qtdAtraso: ponto.qtdAtraso,
      pctAtraso: ponto.pctAtraso,
      oficial: false,
      atrasado: false,
      capturadoEm: agora,
    },
    update: {
      valorVencido: ponto.valorVencido,
      qtdVencido: ponto.qtdVencido,
      valorAberto: ponto.valorAberto,
      qtdAberto: ponto.qtdAberto,
      pctInadimplente: ponto.pctInadimplente,
      valorAtraso: ponto.valorAtraso,
      qtdAtraso: ponto.qtdAtraso,
      pctAtraso: ponto.pctAtraso,
      capturadoEm: agora,
    },
  });
}

export async function promoverRetratoOficial(mes: string, atrasado: boolean): Promise<boolean> {
  const atual = await prisma.crmInadimplenciaMesRetrato.findUnique({ where: { mes } });
  if (!atual || atual.oficial) return false;
  await prisma.crmInadimplenciaMesRetrato.update({
    where: { mes },
    data: { oficial: true, atrasado },
  });
  return true;
}

export async function gravarRetratoOficial(
  ponto: PontoSerieRetrato,
  opts: { atrasado: boolean; agora?: Date },
): Promise<boolean> {
  const atual = await prisma.crmInadimplenciaMesRetrato.findUnique({ where: { mes: ponto.mes } });
  if (atual?.oficial) return false;
  const agora = opts.agora ?? new Date();
  await prisma.crmInadimplenciaMesRetrato.upsert({
    where: { mes: ponto.mes },
    create: {
      mes: ponto.mes,
      valorVencido: ponto.valorVencido,
      qtdVencido: ponto.qtdVencido,
      valorAberto: ponto.valorAberto,
      qtdAberto: ponto.qtdAberto,
      pctInadimplente: ponto.pctInadimplente,
      valorAtraso: ponto.valorAtraso,
      qtdAtraso: ponto.qtdAtraso,
      pctAtraso: ponto.pctAtraso,
      oficial: true,
      atrasado: opts.atrasado,
      capturadoEm: agora,
    },
    update: atual
      ? { oficial: true, atrasado: opts.atrasado }
      : {
          valorVencido: ponto.valorVencido,
          qtdVencido: ponto.qtdVencido,
          valorAberto: ponto.valorAberto,
          qtdAberto: ponto.qtdAberto,
          pctInadimplente: ponto.pctInadimplente,
          valorAtraso: ponto.valorAtraso,
          qtdAtraso: ponto.qtdAtraso,
          pctAtraso: ponto.pctAtraso,
          oficial: true,
          atrasado: opts.atrasado,
          capturadoEm: agora,
        },
  });
  return true;
}
