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
      'Os três cards, o funil e o gráfico usam o recorte da barra de filtros. A série mensal embaixo lista cada mês desse recorte. Clique no card, na fatia do funil, na barra do gráfico ou na célula da tabela para abrir a origem.',
  },
  {
    id: 'layout',
    titulo: 'Como o painel está organizado',
    oQueE:
      'O mesmo desenho da Gestão entradas: barra de recorte, três cards (valor vendido, ticket médio e conversão), funil de vendas, evolução mensal e a série mensal para auditar.',
    comoLe:
      'Filtrar aplica o intervalo de meses. 12 meses, Ano atual e Desde 2018 preenchem e já recarregam. O gráfico de evolução usa barras sobrepostas: a barra cinza é o que foi proposto no mês e a barra azul, dentro dela, é quanto disso virou pedido. Em Valor, cinza = valor das propostas abertas no mês e azul = valor vendido nos pedidos gerados por elas (mesma regra do funil). Em Quantidade, cinza = propostas do mês e azul = propostas que viraram pedido. Em cima de cada barra ficam o percentual que fechou (azul ÷ cinza), verde acima da média do recorte e vermelho abaixo, e, em azul, o valor que virou pedido. O valor proposto aparece no tooltip. Com mais de 18 meses no recorte os rótulos somem e ficam só no tooltip. Clique na barra para abrir a origem do mês.',
  },
  {
    id: 'funil',
    titulo: 'Funil de vendas',
    oQueE:
      'Painel logo abaixo dos cards: propostas emitidas no recorte e quantos pedidos elas geraram. Ao lado ficam o lead time e os números de clientes do recorte.',
    comoLe:
      'Ao lado de cada fatia aparece o valor em reais: em Propostas emitidas, o valor dos itens de porta-pallet das propostas; em Pedidos gerados, o valor vendido desses pedidos (mesma regra do card Valor vendido; pedido que não conta na venda entra com zero). Os dois batem com o total do rodapé no detalhe da fatia. O desenho do funil tem largura fixa: o tamanho das fatias não é proporcional aos números. As duas etapas falam das mesmas propostas: as abertas no recorte. Pedidos gerados conta os pedidos distintos ligados a essas propostas, mesmo que o pedido tenha saído depois do recorte. Uma proposta pode gerar mais de um pedido, e duas propostas podem virar um pedido só; por isso a legenda mostra também quantas propostas viraram pedido. O detalhe marca em "Conta na venda" o pedido que não entra no valor vendido do painel, por exemplo item cancelado. O funil é da proposta: pedido sem proposta e pedido de proposta anterior ao recorte não entram. Por isso a quantidade de pedidos do funil pode ser diferente da do card Valor vendido, que conta todos os pedidos emitidos no recorte. O botão ? no card Valor vendido mostra a conta: quantos pedidos estão no card e fora do funil (sem proposta ou de proposta anterior ao recorte) e quantos estão no funil e fora do card (não entram na venda ou foram emitidos depois do recorte). Clique em qualquer etapa ou número para abrir a origem.',
    detalhes: [
      {
        titulo: 'Clientes',
        texto:
          'Ao lado do funil ficam três linhas: lead time, clientes ao todo e clientes que fecharam negócio. Clientes ao todo = clientes com proposta de porta-pallet aberta no recorte; o número verde ao lado são os novos. Clientes que fecharam negócio = clientes cuja proposta do recorte gerou pedido; o número verde ao lado são os novos entre eles. Cada número abre a própria lista de origem.',
      },
      {
        titulo: 'Como o cliente novo é identificado',
        texto:
          'Pela data de criação do cadastro do cliente no Nomus. Se o cadastro foi criado até 7 dias antes ou depois do primeiro contato de porta-pallet (a primeira proposta ou o primeiro pedido), o vendedor precisou cadastrar o cliente para atendê-lo: é cliente novo. Se o cadastro já existia antes, o cliente já tinha tido contato com a empresa, mesmo em outra linha de produto: não é novo. O primeiro contato precisa cair no recorte. Cadastros sem data de criação (anteriores a abril de 2018) contam como clientes antigos. O detalhe mostra a data do cadastro, o primeiro contato e a distância em dias.',
      },
      {
        titulo: 'Diferença para “Primeira compra”',
        texto:
          'A coluna Primeira compra da série mensal olha só pedidos: é o mês da primeira compra de porta-pallet. Ela não usa o cadastro. Um cliente antigo da empresa que compra porta-pallet pela primeira vez aparece em Primeira compra, mas não como cliente novo no funil.',
      },
    ],
  },
  {
    id: 'recorte',
    titulo: 'O que entra na conta',
    oQueE:
      'Só o grupo de produto Porta Paletes do Nomus, o que inclui acessório e produto acabado. A empresa é a Só Aço. O número é de venda (pedido), não de faturamento (nota).',
    comoLe:
      'Ficam de fora: produção para estoque, requisição de loja do grupo e item de pedido cancelado. Item atendido com corte e já encerrado usa a quantidade que de fato saiu, a mesma regra do Painel Comercial. Proposta rejeitada continua em “propostas emitidas”: ela foi emitida.',
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
      'Propostas e pedidos contam documentos distintos. O valor soma só os itens do grupo Porta Paletes, com desconto. O valor vendido do mês é a venda mensal.',
    comoLe:
      'Ticket médio = valor vendido ÷ pedidos do mês. Conversão = propostas do mês que geraram ao menos um pedido ÷ propostas do mês. A conversão fica no mês da proposta, mesmo que o pedido saia depois. Tempo médio = média dos dias entre a abertura e o primeiro pedido, só das propostas convertidas. Clientes = clientes distintos do mês. Primeira compra = cliente cuja primeira venda de porta-pallet, em todo o histórico, cai naquele mês.',
    detalhes: [
      {
        titulo: 'Total de clientes',
        texto:
          'O total de clientes é a quantidade distinta no período. Somar a coluna repetiria quem comprou em mais de um mês. O total de primeira compra soma a coluna: cada cliente entra uma vez, no mês da primeira compra.',
      },
    ],
  },
  {
    id: 'dados-abertos',
    titulo: 'Dados abertos',
    oQueE:
      'A aba Dados abertos lista a origem de cada número: um item de proposta ou um item de pedido por linha. Ela e os detalhes que abrem ao clicar usam a mesma grade do sistema: ▾ no cabeçalho para classificar e filtrar (valores, faixa numérica ou intervalo de datas), "Limpar filtros da grade" e o total filtrado no rodapé. A exportação para Excel leva a aba aberta com a busca e os filtros da grade.',
    comoLe:
      'Na aba de propostas, a mesma proposta se repete por item. A quantidade da grade é a de propostas distintas. O valor é a soma dos itens. A coluna “Proposta convertida” vale para a proposta inteira. Na aba de pedidos, “Primeira compra” marca o cliente no mês da primeira venda de porta-pallet. A soma do detalhe de uma célula é o número da grade.',
  },
];

export default function PortaPalletsComercialAjudaModal({ aberto, onClose }: PortaPalletsComercialAjudaModalProps) {
  return (
    <AjudaTelaModal
      aberto={aberto}
      onClose={onClose}
      titulo="Indicadores de porta-pallets"
      subtitulo="Como ler este painel"
      introducao="Venda mensal do grupo Porta Paletes, com a origem de cada número no detalhe e na aba de dados abertos."
      secoes={SECOES}
    />
  );
}

export { ComoLerBtn };
