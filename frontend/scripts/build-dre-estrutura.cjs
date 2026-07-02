/**
 * Gera estruturaDreArvore.json — plano de contas DRE (Demonstração do Resultado).
 * Uso: node scripts/build-dre-estrutura.cjs
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '../src/pages/financeiro/dre/estruturaDreArvore.json');

function A(nome, codigo, macro, sinal = -1) {
  return { id: null, nome, tipo: 'A', macro, codigo, sinal, children: [] };
}
function S(nome, codigo, macro, children, sinal = -1) {
  return { id: null, nome, tipo: 'S', macro, codigo, sinal, children };
}
function T(nome, codigo, calcId) {
  return { id: null, nome, tipo: 'T', macro: 'TOTAL', codigo, calcId, children: [] };
}

const RECEITA = 'RECEITA';
const DEDUCAO = 'DEDUCAO';

/** Linhas de produto repetidas em «Receita de vendas» e «Faturamento Indireto Líquido (MKP)». */
const PRODUTOS_RECEITA_VENDAS = [
  'Resfriador industrial',
  'Material comprado',
  'Checkout',
  'Cadeiras e similares',
  'Câmaras',
  'Fogão industrial',
  'Móveis de Aço',
  'Chapa bifeteira',
  'Móveis escolares',
  'Gôndolas',
  'Estufas',
  'Máquina para serrar ossos',
  'Fornos',
  'Balcão',
  'Móveis em melaminico',
  'Mesa para panificação',
  'Outros',
  'Fritadeira tacho',
  'Porta Paletes',
  'Balcão frigorífico sem tendal',
];

function linhasProdutos(codigoPrefixo, indiceInicial, macro, sinal = 1) {
  return PRODUTOS_RECEITA_VENDAS.map((nome, i) =>
    A(nome, `${codigoPrefixo}.${indiceInicial + i}`, macro, sinal),
  );
}
const CUSTO = 'CUSTO';
const DESP_VAR = 'DESP_VAR';
const DESP_OI = 'DESP_OI';
const DESP_ADM = 'DESP_ADM';
const DESP_COM = 'DESP_COM';
const DESP_VEND = 'DESP_VEND';
const DESP_FIN = 'DESP_FIN';
const TRIBUTO = 'TRIBUTO';
const DISTRIB = 'DISTRIB';

const faturamentoDiretoFilhos = linhasProdutos('1.1', 3, RECEITA, 1);

const soAcoFilhos = [
  S('Faturamento Direto', '1.1.2', RECEITA, faturamentoDiretoFilhos, 1),
  A('Faturamento Indireto Bruto', '1.2', RECEITA, 1),
  S('Faturamento Indireto Liquido (MKP)', '1.3', RECEITA, [
    ...linhasProdutos('1.3', 1, RECEITA, 1),
  ], 1),
];

const soMoveisFilhos = [
  A('Faturamento Direto', '1.4.1', RECEITA, 1),
  A('Faturamento Indireto', '1.4.2', RECEITA, 1),
];

const cpvSoAcoFilhos = [
  S('CPV Direto', '6.1.1', CUSTO, linhasProdutos('6.1.1', 1, CUSTO, -1)),
  S('CPV Indireto', '6.1.2', CUSTO, linhasProdutos('6.1.2', 1, CUSTO, -1)),
];

const cmvSoMoveisFilhos = [
  A('CPV Direto', '6.2.1', CUSTO, -1),
  S('CPV Indireto', '6.2.2', CUSTO, linhasProdutos('6.2.2', 1, CUSTO, -1)),
];

const devolucoesFilhos = [
  A('Só Aço', '2.1.1.1', DEDUCAO),
  A('Só Móveis', '2.1.1.2', DEDUCAO),
  A('Só Refrigeração', '2.1.1.3', DEDUCAO),
  A('R N Marques', '2.1.1.4', DEDUCAO),
];

const descontosIncondicionaisFilhos = [
  A('Só Aço', '2.1.3.1', DEDUCAO),
  A('Só Móveis', '2.1.3.2', DEDUCAO),
  A('Só Refrigeração', '2.1.3.3', DEDUCAO),
  A('R N Marques', '2.1.3.4', DEDUCAO),
];

const rnMarquesReceitaFilhos = [
  A('Faturamento Direto', '1.6.1', RECEITA, 1),
  A('Faturamento Indireto', '1.6.2', RECEITA, 1),
];

const cmvRnMarquesFilhos = [
  A('CMV Direto', '6.3.1', CUSTO, -1),
  A('CMV Indireto', '6.3.2', CUSTO, -1),
];

