/**
 * Corrige acentuação corrompida (literais "?") em catálogos/enums do SQLite.
 *
 * Uso:
 *   cd backend && npx tsx scripts/corrigir-acentos-sqlite.ts
 * Simular:
 *   DRY_RUN=1 npx tsx scripts/corrigir-acentos-sqlite.ts
 */
import { prisma } from '../src/config/prisma.js';

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

type Par = { de: string; para: string };

/** Substituições exatas (valor completo da coluna). */
const MAPAS: Record<string, Par[]> = {
  'coleta_precos.status': [
    { de: 'Em cota????o', para: 'Em cotação' },
    { de: 'Em Aprova????o', para: 'Em Aprovação' },
  ],
  'painel_producao_meta.setor': [
    { de: 'Balc??es', para: 'Balcões' },
    { de: 'Fog??es', para: 'Fogões' },
    { de: 'G??ndolas', para: 'Gôndolas' },
    { de: 'M??veis de a??o', para: 'Móveis de aço' },
    { de: 'M??veis em melam??nico', para: 'Móveis em melamínico' },
    { de: 'M??veis em melaminico', para: 'Móveis em melamínico' },
    { de: 'Móveis em melaminico', para: 'Móveis em melamínico' },
  ],
  'grupo_usuario.nome': [
    { de: 'Operador Escrit??rio', para: 'Operador Escritório' },
    { de: 'Produ????o - Painel Metas', para: 'Produção - Painel Metas' },
    { de: 'RH - Gest??o', para: 'RH - Gestão' },
  ],
  'grupo_usuario.descricao': [
    { de: 'Produ????o', para: 'Produção' },
    { de: 'Escrit??rio', para: 'Escritório' },
    { de: 'Gest??o', para: 'Gestão' },
    { de: 'relat??rios', para: 'relatórios' },
    { de: 'usu??rios', para: 'usuários' },
  ],
  'sgq_setor.nome': [
    { de: 'Expedi????o', para: 'Expedição' },
    { de: 'Manuten????o', para: 'Manutenção' },
    { de: 'Montagem  e Refrigera????o de Balc??es', para: 'Montagem  e Refrigeração de Balcões' },
    { de: 'Montagem de fog??es', para: 'Montagem de fogões' },
    { de: 'Montagem de moveis de A??o', para: 'Montagem de moveis de Aço' },
    { de: 'Montagem e refrigera????o de bebedouros', para: 'Montagem e refrigeração de bebedouros' },
    { de: 'Planejamento e controle de produ????o', para: 'Planejamento e controle de produção' },
    { de: 'Produ????o', para: 'Produção' },
    { de: 'Registros de n??o conformidade', para: 'Registros de não conformidade' },
    { de: 'Registros de reclama????es', para: 'Registros de reclamações' },
    { de: 'Seguran??a do Trabalho', para: 'Segurança do Trabalho' },
  ],
  'sgq_tipo_documento.nome': [
    { de: 'Formul??rio', para: 'Formulário' },
    { de: 'Instru????o de Trabalho', para: 'Instrução de Trabalho' },
    { de: 'Procedimento Operacional Padr??o', para: 'Procedimento Operacional Padrão' },
  ],
  'whatsapp_notificacao_tipo.label': [
    { de: 'Altera????o de previs??o de entrega', para: 'Alteração de previsão de entrega' },
    { de: 'Card marcado como Dispon??vel (Ind??stria)', para: 'Card marcado como Disponível (Indústria)' },
    { de: 'Card marcado como Dispon??vel (Loja)', para: 'Card marcado como Disponível (Loja)' },
    { de: 'Card marcado como N??o dispon??vel (Ind??stria)', para: 'Card marcado como Não disponível (Indústria)' },
    { de: 'Card marcado como N??o dispon??vel (Loja)', para: 'Card marcado como Não disponível (Loja)' },
    { de: 'Faturamento di??rio', para: 'Faturamento diário' },
    { de: 'Pedidos com previs??o de entrega vencida', para: 'Pedidos com previsão de entrega vencida' },
  ],
  'email_notificacao_tipo.label': [
    {
      de: 'Alerta de cr??dito ??? cliente regularizado ap??s pausa do pedido',
      para: 'Alerta de crédito — cliente regularizado após pausa do pedido',
    },
    {
      de: 'Alerta de cr??dito ??? pend??ncia em atraso com pedido aberto',
      para: 'Alerta de crédito — pendência em atraso com pedido aberto',
    },
    {
      de: 'Alerta de cr??dito ??? prazo de a????o estourado (PD em carteira)',
      para: 'Alerta de crédito — prazo de ação estourado (PD em carteira)',
    },
    {
      de: 'Alerta de cr??dito ??? resumo di??rio (inadimplentes, regularizados e a????es)',
      para: 'Alerta de crédito — resumo diário (inadimplentes, regularizados e ações)',
    },
  ],
  'email_provider_settings.from_name': [
    { de: 'SoA??o Notifica????es', para: 'SoAço Notificações' },
  ],
  'usuario.nome': [
    { de: 'Ana L??cia', para: 'Ana Lúcia' },
    { de: 'B??rbara Quelly', para: 'Bárbara Quelly' },
    { de: 'Marc??lia Pires', para: 'Marcília Pires' },
    { de: 'Produ????o Metas TV', para: 'Produção Metas TV' },
    { de: 'Tain?? Feitosa', para: 'Tainá Feitosa' },
    { de: 'Vin??cius Cavalcante', para: 'Vinícius Cavalcante' },
  ],
  'pedido_previsao_ajuste.motivo': [
    { de: 'Solicita????o do cliente', para: 'Solicitação do cliente' },
    {
      de: 'Corre????o: sincronizar com data do card Comunica????o PD',
      para: 'Correção: sincronizar com data do card Comunicação PD',
    },
  ],
  'pedido_previsao_ajuste.usuario': [
    { de: 'Vin??cius Cavalcante', para: 'Vinícius Cavalcante' },
  ],
  'mrp_snapshot_row.item_critico': [
    { de: 'N??o', para: 'Não' },
    { de: 'Sem Defini????o', para: 'Sem Definição' },
  ],
  'mrp_snapshot_row.coleta': [
    { de: 'ARAME E VERGALH??O', para: 'ARAME E VERGALHÃO' },
    { de: 'BOBINAS DE A??O', para: 'BOBINAS DE AÇO' },
    { de: 'BOT??O P VIDRO', para: 'BOTÃO P VIDRO' },
    { de: 'CHAPAS DE A??O', para: 'CHAPAS DE AÇO' },
    { de: 'COMPRAS INTERNAS REFRIGERA????O', para: 'COMPRAS INTERNAS REFRIGERAÇÃO' },
    { de: 'CONECTIVOS E CONEX??ES', para: 'CONECTIVOS E CONEXÕES' },
    { de: 'CORREDI??A', para: 'CORREDIÇA' },
    { de: 'FUND??VEIS', para: 'FUNDÍVEIS' },
    { de: 'INFORM??TICA E MATERIAL DE ESCRIT??RIO', para: 'INFORMÁTICA E MATERIAL DE ESCRITÓRIO' },
    { de: 'ITENS DE FOG??O', para: 'ITENS DE FOGÃO' },
    { de: 'ITENS MANUTEN????O', para: 'ITENS MANUTENÇÃO' },
    { de: 'L??S', para: 'LÃS' },
    { de: 'LAMPADA E ABRA??ADEIRA', para: 'LAMPADA E ABRAÇADEIRA' },
    { de: 'P?? DE ALUMINIO', para: 'PÉ DE ALUMINIO' },
    { de: 'PAPEL??O', para: 'PAPELÃO' },
    { de: 'ROD??ZIOS', para: 'RODÍZIOS' },
    { de: 'Sem Defini????o', para: 'Sem Definição' },
    { de: 'TINTA P??', para: 'TINTA PÓ' },
    { de: 'TORNEIRA DE PRESS??O', para: 'TORNEIRA DE PRESSÃO' },
  ],
  'crm_registro_inadimplente.empresa': [
    { de: 'RN MARQUES ARA??JO', para: 'RN MARQUES ARAÚJO' },
    { de: 'S?? A??O  INDUSTRIAL', para: 'SÓ AÇO  INDUSTRIAL' },
    { de: 'S?? A??O INDUSTRIAL', para: 'SÓ AÇO INDUSTRIAL' },
    { de: 'S?? M??VEIS', para: 'SÓ MÓVEIS' },
    { de: 'S?? REFRIGERA????O', para: 'SÓ REFRIGERAÇÃO' },
  ],
  'crm_registro_inadimplente.tipo': [
    { de: 'Boleto Banc??ria', para: 'Boleto Bancária' },
    { de: 'Boleto Banc??rio', para: 'Boleto Bancário' },
    { de: 'Boleto banc??rio', para: 'Boleto bancário' },
    { de: 'Transfer??ncia banc??ria', para: 'Transferência bancária' },
    { de: 'Transferencia Banc??ria', para: 'Transferencia Bancária' },
  ],
  'crm_registro_inadimplente.status': [
    { de: 'NEGOCIA????O EM ATRASO', para: 'NEGOCIAÇÃO EM ATRASO' },
  ],
  'support_ticket_catalog_item.label': [
    { de: 'Aguardando resposta do usu??rio', para: 'Aguardando resposta do usuário' },
    { de: 'Cr??tica', para: 'Crítica' },
    { de: 'D??vida', para: 'Dúvida' },
    { de: 'Em an??lise', para: 'Em análise' },
    { de: 'Informa????o errada', para: 'Informação errada' },
    { de: 'M??dia', para: 'Média' },
  ],
  'rh_faltas_cad_tipos.valor': [
    { de: 'DOA????O DE SANGUE', para: 'DOAÇÃO DE SANGUE' },
    { de: 'LICEN??A MATERNIDADE', para: 'LICENÇA MATERNIDADE' },
    { de: 'LICEN??A PATERNIDADE', para: 'LICENÇA PATERNIDADE' },
    { de: 'LICEN??A PR??-NATAL', para: 'LICENÇA PRÉ-NATAL' },
    { de: 'ATESTADO M??DICO', para: 'ATESTADO MÉDICO' },
  ],
  'rh_faltas_cad_periodos.valor': [
    { de: 'MANH??', para: 'MANHÃ' },
  ],
  'rh_faltas_cad_tipos_sancoes.valor': [
    { de: 'SUSPENS??O', para: 'SUSPENSÃO' },
    { de: 'ADVERT??NCIA', para: 'ADVERTÊNCIA' },
  ],
};

