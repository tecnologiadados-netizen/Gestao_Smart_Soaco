/**
 * Data base (produção efetiva) alinhada ao Gerenciador:
 * formação (constr/cont ou romaneio &lt; corte) → sempre max(normais)+30 (ignora data_producao gravada);
 * demais → data_producao ?? previsão.
 */

import { isCarradaEmFormacao, rotaFromPedidoRow } from './rotaCarrada.js';

const DIAS_FORMACAO = 30;

function normalizeCarradaNome(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/** Carradas especiais (retirada, G. The, romaneio, requisição) — fora do max de normais. */
export function isCarradaOrdemFinal(carrada: string): boolean {
  const n = normalizeCarradaNome(carrada);
  return (
    n.includes('retirada na so aco') ||
    n.includes('retirada na so moveis') ||
    n.includes('entrega em grande teresina') ||
    n.includes('inserir em romaneio') ||
    n.includes('requisicao') ||
    n.startsWith('1-retirada') ||
    n.startsWith('2-retirada') ||
    n.startsWith('3-entrega') ||
    n.startsWith('4-inserir') ||
    n.startsWith('5-requisicao')
  );
}

export function toIsoDateYmd(value: unknown): string {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(value).trim();
  const isoPrefix = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoPrefix) return `${isoPrefix[1]}-${isoPrefix[2]}-${isoPrefix[3]}`;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

export function addDaysIso(iso: string, days: number): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

export function dataProducaoCarradaEmFormacaoApartirDe(maxDataCarradas: string): string {
  if (!maxDataCarradas) return '';
  return addDaysIso(maxDataCarradas, DIAS_FORMACAO);
}

export type PedidoParaDataBase = {
  data_producao?: unknown;
  previsao_entrega_atualizada?: unknown;
  previsao_entrega?: unknown;
  romaneio_como_formacao?: boolean;
  Observacoes?: unknown;
  Observações?: unknown;
  Rota?: unknown;
  rota?: unknown;
  [key: string]: unknown;
};

export function isRomaneioComoFormacaoPedido(p: PedidoParaDataBase): boolean {
  return p.romaneio_como_formacao === true;
}

export function isPedidoEmFormacao(p: PedidoParaDataBase): boolean {
  const rota = rotaFromPedidoRow(p as Record<string, unknown>);
  return isCarradaEmFormacao(rota) || isRomaneioComoFormacaoPedido(p);
}

/** Maior data_producao real entre pedidos de carradas normais. */
export function maxDataProducaoPedidosNormais(pedidos: PedidoParaDataBase[]): string {
  let max = '';
  for (const p of pedidos) {
    const rota = rotaFromPedidoRow(p as Record<string, unknown>);
    if (isCarradaOrdemFinal(rota) || isPedidoEmFormacao(p)) continue;
    const d = toIsoDateYmd(p.data_producao);
    if (d && d > max) max = d;
  }
  return max;
}

/**
 * Data efetiva de produção/consumo (Empenho, Consulta Estoque, etc.).
 * Formação: nunca usa previsão ERP nem data_producao gravada; só max+30 (overlay).
 */
export function resolverDataBasePedido(
  p: PedidoParaDataBase,
  dataProducaoEmFormacao = ''
): string {
  if (isPedidoEmFormacao(p)) {
    return dataProducaoEmFormacao || '';
  }
  const dataProducaoReal = toIsoDateYmd(p.data_producao);
  const previsao = toIsoDateYmd(p.previsao_entrega_atualizada ?? p.previsao_entrega);
  return dataProducaoReal || previsao || '';
}

/**
 * Monta mapa pd.id → data base (mínimo entre linhas do mesmo pedido),
 * aplicando overlay de formação com max das carradas normais + 30.
 */
export function buildDataBasePorPedidoIdMap(
  pedidos: PedidoParaDataBase[],
  idFromPedido: (p: PedidoParaDataBase) => number
): Map<number, string> {
  const dataFormacao = dataProducaoCarradaEmFormacaoApartirDe(maxDataProducaoPedidosNormais(pedidos));
  const acc = new Map<number, string>();

  for (const p of pedidos) {
    const pid = idFromPedido(p);
    if (!Number.isFinite(pid) || pid <= 0) continue;
    const base = resolverDataBasePedido(p, dataFormacao);
    if (!base) continue;
    const cur = acc.get(pid);
    if (cur === undefined || base < cur) acc.set(pid, base);
  }
  return acc;
}
