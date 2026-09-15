export type KnowledgeChunk = {
  id: string;
  tela: string;
  titulo: string;
  texto: string;
  /** Sinônimos / termos de busca (ajuda o retrieval lexical). */
  aliases?: string[];
};

/** Base documental curada (FAQ) — manuais Como ler + glossário operacional. */
export const KNOWLEDGE_CHUNKS: KnowledgeChunk[] = [
  {
    id: 'glossario-pre-compra',
    tela: 'Consulta de Estoque',
    titulo: 'O que é Pré Compra',
    aliases: [
      'pre compra',
      'pré-compra',
      'precompra',
      'cotacao',
      'cotação',
      'cotacao de compra',
      'o que e pre compra',
      'o que e uma pre compra',
    ],
    texto:
      'Pré Compra (na grade da Consulta de Estoque / Cobertura / Ressup) é a quantidade do item que já está em cotação de compra no ERP Nomus, ainda sem virar Pedido de Compra (PC). Na interface o rótulo é “Pré Compra”, mas no banco/código o campo se chama cotação (cotacao). O detalhe ao clicar na célula lista as cotações abertas (nome da cotação, emissão, comprador, SCs vinculadas e quantidade) nos status de cotação em andamento (status 1–3). Não é estoque físico nem SC pura: é o meio do funil SC → Pré Compra (cotação) → Pedido de compra → entrada no estoque. Entra no saldo projetado: estoque − empenho + solicitação + Pré Compra + pedido de compra.',
  },
  {
    id: 'glossario-solicitacao',
    tela: 'Consulta de Estoque',
    titulo: 'O que é Solicitação (SC)',
    aliases: ['sc', 'solicitacao de compra', 'solicitação de compra', 'o que e solicitacao'],
    texto:
      'Solicitação (SC / Solicitação de Compra) é a demanda formal de compra do item ainda não totalmente atendida por cotação ou pedido. Na Consulta de Estoque a coluna Solicitação mostra quantidade consolidada em aberto; o clique abre o detalhe analítico das SCs. Faz parte do pipeline: SC → Pré Compra (cotação) → Pedido de compra. Também soma no saldo projetado.',
  },
  {
    id: 'glossario-pedido-compra',
    tela: 'Consulta de Estoque',
    titulo: 'O que é Pedido de compra (PC)',
    aliases: ['pc', 'pedido de compra', 'pc pend', 'o que e pc'],
    texto:
      'Pedido de compra (PC) é a compra já formalizada com fornecedor, com quantidade pendente de recebimento. Na grade aparece como “Pedido compra”; o detalhe mostra nº do PC, quantidades e datas de entrega. É a etapa depois da Pré Compra/cotação. Entra no saldo projetado e, no Sequenciamento, alimenta avisos de Entrada PC no calendário.',
  },
  {
    id: 'glossario-empenho',
    tela: 'Consulta de Estoque',
    titulo: 'O que é Empenho',
    aliases: ['empenho liquido', 'empenhado', 'o que e empenho'],
    texto:
      'Empenho é a quantidade do item comprometida para atender pedidos/produção. Na Consulta de Estoque a coluna mostra empenho líquido = max(0, empenho bruto − estoque em PA): estoque de produto acabado (via BOM) abate o bruto. O toggle Requisições de loja (padrão Sim) inclui empenhos com atributo Requisitado; com Não, esses empenhos saem do cálculo.',
  },
  {
    id: 'glossario-saldo-projetado',
    tela: 'Consulta de Estoque',
    titulo: 'O que é Saldo projetado',
    aliases: ['saldo projetado', 'disponibilidade liquida', 'o que e saldo projetado'],
    texto:
      'Saldo projetado = estoque atual − empenho + solicitação (SC) + Pré Compra (cotação) + pedido de compra (PC). Indica disponibilidade líquida esperada, não só o físico. Valor ≤ 0 destaca risco de ruptura se o empenho consumir o material antes das entradas (SC/Pré Compra/PC).',
  },
  {
    id: 'glossario-estoque-atual',
    tela: 'Consulta de Estoque',
    titulo: 'Estoque atual e estoque em PA',
    aliases: ['estoque fisico', 'estoque em pa', 'produto acabado'],
    texto:
      'Estoque atual da grade é o somatório do saldo nos setores parametrizados. Quantidade de componente que já está no setor de PA compondo o produto pai (via BOM) não entra nesse somatório — é abatida no empenho líquido (bruto − estoque em PA).',
  },
  {
    id: 'glossario-pipeline-compras',
    tela: 'Compras / PCP',
    titulo: 'Pipeline SC → Pré Compra → PC',
    aliases: ['funil de compra', 'fluxo de compra', 'pipeline'],
    texto:
      'Fluxo típico no Gestão Smart/Nomus: 1) Solicitação de Compra (SC) registra a necessidade; 2) Pré Compra = item em cotação de compra (negociando fornecedor/preço); 3) Pedido de Compra (PC) firma a compra; 4) ao receber, entra no estoque. Na Consulta de Estoque as três colunas (Solicitação, Pré Compra, Pedido compra) mostram essas etapas em paralelo no saldo projetado.',
  },
  {
    id: 'consulta-estoque-cascata',
    tela: 'Consulta de Estoque',
    titulo: 'Grade sintética e clique na célula',
    aliases: ['cascata', 'modal analitico', 'detalhe da celula'],
    texto:
      'A grade traz só valores consolidados (estoque, empenho, SC, Pré Compra, PC, saldo projetado). O detalhe analítico abre sob demanda ao clicar na célula, com a mesma regra/fonte do número da grade. O detalhe fica em cache até um novo Filtrar/Consultar; a soma do modal deve bater com a coluna.',
  },
  {
    id: 'consulta-estoque-requisicoes',
    tela: 'Consulta de Estoque',
    titulo: 'Requisições de loja',
    aliases: ['requisicao de loja', 'requisitado', 'toggle loja'],
    texto:
      'O toggle Requisições de loja controla se o empenho inclui empenhos com atributo Requisitado (padrão Sim). Com Não, esses empenhos são excluídos e a consulta é refeita na hora. Por isso o empenho pode “zerar” na grade mesmo existindo demanda ligada a requisição de loja.',
  },
  {
    id: 'consulta-estoque-pedido',
    tela: 'Consulta de Estoque',
    titulo: 'Filtro por pedido de venda',
    aliases: ['filtro por pd', 'componentes bom', 'itens diretos'],
    texto:
      'Modo opcional que restringe a consulta a um PD: itens diretos do pedido ou componentes via BOM, com escopo só este PD ou todos os empenhos dos itens. Use itens diretos para ver o PA; use componentes (BOM) para necessidade de MP/componentes.',
  },
  {
    id: 'cobertura-acoes',
    tela: 'Cobertura de Estoque',
    titulo: 'Status e ações sugeridas',
    aliases: ['ruptura', 'aguardando pc', 'cobertura'],
    texto:
      'Na Cobertura de Estoque a ação segue o Status: Aguardando PC → cobrar entrega do PC; Ruptura com SC/Pré Compra → acelerar SC/Pré Compra; Ruptura sem pipeline → comprar agora; Crítico → converter SC ou abrir SC urgente; Atenção → programar SC; Excesso → suspender compra; Sem giro → avaliar descarte. Saldo, empenho, SC, Pré Compra, PC e projetado usam as mesmas regras da Consulta de Estoque.',
  },
  {
    id: 'ressup-saldo',
    tela: 'Ressup Almox / Não Almox',
    titulo: 'Saldo projetado no ressuprimento',
    aliases: ['ressup', 'almox'],
    texto:
      'No Ressup Almox o saldo projetado usa −Empenho + Solicitação + Estoque atual + PC Pend + Pré Compra. No Não Almox a ideia é a mesma com estoque efetivo. Clique nas células para o detalhe (mesma integridade grade = modal).',
  },
  {
    id: 'seq-carradas-datas',
    tela: 'Sequenciamento de Carradas',
    titulo: 'Datas de produção e entrega / carrada em formação',
    aliases: ['carrada em construcao', 'em formacao', 'max+30'],
    texto:
      'A simulação recalcula datas sobre um baseline (ERP + ajustes). Só é possível selecionar hoje ou datas futuras. Carrada em formação (construção/contingência) oculta a entrega e usa produção = maior data das demais carradas normais + 30 dias. Inserir em Romaneio com valor abaixo do corte usa a mesma lógica de formação; valor ≥ corte usa emissão + dias da faixa configurada.',
  },
  {
    id: 'seq-carradas-confiavel',
    tela: 'Sequenciamento de Carradas',
    titulo: 'Coluna Confiável',
    aliases: ['previsao confiavel'],
    texto:
      'Na grade, Confiável resume o estado dos itens da carrada. Em consulta o selo só aparece por unanimidade. Em branco ≠ Não confiável. No rascunho, Não / meio / Sim na célula das carradas normais replica a todos os itens vinculados.',
  },
  {
    id: 'seq-entrada-pc',
    tela: 'Sequenciamento de Carradas',
    titulo: 'Entrada PC no calendário de materiais',
    aliases: ['materiais do dia', 'entrada pc'],
    texto:
      'No modal Materiais do dia, a coluna Entrada PC prioriza: (1) qtde de PC com entrega naquele dia; (2) senão a data de entrega mais antiga de PC aberto; (3) senão “Pré Compra”; (4) senão “Solicitação de Compra”; (5) senão 0. Células com PC/Pré Compra/SC são clicáveis.',
  },
  {
    id: 'pedidos-formacao',
    tela: 'Gerenciador de Pedidos',
    titulo: 'Carrada em formação e regras de previsão',
    aliases: ['regra de corte', 'previsao automatica'],
    texto:
      'Rotas cujo nome indica construção/contingência aparecem como Carrada em formação: a grade não mostra data de entrega/previsão até a rota se consolidar. Bifurcação por valor de corte: abaixo → formação (produção max+30); igual ou acima → emissão + dias da faixa (padrão tipicamente +45). Ajuste manual de previsão prevalece.',
  },
  {
    id: 'regras-gerais-cascata',
    tela: 'Padrão do sistema',
    titulo: 'Consultas em cascata grade e modal',
    aliases: ['integridade grade modal'],
    texto:
      'Telas analíticas PCP usam grade enxuta (consolidados) e detalhe lazy ao clicar. Cache em memória por consulta; limpa no Filtrar. Integridade inegociável: valor da grade = soma do modal. Mesma fonte/regra SQL entre grade e detalhe.',
  },
  {
    id: 'busca-texto-livre',
    tela: 'Padrão do sistema',
    titulo: 'Busca de texto livre com %',
    aliases: ['filtro com porcentagem', 'curinga'],
    texto:
      'Filtros de texto livre: sem % = contém o termo; Ferr% = começa com; %Ltda = termina com; %cent% = contém no meio. O % é curinga como em SQL LIKE.',
  },
  {
    id: 'amigaco-escopo',
    tela: 'Assistente Amigaço',
    titulo: 'O que o assistente responde',
    aliases: ['amigaco', 'faq'],
    texto:
      'O Amigaço explica conceitos e regras do Gestão Smart (colunas, filtros, fluxos SC/Pré Compra/PC, sequenciamento, etc.). Não inventa números do ERP Nemus nem datas reais de um item específico — para isso use a tela e clique nas células. Prefira explicar com o glossário e manuais a responder só “não sei”.',
  },
];
