ALTER TABLE "decomposicao_produto_pai" ADD COLUMN "grupo" TEXT NOT NULL DEFAULT 'gondolas';

CREATE INDEX IF NOT EXISTS "decomposicao_produto_pai_grupo_idx"
  ON "decomposicao_produto_pai"("grupo");
