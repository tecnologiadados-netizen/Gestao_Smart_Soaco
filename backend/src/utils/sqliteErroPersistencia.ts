/**
 * Mensagem amigável para falhas de persistência no SQLite/Prisma.
 * O stack cru (Prisma + SqliteError) não deve ir para a UI.
 */
export function mensagemErroPersistenciaSqlite(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  if (/malformed|disk image/i.test(raw)) {
    return 'O banco local está inconsistente e não pôde gravar os ajustes. Restaure o SQLite (dev.db) e tente novamente.';
  }
  if (/SQLITE_BUSY|database is locked/i.test(raw)) {
    return 'O banco está ocupado. Tente concluir novamente em alguns segundos.';
  }
  if (/Prisma|invocation|SqliteError/i.test(raw)) {
    return 'Não foi possível gravar os ajustes no Gerenciador. Tente novamente.';
  }
  return raw.trim() || 'Erro ao registrar ajuste em lote';
}
