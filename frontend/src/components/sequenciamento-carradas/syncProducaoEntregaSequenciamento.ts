/**
 * Sync produção × entrega ao editar data de produção no sequenciamento.
 * Nunca puxa entrega para baixo; só eleva quando produção passa da entrega.
 */

/** Nova entrega após editar produção, ou null se entrega não deve mudar. */
export function entregaAposEditarProducao(novaProducao: string, entregaAtual: string): string | null {
  if (!novaProducao || !entregaAtual) return null;
  if (novaProducao > entregaAtual) return novaProducao;
  return null;
}

export function aplicarProducaoComSyncEntrega(
  editar: (key: string, campo: 'dataProducao' | 'dataEntrega', value: string) => void,
  key: string,
  producao: string,
  entregaAtual: string
): void {
  editar(key, 'dataProducao', producao);
  const novaEntrega = entregaAposEditarProducao(producao, entregaAtual);
  if (novaEntrega) editar(key, 'dataEntrega', novaEntrega);
}
