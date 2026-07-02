-- CreateTable
CREATE TABLE "cubagem_tipo_carroceria" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT,
    "alturaMm" INTEGER NOT NULL,
    "larguraMm" INTEGER NOT NULL,
    "profundidadeMm" INTEGER NOT NULL,
    "capacidadePesoKg" INTEGER,
    "taraKg" INTEGER,
    "pbtKg" INTEGER,
    "alturaEmpilhamentoMm" INTEGER,
    "aberturas" TEXT,
    "fatorAproveitamento" REAL NOT NULL DEFAULT 0.85,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "cubagem_veiculo" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "placa" TEXT NOT NULL,
    "modelo" TEXT,
    "tipoCarroceriaId" INTEGER NOT NULL,
    "ano" INTEGER,
    "motoristaPadrao" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "cubagem_veiculo_tipoCarroceriaId_fkey" FOREIGN KEY ("tipoCarroceriaId") REFERENCES "cubagem_tipo_carroceria" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cubagem_produto" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "idProduto" INTEGER NOT NULL,
    "codigoProduto" TEXT NOT NULL,
    "descricaoProduto" TEXT NOT NULL,
    "pesoKg" REAL,
    "alturaMm" INTEGER,
    "larguraMm" INTEGER,
    "profundidadeMm" INTEGER,
    "numVolumes" INTEGER NOT NULL DEFAULT 1,
    "empilhavel" BOOLEAN NOT NULL DEFAULT true,
    "pesoMaxTopoKg" REAL,
    "podeDeitar" BOOLEAN NOT NULL DEFAULT true,
    "podeVirar" BOOLEAN NOT NULL DEFAULT true,
    "esteLadoParaCima" BOOLEAN NOT NULL DEFAULT false,
    "fragilNaoSobrepor" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "cubagem_produto_volume" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "produtoCubagemId" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,
    "descricao" TEXT,
    "alturaMm" INTEGER,
    "larguraMm" INTEGER,
    "profundidadeMm" INTEGER,
    "pesoKg" REAL,
    CONSTRAINT "cubagem_produto_volume_produtoCubagemId_fkey" FOREIGN KEY ("produtoCubagemId") REFERENCES "cubagem_produto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "cubagem_veiculo_placa_key" ON "cubagem_veiculo"("placa");

-- CreateIndex
CREATE INDEX "cubagem_veiculo_tipoCarroceriaId_idx" ON "cubagem_veiculo"("tipoCarroceriaId");

-- CreateIndex
CREATE UNIQUE INDEX "cubagem_produto_idProduto_key" ON "cubagem_produto"("idProduto");

-- CreateIndex
CREATE INDEX "cubagem_produto_codigoProduto_idx" ON "cubagem_produto"("codigoProduto");

-- CreateIndex
CREATE INDEX "cubagem_produto_volume_produtoCubagemId_idx" ON "cubagem_produto_volume"("produtoCubagemId");

-- CreateIndex
CREATE UNIQUE INDEX "cubagem_produto_volume_produtoCubagemId_ordem_key" ON "cubagem_produto_volume"("produtoCubagemId", "ordem");
