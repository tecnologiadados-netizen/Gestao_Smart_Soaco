/**
 * Link estável, por documento, da evidência visual das divergências.
 * Quem recebe o endereço abre os cards sem login.
 */
import { randomBytes } from 'node:crypto';
import { prisma } from '../config/prisma.js';

export type CabecalhoEvidenciaDoubleCheck = {
  numeroDocumentoFiscal: string | null;
  numeroNfe: string | null;
  dataEntrada: string | null;
  dataEmissao: string | null;
  nomeParceiro: string | null;
};

let tabelaPronta = false;

async function ensureTabela(): Promise<void> {
  if (tabelaPronta) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "double_checkin_espelho_link" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "token" TEXT NOT NULL,
      "idDocumentoEstoque" INTEGER NOT NULL,
      "cabecalhoJson" TEXT NOT NULL,
      "criadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "double_checkin_espelho_link_token_key"
    ON "double_checkin_espelho_link"("token")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "double_checkin_espelho_link_idDocumentoEstoque_key"
    ON "double_checkin_espelho_link"("idDocumentoEstoque")
  `);
  tabelaPronta = true;
}

function novoToken(): string {
  return randomBytes(12).toString('base64url');
}

function lerCabecalho(raw: string): CabecalhoEvidenciaDoubleCheck {
  try {
    const v = JSON.parse(raw) as Partial<CabecalhoEvidenciaDoubleCheck>;
    return {
      numeroDocumentoFiscal: v.numeroDocumentoFiscal ?? null,
      numeroNfe: v.numeroNfe ?? null,
      dataEntrada: v.dataEntrada ?? null,
      dataEmissao: v.dataEmissao ?? null,
      nomeParceiro: v.nomeParceiro ?? null,
    };
  } catch {
    return {
      numeroDocumentoFiscal: null,
      numeroNfe: null,
      dataEntrada: null,
      dataEmissao: null,
      nomeParceiro: null,
    };
  }
}

export async function obterOuCriarLinkEvidencia(
  idDocumentoEstoque: number,
  cabecalho: CabecalhoEvidenciaDoubleCheck
): Promise<string> {
  await ensureTabela();
  const cabecalhoJson = JSON.stringify(cabecalho);
  const existentes = await prisma.$queryRaw<{ token: string }[]>`
    SELECT token FROM double_checkin_espelho_link
    WHERE idDocumentoEstoque = ${idDocumentoEstoque}
    LIMIT 1
  `;
  if (existentes[0]?.token) {
    await prisma.$executeRaw`
      UPDATE double_checkin_espelho_link
      SET cabecalhoJson = ${cabecalhoJson}
      WHERE idDocumentoEstoque = ${idDocumentoEstoque}
    `;
    return existentes[0].token;
  }
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const token = novoToken();
    try {
      await prisma.$executeRaw`
        INSERT INTO double_checkin_espelho_link (token, idDocumentoEstoque, cabecalhoJson)
        VALUES (${token}, ${idDocumentoEstoque}, ${cabecalhoJson})
      `;
      return token;
    } catch {
      const deNovo = await prisma.$queryRaw<{ token: string }[]>`
        SELECT token FROM double_checkin_espelho_link
        WHERE idDocumentoEstoque = ${idDocumentoEstoque}
        LIMIT 1
      `;
      if (deNovo[0]?.token) return deNovo[0].token;
    }
  }
  throw new Error('Não foi possível gerar o link da evidência.');
}

export async function buscarEvidenciaPorToken(token: string): Promise<{
  idDocumentoEstoque: number;
  cabecalho: CabecalhoEvidenciaDoubleCheck;
} | null> {
  await ensureTabela();
  const rows = await prisma.$queryRaw<{ idDocumentoEstoque: number; cabecalhoJson: string }[]>`
    SELECT idDocumentoEstoque, cabecalhoJson
    FROM double_checkin_espelho_link
    WHERE token = ${token}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    idDocumentoEstoque: Number(row.idDocumentoEstoque),
    cabecalho: lerCabecalho(row.cabecalhoJson),
  };
}
