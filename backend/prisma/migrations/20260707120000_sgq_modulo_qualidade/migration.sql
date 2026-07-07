-- CreateTable
CREATE TABLE "sgq_setor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sgq_tipo_documento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sgq_opcao_lista" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "sgq_documento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "tipoUid" TEXT NOT NULL,
    "setorUid" TEXT NOT NULL,
    "versaoAtual" TEXT NOT NULL,
    "localizacao" TEXT,
    "permissoesJson" TEXT,
    "publicacaoJson" TEXT,
    "validadeJson" TEXT,
    "externoRegistroJson" TEXT,
    "criadoPorLogin" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sgq_documento_versao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "documentoId" INTEGER NOT NULL,
    "versao" TEXT NOT NULL,
    "elaboradorLogin" TEXT,
    "consensoLogin" TEXT,
    "revisorLogin" TEXT,
    "aprovadorLogin" TEXT,
    "prazosJson" TEXT,
    "dataElaboracao" TEXT,
    "dataRevisao" TEXT,
    "dataAprovacao" TEXT,
    "observacoes" TEXT,
    "justificativaRevisao" TEXT,
    "alteracoesRevisao" TEXT,
    "observacoesElaboracao" TEXT,
    "observacoesConsenso" TEXT,
    "observacoesAprovacao" TEXT,
    "movimentacoesJson" TEXT,
    "requerSubstituicaoConsenso" BOOLEAN NOT NULL DEFAULT false,
    "arquivoNome" TEXT,
    "arquivoStoragePath" TEXT,
    "arquivoMimeType" TEXT,
    "arquivoAtualizadoEm" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "sgq_documento_versao_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "sgq_documento" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sgq_documento_revalidacao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "documentoId" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "observacoes" TEXT NOT NULL,
    "evidenciaNome" TEXT,
    "evidenciaStoragePath" TEXT,
    "novaDataValidade" TEXT NOT NULL,
    "usuarioLogin" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sgq_documento_revalidacao_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "sgq_documento" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sgq_documento_alerta" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "documentoId" INTEGER NOT NULL,
    "marcoDias" INTEGER NOT NULL,
    "severidade" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sgq_documento_alerta_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "sgq_documento" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sgq_registro" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "codigoDocumento" TEXT,
    "responsavelLogin" TEXT,
    "origemImport" BOOLEAN NOT NULL DEFAULT false,
    "dadosJson" TEXT NOT NULL,
    "criadoPorLogin" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sgq_equipamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "local" TEXT NOT NULL,
    "setorUid" TEXT NOT NULL,
    "responsavelLogin" TEXT NOT NULL,
    "fornecedor" TEXT,
    "tipoCalibracao" TEXT NOT NULL,
    "frequenciaCalibracaoDias" INTEGER NOT NULL,
    "frequenciaVerificacaoDias" INTEGER NOT NULL,
    "ultimaCalibracao" TEXT,
    "ultimaVerificacao" TEXT,
    "proximaCalibracao" TEXT,
    "laudoNome" TEXT,
    "laudoStoragePath" TEXT,
    "versaoLaudoAtual" TEXT,
    "anexosJson" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sgq_calibracao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "equipamentoId" INTEGER NOT NULL,
    "versao" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "responsavelLogin" TEXT NOT NULL,
    "laboratorio" TEXT,
    "laudoNome" TEXT,
    "laudoStoragePath" TEXT,
    "anexosJson" TEXT,
    "observacoes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "sgq_calibracao_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "sgq_equipamento" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sgq_verificacao" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "equipamentoId" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "responsavelLogin" TEXT NOT NULL,
    "observacoes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "sgq_verificacao_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "sgq_equipamento" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sgq_avaliacao_fornecedor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "fornecedorNome" TEXT NOT NULL,
    "avaliadorLogin" TEXT NOT NULL,
    "dataReferencia" TEXT,
    "dataAvaliacao" TEXT,
    "numeroDocumento" TEXT,
    "fornecedorAprovado" BOOLEAN,
    "rncNumero" TEXT,
    "notasJson" TEXT NOT NULL,
    "media" REAL NOT NULL,
    "observacoes" TEXT,
    "origemImport" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sgq_tarefa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "referenciaTipo" TEXT NOT NULL,
    "referenciaId" TEXT NOT NULL,
    "referenciaUid" TEXT,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "responsavelLogin" TEXT NOT NULL,
    "prazo" TEXT,
    "concluida" BOOLEAN NOT NULL DEFAULT false,
    "metadadosJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sgq_anexo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uid" TEXT NOT NULL,
    "contexto" TEXT NOT NULL,
    "contextoUid" TEXT NOT NULL,
    "registroId" INTEGER,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sgq_anexo_registroId_fkey" FOREIGN KEY ("registroId") REFERENCES "sgq_registro" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "sgq_setor_uid_key" ON "sgq_setor"("uid");
