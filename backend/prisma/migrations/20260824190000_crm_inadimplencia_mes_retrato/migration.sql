CREATE TABLE "crm_inadimplencia_mes_retrato" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mes" TEXT NOT NULL,
    "valor_vencido" REAL NOT NULL DEFAULT 0,
    "qtd_vencido" INTEGER NOT NULL DEFAULT 0,
    "valor_aberto" REAL NOT NULL DEFAULT 0,
    "qtd_aberto" INTEGER NOT NULL DEFAULT 0,
    "pct_inadimplente" REAL NOT NULL DEFAULT 0,
    "valor_atraso" REAL NOT NULL DEFAULT 0,
    "qtd_atraso" INTEGER NOT NULL DEFAULT 0,
    "pct_atraso" REAL NOT NULL DEFAULT 0,
    "oficial" BOOLEAN NOT NULL DEFAULT 0,
    "atrasado" BOOLEAN NOT NULL DEFAULT 0,
    "capturado_em" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "crm_inadimplencia_mes_retrato_mes_key" ON "crm_inadimplencia_mes_retrato"("mes");
CREATE INDEX "crm_inadimplencia_mes_retrato_oficial_mes_idx" ON "crm_inadimplencia_mes_retrato"("oficial", "mes");
