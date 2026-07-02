-- Controle de inatividade para logout automático (complementa logoutInatividadeMinutos do grupo)
ALTER TABLE "usuario" ADD COLUMN "ultimaAtividadeEm" DATETIME;
