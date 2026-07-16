-- Migração do módulo RH (tabelas ausentes no banco).
-- Gerada a partir do schema.prisma (somente objetos rh_*).

CREATE TABLE "rh_grupo_permissao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "grupo_id" INTEGER NOT NULL,
    "permissions" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "rh_grupo_permissao_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo_usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "rh_organico" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matricula" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "setor" TEXT NOT NULL,
    "area" TEXT,
    "lider" TEXT,
    "data_admissao" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'Ativo',
    "values_json" TEXT NOT NULL DEFAULT '[]',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE TABLE "rh_faltas_atestados" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "data" DATETIME NOT NULL,
    "mes_falta" TEXT,
    "matricula" TEXT NOT NULL,
    "nome_funcionario" TEXT NOT NULL,
    "endereco" TEXT,
    "area" TEXT,
    "setor" TEXT,
    "lider" TEXT,
    "periodo" TEXT,
    "qntd" TEXT,
    "dias_turno" TEXT,
    "tipo" TEXT,
    "cid" TEXT,
    "local_atendimento" TEXT,
    "medico_responsavel" TEXT,
    "observacoes" TEXT,
    "aprovado" TEXT,
    "reprovado" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE TABLE "rh_sancoes_disciplinares" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matricula" TEXT NOT NULL,
    "nome_funcionario" TEXT NOT NULL,
    "tipo" TEXT,
    "data_aplicacao" DATETIME NOT NULL,
    "mes" TEXT,
    "ano" TEXT,
    "observacoes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE TABLE "rh_faltas_cad_periodos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ordem" INTEGER NOT NULL,
    "valor" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE TABLE "rh_faltas_cad_tipos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ordem" INTEGER NOT NULL,
    "valor" TEXT NOT NULL,
    "contabiliza_indicadores" BOOLEAN NOT NULL DEFAULT true,
    "classificacao_indicador" TEXT,
    "exibir_no_detalhamento" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE TABLE "rh_faltas_cad_cids" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ordem" INTEGER NOT NULL,
    "valor" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE TABLE "rh_faltas_cad_tipos_sancoes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ordem" INTEGER NOT NULL,
    "valor" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE TABLE "rh_faltas_cad_categorias_documentos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ordem" INTEGER NOT NULL,
    "valor" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE TABLE "rh_faltas_alerta_regras" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "base_legal" TEXT NOT NULL,
    "referencia_legal" TEXT,
    "limite_resumo" TEXT NOT NULL DEFAULT '',
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "severidade_padrao" TEXT NOT NULL DEFAULT 'media',
    "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT
);

