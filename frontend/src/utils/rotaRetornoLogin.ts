const RETURN_TO_KEY = 'gestor_return_to';

/** Salva rota de retorno após login (pathname + search, ex.: ?fav=2). */
export function salvarRotaRetornoAposLogin(pathname: string, search: string): void {
  const path = `${pathname}${search}`;
  if (!path || path === '/') return;
  try {
    sessionStorage.setItem(RETURN_TO_KEY, path);
  } catch {
    // ignore quota / private mode
  }
}

/** Lê e remove a rota salva; null se não houver ou inválida. */
export function consumirRotaRetornoAposLogin(): string | null {
  try {
    const raw = sessionStorage.getItem(RETURN_TO_KEY);
    sessionStorage.removeItem(RETURN_TO_KEY);
    if (!raw || raw === '/') return null;
    if (!raw.startsWith('/')) return null;
    if (raw.startsWith('//')) return null;
    return raw;
  } catch {
    return null;
  }
}
