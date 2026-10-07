-- Motivos filhos de cada motivo de demissão da Secullum e o complemento do desligamento.
CREATE TABLE IF NOT EXISTS "rh_motivo_desligamento_filho" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "motivo_pai" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS "rh_motivo_desligamento_filho_motivo_pai_idx" ON "rh_motivo_desligamento_filho"("motivo_pai");

CREATE TABLE IF NOT EXISTS "rh_desligamento_complemento" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "colaborador_matricula" TEXT NOT NULL,
    "colaborador_nome" TEXT NOT NULL DEFAULT '',
    "data_demissao" TEXT NOT NULL DEFAULT '',
    "motivo_pai" TEXT NOT NULL DEFAULT '',
    "motivo_filho_id" TEXT NOT NULL,
    "motivo_filho" TEXT NOT NULL,
    "motivo_texto" TEXT NOT NULL,
    "registrado_por" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "rh_desligamento_complemento_colaborador_matricula_data_demissao_key"
  ON "rh_desligamento_complemento"("colaborador_matricula", "data_demissao");

CREATE INDEX IF NOT EXISTS "rh_desligamento_complemento_colaborador_matricula_idx"
  ON "rh_desligamento_complemento"("colaborador_matricula");
