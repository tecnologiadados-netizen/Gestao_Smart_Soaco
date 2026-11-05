import AjudaTelaModal, { type SecaoAjuda } from '../../../components/AjudaTelaModal';

const SECOES: SecaoAjuda[] = [
  {
    id: 'o-que-e',
    titulo: 'O que a tela mostra',
    oQueE:
      'Faturamento da Só Aço (empresa de saída 1), no mesmo critério do faturamento diário: notas de saída válidas, desconto e devolução.',
    comoLe:
      'Os quatro indicadores no topo são o total do período escolhido em De e Até. Para ver um mês, informe do primeiro ao último dia daquele mês. O gráfico mostra o líquido de cada mês dentro do período; a barra dourada é o mês em que o período inteiro cabe. A tabela lista cada dia com movimento.',
  },
  {
    id: 'colunas',
    titulo: 'Colunas do dia',
    oQueE:
      'Faturado é a soma do valor dos itens de saída, sem desconto e sem devolução. Desconto é a soma dos descontos desses itens. Devolvido é a soma das devoluções do dia. Líquido = faturado − desconto − devolvido.',
    comoLe:
      'Dia sem valor em uma coluna aparece como R$ 0,00. O total no rodapé é a soma das linhas do mês selecionado e deve bater com o card Líquido.',
  },
  {
    id: 'detalhe',
    titulo: 'Auditoria do dia',
    oQueE:
      'O clique no dia expande a linha com as notas e o pedido de venda de cada movimentação. Quando não há NF, o pedido identifica a origem. A soma do detalhe é a mesma da linha. Um segundo clique recolhe.',
    comoLe:
      'Use o número da NF para localizar a nota no Nomus. O detalhe fica em memória até trocar o mês. O botão Excel baixa o mês em duas guias: Detalhe (uma linha por item) e Resumo (um dia por linha, com total geral). A soma das duas guias é a mesma da tela.',
  },
];

export default function FaturamentoAjudaModal({
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
      titulo="Faturamento"
      subtitulo="Painel Metas"
      introducao="Visão mês a mês e conferência dia a dia do faturamento líquido."
      secoes={SECOES}
    />
  );
}