CREATE TABLE "rh_faltas_alerta_enquadramentos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "regra_id" TEXT NOT NULL,
    "falta_id" TEXT NOT NULL,
    "inconsistencia_id" TEXT,
    "matricula" TEXT NOT NULL DEFAULT '',
    "nome_funcionario" TEXT NOT NULL DEFAULT '',
    "data_ausencia" DATETIME,
    "tipo" TEXT NOT NULL DEFAULT '',
    "cid" TEXT,
    "motivo" TEXT NOT NULL DEFAULT '',
    "contexto" TEXT,
    "lancado_por" TEXT NOT NULL DEFAULT '',
    "detectada_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rh_faltas_alerta_enquadramentos_regra_id_fkey" FOREIGN KEY ("regra_id") REFERENCES "rh_faltas_alerta_regras" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "rh_faltas_ausencia_inconsistencias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "falta_id" TEXT NOT NULL,
    "enquadramento_id" TEXT,
    "regra_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "base_legal" TEXT NOT NULL,
    "severidade" TEXT NOT NULL DEFAULT 'media',
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "matricula" TEXT NOT NULL DEFAULT '',
    "nome_funcionario" TEXT NOT NULL DEFAULT '',
    "data_ausencia" DATETIME,
    "dias_acumulados" REAL,
    "limite_dias" REAL,
    "grupo_cid_id" TEXT,
    "grupo_cid_titulo" TEXT,
    "detectada_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvida_em" DATETIME,
    "resolucao_notas" TEXT,
    "lancado_por" TEXT,
    "resolvido_por" TEXT,
    CONSTRAINT "rh_faltas_ausencia_inconsistencias_regra_id_fkey" FOREIGN KEY ("regra_id") REFERENCES "rh_faltas_alerta_regras" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "rh_organico_comentarios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "colaborador_nome" TEXT NOT NULL,
    "colaborador_matricula" TEXT,
    "comentario" TEXT NOT NULL,
    "criado_por" TEXT NOT NULL,
    "tag_codigo" TEXT NOT NULL DEFAULT '6',
    "visibilidade" TEXT NOT NULL DEFAULT 'public',
    "tipo" TEXT NOT NULL DEFAULT 'comentario',
    "categoria" TEXT NOT NULL DEFAULT 'geral',
    "campo_alterado" TEXT,
    "valor_anterior" TEXT,
    "valor_atual" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "rh_organico_fotos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "colaborador_matricula" TEXT NOT NULL,
    "colaborador_nome" TEXT NOT NULL,
    "foto_base64" TEXT NOT NULL,
    "mime_type" TEXT,
    "updated_by" TEXT,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "rh_organico_trajetoria" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "colaborador_matricula" TEXT NOT NULL,
    "colaborador_nome" TEXT NOT NULL DEFAULT '',
    "data_evento" DATETIME NOT NULL,
    "tipo_evento" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "motivo" TEXT,
    "origem_arquivo" TEXT,
    "importado_por" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "rh_organico_alteracao_pendente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "colaborador_matricula" TEXT NOT NULL,
    "colaborador_nome" TEXT NOT NULL DEFAULT '',
    "setor" TEXT NOT NULL DEFAULT '',
    "tipo" TEXT NOT NULL,
    "campo_label" TEXT NOT NULL DEFAULT '',
    "valor_anterior" TEXT NOT NULL DEFAULT '',
    "valor_atual" TEXT NOT NULL DEFAULT '',
    "motivo" TEXT,
    "detected_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" DATETIME,
    "resolved_by" TEXT,
    "data_referencia" DATETIME,
    "organico_trajetoria_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rh_organico_alteracao_pendente_organico_trajetoria_id_fkey" FOREIGN KEY ("organico_trajetoria_id") REFERENCES "rh_organico_trajetoria" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "rh_organico_representantes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "representante_key" TEXT NOT NULL,
    "nome_razao_social" TEXT NOT NULL,
    "nome_fantasia" TEXT,
    "foto_base64" TEXT,
    "foto_mime_type" TEXT,
    "cpf" TEXT,
    "admissao" TEXT,
    "tempo_empresa" TEXT,
    "cargo" TEXT,
    "area" TEXT,
    "setor" TEXT,
    "nascimento" TEXT,
    "idade" TEXT,
    "grau_instrucao" TEXT,
    "vinculo" TEXT,
    "telefone" TEXT,
    "telefone_emergencial" TEXT,
    "agencia" TEXT,
    "conta" TEXT,
    "banco" TEXT,
    "chave_pix" TEXT,
    "caso_nao_tenha_pix" TEXT,
    "updated_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE TABLE "rh_organico_archive_folder_global" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    CONSTRAINT "rh_organico_archive_folder_global_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "rh_organico_archive_folder_global" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "rh_organico_archive_folder_local" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matricula" TEXT NOT NULL,
    "parent_global_id" TEXT,
    "parent_local_id" TEXT,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    CONSTRAINT "rh_organico_archive_folder_local_parent_global_id_fkey" FOREIGN KEY ("parent_global_id") REFERENCES "rh_organico_archive_folder_global" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "rh_organico_archive_folder_local_parent_local_id_fkey" FOREIGN KEY ("parent_local_id") REFERENCES "rh_organico_archive_folder_local" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "rh_organico_archive_folder_hidden" (
    "matricula" TEXT NOT NULL,
    "global_folder_id" TEXT NOT NULL,
    "hidden_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "hidden_by" TEXT,

    PRIMARY KEY ("matricula", "global_folder_id"),
    CONSTRAINT "rh_organico_archive_folder_hidden_global_folder_id_fkey" FOREIGN KEY ("global_folder_id") REFERENCES "rh_organico_archive_folder_global" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "rh_organico_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matricula" TEXT NOT NULL,
    "global_folder_id" TEXT,
    "local_folder_id" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "classification" TEXT NOT NULL DEFAULT 'confidential',
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "storage_path" TEXT NOT NULL,
    "cover_storage_path" TEXT,
    "source_pages" TEXT,
    "source_kind" TEXT NOT NULL DEFAULT 'individual',
    "status" TEXT NOT NULL DEFAULT 'active',
    "launch_source" TEXT,
    "launch_source_record_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME,
    "deleted_by" TEXT,
    CONSTRAINT "rh_organico_documents_global_folder_id_fkey" FOREIGN KEY ("global_folder_id") REFERENCES "rh_organico_archive_folder_global" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "rh_organico_documents_local_folder_id_fkey" FOREIGN KEY ("local_folder_id") REFERENCES "rh_organico_archive_folder_local" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "rh_organico_document_audit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "document_id" TEXT,
    "matricula" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "details" TEXT,
    "occurred_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rh_organico_document_audit_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "rh_organico_documents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "rh_colaboradores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "setor" TEXT NOT NULL,
    "salario" REAL NOT NULL,
    "admissao" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Ativo',
    "tempo_empresa" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE TABLE "rh_cargos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cargo" TEXT NOT NULL,
    "faixa_min" REAL NOT NULL,
    "faixa_max" REAL NOT NULL,
    "media_atual" REAL NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "rh_cargos_inconsistencias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cargo" TEXT NOT NULL,
    "setor" TEXT NOT NULL,
    "problema" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "rh_cargos_salario_setor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "setor" TEXT NOT NULL,
    "media" REAL NOT NULL,
    "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "rh_cargo_faixas" (
    "cargo" TEXT NOT NULL PRIMARY KEY,
    "faixa_min" REAL,
    "faixa_max" REAL,
    "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT
);

