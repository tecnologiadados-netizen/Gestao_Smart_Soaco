/** Status tri-estado de previsão confiável no calendário de produção. */
export type StatusConfiavelCalendario = 'sim' | 'nao' | 'branco';

const ORDEM_STATUS: StatusConfiavelCalendario[] = ['sim', 'nao', 'branco'];

/**
 * Precedência: override do rascunho (`map`) → valor do snapshot → em branco.
 * Não usa unanimidade da grade de carradas (mix → todos os status presentes).
 */
export function statusConfiavelEfetivo(
  idPedido: string | undefined,
  map: Record<string, boolean | null | undefined>,
  snapshotValor?: boolean | null
): StatusConfiavelCalendario {
  const id = idPedido?.trim();
  if (id) {
    const escolhido = map[id];
    if (escolhido === true) return 'sim';
    if (escolhido === false) return 'nao';
  }
  if (snapshotValor === true) return 'sim';
  if (snapshotValor === false) return 'nao';
  return 'branco';
}

/** Resolve o status efetivo de uma linha do snapshot. */
export function statusConfiavelDaLinha(
  row: Record<string, unknown>,
  map: Record<string, boolean | null | undefined>
): StatusConfiavelCalendario {
  const id = String(row.id_pedido ?? row.idChave ?? '').trim();
  const snap = row.previsao_atual_confiavel;
  const snapshotValor = snap === true || snap === false ? snap : null;
  return statusConfiavelEfetivo(id || undefined, map, snapshotValor);
}

/** Lista estável dos status presentes (sim → nao → branco). */
export function agregarStatusConfiavel(
  statuses: Iterable<StatusConfiavelCalendario>
): StatusConfiavelCalendario[] {
  const set = new Set<StatusConfiavelCalendario>();
  for (const s of statuses) set.add(s);
  return ORDEM_STATUS.filter((s) => set.has(s));
}

/** Filtro multi: vazio = Todos; senão o status deve estar na seleção. */
export function linhaPassaFiltroConfiavel(
  status: StatusConfiavelCalendario,
  selecionados: string[]
): boolean {
  if (selecionados.length === 0) return true;
  return selecionados.includes(status);
}

/** Mapa id_pedido → status efetivo a partir das linhas do snapshot. */
export function mapaStatusConfiavelPorId(
  linhas: Record<string, unknown>[],
  map: Record<string, boolean | null | undefined>
): Map<string, StatusConfiavelCalendario> {
  const out = new Map<string, StatusConfiavelCalendario>();
  for (const row of linhas) {
    const id = String(row.id_pedido ?? row.idChave ?? '').trim();
    if (!id) continue;
    out.set(id, statusConfiavelDaLinha(row, map));
  }
  return out;
}

/** Status de um detalhe do calendário via idPedido (sem id → em branco). */
export function statusConfiavelDoDetalhe(
  idPedido: string | undefined,
  statusPorId: Map<string, StatusConfiavelCalendario>
): StatusConfiavelCalendario {
  const id = idPedido?.trim();
  if (!id) return 'branco';
  return statusPorId.get(id) ?? 'branco';
}
