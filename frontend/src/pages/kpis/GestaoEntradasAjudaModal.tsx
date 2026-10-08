import AjudaTelaModal, { type SecaoAjuda } from '../../components/AjudaTelaModal';

export type GestaoEntradasAjudaModalProps = {
  aberto: boolean;
  onClose: () => void;
};

const SECOES: SecaoAjuda[] = [
  {
    id: 'universo',
    titulo: 'O que entra na conta',
    oQueE:
      'O painel lê as notas de entrada do Nomus pela data de entrada, nos mesmos tipos de movimentação da conferência Double Check NFe (11, 35 e 111 a 116). Para entradas até 18/09/2026, a conferência é “Não aplicada”. De 19/09 a 20/09/2026, vale a conferência simples: o comparativo NF × PC fica visível somente para consulta e o usuário apenas confirma o documento. A partir de 21/09/2026, vale o fluxo completo, com aceite ou recusa obrigatórios para cada divergência. A leitura padrão é a visão real.',
    comoLe:
      'O período padrão é o mês corrente. Ajuste início e fim e clique em Filtrar. Visão real considera só divergência real. Visão geral inclui também a benigna. Cada nota conta uma vez, mesmo com vários itens. O detalhe do dia usa a mesma leitura que está selecionada.',
  },
  {
    id: 'status',
    titulo: 'Cards e anel',
    oQueE:
      'Entradas é a quantidade de notas no período. Conferidas já passaram pelo Double Check e não têm divergência da leitura atual sem decisão. Na visão real, divergência só benigna não tira a nota de Sem divergência e não a deixa pendente. Na visão geral, benigna e real entram juntas. Se surgir uma nova diferença após a conferência, a nota volta para Pendente: o usuário pode decidir essa nova pendência e confirmar novamente, sem alterar as decisões anteriores. Para alterar uma decisão já existente, é necessário reabrir a conferência com a permissão específica. A média divide o total pelos dias que tiveram ao menos uma entrada. Sem divergência é conferidas sem divergência da leitura ÷ conferidas.',
    comoLe:
      'Clique no card para abrir a tabela dos documentos daquele número, na mesma visão do painel. No anel, a fatia colorida lista as conferidas sem divergência e a faixa restante lista as conferidas que ainda divergem. Clique no documento que tem divergência para abrir a mesma evidência do dia: campo, natureza, item, valor na NF, valor no pedido, motivo e observação. No cabeçalho de cada coluna, a seta classifica e filtra a lista. Entradas e Média ao dia listam todas as notas do período. Conferidas lista as que já passaram pelo Double Check na leitura atual. Pendentes lista só as que ainda não fecharam e em que a conferência se aplica: entrada até 18/09/2026 fica como Não aplicada e não entra nesse número. O percentual de conferidas e pendentes usa só esse universo. O círculo grande, logo abaixo da evolução, usa a mesma escala: vermelho é pior, azul-marinho é melhor. Entra na conta a nota conferida cuja NF já está igual ao pedido na leitura escolhida, mesmo que a divergência tenha existido no dia da conferência. Nota pendente não entra. Sem conferência no período, o círculo fica sem percentual.',
  },
  {
    id: 'linha',
    titulo: 'Entradas ao dia',
    oQueE:
      'A linha azul-marinho é o total de notas naquele dia ou mês. A linha laranja é quantas dessas notas ainda têm divergência aceita na leitura escolhida: na visão real, só a real; na visão geral, benigna e real. A NF continua diferente do pedido de compra nesse recorte.',
    comoLe:
      'No ponto, a leitura é “Das 18 entradas, 9 tiveram divergência aceita.” Clique na bolinha para abrir as entradas daquele dia na mesma visão do painel: quais ainda divergem e, nessas, o valor na NF ao lado do valor no pedido, o campo, a natureza, a decisão e a observação. Na visão real, campo só benigno aparece em Demais entradas, como Sem divergência. Se a diferença foi corrigida no ERP depois da conferência, a nota sai da linha laranja. Recusa que ainda existe não entra na linha laranja. No modo Mês, a bolinha abre o mês.',
  },
  {
    id: 'tipos',
    titulo: 'Natureza, tipos e motivos',
    oQueE:
      'Cada diferença é separada em Divergência benigna ou Divergência real. Preço e IPI menores ou iguais ao pedido são benignos; quantidade diferente é real. No pagamento, o sistema compara os dias calculados parcela a parcela: prazo da NF igual, posterior ou até 5 dias mais curto que o pedido é benigno. Seis dias ou mais a menos é real. Quando a nota tem uma parcela a mais, o pagamento só é benigno se todas as parcelas da NF vencem depois do último prazo do PC. A parcela que existe só na nota, como o frete lançado na entrada, continua real até o conferente escolher “Frete lançado na entrada (pedido sem o valor exato)”, que abona o pagamento inteiro. Se o Nomus apenas empurrou um vencimento de sábado, domingo ou feriado para o próximo dia útil, a diferença também é benigna e o card explica isso. Se faltar data base em um dos lados, compara a condição e a regra cadastradas, e condições iguais não geram divergência. Arredondamento, IPI reflexo, frete lançado na entrada e “divergência só na tela” também são benignos. Na dúvida, o sistema classifica como real. Aceitar ou recusar é uma decisão separada da natureza.',
    comoLe:
      'A tabela do documento mostra o selo Real ou Benigna em cada campo que entra na leitura. Na visão real o selo benigno não aparece, porque esse campo saiu da conta. Na barra do campo, a legenda diz quantas divergências existem e em quantos documentos elas estão, além de aceitas e recusas. Clique no campo ou no motivo do ranking para abrir a tabela das divergências daquele número, com item, valor na NF, valor no pedido, decisão e observação. O ranking por campo e o ranking de motivos seguem a visão selecionada. Diferença corrigida no ERP sai desses rankings. O WhatsApp contém somente divergências reais; as benignas continuam disponíveis na tabela do Double Check e no histórico. Usuários autorizados podem reabrir uma conferência: as decisões e observações anteriores permanecem visíveis, mas deixam de valer e cada divergência atual precisa ser aceita ou recusada novamente.',
  },
  {
    id: 'movimento',
    titulo: 'Tipos de movimentação',
    oQueE:
      'O botão Volume mostra os três tipos de movimentação com mais NFs no período. Divergências muda a rosca para os três tipos com mais NFs conferidas que ainda divergem do pedido na leitura selecionada, usando uma escala quente. O nome do tipo vem do cadastro do Nomus.',
    comoLe:
      'Em Volume, cada tipo informa notas, itens e participação no top 3. Em Divergências, informa quantas NFs ainda divergem, o total de NFs daquele tipo e sua participação entre as três líderes. Clique na fatia ou na linha do tipo para abrir os documentos daquele número, na mesma visão do painel.',
  },
];

export default function GestaoEntradasAjudaModal({ aberto, onClose }: GestaoEntradasAjudaModalProps) {
  return (
    <AjudaTelaModal
      aberto={aberto}
      onClose={onClose}
      titulo="Como ler Gestão entradas"
      subtitulo="Volume, conferência e divergências aceitas."
      introducao="O painel acompanha a acuracidade das entradas. A visão real, que abre por padrão, ignora divergência benigna. A visão geral inclui benigna e real."
      secoes={SECOES}
      tituloId="gestao-entradas-ajuda-titulo"
    />
  );
}