CREATE TABLE "rh_dashboard_turnover" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mes" TEXT NOT NULL,
    "valor" REAL NOT NULL,
    "ordem" INTEGER NOT NULL
);

CREATE TABLE "rh_dashboard_headcount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "setor" TEXT NOT NULL,
    "count" INTEGER NOT NULL
);

CREATE TABLE "rh_dashboard_custo_setor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL
);

CREATE TABLE "rh_dashboard_alertas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL
);

CREATE TABLE "rh_relatorios_mensais" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "month" TEXT NOT NULL,
    "admissoes" INTEGER NOT NULL,
    "demissoes" INTEGER NOT NULL,
    "folha" REAL NOT NULL,
    "ordem" INTEGER NOT NULL
);

CREATE TABLE "rh_pontualidade_ponto_snapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rows" TEXT NOT NULL DEFAULT '[]',
    "date_range_start" TEXT,
    "date_range_end" TEXT,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "rh_config" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT,
    "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "rh_replace_snapshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dataset" TEXT NOT NULL,
    "actor" TEXT,
    "action" TEXT NOT NULL DEFAULT 'replace',
    "row_count_before" INTEGER NOT NULL DEFAULT 0,
    "snapshot" TEXT NOT NULL,
    "meta" TEXT NOT NULL DEFAULT '{}',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "rh_organico_log_sancao_fingerprint" (
    "fingerprint" TEXT NOT NULL PRIMARY KEY,
    "organico_comentario_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rh_organico_log_sancao_fingerprint_organico_comentario_id_fkey" FOREIGN KEY ("organico_comentario_id") REFERENCES "rh_organico_comentarios" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "rh_grupo_permissao_grupo_id_key" ON "rh_grupo_permissao"("grupo_id");

CREATE INDEX "rh_faltas_cad_periodos_ordem_idx" ON "rh_faltas_cad_periodos"("ordem");

CREATE INDEX "rh_faltas_cad_tipos_ordem_idx" ON "rh_faltas_cad_tipos"("ordem");

CREATE INDEX "rh_faltas_cad_cids_ordem_idx" ON "rh_faltas_cad_cids"("ordem");

CREATE INDEX "rh_faltas_cad_tipos_sancoes_ordem_idx" ON "rh_faltas_cad_tipos_sancoes"("ordem");

CREATE INDEX "rh_faltas_cad_categorias_documentos_ordem_idx" ON "rh_faltas_cad_categorias_documentos"("ordem");

CREATE INDEX "rh_faltas_alerta_enquadramentos_regra_id_detectada_em_idx" ON "rh_faltas_alerta_enquadramentos"("regra_id", "detectada_em");

CREATE INDEX "rh_faltas_ausencia_inconsistencias_status_detectada_em_idx" ON "rh_faltas_ausencia_inconsistencias"("status", "detectada_em");

CREATE INDEX "rh_organico_comentarios_colaborador_nome_colaborador_matricula_created_at_idx" ON "rh_organico_comentarios"("colaborador_nome", "colaborador_matricula", "created_at");

CREATE UNIQUE INDEX "rh_organico_fotos_colaborador_matricula_key" ON "rh_organico_fotos"("colaborador_matricula");

CREATE INDEX "rh_organico_fotos_colaborador_nome_idx" ON "rh_organico_fotos"("colaborador_nome");

CREATE INDEX "rh_organico_trajetoria_colaborador_matricula_data_evento_created_at_idx" ON "rh_organico_trajetoria"("colaborador_matricula", "data_evento", "created_at");

CREATE INDEX "rh_organico_alteracao_pendente_setor_idx" ON "rh_organico_alteracao_pendente"("setor");

CREATE UNIQUE INDEX "rh_organico_representantes_representante_key_key" ON "rh_organico_representantes"("representante_key");

CREATE INDEX "rh_organico_archive_folder_global_parent_id_sort_order_idx" ON "rh_organico_archive_folder_global"("parent_id", "sort_order");

CREATE INDEX "rh_organico_archive_folder_local_matricula_sort_order_idx" ON "rh_organico_archive_folder_local"("matricula", "sort_order");

CREATE INDEX "rh_organico_documents_matricula_status_created_at_idx" ON "rh_organico_documents"("matricula", "status", "created_at");

CREATE INDEX "rh_organico_documents_global_folder_id_idx" ON "rh_organico_documents"("global_folder_id");

CREATE INDEX "rh_organico_documents_local_folder_id_idx" ON "rh_organico_documents"("local_folder_id");

CREATE INDEX "rh_organico_documents_launch_source_launch_source_record_id_idx" ON "rh_organico_documents"("launch_source", "launch_source_record_id");

CREATE INDEX "rh_organico_document_audit_matricula_occurred_at_idx" ON "rh_organico_document_audit"("matricula", "occurred_at");

CREATE UNIQUE INDEX "rh_colaboradores_codigo_key" ON "rh_colaboradores"("codigo");