CREATE UNIQUE INDEX "sgq_setor_sigla_key" ON "sgq_setor"("sigla");
CREATE UNIQUE INDEX "sgq_tipo_documento_uid_key" ON "sgq_tipo_documento"("uid");
CREATE UNIQUE INDEX "sgq_tipo_documento_sigla_key" ON "sgq_tipo_documento"("sigla");
CREATE UNIQUE INDEX "sgq_opcao_lista_chave_valor_key" ON "sgq_opcao_lista"("chave", "valor");
CREATE INDEX "sgq_opcao_lista_chave_idx" ON "sgq_opcao_lista"("chave");
CREATE UNIQUE INDEX "sgq_documento_uid_key" ON "sgq_documento"("uid");
CREATE UNIQUE INDEX "sgq_documento_codigo_key" ON "sgq_documento"("codigo");
CREATE INDEX "sgq_documento_status_idx" ON "sgq_documento"("status");
CREATE INDEX "sgq_documento_tipoUid_idx" ON "sgq_documento"("tipoUid");
CREATE INDEX "sgq_documento_setorUid_idx" ON "sgq_documento"("setorUid");
CREATE UNIQUE INDEX "sgq_documento_versao_uid_key" ON "sgq_documento_versao"("uid");
CREATE UNIQUE INDEX "sgq_documento_versao_documentoId_versao_key" ON "sgq_documento_versao"("documentoId", "versao");
CREATE INDEX "sgq_documento_versao_documentoId_idx" ON "sgq_documento_versao"("documentoId");
CREATE UNIQUE INDEX "sgq_documento_revalidacao_uid_key" ON "sgq_documento_revalidacao"("uid");
CREATE INDEX "sgq_documento_revalidacao_documentoId_idx" ON "sgq_documento_revalidacao"("documentoId");
CREATE UNIQUE INDEX "sgq_documento_alerta_uid_key" ON "sgq_documento_alerta"("uid");
CREATE INDEX "sgq_documento_alerta_documentoId_idx" ON "sgq_documento_alerta"("documentoId");
CREATE UNIQUE INDEX "sgq_registro_uid_key" ON "sgq_registro"("uid");
CREATE UNIQUE INDEX "sgq_registro_numero_key" ON "sgq_registro"("numero");
CREATE INDEX "sgq_registro_tipo_status_idx" ON "sgq_registro"("tipo", "status");
CREATE INDEX "sgq_registro_createdAt_idx" ON "sgq_registro"("createdAt");
CREATE UNIQUE INDEX "sgq_equipamento_uid_key" ON "sgq_equipamento"("uid");
CREATE UNIQUE INDEX "sgq_equipamento_codigo_key" ON "sgq_equipamento"("codigo");
CREATE UNIQUE INDEX "sgq_calibracao_uid_key" ON "sgq_calibracao"("uid");
CREATE INDEX "sgq_calibracao_equipamentoId_idx" ON "sgq_calibracao"("equipamentoId");
CREATE UNIQUE INDEX "sgq_verificacao_uid_key" ON "sgq_verificacao"("uid");
CREATE INDEX "sgq_verificacao_equipamentoId_idx" ON "sgq_verificacao"("equipamentoId");
CREATE UNIQUE INDEX "sgq_avaliacao_fornecedor_uid_key" ON "sgq_avaliacao_fornecedor"("uid");
CREATE INDEX "sgq_avaliacao_fornecedor_fornecedorId_idx" ON "sgq_avaliacao_fornecedor"("fornecedorId");
CREATE INDEX "sgq_avaliacao_fornecedor_dataAvaliacao_idx" ON "sgq_avaliacao_fornecedor"("dataAvaliacao");
CREATE UNIQUE INDEX "sgq_tarefa_uid_key" ON "sgq_tarefa"("uid");
CREATE INDEX "sgq_tarefa_responsavelLogin_concluida_idx" ON "sgq_tarefa"("responsavelLogin", "concluida");
CREATE INDEX "sgq_tarefa_referenciaTipo_referenciaId_idx" ON "sgq_tarefa"("referenciaTipo", "referenciaId");
CREATE UNIQUE INDEX "sgq_anexo_uid_key" ON "sgq_anexo"("uid");
CREATE INDEX "sgq_anexo_contexto_contextoUid_idx" ON "sgq_anexo"("contexto", "contextoUid");
CREATE INDEX "sgq_anexo_registroId_idx" ON "sgq_anexo"("registroId");