/**
 * Fragmentos seguros para REPLACE em textos longos (notificações, assuntos, descrições de tipos).
 * Aplicados do mais longo para o mais curto.
 */
const FRAGMENTOS: Par[] = [
  { de: 'Comunica????o', para: 'Comunicação' },
  { de: 'Atualiza????o', para: 'Atualização' },
  { de: 'Notifica????es', para: 'Notificações' },
  { de: 'Notifica????o', para: 'Notificação' },
  { de: 'informa????o', para: 'informação' },
  { de: 'Informa????o', para: 'Informação' },
  { de: 'Defini????o', para: 'Definição' },
  { de: 'Aprova????o', para: 'Aprovação' },
  { de: 'cota????o', para: 'cotação' },
  { de: 'produ????o', para: 'produção' },
  { de: 'Produ????o', para: 'Produção' },
  { de: 'previs??o', para: 'previsão' },
  { de: 'Previs??o', para: 'Previsão' },
  { de: 'Altera????o', para: 'Alteração' },
  { de: 'Solicita????o', para: 'Solicitação' },
  { de: 'Corre????o', para: 'Correção' },
  { de: 'reclama????es', para: 'reclamações' },
  { de: 'pend??ncia', para: 'pendência' },
  { de: 'regularizado', para: 'regularizado' },
  { de: 'cr??dito', para: 'crédito' },
  { de: 'Cr??dito', para: 'Crédito' },
  { de: 'di??rio', para: 'diário' },
  { de: 'a????es', para: 'ações' },
  { de: 'ap??s', para: 'após' },
  { de: 'Dispon??vel', para: 'Disponível' },
  { de: 'dispon??vel', para: 'disponível' },
  { de: 'Ind??stria', para: 'Indústria' },
  { de: 'Escrit??rio', para: 'Escritório' },
  { de: 'escrit??rio', para: 'escritório' },
  { de: 'Gest??o', para: 'Gestão' },
  { de: 'usu??rio', para: 'usuário' },
  { de: 'Usu??rio', para: 'Usuário' },
  { de: 'relat??rios', para: 'relatórios' },
  { de: 'Expedi????o', para: 'Expedição' },
  { de: 'Manuten????o', para: 'Manutenção' },
  { de: 'Refrigera????o', para: 'Refrigeração' },
  { de: 'refrigera????o', para: 'refrigeração' },
  { de: 'Formul??rio', para: 'Formulário' },
  { de: 'Instru????o', para: 'Instrução' },
  { de: 'Padr??o', para: 'Padrão' },
  { de: 'an??lise', para: 'análise' },
  { de: 'Cr??tica', para: 'Crítica' },
  { de: 'cr??tico', para: 'crítico' },
  { de: 'D??vida', para: 'Dúvida' },
  { de: 'M??dia', para: 'Média' },
  { de: 'Negocia????o', para: 'Negociação' },
  { de: 'NEGOCIA????O', para: 'NEGOCIAÇÃO' },
  { de: 'Transfer??ncia', para: 'Transferência' },
  { de: 'Banc??rio', para: 'Bancário' },
  { de: 'banc??rio', para: 'bancário' },
  { de: 'Banc??ria', para: 'Bancária' },
  { de: 'banc??ria', para: 'bancária' },
  { de: 'Vin??cius', para: 'Vinícius' },
  { de: 'Marc??lia', para: 'Marcília' },
  { de: 'B??rbara', para: 'Bárbara' },
  { de: 'L??cia', para: 'Lúcia' },
  { de: 'Tain??', para: 'Tainá' },
  { de: 'SoA??o', para: 'SoAço' },
  { de: 'S?? A??o', para: 'Só Aço' },
  { de: 'S?? A??O', para: 'SÓ AÇO' },
  { de: 'S?? M??VEIS', para: 'SÓ MÓVEIS' },
  { de: 'Voc??', para: 'Você' },
  { de: 'n??o', para: 'não' },
  { de: 'N??o', para: 'Não' },
  { de: 'fog??es', para: 'fogões' },
  { de: 'Fog??es', para: 'Fogões' },
  { de: 'Balc??es', para: 'Balcões' },
  { de: 'G??ndolas', para: 'Gôndolas' },
  { de: 'G??NDOLA', para: 'GÔNDOLA' },
  { de: 'G??ndola', para: 'Gôndola' },
  { de: 'CONTINUA????O', para: 'CONTINUAÇÃO' },
  { de: 'Continua????o', para: 'Continuação' },
  { de: 'continua????o', para: 'continuação' },
  { de: 'DIVIS??ES', para: 'DIVISÕES' },
  { de: 'Divis??es', para: 'Divisões' },
  { de: 'a??o', para: 'aço' },
  { de: 'A??o', para: 'Aço' },
  { de: 'A??O', para: 'AÇO' },
  { de: 'M??veis', para: 'Móveis' },
  { de: 'M??VEIS', para: 'MÓVEIS' },
  { de: 'melam??nico', para: 'melamínico' },
  { de: 'Seguran??a', para: 'Segurança' },
  { de: '???', para: '—' },
];

