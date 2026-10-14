const STORAGE_KEY = 'gsmart:chunk-obsoleto-reload';
const JANELA_MS = 60_000;

let disparouNestaAba = false;

/** Falha típica de `import()` quando o deploy trocou o hash e o arquivo antigo não existe mais. */
export function isErroChunkObsoleto(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(
    msg,
  );
}

/**
 * Recarrega a página uma vez para buscar o index.html novo.
 * Na mesma aba, chamadas seguintes devolvem true para a UI esperar o reload
 * em vez de mostrar o erro. Depois do reload, uma nova falha em até 1 minuto
 * não dispara outro ciclo.
 */
export function recarregarSeChunkObsoleto(err?: unknown): boolean {
  if (err != null && !isErroChunkObsoleto(err)) return false;
  if (disparouNestaAba) return true;
  try {
    const prev = Number(sessionStorage.getItem(STORAGE_KEY) || 0);
    if (prev && Date.now() - prev < JANELA_MS) return false;
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // sessionStorage indisponível: ainda tenta o reload, sem a trava entre cargas.
  }
  disparouNestaAba = true;
  window.location.reload();
  return true;
}
