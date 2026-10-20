import AjudaTelaModal, { type SecaoAjuda } from '../../../components/AjudaTelaModal';

const SECOES: SecaoAjuda[] = [
  {
    id: 'o-que-e',
    titulo: 'O que esta tela faz',
    oQueE:
      'Lista os itens em aberto de gôndolas e porta-paletes. O clique no item abre a ficha: os PI e PP quando a lista de produção está no Nomus, ou as peças da planilha quando essa lista não existe.',
    comoLe:
      'Os cartões Carteira, Gôndolas e Porta-paletes restringem a grade. Cada coluna tem o filtro do cabeçalho: lista de valores, ordenação e, nas quantidades, maior ou menor. A entrega filtra por intervalo de datas. O código verde tem ficha. Ao lado dele, Nomus indica lista de produção no Nomus e Planilha indica a reserva importada do setor. O código vermelho não tem ficha em nenhum dos dois. O clique abre o modal daquele item. Gerar ordem pede primeiro o setor, Gôndolas ou Porta-paletes. Em seguida abre os pedidos daquele setor e, dentro de cada um, as peças da ficha de materiais, todas marcadas. Nas peças do Nomus, o lápis edita a medida 01 e a medida 02. O Gestão guarda essas medidas pelo código da peça e preenche sozinho nas próximas ordens. Desmarque a peça que não entra e confirme para imprimir a ordem. A impressão abre o resumo consolidado e, depois, uma página por pedido, com o cabeçalho de logo, data e pedidos em todas as páginas.',
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
      'Se o código tem lista de materiais padrão com ficha de produção no Nomus, o modal lista só os componentes PI (produto intermediário) e PP (produto em processo) dessa ficha. A planilha desse item não entra. Se a ficha de produção não existe, o modal usa a planilha do setor, no código sem o que vem depois do ponto.',
    comoLe:
      'O cabeçalho do modal diz a origem: Nomus ou Planilha. Na origem Nomus as colunas são código, descrição, tipo, qtd na ficha e qtd total. Na planilha as colunas são a peça, a matéria-prima, as medidas e as mesmas quantidades. Importar planilha troca a reserva daquele setor e vale para os próximos cliques.',
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
