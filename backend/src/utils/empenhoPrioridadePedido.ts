/** Prioridade de carrada para waterfall / saldo projetado (menor = mais urgente). */
export const PRIORIDADE_CARRADA_RETIRADA = 1;
export const PRIORIDADE_CARRADA_ENTREGA_G_THE = 2;
export const PRIORIDADE_CARRADA_OUTRAS = 3;
export const PRIORIDADE_CARRADA_REQUISICAO = 4;
/** Pedidos sem romaneio — sempre após os demais na mesma data. */
export const PRIORIDADE_SEM_ROMANEIO = 99;

export type ChaveOrdenacaoEmpenhoPedido = {
  pedido: string;
  dataEntrega: string | null;
  rota: string;
  temRomaneio: boolean;
};

export function prioridadeCarradaEmpenho(rota: string): number {
  const r = rota.trim().toLowerCase();
  if (r.includes('retirada')) return PRIORIDADE_CARRADA_RETIRADA;
  if (r.includes('entrega g the') || r.includes('entrega g. the')) return PRIORIDADE_CARRADA_ENTREGA_G_THE;
  if (r.includes('requisição') || r.includes('requisicao')) return PRIORIDADE_CARRADA_REQUISICAO;
  return PRIORIDADE_CARRADA_OUTRAS;
}

/** Pedidos aguardando romaneio (final da fila) — distinto de Entrega G The / Retirada sem vínculo. */
export function isRotaAguardandoRomaneio(l: ChaveOrdenacaoEmpenhoPedido): boolean {
  const r = l.rota.trim().toLowerCase();
  if (!r || r.includes('inserir em romaneio')) return true;
  // Classificações nomeadas (Retirada, Entrega G The, Requisição) não vão para o fim só por falta de romaneio.
  if (prioridadeCarradaEmpenho(l.rota) !== PRIORIDADE_CARRADA_OUTRAS) return false;
  return !l.temRomaneio;
}

export function prioridadeOrdenacaoEmpenho(l: ChaveOrdenacaoEmpenhoPedido): number {
  const carrada = prioridadeCarradaEmpenho(l.rota);
  if (carrada !== PRIORIDADE_CARRADA_OUTRAS) return carrada;
  if (isRotaAguardandoRomaneio(l)) return PRIORIDADE_SEM_ROMANEIO;
  return PRIORIDADE_CARRADA_OUTRAS;
}

function cmpPedidoNome(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' });
}

/** Chave de agrupamento: mesma data + mesma rota/carrada ficam adjacentes. */
export function chaveRotaEmpenho(rota: string): string {
  return rota.trim().toLowerCase();
}

/** Data ASC → classe carrada → rota (agrupa mesma carrada) → pedido ASC. Sem romaneio por último. */
export function cmpPedidosEmpenho(a: ChaveOrdenacaoEmpenhoPedido, b: ChaveOrdenacaoEmpenhoPedido): number {
  const da = a.dataEntrega ?? '9999-99-99';
  const db = b.dataEntrega ?? '9999-99-99';
  if (da !== db) return da.localeCompare(db);
  const pa = prioridadeOrdenacaoEmpenho(a);
  const pb = prioridadeOrdenacaoEmpenho(b);
  if (pa !== pb) return pa - pb;
  const ra = chaveRotaEmpenho(a.rota);
  const rb = chaveRotaEmpenho(b.rota);
  if (ra !== rb) return ra.localeCompare(rb, 'pt-BR', { numeric: true, sensitivity: 'base' });
  return cmpPedidoNome(a.pedido, b.pedido);
}
