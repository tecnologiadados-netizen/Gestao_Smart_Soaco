CREATE TABLE "crm_inadimplente_tarefa_config" (
    "id" INTEGER NOT NULL PRIMARY KEY,
    "responsavel_usuario_id" INTEGER,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_login" TEXT
);

INSERT INTO "crm_inadimplente_tarefa_config" ("id", "updated_at") VALUES (1, CURRENT_TIMESTAMP);

CREATE TABLE "crm_inadimplente_tarefa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "origem" TEXT NOT NULL,
    "codigo_conta" TEXT NOT NULL,
    "cliente_nome" TEXT NOT NULL,
    "cliente_chave" TEXT NOT NULL,
    "empresa_id" INTEGER,
    "empresa_nome" TEXT,
    "banco" TEXT,
    "tipo" TEXT,
    "vencimento" TEXT,
    "valor" REAL NOT NULL DEFAULT 0,
    "dias_atraso" INTEGER NOT NULL DEFAULT 0,
    "nf_pd" TEXT,
    "descricao" TEXT,
    "vendedor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'aberta',
    "responsavel_usuario_id" INTEGER,
    "concluida_em" DATETIME,
    "last_seen_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "crm_inadimplente_tarefa_origem_codigo_conta_key" ON "crm_inadimplente_tarefa"("origem", "codigo_conta");
CREATE INDEX "crm_inadimplente_tarefa_status_vencimento_idx" ON "crm_inadimplente_tarefa"("status", "vencimento");
CREATE INDEX "crm_inadimplente_tarefa_cliente_chave_idx" ON "crm_inadimplente_tarefa"("cliente_chave");
CREATE INDEX "crm_inadimplente_tarefa_responsavel_usuario_id_idx" ON "crm_inadimplente_tarefa"("responsavel_usuario_id");

CREATE TABLE "crm_inadimplente_tarefa_contato" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tarefa_id" INTEGER NOT NULL,
    "data_contato" DATETIME,
    "texto" TEXT NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "criado_por_login" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_inadimplente_tarefa_contato_tarefa_id_fkey" FOREIGN KEY ("tarefa_id") REFERENCES "crm_inadimplente_tarefa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "crm_inadimplente_tarefa_contato_tarefa_id_data_contato_idx" ON "crm_inadimplente_tarefa_contato"("tarefa_id", "data_contato");
CREATE INDEX "crm_inadimplente_tarefa_contato_tarefa_id_created_at_idx" ON "crm_inadimplente_tarefa_contato"("tarefa_id", "created_at");
