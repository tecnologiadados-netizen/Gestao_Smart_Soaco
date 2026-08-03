import { normalizarTextoBusca } from '../utils/textoLivreBusca.js';

/**
 * Empresas parceiras do grupo — pedidos costumam ser requisições internas,
 * não venda comercial típica. Não entram no alerta/fila de pendências de crédito.
 */
export const CLIENTES_PARCEIROS_CREDITO_EXCLUIDOS = [
  'r n marques',
  'so moveis',
] as const;

/** Nome do cliente bate com parceiro excluído (prefixo, após normalizar acentos). */
export function isClienteParceiroCreditoExcluido(nome: string): boolean {
  const n = normalizarTextoBusca(nome);
  if (!n) return false;
  return CLIENTES_PARCEIROS_CREDITO_EXCLUIDOS.some(
    (p) => n === p || n.startsWith(`${p} `) || n.startsWith(`${p}(`) || n.startsWith(`${p}-`)
  );
}
