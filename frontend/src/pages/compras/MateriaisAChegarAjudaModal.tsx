import AjudaTelaModal, { type SecaoAjuda } from '../../components/AjudaTelaModal';

export type MateriaisAChegarAjudaModalProps = {
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
    id: 'documento',
    titulo: 'Pedido e pré-entrada completos',
    oQueE:
      'No detalhe de Comprado e de Pré-entrada, o número do pedido e o do documento são links. Eles abrem o documento inteiro: todos os itens do pedido de compra (ou da pré-entrada), com o status de cada um no caminho. O produto de onde você veio fica destacado com faixa azul e a etiqueta "Pesquisado", e a lista já rola até ele. No pedido, itens com data de entrega a atualizar mostram o prazo (Sem data, Atrasada ou Vence em X dias) e o botão Alterar data.',
    comoLe:
      'Dentro do documento, os números de pré-entrada (no pedido) e de pedido (na pré-entrada) também abrem o documento correspondente; o botão Voltar retorna ao anterior. "Filtrar a grade por este pedido/documento" fecha os modais e preenche o filtro da grade. "Ver na grade" filtra a grade pelo código do item. A coluna Em caminho é o que o item soma na etapa da grade, pela mesma regra da grade: saldo do pedido no Comprado e quantidade do documento 173 na Pré-entrada.',
    detalhes: [
      {
        titulo: 'Comprado / Pré-entrada',
        texto:
          'Itens que estão na grade, com a mesma regra das etapas. O pedido é contado no Comprado só se tiver solicitação da empresa vinculada.',
      },
      {
        titulo: 'Em aberto, sem solicitação',
        texto:
          'Item do pedido com saldo a receber, mas sem solicitação da empresa. Não entra na grade; aparece aqui para completar o pedido.',
      },
      {
        titulo: 'Pré-entrada, pedido não atendido',
        texto:
          'Documento ainda é pré-entrada (173), mas o item do pedido vinculado não está atendido totalmente (ou o item não tem pedido). Não entra na grade.',
      },
      {
        titulo: 'Recebido, Encerrado com saldo, Cancelado / corte',
        texto:
          'Itens que já saíram do caminho: material já entrou de fato, item encerrado sem receber tudo, ou item cancelado/cortado no pedido.',
      },
    ],
  },
  {
    id: 'datas-entrega',
    titulo: 'Datas de entrega a atualizar',
    oQueE:
      'Aba que lista os pedidos de compra cuja data de entrega precisa ser atualizada. Entra o item do pedido que está Liberado ou Atendido parcialmente (com saldo a receber), ou Atendido totalmente mas com documento de entrada ainda em pré-entrada (173). Item Aguardando liberação não entra. Além disso, a data de entrega do item precisa estar atrasada, vazia ou vencer nos próximos 7 dias. Entra todo pedido de compra, com ou sem solicitação vinculada.',
    comoLe:
      'Cada linha é um pedido: situação dos itens (liberados, parciais, pré-entrada), quantos itens estão a atualizar, a data de entrega mais antiga entre esses itens (ou "Sem data") e o prazo mais crítico (Sem data, Atrasada há X dias ou Vence em X dias). A lista vem com os sem data primeiro e depois os mais atrasados. Clique no pedido para abrir somente os itens com status aceito nesta aba: Liberado, Atendido parcialmente ou Atendido totalmente com pré-entrada vinculada. Os que estão na janela de prazo aparecem com destaque e o botão Alterar data, que usa a mesma alteração da tela de Integração (nova data, motivo e observação, com histórico). Depois de salvar, a lista se atualiza; se a nova data ficar a mais de 7 dias, o item sai dela.',
    detalhes: [
      {
        titulo: 'Permissões',
        texto:
          'A tela fica em Compras e tem três permissões próprias, marcadas no grupo de usuários: "Materiais a chegar — acesso à tela" abre a tela; "ver a guia Datas de entrega a atualizar" mostra esta aba; "alterar datas de entrega" mostra o botão Alterar data no pedido. Sem a permissão da guia, a aba não aparece. Sem a de alterar, o prazo continua visível no pedido, mas sem o botão.',
      },
      {
        titulo: 'Diferença para a etapa Comprado',
        texto:
          'A etapa Comprado da grade só conta pedido ligado a solicitação da empresa. A aba de datas olha todos os pedidos de compra, porque a data de entrega vale para qualquer item a receber.',
      },
    ],
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

export default function MateriaisAChegarAjudaModal({
  aberto,
  onClose,
}: MateriaisAChegarAjudaModalProps) {
  return (
    <AjudaTelaModal
      aberto={aberto}
      onClose={onClose}
      titulo="Como ler Materiais a chegar"
      subtitulo="Solicitação, pedido e pré-entrada no mesmo fluxo"
      introducao="Compras e PCP usam esta tela para ver o que ainda vai chegar, inclusive quando a pré-entrada já encerrou o pedido de compra, e para manter em dia a data de entrega dos pedidos."
      secoes={SECOES}
      tituloId="acompanhamento-solicitacao-ajuda-titulo"
    />
  );
}
