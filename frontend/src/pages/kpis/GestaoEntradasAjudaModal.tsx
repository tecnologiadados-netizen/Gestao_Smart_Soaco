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
      'O painel lê as notas de entrada do Nomus pela data de entrada, nos mesmos tipos de movimentação da conferência Double Check NFe (11, 35 e 111 a 116).',
    comoLe:
      'O período padrão é o mês corrente. Ajuste início e fim e clique em Filtrar. Cada nota conta uma vez, mesmo com vários itens.',
  },
  {
    id: 'status',
    titulo: 'Cards e anel',
    oQueE:
      'Entradas é a quantidade de notas no período. Conferidas já passaram pelo Double Check. Pendentes ainda não. A média divide o total pelos dias que tiveram ao menos uma entrada. Sem divergência é conferidas sem divergência ÷ conferidas.',
    comoLe:
      'A faixa sob o número compara duas metades com a mesma quantidade de dias (a do meio fica de fora quando o período é ímpar). Seta verde é melhora: mais entradas, mais conferidas, média maior ou mais pontos percentuais sem divergência. Em pendentes, verde é queda. Vermelho é o caminho inverso. Com menos de dois dias, a comparação não aparece. O círculo grande, logo abaixo da evolução, usa a mesma escala: vermelho é pior, azul-marinho é melhor. Entra na conta a nota conferida cuja NF já está igual ao pedido, mesmo que a divergência tenha existido no dia da conferência. Nota pendente não entra. Sem conferência no período, o círculo fica sem percentual.',
  },
  {
    id: 'linha',
    titulo: 'Entradas ao dia',
    oQueE:
      'A linha azul-marinho é o total de notas naquele dia ou mês. A linha laranja é quantas dessas notas ainda têm divergência aceita: a NF continua diferente do pedido de compra.',
    comoLe:
      'No ponto, a leitura é “Das 18 entradas, 9 tiveram divergência aceita.” Clique na bolinha para abrir as entradas daquele dia: quais ainda divergem e, nessas, o valor na NF ao lado do valor no pedido, o campo, a decisão e a observação. Se a diferença foi corrigida no ERP depois da conferência, a nota sai da linha laranja. Recusa que ainda existe não entra na linha laranja. No modo Mês, a bolinha abre o mês.',
  },
  {
    id: 'tipos',
    titulo: 'Tipos de divergência e motivos',
    oQueE:
      'O ranking por campo conta cada decisão (valor unitário, quantidade, IPI ou condição de pagamento) das notas conferidas que ainda divergem do pedido. O ranking de motivos conta só as decisões aceitas, pela justificativa escolhida na conferência. Diferença já corrigida no ERP sai desses rankings.',
    comoLe:
      'Uma nota pode aparecer em mais de um campo. A lista de motivos muda conforme o campo (valor, quantidade, IPI ou pagamento); Outros fica por último e só entra quando nenhum motivo daquele campo couber. Decisão gravada em nota que ainda não foi conferida não entra nos rankings.',
  },
  {
    id: 'movimento',
    titulo: 'Tipos de movimentação',
    oQueE:
      'O botão Volume mostra os três tipos de movimentação com mais NFs no período. Divergências muda a rosca para os três tipos com mais NFs conferidas que ainda divergem do pedido, usando uma escala quente. O nome do tipo vem do cadastro do Nomus.',
    comoLe:
      'Em Volume, cada tipo informa notas, itens e participação no top 3. Em Divergências, informa quantas NFs ainda divergem, o total de NFs daquele tipo e sua participação entre as três líderes.',
  },
];

export default function GestaoEntradasAjudaModal({ aberto, onClose }: GestaoEntradasAjudaModalProps) {
  return (
    <AjudaTelaModal
      aberto={aberto}
      onClose={onClose}
      titulo="Como ler Gestão entradas"
      subtitulo="Volume, conferência e divergências aceitas."
      introducao="O painel acompanha a acuracidade das entradas: quantas notas entraram, quantas foram conferidas sem divergência e onde as divergências aceitas se concentram."
      secoes={SECOES}
      tituloId="gestao-entradas-ajuda-titulo"
    />
  );
}
