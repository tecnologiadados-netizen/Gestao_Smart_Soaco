/** Cache em memória com TTL — equivalente a backend/app/cache.py */

class TTLCache<T = unknown> {
  private readonly ttl: number;
  private readonly maxSize: number;
  private readonly data = new Map<string, { ts: number; value: T }>();

  constructor(ttlSeconds: number, maxSize = 256) {
    this.ttl = ttlSeconds * 1000;
    this.maxSize = maxSize;
  }

  get(key: string): T | null {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts >= this.ttl) {
      this.data.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.data.size >= this.maxSize) {
      let oldestKey = '';
      let oldestTs = Infinity;
      for (const [k, v] of this.data) {
        if (v.ts < oldestTs) {
          oldestTs = v.ts;
          oldestKey = k;
        }
      }
      if (oldestKey) this.data.delete(oldestKey);
    }
    this.data.set(key, { ts: Date.now(), value });
  }

  clear(): void {
    this.data.clear();
  }
}

export const setorMapCache = new TTLCache<Map<number, string>>(600, 4);
export const produtoPesoCache = new TTLCache<Map<number, number>>(3600, 4);
export const yearRowsCache = new TTLCache<YearRowsBundle>(300, 16);
export const dashboardCache = new TTLCache<Record<string, unknown>>(120, 128);

export type PaRow = { id_produto: number; dt: Date | string; quantidade: number };
export type GondRow = {
  id_produto: number;
  dt: Date | string;
  qtde: number;
  grupo_produto: string;
  peso_total: number;
};
export type PedidoRow = {
  id_produto: number;
  dt: Date | string;
  id_pedido: number;
  codigo_pedido: string;
  cliente: string;
  codigo_produto: string;
  descricao_produto: string;
};

export type YearRowsBundle = [PaRow[], GondRow[], PedidoRow[]];

export function clearPainelProducaoCaches(): void {
  dashboardCache.clear();
  yearRowsCache.clear();
}
