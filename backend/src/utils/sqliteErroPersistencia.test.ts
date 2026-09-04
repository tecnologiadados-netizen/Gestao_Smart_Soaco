import { describe, expect, it } from 'vitest';
import { mensagemErroPersistenciaSqlite } from './sqliteErroPersistencia.js';

describe('mensagemErroPersistenciaSqlite', () => {
  it('sanitiza database disk image malformed', () => {
    const raw =
      'PrismaClientUnknownRequestError: Invalid `prisma.pedidoPrevisaoAjuste.createMany()` invocation\nSqliteError: database disk image is malformed';
    expect(mensagemErroPersistenciaSqlite(new Error(raw))).toMatch(/inconsistente/);
    expect(mensagemErroPersistenciaSqlite(new Error(raw))).not.toMatch(/createMany/);
  });

  it('sanitiza banco ocupado', () => {
    expect(mensagemErroPersistenciaSqlite(new Error('SQLITE_BUSY: database is locked'))).toMatch(
      /ocupado/
    );
  });

  it('sanitiza dump genérico do Prisma', () => {
    expect(
      mensagemErroPersistenciaSqlite(new Error('Invalid `prisma.foo()` invocation'))
    ).toMatch(/Não foi possível gravar/);
  });

  it('preserva mensagem de negócio', () => {
    expect(mensagemErroPersistenciaSqlite(new Error('Motivo é obrigatório'))).toBe(
      'Motivo é obrigatório'
    );
  });
});
