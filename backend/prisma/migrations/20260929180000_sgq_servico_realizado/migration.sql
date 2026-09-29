-- Cadastro de serviços realizados por setor de produção.
CREATE TABLE IF NOT EXISTS "sgq_servico_realizado" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "setorProducao" TEXT NOT NULL,
    "exemplosJson" TEXT NOT NULL DEFAULT '[]',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "sgq_servico_realizado_uid_key" UNIQUE ("uid"),
    CONSTRAINT "sgq_servico_realizado_setor_descricao_key" UNIQUE ("setorProducao", "descricao")
);

CREATE INDEX IF NOT EXISTS "sgq_servico_realizado_setorProducao_idx" ON "sgq_servico_realizado"("setorProducao");
