import { setorProgramacaoIgnoraAbateEstoque } from './abaterSaldoEstoqueProgramacao';
import { isRecursoPcp } from './programacaoSetorialRecursoPcp';

export type ItemAglutinavelProgramacao = {
  Observacoes?: string;
  DataBaseIso?: string;
  DataBase?: string;
  Previsao?: string;
  Cod?: string;
  PD?: string;
  idChave?: string;
  id?: string;
  Recurso?: string;
  'Setor de Producao'?: string;
  originalQty: number;
  qtyToProduce: number;
  fulfilledByStock: number;
};

/**
 * Junta linhas da mesma observação, data base e código.
 * Cadeiras fica de fora: cada pedido permanece na própria linha, com a quantidade dele,
 * mesmo quando a previsão cai no mesmo dia e o produto é o mesmo.
 */
export function aglutinarItensProgramacaoSetorial<T extends ItemAglutinavelProgramacao>(items: T[]): T[] {
  const groups = new Map<string, T>();
  items.forEach((item, index) => {
    const dataBase = String(item.DataBaseIso ?? item.DataBase ?? item.Previsao ?? '');
    const fragmentar = setorProgramacaoIgnoraAbateEstoque(item['Setor de Producao']);
    const key = fragmentar
      ? `linha:${index}`
      : `${item.Observacoes ?? ''}|${dataBase}|${item.Cod ?? ''}`;

    const atual = groups.get(key);
    if (!atual) {
      groups.set(key, { ...item });
      return;
    }

    atual.originalQty += item.originalQty;
    atual.qtyToProduce += item.qtyToProduce;
    atual.fulfilledByStock += item.fulfilledByStock;
    if (item.PD && !String(atual.PD || '').includes(String(item.PD))) {
      atual.PD = atual.PD ? `${atual.PD}, ${item.PD}` : item.PD;
    }
    // Recurso: necessário para o setor "Corte e Dobra" (PCP). Se o primeiro item não tinha PCP, outro da mesma chave pode ter.
    if (isRecursoPcp(item.Recurso)) {
      atual.Recurso = item.Recurso;
    } else if (!isRecursoPcp(atual.Recurso) && item.Recurso != null && String(item.Recurso).trim() !== '') {
      atual.Recurso = item.Recurso;
    }
  });
  return [...groups.values()];
}
