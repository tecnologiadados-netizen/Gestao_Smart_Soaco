/**
 * Controle de execução de notificações agendadas (e-mail/WhatsApp), com:
 *  - Ledger persistente (tabela) de "slots" já executados por dia.
 *  - Claim atômico por slot (evita duplicidade entre o cron ao vivo e o catch-up).
 *  - Catch-up: ao subir o servidor, recupera horários que já venceram hoje e não
 *    foram executados (dentro de uma janela de tolerância).
 *
 * Motivo: `node-cron` só dispara no minuto exato enquanto o processo está vivo.
 * Se o backend estiver reiniciando/caído naquele minuto, o horário é perdido e
 * nunca mais roda. O catch-up cobre esse caso sem duplicar envios.
 *
 * Implementação por SQL cru (CREATE TABLE IF NOT EXISTS) de propósito: evita
 * depender de uma nova migração Prisma (que hoje está bloqueada por migração
 * anterior com falha), seguindo o padrão de "ensure" já usado no projeto.
 */

import { prisma } from '../config/prisma.js';

export type CanalAgendamento = 'email' | 'whatsapp' | 'sgq_email';

type SlotAgendado = { slot: string; dias: number[] };

/** `M H * * DOW` — minuto, hora(s) (lista/faixa), dia-da-semana (* / lista / faixa). */
const CRON_RE = /^(\d{1,2})\s+([\d,\-]+)\s+\*\s+\*\s+(\*|[\d,\-]+)$/;

let tabelaPronta = false;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Data local no formato YYYY-MM-DD (fuso do servidor). */
export function dataRefLocal(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Horário local no formato HH:MM (fuso do servidor). */
export function slotHHMM(d: Date = new Date()): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Tolerância (min) para recuperar horários vencidos no catch-up. Padrão 180. */
export function toleranciaCatchupMin(): number {
  const n = Number(process.env.NOTIFICACAO_CATCHUP_TOLERANCIA_MIN);
  return Number.isFinite(n) && n > 0 ? n : 180;
}

function expandirFaixaLista(campo: string, min: number, max: number): number[] {
  const set = new Set<number>();
  for (const token of campo.split(',')) {
    const parte = token.trim();
    if (!parte) continue;
    const faixa = /^(\d{1,2})-(\d{1,2})$/.exec(parte);
    if (faixa) {
      const ini = Number(faixa[1]);
      const fim = Number(faixa[2]);
      if (ini <= fim) {
        for (let v = ini; v <= fim; v++) if (v >= min && v <= max) set.add(v);
      }
      continue;
    }
    const n = Number(parte);
    if (Number.isInteger(n) && n >= min && n <= max) set.add(n);
  }
  return [...set];
}

/** Converte a expressão cron (com múltiplas partes por `|`) em slots HH:MM + dias. */
export function parseAgendamentoSlots(expr: string | null | undefined): SlotAgendado[] {
  const raw = expr?.trim();
  if (!raw) return [];
  const out: SlotAgendado[] = [];
  for (const parte of raw.split('|').map((p) => p.trim()).filter(Boolean)) {
    const m = CRON_RE.exec(parte);
    if (!m) continue;
    const min = Number(m[1]);
    if (!Number.isInteger(min) || min < 0 || min > 59) continue;
    const dias = m[3] === '*' ? [0, 1, 2, 3, 4, 5, 6] : expandirFaixaLista(m[3]!, 0, 6);
    for (const h of expandirFaixaLista(m[2]!, 0, 23)) {
      out.push({ slot: `${pad2(h)}:${pad2(min)}`, dias });
    }
  }
  return out;
}

/** Slots que já venceram hoje e estão dentro da janela de tolerância. */
export function slotsPendentesCatchup(
  expr: string | null | undefined,
  now: Date = new Date(),
  toleranciaMin: number = toleranciaCatchupMin()
): string[] {
  const hoje = now.getDay();
  const vistos = new Set<string>();
  const pendentes: string[] = [];
  for (const s of parseAgendamentoSlots(expr)) {
    if (!s.dias.includes(hoje)) continue;
    if (vistos.has(s.slot)) continue;
    const [h, m] = s.slot.split(':').map(Number);
    const slotDate = new Date(now);
    slotDate.setHours(h!, m!, 0, 0);
    const diffMin = (now.getTime() - slotDate.getTime()) / 60000;
    if (diffMin >= 0 && diffMin <= toleranciaMin) {
      vistos.add(s.slot);
      pendentes.push(s.slot);
    }
  }
  return pendentes;
}

/** Cria a tabela de controle (idempotente) e limpa registros antigos. */
export async function ensureAgendamentoExecucaoTable(): Promise<void> {
  if (tabelaPronta) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS notificacao_agendamento_execucao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      canal TEXT NOT NULL,
      code TEXT NOT NULL,
      data_ref TEXT NOT NULL,
      slot TEXT NOT NULL,
      origem TEXT NOT NULL,
      executado_em TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS ux_notif_agenda_exec
      ON notificacao_agendamento_execucao (canal, code, data_ref, slot)`
  );
  const limite = dataRefLocal(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  await prisma
    .$executeRawUnsafe(`DELETE FROM notificacao_agendamento_execucao WHERE data_ref < ?`, limite)
    .catch(() => undefined);
  tabelaPronta = true;
}

/**
 * Reivindica um slot de execução. Retorna `true` somente para quem inseriu o
 * registro (o "dono" da execução daquele slot/dia). Como o SQLite serializa
 * escritas, isso funciona como um lock leve contra duplicidade.
 */
export async function reivindicarSlot(input: {
  canal: CanalAgendamento;
  code: string;
  dataRef: string;
  slot: string;
  origem: 'cron' | 'catchup';
}): Promise<boolean> {
  await ensureAgendamentoExecucaoTable();
  const affected = await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO notificacao_agendamento_execucao (canal, code, data_ref, slot, origem)
     VALUES (?, ?, ?, ?, ?)`,
    input.canal,
    input.code,
    input.dataRef,
    input.slot,
    input.origem
  );
  return affected === 1;
}

/**
 * Wrapper para o disparo AO VIVO do cron: reivindica o slot do minuto atual e só
 * executa se ganhou o claim (evita rodar duas vezes o mesmo horário).
 */
export async function dispararComClaim(
  canal: CanalAgendamento,
  code: string,
  run: () => Promise<void>
): Promise<void> {
  const claimed = await reivindicarSlot({
    canal,
    code,
    dataRef: dataRefLocal(),
    slot: slotHHMM(),
    origem: 'cron',
  });
  if (!claimed) return;
  await run();
}

/** Recupera, na subida, horários vencidos hoje e ainda não executados. */
export async function executarCatchup(params: {
  canal: CanalAgendamento;
  code: string;
  expr: string | null | undefined;
  run: () => Promise<void>;
  logPrefix: string;
}): Promise<void> {
  await ensureAgendamentoExecucaoTable();
  const now = new Date();
  const dataRef = dataRefLocal(now);
  for (const slot of slotsPendentesCatchup(params.expr, now)) {
    const claimed = await reivindicarSlot({
      canal: params.canal,
      code: params.code,
      dataRef,
      slot,
      origem: 'catchup',
    });
    if (!claimed) continue;
    console.log(
      `${params.logPrefix} Catch-up: recuperando horário perdido ${slot} (${dataRef}) de "${params.code}".`
    );
    try {
      await params.run();
    } catch (e) {
      console.error(
        `${params.logPrefix} Catch-up falhou (${params.code} ${slot}):`,
        e instanceof Error ? e.message : e
      );
    }
  }
}
