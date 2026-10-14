import AjudaTelaModal, { type SecaoAjuda } from '../../../components/AjudaTelaModal';

const SECOES: SecaoAjuda[] = [
  {
    id: 'o-que-e',
    titulo: 'O que esta tela faz',
    oQueE:
      'Esta tela gera a ordem de produção de qualquer produto do catálogo. O setor é livre, como no sistema de exemplo: não fica preso a gôndola ou porta-pallet. Ela fica à parte da Programação de produção (Recurso 1000).',
    comoLe:
      'A tela tem duas guias. Produtos pai lista o catálogo: a linha verde tem saldo em aberto para produzir. Cada coluna tem o filtro da grade. Em cada pai, Editar abre as peças e os filhos. Gerar ordem abre a quantidade a produzir. Histórico lista as ordens já geradas, com a data, o usuário e o PDF.',
  },
  {
    id: 'ordem',
    titulo: 'Ordem de serviço',
    oQueE:
      'Gerar ordem grava a quantidade a produzir do pai e multiplica a quantidade de cada peça. Ver lista os pedidos de venda em que os filhos estão alocados e deixa ajustar a quantidade antes de imprimir. O papel é a ordem de serviço industrial: cabeçalho com a logo Só Aço, produto, quantidade a produzir e o detalhamento das peças com a quantidade total.',
    comoLe:
      'Gerar ordem abre o resumo. Todo filho vinculado aparece na lista. A linha verde é a que ainda tem saldo. Filho sem saldo continua na tabela, sem destaque. A quantidade a produzir fica na tela seguinte, já preenchida com o saldo em aberto: Liberado e Atendido parcialmente, só o que ainda falta atender. Dá para digitar outra quantidade antes de imprimir. No papel, a qtd total de cada peça é a qtd da peça vezes a quantidade informada. L e A não se multiplicam.',
  },
  {
    id: 'cadastros',
    titulo: 'Cadastros',
    oQueE:
      'Cadastros guarda os setores, os pais e as peças de corte. O catálogo já começa com os produtos pai e as peças do sistema de exemplo. O setor é um nome livre. Em cada pai dá para incluir peças (quantidade, L, A e matéria-prima) e vincular filhos do NOMUS.',
    comoLe:
      'Na grade, Editar abre aquele pai. Em Cadastros, Vínculos faz o mesmo. No detalhamento, altere, inclua ou remova peças. Abaixo, busque o produto do NOMUS para vincular ou retirar um filho. A ordem sai quando houver ao menos uma peça ou um filho.',
    detalhes: [
      {
        titulo: 'Peças do sistema de exemplo',
        texto:
          'As peças já gravadas vieram do cadastro de exemplo: componente, quantidade, L (mm), A (mm) e matéria-prima. Dá para editar, incluir e remover em Vínculos.',
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
      'Qtde pedida é o que foi vendido no item. O saldo é o que ainda está em aberto nesse item. A quantidade do pai soma o saldo dos filhos em Liberado e Atendido parcialmente.',
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
      'A quantidade do pai é o saldo em aberto dos filhos: a soma do saldo de cada produto do NOMUS vinculado, nos itens Liberado e Atendido parcialmente.',
    comoLe:
      'O número da grade é o mesmo total do detalhe. Some a coluna Saldo dos filhos e o resultado é a quantidade do pai.',
    detalhes: [
      {
        titulo: 'Exemplo',
        texto:
          'O pai tem dois filhos. Um ainda tem saldo 6 e o outro saldo 4. A quantidade sugerida do pai é 10.',
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
      subtitulo="Produto pai, peças de corte e filhos do NOMUS"
      introducao="A ordem é cadastrada aqui, separada da Programação de produção. O pai recebe as peças de corte e o vínculo dos produtos filhos do NOMUS."
      secoes={SECOES}
    />
  );
}
