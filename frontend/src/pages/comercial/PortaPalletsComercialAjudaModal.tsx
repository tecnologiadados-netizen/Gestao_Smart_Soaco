import AjudaTelaModal, { ComoLerBtn, type SecaoAjuda } from '../../components/AjudaTelaModal';

export type PortaPalletsComercialAjudaModalProps = {
  aberto: boolean;
  onClose: () => void;
};

const SECOES: SecaoAjuda[] = [
  {
    id: 'o-que-e',
    titulo: 'O que é',
    oQueE:
      'Painel da venda de porta-pallets. O recorte padrão são os últimos 12 meses; dá para ir até janeiro de 2018. Serve para comparar os anos já fechados com os meses que ainda vão acontecer.',
    comoLe:
      'Os três cards, o funil, o gráfico e a Auditoria mensal usam o recorte da barra: o período e os filtros de empresa, vendedor, subgrupo, UF, cidade e família. O período é por dia (digite dd/mm/aaaa ou clique no dia inicial e no final). Filtrar aplica o período e os filtros juntos. 12 meses e Desde 2018 trocam as datas e também aplicam o que está marcado nos filtros. A Auditoria mensal lista cada mês desse recorte; o primeiro e o último mês só contam os dias que estão dentro do período. No bloco Pedidos gerados, a quantidade, o valor vendido e o ticket médio contam os pedidos gerados pelas propostas abertas no mês (mesma regra do funil e do gráfico), mesmo que o pedido tenha saído depois; o total é o da fatia Pedidos gerados do funil. Por isso esse bloco pode diferir do card Valor vendido, que soma os pedidos emitidos no recorte. Clique no card, na fatia do funil, na barra do gráfico ou na célula da tabela para abrir a origem.',
  },
  {
    id: 'layout',
    titulo: 'Como o painel está organizado',
    oQueE:
      'O mesmo desenho da Gestão entradas: barra de recorte, três cards (valor vendido, ticket médio e conversão), funil de vendas, evolução mensal e a Auditoria mensal.',
    comoLe:
      'O campo Período abre um calendário de dias: digite De/Até (dd/mm/aaaa) ou clique no dia inicial e depois no final; Filtrar aplica o intervalo e os filtros de empresa, vendedor, subgrupo, UF, cidade e família. 12 meses e Desde 2018 preenchem e já recarregam. O gráfico de evolução tem duas visões, escolhidas no canto superior direito (Fechamento ou YoY; R$ ou Qtd). "YoY" (ano x ano) mostra, mês a mês, duas barras lado a lado: a da esquerda é o mesmo mês do ano anterior (mesmas datas, um ano antes) e a da direita é o período atual. Cada uma segue a mesma lógica de preenchimento do Fechamento: a barra larga translúcida é o proposto e a barra interna é o que virou pedido (cinza no ano anterior, azul no período atual). Acima da barra atual, ▲ verde indica melhora e ▼ vermelha piora do que virou pedido, em % sobre o ano anterior ("novo" quando o ano anterior foi zero). Usa a mesma escala ampliada. Clique em qualquer barra para abrir o detalhe daquele mês (do ano anterior ou do período atual), com as guias Propostas e Pedidos gerados. "Fechamento" usa barras sobrepostas: a barra cinza é o que foi proposto no mês e a barra azul, dentro dela, é quanto disso virou pedido. Em Valor, cinza = valor das propostas abertas no mês e azul = valor vendido nos pedidos gerados por elas (mesma regra do funil). Em Quantidade, cinza = propostas do mês e azul = propostas que viraram pedido. Cada mês tem um rótulo com valor, escolhido na legenda: com "Virou pedido" (padrão) o rótulo mostra o valor que virou pedido e fica logo acima da barra azul; com "Proposto" mostra o valor proposto e fica acima da barra cinza. O tooltip mostra os dois valores e o percentual que fechou (azul ÷ cinza). O eixo usa escala ampliada (raiz quadrada) para deixar visíveis os valores pequenos: a ordem entre os meses e os valores do eixo continuam corretos, mas a altura da barra não é proporcional ao valor. Com muitos meses no recorte o gráfico rola na horizontal. Clique na barra para abrir o detalhe do mês com duas guias: Propostas (uma linha por proposta, do maior valor para o menor: número, abertura, cliente, valor, pedido gerado e observação; o número da proposta abre os itens) e Pedidos gerados (os pedidos que essas propostas geraram, com a proposta de origem e o valor vendido; o número do pedido abre os itens). Textos longos ficam cortados numa linha; passe o mouse para ler inteiro. A guia aberta primeiro segue a legenda escolhida. Cada guia mostra o resumo e o selo "confere com a barra" quando a soma do detalhe é igual à barra.',
  },
  {
    id: 'funil',
    titulo: 'Funil de vendas',
    oQueE:
      'Painel logo abaixo dos cards: propostas emitidas no recorte e quantos pedidos elas geraram. Ao lado ficam o lead time e os números de leads do recorte.',
    comoLe:
      'Ao lado de cada fatia aparece o valor em reais: em Propostas emitidas, o valor dos itens de porta-pallet das propostas; em Pedidos gerados, o valor vendido desses pedidos (mesma regra do card Valor vendido). Só entram pedidos válidos: requisição de loja, pedido de estoque e pedido cujos itens de porta-pallet foram cancelados não contam no funil, na conversão, no lead time, no gráfico nem no bloco Pedidos gerados — igual ao card. Os dois batem com o total do rodapé no detalhe da fatia. O desenho do funil tem largura fixa: o tamanho das fatias não é proporcional aos números. As duas etapas falam das mesmas propostas: as abertas no recorte. Pedidos gerados conta os pedidos distintos ligados a essas propostas, mesmo que o pedido tenha saído depois do recorte. Uma proposta pode gerar mais de um pedido, e duas propostas podem virar um pedido só; por isso a legenda mostra também quantas propostas viraram pedido. A lista de Propostas emitidas abre com uma linha por proposta, sem o produto. O número da proposta abre os itens (produto, descrição, valor, status e motivo); a soma desses itens é o valor da linha. A lista de Pedidos gerados abre com uma linha por pedido. O número do pedido abre os itens de porta-pallet; a soma é o valor vendido da linha. O funil é da proposta: pedido sem proposta e pedido de proposta anterior ao recorte não entram. Por isso a quantidade de pedidos do funil pode ser diferente da do card Valor vendido, que conta todos os pedidos emitidos no recorte. O botão ? no card Valor vendido mostra a conta: quantos pedidos estão no card e fora do funil (sem proposta ou de proposta anterior ao recorte) e quantos estão no funil e fora do card (não entram na venda ou foram emitidos depois do recorte). Clique em qualquer etapa ou número para abrir a origem.',
    detalhes: [
      {
        titulo: 'Leads',
        texto:
          'Ao lado do funil ficam três linhas: lead time, leads ao todo e leads que fecharam negócio. Leads ao todo = pessoas com proposta de porta-palete aberta no recorte; o número verde ao lado são os leads novos. Leads que fecharam negócio = leads cuja proposta do recorte gerou pedido; o número verde ao lado são os leads novos entre eles. Cada número abre a própria lista de origem.',
      },
      {
        titulo: 'Como o lead novo é identificado',
        texto:
          'Lead novo é quem não tem proposta de porta-palete anterior. A conferência olha as propostas da família 95, de qualquer vendedor e de qualquer empresa: se a pessoa já tem uma proposta com abertura antes da primeira proposta dela neste recorte, não é lead novo. Proposta rejeitada também conta como proposta anterior. Proposta de outro produto não entra nessa conta. Quem está sem cadastro de cliente não entra como lead novo. O detalhe mostra a criação do cadastro, a primeira proposta deste recorte e a data do 1º pedido na empresa ("Nunca comprou" quando não há). A data de criação é a da linha Criação do Histórico de modificações do Nomus, e não a "Data do início do relacionamento".',
      },
      {
        titulo: '“1ª compra” na Auditoria mensal',
        texto:
          'A coluna 1ª compra da Auditoria mensal conta os clientes novos que compraram no mês: o pedido de porta-pallet do mês é a primeira compra deles na empresa (nenhum pedido de qualquer produto antes). Cliente antigo que compra porta-pallet pela primeira vez não entra. No detalhe de Clientes com pedido, esses clientes ficam com a data de criação destacada. Nos detalhes de Clientes com pedido e de 1ª compra, cada linha traz o código do cliente, a proposta e a data, o pedido e a data, a criação do cadastro, a quantidade de pedidos e o valor — o mesmo padrão de auditoria do Excel da Auditoria mensal.',
      },
    ],
  },
  {
    id: 'recorte',
    titulo: 'O que entra na conta',
    oQueE:
      'O universo é a família de produto 95 (Porta palete) e as ramificações: 95.1 industrial, 95.2 econômico, 95.3 semi industrial, 95.4 a 95.6 componentes, e os níveis abaixo (coluna, longarina, sapata e os demais). Sem filtro de empresa, a conta é a da Só Aço. O número é de venda (pedido), não de faturamento (nota).',
    comoLe:
      'O produto entra pela família do cadastro (código 95 ou 95.algo), não pelo grupo de produto. Famílias como Padrão e Projeto ficam de fora, mesmo quando o grupo do produto é Porta Paletes. O filtro Família abre a árvore da 95: marcar um ramo (por exemplo 95.4) mantém esse ramo e o que está abaixo dele; desmarcar um filho deixa os irmãos. A árvore traz sempre todas as ramificações cadastradas da 95 (95.1 a 95.6 e os níveis abaixo), mesmo as que não têm venda no recorte; marcar um ramo sem venda deixa o painel zerado. Com a 95 inteira marcada, o painel não restringe a família. Empresa vazia conta todas as empresas com valor vendido de porta-palete nesse recorte; o padrão é a Só Aço. Empresa cujo valor fecha em zero não aparece: pedido cortado e encerrado, sem quantidade que tenha saído, entra como zero. Vendedor / representante é quem está no documento (o vendedor, ou o representante quando não há vendedor) — na proposta vale o da proposta, no pedido vale o do pedido. Subgrupo 1 é o atributo do produto. UF e cidade são o município do cliente. Cada lista (menos a Família) só mostra o que tem pedido vendido dentro dos filtros que já estão aplicados (período, empresa, vendedor, subgrupo, UF, cidade e família). A lista que está aberta não se restringe por ela mesma, para continuar dando as outras opções daquele campo. Na empresa, no vendedor, na UF e na cidade, a ordem é do maior valor vendido para o menor nesse contexto, com a barra e o valor ao lado. Quem só emitiu proposta, ou não vendeu nesse recorte, não aparece. Ficam de fora também: produção para estoque, requisição de loja e item de pedido cancelado. Item atendido com corte e já encerrado usa a quantidade que de fato saiu. Proposta rejeitada continua em “propostas emitidas”: ela foi emitida.',
    detalhes: [
      {
        titulo: 'Data da proposta',
        texto:
          'A data da proposta é a data de abertura no Nomus. Não existe uma data de emissão separada. O tempo até o pedido usa essa abertura e a data de emissão do primeiro pedido ligado à proposta.',
      },
    ],
  },
  {
    id: 'indicadores',
    titulo: 'Indicadores',
    oQueE:
      'Propostas e pedidos contam documentos distintos. O valor soma só os itens da família 95 e ramificações, com desconto. O valor vendido do mês é a venda mensal.',
    comoLe:
      'Ticket médio = valor vendido ÷ pedidos do mês. Conversão = propostas do mês que geraram ao menos um pedido ÷ propostas do mês. A conversão fica no mês da proposta, mesmo que o pedido saia depois. Tempo médio = média dos dias entre a abertura e o primeiro pedido, só das propostas convertidas. Clientes = clientes distintos do mês. 1ª compra = cliente cuja primeira compra na empresa (qualquer produto) é o pedido de porta-pallet daquele mês.',
    detalhes: [
      {
        titulo: 'Total de clientes',
        texto:
          'O total de clientes é a quantidade distinta no período. Somar a coluna repetiria quem comprou em mais de um mês. O total de primeira compra soma a coluna: cada cliente entra uma vez, no mês da primeira compra.',
      },
    ],
  },
  {
    id: 'auditoria',
    titulo: 'Auditoria e exportação',
    oQueE:
      'A origem de cada número fica nos detalhes que abrem ao clicar. Eles usam a mesma grade do sistema: ▾ no cabeçalho para classificar e filtrar (valores, faixa numérica ou intervalo de datas), "Limpar filtros da grade", o total filtrado no rodapé e "Mostrar todas", que tira a paginação. Nos detalhes, "Exportar Excel" gera o espelho da grade para auditoria: mesmas colunas, filtros, ordem e total filtrado. O "Exportar Excel" da Auditoria mensal gera, para o período filtrado, uma linha por proposta (com "Lead novo?" pela regra do funil e a data de criação do cliente), por pedido gerado e por cliente de cada mês, além da aba Conferência, que recalcula cada mês da tabela por fórmulas a partir dessas linhas.',
    comoLe:
      'No detalhe de propostas, cada linha é uma proposta. O valor da linha é a soma dos itens, que abrem ao clicar no número da proposta. No detalhe de pedidos gerados, cada linha é um pedido e o número abre os itens. A coluna “Convertida” vale para a proposta inteira. O total filtrado do rodapé é a soma das linhas exibidas, e a soma do detalhe de uma célula é o número da grade.',
    detalhes: [
      {
        titulo: 'Opções alternativas do mesmo projeto',
        texto:
          'Quando o vendedor cadastra opções diferentes do mesmo projeto como propostas separadas no Nomus (ex.: "01ª opção", "02ª opção"), cada uma entra no valor proposto do mês, porque são propostas emitidas distintas. Revisões formais do Nomus não estão duplicadas. Isso pode inflar a barra cinza de um mês. Na guia Propostas do gráfico, filtre a coluna Cliente e leia a coluna Observação para identificar as opções.',
      },
    ],
  },
];

export default function PortaPalletsComercialAjudaModal({ aberto, onClose }: PortaPalletsComercialAjudaModalProps) {
  return (
    <AjudaTelaModal
      aberto={aberto}
      onClose={onClose}
      titulo="Indicadores de porta-pallets"
      subtitulo="Como ler este painel"
      introducao="Venda mensal da família 95 (Porta palete) e ramificações, com a origem de cada número no detalhe de cada célula."
      secoes={SECOES}
    />
  );
}

export { ComoLerBtn };
