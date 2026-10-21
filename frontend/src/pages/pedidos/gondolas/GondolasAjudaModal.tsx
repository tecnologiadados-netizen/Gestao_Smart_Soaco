import AjudaTelaModal, { type SecaoAjuda } from '../../../components/AjudaTelaModal';

const SECOES: SecaoAjuda[] = [
  {
    id: 'o-que-e',
    titulo: 'O que esta tela faz',
    oQueE:
      'Lista os itens em aberto de gôndolas e porta-paletes. O clique no item abre a ficha: os PI e PP quando a lista de produção está no Nomus, ou as peças da planilha quando essa lista não existe.',
    comoLe:
      'Os cartões Carteira, Gôndolas e Porta-paletes restringem a grade. Cada coluna tem o filtro do cabeçalho: lista de valores, ordenação e, nas quantidades, maior ou menor. A entrega filtra por intervalo de datas. O código verde tem ficha. Ao lado dele, Nomus indica lista de produção no Nomus e Planilha indica a reserva importada do setor. O código vermelho não tem ficha em nenhum dos dois. O clique abre o modal daquele item. Gerar ordem pede primeiro o setor, Gôndolas ou Porta-paletes. Em seguida abre os pedidos daquele setor e, dentro de cada um, as peças da ficha de materiais, todas marcadas. A linha do produto principal mostra a origem da ficha: Nomus ou Planilha. Nas peças do Nomus, o lápis edita a medida 01 e a medida 02. O Gestão guarda essas medidas pelo código da peça e preenche sozinho nas próximas ordens. O Modelo vem da coluna Modelo da planilha importada; peças do Nomus não têm modelo. A coluna Observações é digitada em cada peça antes de imprimir e vale só para aquela ordem. No resumo consolidado o modelo aparece quando todas as peças agrupadas têm o mesmo, e as observações ficam nas páginas de cada pedido. Desmarque a peça que não entra e confirme. Com a busca preenchida, só as peças marcadas que aparecem no filtro vão para a impressão. Depois de imprimir ou cancelar a impressão, o modal continua aberto com a mesma seleção. Antes de imprimir, escolha Apenas PI ou Apenas PP: cada ordem sai com um tipo só. A escolha vale só para as peças marcadas, e as peças da planilha, que não têm tipo, entram nas duas opções. A impressão abre o resumo consolidado e, depois, uma página por pedido. Em cada página, a mesma peça (mesma descrição, matéria-prima e medida) sai numa linha só, com a quantidade somada, mesmo que venha de itens diferentes do pedido. Todas as páginas levam o cabeçalho de logo, data e pedidos em todas as páginas.',
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
