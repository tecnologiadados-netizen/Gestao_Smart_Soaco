import AjudaTelaModal, { type SecaoAjuda } from '../../../components/AjudaTelaModal';

const SECOES: SecaoAjuda[] = [
  {
    id: 'o-que-e',
    titulo: 'O que esta tela faz',
    oQueE:
      'Esta tela gera a ordem de produção de qualquer produto do catálogo. O setor é livre, como no sistema de exemplo: não fica preso a gôndola ou porta-pallet. Ela fica à parte da Programação de produção (Recurso 1000).',
    comoLe:
      'No filtro, escolha um setor ou deixe Todos os setores. A primeira grade lista os pais. Cada coluna tem o filtro da grade: lista de valores, ordenação e, em Filhos e Quantidade do pai, filtro numérico. Em cada pai, Gerar ordem abre a quantidade e os filhos. A segunda grade lista as ordens já emitidas, com Ver e PDF.',
  },
  {
    id: 'ordem',
    titulo: 'Gerar ordem e PDF',
    oQueE:
      'Gerar ordem grava a quantidade a produzir e multiplica a quantidade de cada filho. Ver mostra essa ordem na tela. PDF abre a impressão do mesmo conteúdo.',
    comoLe:
      'A quantidade sugerida é o total vendido dos filhos. Dá para alterar antes de confirmar. A qtd total de cada filho é a qtd no pai vezes a quantidade da ordem. A matéria-prima impressa é o produto em processo escolhido no cadastro.',
  },
  {
    id: 'cadastros',
    titulo: 'Cadastros',
    oQueE:
      'Cadastros guarda os setores e os pais. O catálogo já começa com os produtos pai do sistema de exemplo, sem filhos. O setor é um nome livre. Em cada pai dá para vincular ou retirar filhos do NOMUS. O botão Novo cria outro pai no setor escolhido.',
    comoLe:
      'Abra Vínculos, busque o produto do NOMUS e salve. Dá para gravar o pai sem filho e voltar depois. A ordem só é gerada quando houver pelo menos um filho. Em cada filho, Matéria-prima (PP) lista só os produtos em processo da lista de materiais daquele filho.',
    detalhes: [
      {
        titulo: 'Matéria-prima',
        texto:
          'A lista suspensa lê a lista de materiais padrão do filho no NOMUS (produção, precificação ou parcial) e mostra apenas o tipo Produto em processo. Matéria-prima comprada e produto acabado não entram.',
      },
      {
        titulo: 'Filho que já está em outro pai',
        texto:
          'Ao vincular um filho que já pertence a outro pai, a tela avisa em quais pais ele aparece. O aviso não impede a gravação: Salvar continua disponível.',
      },
    ],
  },
  {
    id: 'carteira',
    titulo: 'De onde vem a quantidade',
    oQueE:
      'A carteira é a do Gerenciador de Pedidos: itens com status Liberado ou Atendido parcialmente, das empresas que entram nessa tela. Cada item conta uma vez, pela qtde pedida.',
    comoLe:
      'Qtde pedida é o que foi vendido no item. A quantidade do pai soma a qtde pedida de todos os filhos vinculados. Pendente aparece no detalhe e não entra nessa soma.',
    detalhes: [
      {
        titulo: 'O que fica de fora',
        texto:
          'Atendido totalmente, corte, cancelado e devolução encerrada ficam em Pedidos encerrados e não entram. Itens da empresa de móveis em retirada, Grande Teresina ou requisição também ficam de fora, como no Gerenciador.',
      },
    ],
  },
  {
    id: 'sugestao',
    titulo: 'Quantidade do pai',
    oQueE:
      'A quantidade do pai é o total vendido dos filhos: a soma da qtde pedida de cada produto do NOMUS na carteira. A quantidade no pai diz quantas unidades daquele filho entram em 1 pai simbólico e fica guardada para o plano. Ela não entra nessa soma.',
    comoLe:
      'O número da grade é o mesmo total do detalhe. Some a coluna Qtde pedida dos filhos e o resultado é a quantidade do pai.',
    detalhes: [
      {
        titulo: 'Exemplo',
        texto:
          'O pai tem dois filhos. A carteira pediu 10 de um e 12 do outro. A quantidade do pai é 22.',
      },
    ],
  },
];

export default function DecomposicaoAjudaModal({
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
      titulo="Ordem de produção"
      subtitulo="Produto pai, filhos do NOMUS e matéria-prima em processo"
      introducao="A ordem é cadastrada aqui, separada da Programação de produção. O pai recebe os filhos, e a matéria-prima de cada filho é um produto em processo da lista de materiais dele."
      secoes={SECOES}
    />
  );
}
