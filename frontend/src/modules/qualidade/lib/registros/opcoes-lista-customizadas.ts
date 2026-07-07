export const RCC_RECLAMACOES_OPCOES_STORAGE_KEY = "sgq-rcc-reclamacoes-opcoes";
export const RCC_SERVICOS_OPCOES_STORAGE_KEY = "sgq-rcc-servicos-opcoes";

function normalizarOpcao(opcao: string): string {
  return opcao.trim().toUpperCase();
}

export function carregarOpcoesCustomizadas(storageKey: string): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function mesclarOpcoesLista(
  opcoesBase: readonly string[],
  opcoesCustomizadas: readonly string[],
  valorAtual = ""
): string[] {
  const map = new Map<string, string>();

  for (const opcao of opcoesBase) {
    map.set(normalizarOpcao(opcao), opcao);
  }

  for (const opcao of opcoesCustomizadas) {
    const trimmed = opcao.trim();
    if (!trimmed) continue;
    const chave = normalizarOpcao(trimmed);
    if (!map.has(chave)) map.set(chave, trimmed);
  }

  const valorTrimmed = valorAtual.trim();
  if (valorTrimmed) {
    const chave = normalizarOpcao(valorTrimmed);
    if (!map.has(chave)) map.set(chave, valorTrimmed);
  }

  return Array.from(map.values()).sort((a, b) =>
    a.localeCompare(b, "pt-BR", { sensitivity: "base" })
  );
}

export function adicionarOpcaoCustomizada(
  storageKey: string,
  opcoesCustomizadas: readonly string[],
  opcoesBase: readonly string[],
  novaOpcao: string
): string[] {
  const trimmed = novaOpcao.trim();
  if (!trimmed) return [...opcoesCustomizadas];

  const jaExiste = mesclarOpcoesLista(
    opcoesBase,
    opcoesCustomizadas,
    trimmed
  ).some((opcao) => normalizarOpcao(opcao) === normalizarOpcao(trimmed));

  if (jaExiste) return [...opcoesCustomizadas];

  const proximas = [...opcoesCustomizadas, trimmed].sort((a, b) =>
    a.localeCompare(b, "pt-BR", { sensitivity: "base" })
  );

  if (typeof window !== "undefined") {
    localStorage.setItem(storageKey, JSON.stringify(proximas));
    void import("@qualidade/lib/qualidadePersistence").then(({ scheduleOpcoesListaSync }) =>
      scheduleOpcoesListaSync()
    );
  }

  return proximas;
}

export function filtrarOpcoesLista(
  opcoes: readonly string[],
  termo: string
): string[] {
  const q = termo.trim().toLowerCase();
  if (!q) return [...opcoes];
  return opcoes.filter((opcao) => opcao.toLowerCase().includes(q));
}