const COLUNAS_FRAGMENTO: Array<{ table: string; column: string }> = [
  { table: 'whatsapp_notificacao_tipo', column: 'descricao' },
  { table: 'email_notificacao_tipo', column: 'descricao' },
  { table: 'grupo_usuario', column: 'descricao' },
  { table: 'sycro_order_notification', column: 'message' },
  { table: 'email_disparo_log', column: 'assunto' },
  { table: 'sycro_order_order', column: 'delivery_method' },
  { table: 'precificacao', column: 'descricaoProduto' },
  { table: 'precificacao_item', column: 'descricaopai' },
  { table: 'precificacao_item', column: 'componente' },
  { table: 'cubagem_produto', column: 'descricaoProduto' },
];

async function updateExact(table: string, column: string, de: string, para: string): Promise<number> {
  const sql = `UPDATE "${table}" SET "${column}" = ? WHERE "${column}" = ?`;
  if (DRY_RUN) {
    const rows = await prisma.$queryRawUnsafe<Array<{ c: number }>>(
      `SELECT COUNT(*) as c FROM "${table}" WHERE "${column}" = ?`,
      de
    );
    return Number(rows[0]?.c ?? 0);
  }
  const result = await prisma.$executeRawUnsafe(sql, para, de);
  return Number(result);
}

