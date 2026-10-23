CREATE TABLE "diario_contas_pagar_processo_historico" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "processo_id" INTEGER NOT NULL,
    "acao" TEXT NOT NULL,
    "status_anterior" TEXT,
    "status_novo" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "detalhe" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "diario_contas_pagar_processo_historico_processo_id_fkey"
      FOREIGN KEY ("processo_id") REFERENCES "diario_contas_pagar_processo" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "diario_contas_pagar_processo_historico_processo_id_criado_em_idx"
  ON "diario_contas_pagar_processo_historico"("processo_id", "criado_em");

INSERT INTO "diario_contas_pagar_processo_historico"
  ("processo_id", "acao", "status_anterior", "status_novo", "usuario", "detalhe", "criado_em")
SELECT "id", 'Processo iniciado', NULL, 'rascunho', "usuario", NULL, "criado_em"
FROM "diario_contas_pagar_processo";

INSERT INTO "diario_contas_pagar_processo_historico"
  ("processo_id", "acao", "status_anterior", "status_novo", "usuario", "detalhe", "criado_em")
SELECT "id", 'Enviado para aprovação', 'rascunho', 'em_aprovacao', "usuario", NULL, "enviado_em"
FROM "diario_contas_pagar_processo"
WHERE "enviado_em" IS NOT NULL;

INSERT INTO "diario_contas_pagar_processo_historico"
  ("processo_id", "acao", "status_anterior", "status_novo", "usuario", "detalhe", "criado_em")
SELECT "id", 'Processo aprovado', 'em_aprovacao', 'aprovado',
       COALESCE("aprovado_por", "usuario"), NULL, "aprovado_em"
FROM "diario_contas_pagar_processo"
WHERE "aprovado_em" IS NOT NULL;