const roots = [
  S('Receita Bruta', '1', RECEITA, [
    S('Receita de vendas de produtos', '1.1', RECEITA, [
      S('Só Aço', '1.1.1', RECEITA, soAcoFilhos, 1),
      S('Só Móveis', '1.4', RECEITA, soMoveisFilhos, 1),
      A('Só Refrigeração', '1.5', RECEITA, 1),
      S('R N Marques', '1.6', RECEITA, rnMarquesReceitaFilhos, 1),
    ], 1),
  ], 1),

  S('(-) Deduções Sobre o Faturamento', '2', DEDUCAO, [
    S('(-) Devoluções e Descontos', '2.1', DEDUCAO, [
      S('Devoluções', '2.1.1', DEDUCAO, devolucoesFilhos),
      A('Cancelamentos', '2.1.2', DEDUCAO),
      S('Descontos incondicionais', '2.1.3', DEDUCAO, descontosIncondicionaisFilhos),
    ]),
  ]),

  T('Receita Líquida Antes de Impostos s/ Vendas', '3', 'RL_ANTES_IMPOSTOS'),

  S('(-) Impostos s/ Vendas', '4', DEDUCAO, [
    A('ICMS s/ vendas', '4.1', DEDUCAO),
    A('ICMS ST', '4.2', DEDUCAO),
    A('ICMS Substituição Tributária', '4.3', DEDUCAO),
    A('Guia Antecipação', '4.4', DEDUCAO),
    A('ICMS Difal Uso e Consumo', '4.5', DEDUCAO),
    A('Cofins s/ vendas', '4.7', DEDUCAO),
    A('PIS', '4.8', DEDUCAO),
    A('PIS Importação', '4.9', DEDUCAO),
    A('ISS', '4.10', DEDUCAO),
    A('IPI', '4.11', DEDUCAO),
    A('Imposto – Simples Nacional', '4.14', DEDUCAO),
    A('Impostos Retenção', '4.15', DEDUCAO),
  ]),

  T('(=) Receita Líquida', '5', 'RECEITA_LIQUIDA'),

  S('(-) CPV', '6', CUSTO, [
    S('CPV Só Aço', '6.1', CUSTO, cpvSoAcoFilhos),
    S('CMV Só Móveis', '6.2', CUSTO, cmvSoMoveisFilhos),
    S('CMV RN Marques', '6.3', CUSTO, cmvRnMarquesFilhos),
    A('CMV Só Refrigeração', '6.4', CUSTO),
  ]),

  S('(-) Despesas Variáveis', '8', DESP_VAR, [
    S('Energia Elétrica', '8.1', DESP_VAR, [
      A('Energia elétrica', '8.1.1', DESP_VAR),
    ]),
    S('Movimentação e Armazenagem', '8.2', DESP_VAR, [
      A('Fretes e carretos', '8.2.1', DESP_VAR),
      A('Fretes - Mercadorias', '8.2.2', DESP_VAR),
    ]),
  ]),

  S('(-) Gastos com Pessoal Operação', '10', DESP_OI, [
    S('Folha de Pagamento - Operacional', '10.1', DESP_OI, [
      A('Salários operacional', '10.1.1', DESP_OI),
      A('Provisão 13º Salário - Operação', '10.1.2', DESP_OI),
      A('Provisão Férias - Operação', '10.1.3', DESP_OI),
      A('Provisão 1/3 Férias - Operação', '10.1.4', DESP_OI),
      A('Provisão INSS Férias - Operação', '10.1.5', DESP_OI),
      A('Provisão FGTS Férias - Operação', '10.1.6', DESP_OI),
      A('INSS Operação', '10.1.7', DESP_OI),
      A('FGTS Operação', '10.1.8', DESP_OI),
      A('Horas Extras - Operacional', '10.1.9', DESP_OI),
      A('Alimentação hora extra', '10.1.10', DESP_OI),
      A('Bonificação Operacional', '10.1.11', DESP_OI),
      A('Vale Transporte - Operacional', '10.1.12', DESP_OI),
      A('Vale Alimentação/Refeição - Operacional', '10.1.13', DESP_OI),
      A('Pensão Alimentícia', '10.1.14', DESP_OI),
      A('Ajuda de Custo', '10.1.15', DESP_OI),
    ]),
    S('Demais Gastos com Pessoal', '10.2', DESP_OI, [
      A('Saúde ocupacional', '10.2.1', DESP_OI),
      A('Auxílio Combustível - Operação', '10.2.2', DESP_OI),
      A('Seguro de vida', '10.2.3', DESP_OI),
      A('Contribuição sindical', '10.2.4', DESP_OI),
    ]),
    S('Serviços Terceirizados da Produção', '10.3', DESP_OI, [
      A('Serviços Terceirizados de Produção', '10.3.1', DESP_OI),
      A('Aluguéis de Equipamentos Produção', '10.3.2', DESP_OI),
      A('Análises e Inspeções Técnicas', '10.3.3', DESP_OI),
    ]),
    S('Desenvolvimento de Colaboradores', '10.4', DESP_OI, [
      A('Treinamentos e Certificações', '10.4.1', DESP_OI),
    ]),
    S('EPI e Uniformes', '10.5', DESP_OI, [
      A('EPI', '10.5.1', DESP_OI),
      A('Fardamento', '10.5.2', DESP_OI),
    ]),
  ]),

  S('(-) Despesas Operacionais Indiretas', '11', DESP_OI, [
    S('Mecânica, Manutenção e Equipamentos', '11.1', DESP_OI, [
      A('Manutenção Industrial', '11.1.1', DESP_OI),
      A('Materiais manutenção Mecânica', '11.1.2', DESP_OI),
      A('Serviços manutenção Mecânica', '11.1.3', DESP_OI),
      A('Materiais manutenção Elétrico', '11.1.4', DESP_OI),
      A('Materiais manutenção Hidráulico', '11.1.5', DESP_OI),
      A('Calibração de instrumentos', '11.1.6', DESP_OI),
      A('Peças, Ferramentas, Pneus', '11.1.7', DESP_OI),
    ]),
    S('Despesas Logística', '11.2', DESP_OI, [
      S('Folha de Pagamento - Logística', '11.2.1', DESP_OI, [
        A('Salários Logística', '11.2.1.1', DESP_OI),
        A('Provisão 13º Salário - Logística', '11.2.1.2', DESP_OI),
        A('Provisão Férias', '11.2.1.3', DESP_OI),
        A('Provisão 1/3 Férias', '11.2.1.4', DESP_OI),
        A('Provisão INSS Férias', '11.2.1.5', DESP_OI),
        A('Provisão FGTS Férias', '11.2.1.6', DESP_OI),
        A('INSS Logística', '11.2.1.7', DESP_OI),
        A('FGTS Logística', '11.2.1.8', DESP_OI),
        A('Auxílio Combustível - Logística', '11.2.1.9', DESP_OI),
        A('Despesas de Viagens OP', '11.2.1.10', DESP_OI),
      ]),
    ]),
    S('Despesas com Frota', '11.3', DESP_OI, [
      A('IPVA E Licenciamentos', '11.3.1', DESP_OI),
      A('Combustíveis e Lubrificantes', '11.3.2', DESP_OI),
      A('Multas de Trânsito', '11.3.3', DESP_OI),
      A('Rastreamento de Veículos', '11.3.4', DESP_OI),
    ]),
    S('Manutenção Veicular', '11.4', DESP_OI, [
      A('Serviços manutenção de veículos', '11.4.1', DESP_OI),
      A('Materiais de manut. de veículos', '11.4.2', DESP_OI),
    ]),
  ]),

  T('(=) Lucro Bruto', '12', 'LUCRO_BRUTO'),

  S('(-) Despesas Administrativas', '13', DESP_ADM, [
    S('Folha de Pagamento - Administrativo', '13.1', DESP_ADM, [
      A('Salários', '13.1.1', DESP_ADM),
      A('Adiantamentos a Colaboradores', '13.1.2', DESP_ADM),
      A('Horas Extras - Administrativo', '13.1.3', DESP_ADM),
      A('Vale Transporte - Administrativo', '13.1.4', DESP_ADM),
      A('INSS Administrativo', '13.1.6', DESP_ADM),
      A('FGTS Administrativo', '13.1.7', DESP_ADM),
      A('Provisão Férias', '13.1.8', DESP_ADM),
      A('Provisão 13º Salário', '13.1.9', DESP_ADM),
      A('Provisão INSS Férias', '13.1.10', DESP_ADM),
      A('Provisão FGTS Férias', '13.1.11', DESP_ADM),
      A('Provisão 1/3 Férias', '13.1.16', DESP_ADM),
      S('Pró-labore', '13.1.12', DESP_ADM, [
        A('Pró-labore Só Aço', '13.1.12.1', DESP_ADM),
        A('Pró-labore Só Móveis', '13.1.12.2', DESP_ADM),
        A('Pró-labore Só Refrigeração', '13.1.12.3', DESP_ADM),
        A('Pró-labore RN Marques', '13.1.12.4', DESP_ADM),
      ]),
    ]),
    S('Despesas Variáveis com Pessoal', '13.2', DESP_ADM, [
      A('Assistência Médica/Odontológica/Farmácia', '13.2.1', DESP_ADM),
      A('Bolsa de Estágio', '13.2.2', DESP_ADM),
      A('Auxílio Combustível - Administrativo', '13.2.3', DESP_ADM),
      A('Vale Alimentação/Refeição - Administrativo', '13.2.4', DESP_ADM),
      A('Refeições Corporativas', '13.2.5', DESP_ADM),
      A('Bonificação - Administrativo', '13.2.6', DESP_ADM),
      A('Despesas de Viagem', '13.2.7', DESP_ADM),
      A('Treinamento e desenvolvimento', '13.2.8', DESP_ADM),
      A('Fardamento Administrativo', '13.2.9', DESP_ADM),
    ]),
    S('Despesas Prediais', '13.3', DESP_ADM, [
      A('Aluguel', '13.3.1', DESP_ADM),
      A('IPTU e Condomínio', '13.3.2', DESP_ADM),
      A('Segurança e Vigilância', '13.3.3', DESP_ADM),
      A('Água e Tratamento de Efluentes', '13.3.4', DESP_ADM),
      A('Materiais manutenção Predial', '13.3.5', DESP_ADM),
      A('Serviços manutenção Predial', '13.3.6', DESP_ADM),
    ]),
    S('Indenizações e Rescisões', '13.4', DESP_ADM, [
      A('FGTS multa rescisória', '13.4.1', DESP_ADM),
    ]),
    S('Treinamentos', '13.6', DESP_ADM, [
      A('Alimentação para eventos', '13.6.1', DESP_ADM),
      A('Brindes para Clientes', '13.6.2', DESP_ADM),
      A('Eventos para Clientes', '13.6.3', DESP_ADM),
    ]),
    S('Despesas Diversas', '13.7', DESP_ADM, [
      A('Cartórios e Notários', '13.7.1', DESP_ADM),
      A('Taxas de Legalização', '13.7.2', DESP_ADM),
      A('Multas Judiciais', '13.7.3', DESP_ADM),
      A('Despachantes', '13.7.4', DESP_ADM),
      A('Laudos ambientais', '13.7.5', DESP_ADM),
    ]),
    S('Despesas de Viagem', '13.8', DESP_ADM, [
      A('Passagens aéreas', '13.8.1', DESP_ADM),
      A('Hotéis e Hospedagens', '13.8.2', DESP_ADM),
      A('Translados', '13.8.3', DESP_ADM),
    ]),
    S('Despesas de Escritório', '13.9', DESP_ADM, [
      A('Material de escritório', '13.9.1', DESP_ADM),
      A('Materiais de suprimentos de informática', '13.9.2', DESP_ADM),
      A('Despesas Gráficas', '13.9.3', DESP_ADM),
      A('Despesas Mailing', '13.9.4', DESP_ADM),
      A('Aluguel de Equipamentos', '13.9.5', DESP_ADM),
    ]),
    S('Utilidades', '13.10', DESP_ADM, [
      A('Internet', '13.10.1', DESP_ADM),
      A('Telefone celular', '13.10.2', DESP_ADM),
      A('Telefonia fixa', '13.10.3', DESP_ADM),
    ]),
    S('Copa e Cozinha', '13.11', DESP_ADM, [
      A('Higienização e Esterilização', '13.11.1', DESP_ADM),
      A('Material de Limpeza', '13.11.2', DESP_ADM),
      A('Copa e Cozinha', '13.11.3', DESP_ADM),
    ]),
    S('Softwares', '13.12', DESP_ADM, [
      A('Manutenção/Licença de softwares', '13.12.1', DESP_ADM),
      A('Software Gestão', '13.12.2', DESP_ADM),
    ]),
    S('Outros', '13.13', DESP_ADM, [
      A('Programa de Formação Profissional', '13.13.1', DESP_ADM),
      A('Seguros', '13.13.2', DESP_ADM),
      A('Gastos com Animais', '13.13.3', DESP_ADM),
    ]),
  ]),

  S('(-) Despesas Comerciais', '14', DESP_COM, [
    S('Promoção e Comercial', '14.1', DESP_COM, [
      A('Propagandas e anúncios - Atividades Empresas', '14.1.1', DESP_COM),
    ]),
    S('Despesas Operacionais', '14.2', DESP_COM, [
      A('Aluguel de Máquina de Cartão', '14.2.1', DESP_COM),
    ]),
    S('Relacionamento', '14.3', DESP_COM, [
      A('Brindes', '14.3.1', DESP_COM),
      A('Eventos Clientes Externos', '14.3.2', DESP_COM),
      A('Parcerias Comerciais', '14.3.3', DESP_COM),
    ]),
    S('Comissões e Bonificações', '14.4', DESP_COM, [
      A('Comissão sobre vendas', '14.4.1', DESP_COM),
      A('Representantes', '14.4.2', DESP_COM),
      A('Bonificações Externas', '14.4.3', DESP_COM),
      A('Televendas', '14.4.4', DESP_COM),
    ]),
  ]),

  S('(-) Serviços de Terceiros', '15', DESP_VEND, [
    S('Judicial', '15.1', DESP_VEND, [
      A('Assessoria Jurídica', '15.1.1', DESP_VEND),
      A('Despesas legais e judiciais', '15.1.2', DESP_VEND),
    ]),
    S('Gestão Empresarial', '15.2', DESP_VEND, [
      A('Assessoria e Consultoria', '15.2.1', DESP_VEND),
    ]),
    S('Marketing/Publicidade', '15.3', DESP_VEND, [
      A('Assessoria de marketing e publicidade', '15.3.1', DESP_VEND),
      A('Propagandas e anúncios - Atividades Empresas', '15.3.2', DESP_VEND),
      A('Materiais de Marketing e Publicidade', '15.3.3', DESP_VEND),
    ]),
    S('Contabilidade', '15.4', DESP_VEND, [
      A('Assessoria Contábil', '15.4.1', DESP_VEND),
    ]),
    S('Outros Serviços', '15.5', DESP_VEND, [
      A('Assistência Técnica', '15.5.1', DESP_VEND),
      A('Manutenção de Hardware', '15.5.2', DESP_VEND),
      A('Coleta de Lixo', '15.5.3', DESP_VEND),
    ]),
  ]),

  T('(=) EBITDA (Resultado Operacional)', '16', 'EBITDA'),

  S('(-) Despesas Financeiras', '17', DESP_FIN, [
    S('Empréstimos Bancários', '17.1', DESP_FIN, [
      A('Empréstimos e financiamentos - CD + Juros', '17.1.1', DESP_FIN),
    ]),
    S('Antecipação', '17.2', DESP_FIN, [
      A('Antecipação de recebíveis - taxas e juros', '17.2.1', DESP_FIN),
    ]),
    S('Taxas e Demais', '17.3', DESP_FIN, [
      A('Tarifas Bancárias', '17.3.1', DESP_FIN),
      A('Taxas adm. de cartões', '17.3.2', DESP_FIN),
      A('Taxas de Administração de Consórcios', '17.3.3', DESP_FIN),
      A('IOF', '17.3.4', DESP_FIN),
      A('Juros sobre Mora', '17.3.5', DESP_FIN),
      A('Juros sobre parcelamento tributário', '17.3.6', DESP_FIN),
      A('Juros sobre atrasos de pagamentos', '17.3.7', DESP_FIN),
    ]),
  ]),

  T('Lucro Antes do Imposto', '18', 'LUCRO_ANTES_IMPOSTO'),

  S('(-) Tributos', '19', TRIBUTO, [
    S('Impostos Sobre o Lucro', '19.1', TRIBUTO, [
      A('CSLL', '19.1.1', TRIBUTO),
      A('IRPJ', '19.1.2', TRIBUTO),
      A('IRRF', '19.1.3', TRIBUTO),
    ]),
  ]),

  T('Lucro Líquido', '20', 'LUCRO_LIQUIDO'),

  S('(-) Distribuição de Lucros', '21', DISTRIB, [
    A('Distribuição de Lucros', '21.1', DISTRIB),
    A('Retirada de Lucros', '21.2', DISTRIB),
  ]),

  T('Lucro Após Retiradas', '22', 'LUCRO_APOS_RETIRADAS'),
];

function assignPathKeys(nodes, prefix = 'D') {
  nodes.forEach((n, i) => {
    n.pathKey = `${prefix}/${i}`;
    if (n.children?.length) assignPathKeys(n.children, n.pathKey);
  });
}

assignPathKeys(roots);

const out = { roots };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2), 'utf8');
console.log('OK:', OUT, '—', roots.length, 'raízes de primeiro nível');
