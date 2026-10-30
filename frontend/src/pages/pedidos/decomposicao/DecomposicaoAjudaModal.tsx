import AjudaTelaModal, { type SecaoAjuda } from '../../../components/AjudaTelaModal';

const SECOES: SecaoAjuda[] = [
  {
    id: 'o-que-e',
    titulo: 'O que esta tela faz',
    oQueE:
      'Esta tela gera a ordem de produção de qualquer produto do catálogo. O setor é livre, como no sistema de exemplo: não fica preso a gôndola ou porta-pallet. Ela fica à parte da Programação de produção (Recurso 1000). Visualizar abre a tela e o histórico. Visualizar e gerar também cria a ordem e altera a quantidade na impressão. A permissão total do PCP cobre as duas.',
    comoLe:
      'A tela tem duas guias. Produtos pai lista o catálogo: a linha verde tem saldo em aberto para produzir. Cada coluna tem o filtro da grade. Em cada pai, Editar abre as peças e os filhos. Gerar ordem abre a quantidade a produzir. Histórico lista as ordens já geradas, com a data, o usuário e o PDF.',
  },
  {
    id: 'ordem',
    titulo: 'Ordem de serviço',
    oQueE:
      'Gerar ordem abre a conferência sem gravar. A ordem só entra no histórico depois de imprimir e apertar Salvar. Ver, numa ordem já salva, lista os pedidos de venda em que os filhos estão alocados. O papel é a ordem de serviço industrial: cabeçalho com a logo Só Aço, produto, quantidade a produzir e o detalhamento das peças marcadas, com a quantidade total. Peça desmarcada não sai no PDF.',
    comoLe:
      'Gerar ordem abre o resumo e ainda não grava nada. Todo filho vinculado aparece na lista. A linha verde é a que ainda tem saldo. Filho sem saldo continua na tabela, sem destaque. Cada peça nasce marcada para o PDF. Desmarque a caixa à esquerda para essa peça não sair na impressão nem na reimpressão do histórico. Em cada peça dá para digitar a medida de corte e a observação: o PDF leva esses textos para as colunas de mesmo nome. Célula vazia sai como traço. A tela seguinte lista os pedidos em aberto que entram nesta ordem. A caixa Próxima ordem nasce desmarcada: o item não volta na ordem seguinte deste pai. Marque a caixa para ele aparecer de novo. Fechar essa tela descarta a ordem. A quantidade a produzir já vem com a soma desses saldos. Dá para digitar outra quantidade antes de imprimir. No papel, a qtd total de cada peça é a qtd da peça vezes a quantidade informada. L e A não se multiplicam. O total do rodapé soma só as peças que ficaram marcadas. Depois de imprimir, Salvar grava a ordem, fecha a tela e mostra ela no Histórico. No Histórico, Excluir apaga a ordem e zera a regra da próxima ordem: os pedidos dela voltam a poder entrar na próxima.',
  },
  {
    id: 'cadastros',
    titulo: 'Cadastros',
    oQueE:
      'Cadastros guarda os setores, os pais e as peças de corte. O catálogo já começa com os produtos pai e as peças do sistema de exemplo. O setor é um nome livre. Em cada pai dá para incluir peças (quantidade, L, A e matéria-prima) e vincular filhos do NOMUS.',
    comoLe:
      'Na grade, Editar abre aquele pai. Em Cadastros, Vínculos faz o mesmo. No detalhamento, altere, inclua ou remova peças. Abaixo, busque no NOMUS, marque um ou vários produtos e use Vincular selecionados. A ordem sai quando houver ao menos uma peça ou um filho.',
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
      'Qtde pedida é o que foi vendido no item. O saldo é o que ainda está em aberto nesse item. A quantidade do pai soma o saldo dos filhos em Liberado e Atendido parcialmente, menos o item que já entrou numa ordem deste pai com a caixa Próxima ordem desmarcada.',
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
