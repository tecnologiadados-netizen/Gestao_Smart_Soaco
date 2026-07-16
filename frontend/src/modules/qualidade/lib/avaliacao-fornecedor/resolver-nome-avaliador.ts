import { users as usuariosLegado } from "@qualidade/lib/mock-data/users";

const NOMES_LEGADO_POR_ID = Object.fromEntries(
  usuariosLegado.map((u) => [u.id, u.nome])
);

function formatarIdUsuario(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(" ");
}

/** Resolve o nome exibível do avaliador (ERP, login ou IDs legados `user-*`). */
export function resolverNomeAvaliador(
  avaliadorId: string,
  users: Array<{ id: string; nome: string }>
): string {
  if (!avaliadorId.trim()) return "—";

  const doStore = users.find((u) => u.id === avaliadorId)?.nome;
  if (doStore) return doStore;

  const legado = NOMES_LEGADO_POR_ID[avaliadorId];
  if (legado) return legado;

  if (avaliadorId.startsWith("user-")) {
    return formatarIdUsuario(avaliadorId.slice(5));
  }

  return avaliadorId;
}
