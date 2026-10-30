import AjudaTelaModal, { type SecaoAjuda } from '../../../components/AjudaTelaModal';

const SECOES: SecaoAjuda[] = [
  {
    id: 'o-que-e',
    titulo: 'O que esta tela faz',
    oQueE:
      'Lista os itens em aberto de gôndolas e porta-paletes. O clique no item abre a ficha: os PI e PP quando a lista de produção está no Nomus, ou as peças da planilha quando essa lista não existe.',
    comoLe:
      'Os cartões Carteira, Gôndolas e Porta-paletes restringem a grade. Cada coluna tem o filtro do cabeçalho: lista de valores, ordenação e, nas quantidades, maior ou menor. A entrega filtra por intervalo de datas. O código verde tem ficha. Ao lado dele, Nomus indica lista de produção no Nomus e Planilha indica a reserva importada do setor. O código vermelho não tem ficha em nenhum dos dois. O clique abre o modal daquele item e o ícone ao lado do código copia o código. O botão Excel, ao lado da contagem de itens, baixa as linhas que a grade está mostrando, com o cartão, os filtros e a ordenação aplicados, já formatadas como tabela do Excel e com a coluna Ficha (Nomus, Planilha ou Sem ficha). Gerar ordem pede primeiro o setor, Gôndolas ou Porta-paletes. Em seguida abre os pedidos daquele setor e, dentro de cada um, as peças da ficha de materiais, todas marcadas. A linha do produto principal mostra a origem da ficha: Nomus ou Planilha. Nas peças PP do Nomus, o lápis edita o modelo, a matéria-prima, a medida 01 e a medida 02. O Gestão guarda esses dados pelo código da peça e preenche sozinho nas próximas ordens. Peças PI não têm o lápis. Nas peças da planilha, o modelo vem da coluna Modelo da planilha importada. A coluna Observações é digitada em cada peça antes de imprimir e vale só para aquela ordem. No resumo consolidado o modelo aparece quando todas as peças agrupadas têm o mesmo, e as observações ficam nas páginas de cada pedido. Desmarque a peça que não entra e confirme. Com a busca preenchida, só as peças marcadas que aparecem no filtro vão para a impressão. Depois de imprimir ou cancelar a impressão, o modal continua aberto com a mesma seleção. Antes de imprimir, escolha Apenas PI ou Apenas PP: cada ordem sai com um tipo só. A escolha vale só para as peças marcadas, e as peças da planilha, que não têm tipo, entram nas duas opções. A impressão abre o resumo consolidado e, depois, uma página por pedido. Em cada página, a mesma peça (mesma descrição, matéria-prima e medida) sai numa linha só, com a quantidade somada, mesmo que venha de itens diferentes do pedido. Todas as páginas levam o cabeçalho de logo, data e pedidos em todas as páginas.',
  },
  {
    id: 'permissoes',
    titulo: 'Permissões',
    oQueE:
      'No grupo de usuários, seção PCP, a tela tem permissões próprias: visualizar (carteira, ficha, histórico, PDF e Excel), gerar ordem, excluir ordem do histórico, editar medidas (lápis), importar planilha e escolher ficha (Nomus ou planilha). Permissão total do PCP libera tudo.',
    comoLe:
      'Qualquer uma delas abre a tela. Os botões Gerar ordem, Excluir, o lápis, Importar gôndolas/porta-paletes e a chave Nomus/Planilha só aparecem para quem tem a permissão daquela ação. Sem escolher ficha, o Gerar ordem não pede a escolha e usa o Nomus nos códigos que têm as duas fichas.',
  },
  {
    id: 'duas-fichas',
    titulo: 'Código com ficha no Nomus e na planilha',
    oQueE:
      'Quando o código tem lista de produção no Nomus e também linhas na planilha do setor, a grade mostra o selo Escolher ficha. Sem escolha, vale o Nomus.',
    comoLe:
      'Ao abrir o Gerar ordem e escolher o setor, aparecem primeiro os códigos que ainda não têm escolha, com os pedidos de cada um. Marque Nomus ou Planilha em cada linha (ou Todos Nomus / Todos Planilha) e confirme. O Gestão guarda a escolha por código e não pergunta de novo; o selo vira 2 fichas e a origem ao lado mostra a lista que ficou. Para trocar depois, abra a ficha do item e use a chave Ficha no Nomus / Planilha do setor no topo do modal. Trocar a lista de um item que já tem peças em ordem não desfaz a ordem: as peças da outra lista aparecem como novas.',
  },
  {
    id: 'historico',
    titulo: 'Histórico das ordens',
    oQueE:
      'Gerar ordem grava a ordem com número OG-…, data, usuário, setor e tipo (PI, PP ou Planilha), e guarda uma cópia das peças impressas. A aba Histórico mostra uma linha por pedido, com cliente, produtos, número de ordens e peças. Clique no pedido para abrir as ordens dele; em cada ordem, PDF reimprime a cópia gravada e Excluir apaga a ordem inteira, inclusive os outros pedidos que estiverem nela. Os filtros Pedido, Cliente e Produto aceitam %: PD 50%, %Ltda, PA 11023%. Na linha de cada pedido, Excel PP baixa uma aba única com todos os PP das ordens daquele pedido, inclusive as peças das ordens de Planilha (só os PI do Nomus ficam de fora), nas colunas do PDF: pedido, descrição, modelo, matéria-prima, medida, observações e qtd total. A mesma peça sai numa linha só, com a quantidade somada.',
    comoLe:
      'Cada peça de um item de pedido sai em ordem uma vez só. No Gerar ordem e na escolha Apenas PI ou Apenas PP ficam só as peças que ainda não saíram; as peças desmarcadas continuam disponíveis para a próxima ordem. O item só sai da grade quando todas as peças da ficha dele já estão em ordem, ou seja, depois das ordens de PI e de PP. Na ficha do item, a peça que já saiu aparece com o selo Em ordem e o número. Ao excluir uma ordem do Histórico, as peças dela voltam a ficar disponíveis e o pedido volta para a carteira.',
  },
  {
    id: 'carteira',
    titulo: 'De onde vêm os itens',
    oQueE:
      'A carteira é a do Gerenciador: item Liberado ou Atendido parcialmente, empresas que entram nessa tela, setor de produção Gôndolas ou Porta Paletes. Requisição fica de fora.',
    comoLe:
      'Qtde pedida é o que foi vendido. Pendente é o saldo em aberto. Qtde pendente real segue a rota: até 4 usa o pendente; a partir de 6 usa o que já está no romaneio. A qtd total do modal multiplica a quantidade da ficha por essa qtde pendente real.',
  },
  {
    id: 'ficha',
    titulo: 'Nomus ou planilha',
    oQueE:
      'Se o código tem lista de materiais padrão com ficha de produção no Nomus, o modal lista os PI e os PP dessa ficha. O PP de cada PI entra pela lista de produção do próprio PI, com a quantidade multiplicada. A planilha desse item não entra. Se a ficha de produção não existe, o modal usa a planilha do setor, no código sem o que vem depois do ponto.',
    comoLe:
      'O cabeçalho do modal diz a origem: Nomus ou Planilha. Na origem Nomus cada PP aparece expandido logo abaixo do PI ao qual pertence; use a seta do PI para recolher ou expandir seus PP. As colunas são código, descrição, tipo, qtd na ficha e qtd total. Na planilha as colunas são a peça, a matéria-prima, as medidas e as mesmas quantidades. Baixar modelo pede o setor, Gôndolas ou Porta-paletes, e entrega a última planilha guardada daquele setor, numa aba só, com código PA, descrição da peça, quantidade, matéria-prima, as duas medidas e o modelo. Importar planilha troca a reserva daquele setor e vale para os próximos cliques.',
  },
];

export default function GondolasAjudaModal({
  aberto,
  onClose,
}: {
  aberto: boolean;
  onClose: () => void;
}) {
  return (
    <AjudaTelaModal
      aberto={aberto}
      onClose={onClose}
      titulo="Gôndolas e porta-paletes"
      subtitulo="Carteira em aberto e ficha do item"
      introducao="A grade lista os itens de gôndola e porta-palete ainda em aberto. O modal do item usa a ficha de produção do Nomus ou a planilha do setor."
      secoes={SECOES}
    />
  );
}
