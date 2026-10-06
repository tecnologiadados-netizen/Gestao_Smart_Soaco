-- PDV: empresa do operador, caixa, venda e certificado.

CREATE TABLE "pdv_usuario_empresa" (
    "usuario_id" INTEGER NOT NULL PRIMARY KEY,
    "id_empresa" INTEGER NOT NULL,
    CONSTRAINT "pdv_usuario_empresa_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "pdv_empresa_config" (
    "id_empresa" INTEGER NOT NULL PRIMARY KEY,
    "nome_empresa" TEXT NOT NULL DEFAULT '',
    "uf" TEXT NOT NULL DEFAULT '',
    "crt" TEXT NOT NULL DEFAULT '',
    "id_tabela_preco" INTEGER,
    "id_tipo_movimentacao" INTEGER,
    "id_tipo_pedido" INTEGER,
    "id_setor_saida" INTEGER,
    "id_condicao_pagamento" INTEGER,
    "id_forma_pagamento" INTEGER,
    "id_pessoa_consumidor" INTEGER,
    "id_conta_bancaria" INTEGER,
    "id_pessoa_vendedor" INTEGER
);

CREATE TABLE "pdv_certificado" (
    "id_empresa" INTEGER NOT NULL PRIMARY KEY,
    "pfx_cipher" TEXT NOT NULL DEFAULT '',
    "senha_cipher" TEXT NOT NULL DEFAULT '',
    "csc_cipher" TEXT NOT NULL DEFAULT '',
    "csc_id" TEXT NOT NULL DEFAULT '',
    "serie_nfce" INTEGER NOT NULL DEFAULT 1,
    "serie_nfe" INTEGER NOT NULL DEFAULT 1,
    "proximo_nfce" INTEGER NOT NULL DEFAULT 1,
    "proximo_nfe" INTEGER NOT NULL DEFAULT 1,
    "ambiente" TEXT NOT NULL DEFAULT 'homologacao',
    "cnpj" TEXT NOT NULL DEFAULT '',
    "valido_ate" DATETIME,
    "titular" TEXT NOT NULL DEFAULT ''
);

CREATE TABLE "pdv_caixa" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "usuario_id" INTEGER NOT NULL,
    "id_empresa" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'aberto',
    "fundo_troco" REAL NOT NULL DEFAULT 0,
    "aberto_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechado_em" DATETIME
);

CREATE INDEX "pdv_caixa_usuario_id_id_empresa_status_idx" ON "pdv_caixa"("usuario_id", "id_empresa", "status");

CREATE TABLE "pdv_caixa_movimento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caixa_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "valor" REAL NOT NULL,
    "observacao" TEXT NOT NULL DEFAULT '',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pdv_caixa_movimento_caixa_id_fkey" FOREIGN KEY ("caixa_id") REFERENCES "pdv_caixa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "pdv_caixa_movimento_caixa_id_idx" ON "pdv_caixa_movimento"("caixa_id");

CREATE TABLE "pdv_venda" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "caixa_id" INTEGER,
    "usuario_id" INTEGER NOT NULL,
    "id_empresa" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'aberta',
    "id_pessoa_cliente" INTEGER,
    "cliente_nome" TEXT NOT NULL DEFAULT '',
    "observacao" TEXT NOT NULL DEFAULT '',
    "fiscal_tipo" TEXT NOT NULL DEFAULT 'nenhuma',
    "id_pedido_nomus" INTEGER,
    "id_documento_nomus" INTEGER,
    "chave" TEXT NOT NULL DEFAULT '',
    "protocolo" TEXT NOT NULL DEFAULT '',
    "status_fiscal" TEXT NOT NULL DEFAULT '',
    "motivo_fiscal" TEXT NOT NULL DEFAULT '',
    "xml_nota" TEXT NOT NULL DEFAULT '',
    "qr_code" TEXT NOT NULL DEFAULT '',
    "total" REAL NOT NULL DEFAULT 0,
    "troco" REAL NOT NULL DEFAULT 0,
    "aliquota_ipi_media" REAL NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluida_em" DATETIME,
    CONSTRAINT "pdv_venda_caixa_id_fkey" FOREIGN KEY ("caixa_id") REFERENCES "pdv_caixa" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "pdv_venda_id_empresa_status_idx" ON "pdv_venda"("id_empresa", "status");
CREATE INDEX "pdv_venda_usuario_id_status_idx" ON "pdv_venda"("usuario_id", "status");

CREATE TABLE "pdv_venda_item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "venda_id" INTEGER NOT NULL,
    "id_produto" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL DEFAULT '',
    "descricao" TEXT NOT NULL DEFAULT '',
    "quantidade" REAL NOT NULL,
    "valor_unitario" REAL NOT NULL,
    "desconto_percentual" REAL NOT NULL DEFAULT 0,
    "id_tabela_preco" INTEGER,
    "ncm" TEXT NOT NULL DEFAULT '',
    "origem" TEXT NOT NULL DEFAULT '',
    "id_unidade_medida" INTEGER,
    "aliquota_ipi" REAL NOT NULL DEFAULT 0,
    "saldo" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "pdv_venda_item_venda_id_fkey" FOREIGN KEY ("venda_id") REFERENCES "pdv_venda" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "pdv_venda_item_venda_id_idx" ON "pdv_venda_item"("venda_id");

CREATE TABLE "pdv_venda_pagamento" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "venda_id" INTEGER NOT NULL,
    "id_forma_pagamento" INTEGER NOT NULL,
    "nome_forma" TEXT NOT NULL DEFAULT '',
    "valor" REAL NOT NULL,
    CONSTRAINT "pdv_venda_pagamento_venda_id_fkey" FOREIGN KEY ("venda_id") REFERENCES "pdv_venda" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "pdv_venda_pagamento_venda_id_idx" ON "pdv_venda_pagamento"("venda_id");
