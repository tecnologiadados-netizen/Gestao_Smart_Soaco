import AjudaTelaModal, { type SecaoAjuda } from '../../components/AjudaTelaModal';

export type AcompanhamentoSolicitacaoAjudaModalProps = {
  aberto: boolean;
  onClose: () => void;
};

const SECOES: SecaoAjuda[] = [
  {
    id: 'corte',
    titulo: 'O que entra no pipeline',
    oQueE:
      'A tela mostra só o material que ainda está a caminho da empresa. Cada produto é uma linha, e as três etapas são colunas do processo: Solicitado, Comprado e Pré-entrada.',
    comoLe:
      'Se o produto não está em nenhuma das três etapas, ele não aparece. Entrada cujo documento já saiu do tipo pré-entrada (173) também não aparece: o material já entrou de fato.',
    detalhes: [
      {
        titulo: 'Solicitado',
        texto:
          'Solicitação de compra no status Liberada, ainda sem pedido de compra vinculado. A quantidade é a da solicitação.',
      },
      {
        titulo: 'Comprado',
        texto:
          'Pedido de compra em aberto, com saldo a receber. A solicitação de origem pode já estar Encerrada: o vínculo com o pedido é que mantém o item nesta etapa, não o status Liberada.',
      },
      {
        titulo: 'Pré-entrada',
        texto:
          'Pedido atendido totalmente, mas o documento de entrada vinculado ainda é pré-entrada (tipo 173). O status na tela é um só: Pré-entrada. O material pode estar a caminho ou já na conferência. Entra mesmo quando o item do pedido não tem solicitação vinculada.',
      },
    ],
  },
  {
    id: 'linha',
    titulo: 'Uma linha por produto',
    oQueE:
      'O mesmo produto pode ter quantidade em mais de uma etapa ao mesmo tempo. A linha continua única: cada quantidade fica na etapa correspondente.',
    comoLe:
      'Uma etapa vazia aparece tracejada. Clique na etapa preenchida para abrir o detalhe, com a cadeia do vínculo: solicitação, pedido e documento de pré-entrada, conforme a etapa. A soma das linhas do modal é a quantidade da etapa na linha. A data do cartão é a mais antiga ainda naquela etapa. Na pré-entrada, essa data é a emissão da NF.',
  },
  {
    id: 'filtro',
    titulo: 'Filtros e datas',
    oQueE:
      'A lista abre com todos os produtos que estão em alguma etapa. Há um campo para código ou descrição, outro para o número da solicitação, outro para o pedido de compra e outro para o documento de entrada. Abaixo ficam os filtros de data: emissão da solicitação, necessidade da solicitação, emissão do pedido e emissão da NF.',
    comoLe:
      'Os campos preenchidos se combinam: o produto precisa passar em todos. Código ou descrição aceita qualquer um dos dois. Sem %, o filtro contém o texto. Com %, vale o curinga: CHAPA% começa com CHAPA, %MM termina com MM. A solicitação vale nas três etapas; o pedido, em Comprado e Pré-entrada; o documento, só na Pré-entrada. Cada data abre um modal, com o período e a ordem. Crescente lista da data mais antiga para a mais recente. Decrescente faz o inverso. Produto sem data naquela etapa fica de fora do período.',
  },
];

export default function AcompanhamentoSolicitacaoAjudaModal({
  aberto,
  onClose,
}: AcompanhamentoSolicitacaoAjudaModalProps) {
  return (
    <AjudaTelaModal
      aberto={aberto}
      onClose={onClose}
      titulo="Como ler Materiais a chegar"
      subtitulo="Solicitação, pedido e pré-entrada no mesmo fluxo"
      introducao="O PCP usa esta tela para ver o que ainda vai chegar, inclusive quando a pré-entrada já encerrou o pedido de compra."
      secoes={SECOES}
      tituloId="acompanhamento-solicitacao-ajuda-titulo"
    />
  );
}