async function replaceFragment(table: string, column: string, de: string, para: string): Promise<number> {
  if (DRY_RUN) {
    const rows = await prisma.$queryRawUnsafe<Array<{ c: number }>>(
      `SELECT COUNT(*) as c FROM "${table}" WHERE "${column}" LIKE ?`,
      `%${de}%`
    );
    return Number(rows[0]?.c ?? 0);
  }
  // REPLACE nativo do SQLite
  const result = await prisma.$executeRawUnsafe(
    `UPDATE "${table}" SET "${column}" = REPLACE("${column}", ?, ?) WHERE "${column}" LIKE ?`,
    de,
    para,
    `%${de}%`
  );
  return Number(result);
}

async function fixColetaDefault(): Promise<void> {
  const rows = await prisma.$queryRawUnsafe<Array<{ sql: string }>>(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='coleta_precos'`
  );
  const ddl = rows[0]?.sql ?? '';
  if (!ddl.includes('cota????o') && !ddl.includes("Em cota????o")) {
    console.log('DEFAULT coleta_precos.status: já OK ou ausente no DDL');
    return;
  }
  console.log('DEFAULT coleta_precos.status corrompido no DDL — tentando rebuild leve da tabela...');
  if (DRY_RUN) {
    console.log('[DRY_RUN] rebuild DEFAULT seria aplicado');
    return;
  }
  // Rebuild: copia dados, troca DEFAULT no CREATE, recria índices simples.
  // FKs de coleta_precos_* apontam para esta tabela — desliga FKs temporariamente.
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
  try {
    const newDdl = ddl
      .replace(/Em cota\?\?\?\?o/g, 'Em cotação')
      .replace(/"coleta_precos"/, '"coleta_precos__fix_utf8"')
      .replace(/CREATE TABLE coleta_precos\b/, 'CREATE TABLE "coleta_precos__fix_utf8"');
    if (newDdl === ddl || !newDdl.includes('Em cotação')) {
      console.warn('Não foi possível reescrever DEFAULT; pulando rebuild (linhas já UPDATE).');
      return;
    }
    await prisma.$executeRawUnsafe(newDdl);
    await prisma.$executeRawUnsafe(
      'INSERT INTO "coleta_precos__fix_utf8" SELECT * FROM "coleta_precos"'
    );
    await prisma.$executeRawUnsafe('DROP TABLE "coleta_precos"');
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "coleta_precos__fix_utf8" RENAME TO "coleta_precos"'
    );
    console.log('DEFAULT coleta_precos.status reconstruído com Em cotação');
  } finally {
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
  }
}

async function main() {
  console.log(DRY_RUN ? '[DRY_RUN] Corrigindo acentos...' : 'Corrigindo acentos...');
  let total = 0;

  for (const [chave, pares] of Object.entries(MAPAS)) {
    const [table, column] = chave.split('.') as [string, string];
    for (const { de, para } of pares) {
      try {
        const n = await updateExact(table, column, de, para);
        if (n > 0) {
          console.log(`  ${chave}: ${n}× "${de}" → "${para}"`);
          total += n;
        }
      } catch (e) {
        console.warn(`  [skip] ${chave}:`, e instanceof Error ? e.message : e);
      }
    }
  }

  const frags = [...FRAGMENTOS].sort((a, b) => b.de.length - a.de.length);
  for (const { table, column } of COLUNAS_FRAGMENTO) {
    for (const { de, para } of frags) {
      try {
        const n = await replaceFragment(table, column, de, para);
        if (n > 0) {
          console.log(`  REPLACE ${table}.${column}: ${n}× contendo "${de}"`);
          total += n;
        }
      } catch (e) {
        console.warn(`  [skip] REPLACE ${table}.${column}:`, e instanceof Error ? e.message : e);
      }
    }
  }

  // RH cadastros: aplicar fragmentos genéricos nas colunas valor
  for (const table of [
    'rh_faltas_cad_tipos',
    'rh_faltas_cad_periodos',
    'rh_faltas_cad_tipos_sancoes',
    'rh_faltas_cad_categorias',
  ]) {
    for (const { de, para } of frags) {
      try {
        const n = await replaceFragment(table, 'valor', de, para);
        if (n > 0) {
          console.log(`  REPLACE ${table}.valor: ${n}× contendo "${de}"`);
          total += n;
        }
      } catch {
        /* tabela pode não existir */
      }
    }
  }

  await fixColetaDefault();

  console.log(`\nConcluído. Linhas/operações afetadas ≈ ${total}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
