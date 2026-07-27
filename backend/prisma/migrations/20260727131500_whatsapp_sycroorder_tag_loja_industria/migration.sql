-- Separa alertas Comunicação PD Disponível / Não disponível em Loja e Indústria.
-- Destinatários ficam por tipo (configuráveis em Integração → SMS).

UPDATE "whatsapp_notificacao_tipo"
SET "ativo" = 0, "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" IN ('sycroorder_tag_disponivel', 'sycroorder_tag_indisponivel');

INSERT INTO "whatsapp_notificacao_tipo" ("code", "label", "descricao", "ativo", "sortOrder", "fonteMensagem", "modoDisparo", "cronExpressao", "builderCode", "updatedAt")
SELECT
  'sycroorder_tag_disponivel_loja',
  'Card marcado como Disponível (Loja)',
  'Escopo Loja. Vendedores: ANTONIO LUIS PEREIRA DE SOUSA; GILVANIA EVANGELISTA SAMPAIO; MIRIAM DA SILVA NEPOMUCENO; LARISSA CRISTINE PINHEIRO DOS SANTOS.',
  1,
  25,
  'evento',
  'evento',
  NULL,
  NULL,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "whatsapp_notificacao_tipo" WHERE "code" = 'sycroorder_tag_disponivel_loja'
);

INSERT INTO "whatsapp_notificacao_tipo" ("code", "label", "descricao", "ativo", "sortOrder", "fonteMensagem", "modoDisparo", "cronExpressao", "builderCode", "updatedAt")
SELECT
  'sycroorder_tag_disponivel_industria',
  'Card marcado como Disponível (Indústria)',
  'Escopo Indústria. Vendedores: MARCOS AMORIM; IDELGASTO ALVES CAMPELO; J. A. DE P. ROCHA - AIRTON REPRESENTAÇÕES; JAMES PEREIRA DOS SANTOS; JONAS JEMYSON DA SILVA FERREIRA; LARISSE NARLLA; MARIA CLARA; GOLD REPRESENTAÇÕES; HENRIQUE REPRESENTAÇÃO LTDA. Vendedores não listados (ou sem vendedor no PD) também disparam este alerta.',
  1,
  26,
  'evento',
  'evento',
  NULL,
  NULL,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "whatsapp_notificacao_tipo" WHERE "code" = 'sycroorder_tag_disponivel_industria'
);

INSERT INTO "whatsapp_notificacao_tipo" ("code", "label", "descricao", "ativo", "sortOrder", "fonteMensagem", "modoDisparo", "cronExpressao", "builderCode", "updatedAt")
SELECT
  'sycroorder_tag_indisponivel_loja',
  'Card marcado como Não disponível (Loja)',
  'Escopo Loja. Vendedores: ANTONIO LUIS PEREIRA DE SOUSA; GILVANIA EVANGELISTA SAMPAIO; MIRIAM DA SILVA NEPOMUCENO; LARISSA CRISTINE PINHEIRO DOS SANTOS.',
  1,
  27,
  'evento',
  'evento',
  NULL,
  NULL,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "whatsapp_notificacao_tipo" WHERE "code" = 'sycroorder_tag_indisponivel_loja'
);

INSERT INTO "whatsapp_notificacao_tipo" ("code", "label", "descricao", "ativo", "sortOrder", "fonteMensagem", "modoDisparo", "cronExpressao", "builderCode", "updatedAt")
SELECT
  'sycroorder_tag_indisponivel_industria',
  'Card marcado como Não disponível (Indústria)',
  'Escopo Indústria. Vendedores: MARCOS AMORIM; IDELGASTO ALVES CAMPELO; J. A. DE P. ROCHA - AIRTON REPRESENTAÇÕES; JAMES PEREIRA DOS SANTOS; JONAS JEMYSON DA SILVA FERREIRA; LARISSE NARLLA; MARIA CLARA; GOLD REPRESENTAÇÕES; HENRIQUE REPRESENTAÇÃO LTDA. Vendedores não listados (ou sem vendedor no PD) também disparam este alerta.',
  1,
  28,
  'evento',
  'evento',
  NULL,
  NULL,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "whatsapp_notificacao_tipo" WHERE "code" = 'sycroorder_tag_indisponivel_industria'
);
