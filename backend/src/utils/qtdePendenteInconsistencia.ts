/**
 * Mesma regra do frontend (`frontend/src/utils/qtdePendenteInconsistencia.ts`):
 * soma de "Qtde Pendente Real" por pedido+código não pode ultrapassar "Pendente" do item.
 */

export const MSG_BLOQUEIO_INCONSISTENCIA_QTDE_PENDENTE =
  'Existem inconsistências no Gerenciador de Pedidos: a soma de Qtde Pendente Real por pedido+código ultrapassa a coluna Pendente do item (faturamento parcial sem vínculo por rota no ERP). Corrija no Gerenciador antes de gerar a programação.';

export type GrupoInconsistenciaQtdePendente = {
  key: string;
  pdLabel: string;
  cod: string;
  pendenteItem: number;
  somaQtdePendenteReal: number;
};

export type PedidoRowLike = Record<string, unknown>;

function getPdRaw(p: PedidoRowLike): string {
  const v = p['PD'] ?? p['pd'];
  return v != null ? String(v).trim() : '';
}

function getCodRaw(p: PedidoRowLike): string {
  const v = p['Cod'] ?? p['cod'];
  return v != null ? String(v).trim() : '';
}

function normalizePdDigits(pd: string): string {
  const s = String(pd ?? '').trim();
  const digits = s.replace(/\D+/g, '');
  return digits || s;
}

export function analisarInconsistenciaQtdePendenteReal(pedidos: PedidoRowLike[]): {
  hasIssue: boolean;
  grupos: GrupoInconsistenciaQtdePendente[];
} {
  const map = new Map<string, PedidoRowLike[]>();
  for (const p of pedidos) {
    const pd = getPdRaw(p);
    const cod = getCodRaw(p);
    if (!pd || !cod) continue;
    const key = `${normalizePdDigits(pd)}|${cod.toUpperCase()}`;
    const arr = map.get(key) ?? [];
    arr.push(p);
    map.set(key, arr);
  }

  const grupos: GrupoInconsistenciaQtdePendente[] = [];
  for (const [key, linhas] of map) {
    if (linhas.length === 0) continue;
    let soma = 0;
    for (const r of linhas) {
      const q = Number(r['Qtde Pendente Real'] ?? r['Qtde pendente real']);
      if (Number.isFinite(q) && q >= 0) soma += q;
    }
    const pendVals = linhas
      .map((r) => Number(r['Pendente'] ?? r['pendente']))
      .filter((n) => Number.isFinite(n) && n >= 0);
    if (pendVals.length === 0) continue;
    const pendenteItem = Math.min(...pendVals);
    if (!Number.isFinite(pendenteItem)) continue;
    if (soma > pendenteItem + 1e-6) {
      grupos.push({
        key,
        pdLabel: getPdRaw(linhas[0]!) || key.split('|')[0]!,
        cod: getCodRaw(linhas[0]!) || key.split('|')[1]!,
        pendenteItem,
        somaQtdePendenteReal: soma,
      });
    }
  }

  return { hasIssue: grupos.length > 0, grupos };
}
