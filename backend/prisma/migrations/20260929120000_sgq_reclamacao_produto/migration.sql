-- Cadastro de reclamações de produto por setor de produção.
CREATE TABLE IF NOT EXISTS "sgq_reclamacao_produto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "setorProducao" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "sgq_reclamacao_produto_uid_key" UNIQUE ("uid"),
    CONSTRAINT "sgq_reclamacao_produto_setor_descricao_key" UNIQUE ("setorProducao", "descricao")
);

CREATE INDEX IF NOT EXISTS "sgq_reclamacao_produto_setorProducao_idx" ON "sgq_reclamacao_produto"("setorProducao");
