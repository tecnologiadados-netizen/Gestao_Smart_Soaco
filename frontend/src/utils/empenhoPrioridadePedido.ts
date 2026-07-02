/** Prioridade de carrada para saldo projetado (menor = mais urgente). */
export const PRIORIDADE_CARRADA_RETIRADA = 1;
export const PRIORIDADE_CARRADA_ENTREGA_G_THE = 2;
export const PRIORIDADE_CARRADA_OUTRAS = 3;
export const PRIORIDADE_CARRADA_REQUISICAO = 4;
export const PRIORIDADE_SEM_ROMANEIO = 99;

export type ChaveOrdenacaoEmpenhoPedido = {
  pedido: string;
  dataEntrega: string | null;
  rota: string;
  temRomaneio?: boolean;
};

export function prioridadeCarradaEmpenho(rota: string): number {
  const r = rota.trim().toLowerCase();
  if (r.includes('retirada')) return PRIORIDADE_CARRADA_RETIRADA;
  if (r.includes('entrega g the') || r.includes('entrega g. the')) return PRIORIDADE_CARRADA_ENTREGA_G_THE;
  if (r.includes('requisição') || r.includes('requisicao')) return PRIORIDADE_CARRADA_REQUISICAO;
  return PRIORIDADE_CARRADA_OUTRAS;
}

export function isRotaAguardandoRomaneio(l: ChaveOrdenacaoEmpenhoPedido): boolean {
  const r = l.rota.trim().toLowerCase();
  if (!r || r.includes('inserir em romaneio')) return true;
  if (prioridadeCarradaEmpenho(l.rota) !== PRIORIDADE_CARRADA_OUTRAS) return false;
  const temRomaneio = l.temRomaneio ?? false;
  return !temRomaneio;
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

export function chaveRotaEmpenho(rota: string): string {
  return rota.trim().toLowerCase();
}

/** Data ASC → classe carrada → rota (agrupa mesma carrada) → pedido ASC. */
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
