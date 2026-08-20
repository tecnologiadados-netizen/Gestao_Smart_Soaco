import type { TarefaInadimplente } from '../../../../api/crmFinanceiro';

export type FatiaPainel = {
  chave: string;
  valor: number;
  qtd: number;
  ids: number[];
};

export type ClasseRecuperado = 'mesmo_mes' | 'outros_meses' | 'sem_data' | 'no_prazo';

export function valorTarefa(row: TarefaInadimplente): number {
  return Number.isFinite(row.valor) ? row.valor : 0;
}

export function rotuloEmpresa(row: TarefaInadimplente): string {
  return row.empresaNome?.trim() || 'Sem empresa';
}

export function rotuloCondicao(row: TarefaInadimplente): string {
  const t = row.tipo?.trim();
  return t || 'Sem condição';
}

export function tarefasEmAberto(rows: TarefaInadimplente[]): TarefaInadimplente[] {
  return rows.filter((r) => r.status !== 'concluida');
}

export function tarefasConcluidas(rows: TarefaInadimplente[]): TarefaInadimplente[] {
  return rows.filter((r) => r.status === 'concluida');
}

export function agregarPor(
  rows: TarefaInadimplente[],
  chaveDe: (row: TarefaInadimplente) => string,
): FatiaPainel[] {
  const map = new Map<string, FatiaPainel>();
  for (const row of rows) {
    const chave = chaveDe(row);
    const atual = map.get(chave) ?? { chave, valor: 0, qtd: 0, ids: [] };
    atual.valor += valorTarefa(row);
    atual.qtd += 1;
    atual.ids.push(row.id);
    map.set(chave, atual);
  }
  return [...map.values()].sort((a, b) => b.valor - a.valor);
}

function ymd(value: string | null | undefined): string | null {
  const s = String(value ?? '').trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : null;
}

function ym(value: string | null | undefined): string | null {
  const d = ymd(value);
  return d ? d.slice(0, 7) : null;
}

export function dataNaFaixa(dataYmd: string | null, de: string, ate: string): boolean {
  if (!de.trim() && !ate.trim()) return true;
  if (!dataYmd) return false;
  if (de.trim() && dataYmd < de.trim()) return false;
  if (ate.trim() && dataYmd > ate.trim()) return false;
  return true;
}

/** Recorte do histórico da fila pelo vencimento (vazio = todo o histórico). */
export function filtrarPorVencimento(
  rows: TarefaInadimplente[],
  de: string,
  ate: string,
): TarefaInadimplente[] {
  if (!de.trim() && !ate.trim()) return rows;
  return rows.filter((r) => dataNaFaixa(ymd(r.vencimento), de, ate));
}

/** Data de pagamento da recuperação: recebimento; se vazio, baixa. */
export function dataPagamentoRecuperado(row: TarefaInadimplente): string | null {
  return ymd(row.pagamento) || ymd(row.dataBaixa);
}

/**
 * Recuperado = venceu e foi pago depois do vencimento.
 * mesmo_mes: pagamento no mesmo mês do vencimento.
 * outros_meses: pagamento em mês posterior.
 */
export function classificarRecuperado(row: TarefaInadimplente): ClasseRecuperado {
  const venc = ymd(row.vencimento);
  const pag = dataPagamentoRecuperado(row);
  if (!venc || !pag) return 'sem_data';
  if (pag <= venc) return 'no_prazo';
  return ym(venc) === ym(pag) ? 'mesmo_mes' : 'outros_meses';
}

export function agregarRecuperado(rows: TarefaInadimplente[]): Record<ClasseRecuperado, FatiaPainel> {
  const vazio = (chave: string): FatiaPainel => ({ chave, valor: 0, qtd: 0, ids: [] });
  const out: Record<ClasseRecuperado, FatiaPainel> = {
  mesmo_mes: vazio('Recuperado no mês'),
    outros_meses: vazio('Pago em meses seguintes'),
    sem_data: vazio('Sem data de vencimento ou pagamento'),
    no_prazo: vazio('Pago no vencimento ou antes'),
  };
  for (const row of rows) {
    const classe = classificarRecuperado(row);
    const fatia = out[classe];
    fatia.valor += valorTarefa(row);
    fatia.qtd += 1;
    fatia.ids.push(row.id);
  }
  return out;
}
