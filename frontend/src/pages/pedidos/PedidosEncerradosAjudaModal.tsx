import AjudaTelaModal, { type SecaoAjuda } from '../../components/AjudaTelaModal';

export type PedidosEncerradosAjudaModalProps = {
  aberto: boolean;
  onClose: () => void;
};

const SECOES: SecaoAjuda[] = [
  {
    id: 'o-que-e',
    titulo: 'O que é um pedido encerrado',
    oQueE:
      'Itens/pedidos que saíram do Gerenciador de Pedidos porque o status no ERP está encerrado (não entram mais na grade operacional ativa).',
    comoLe:
      'Use esta tela para consultar o histórico de um PD que já não aparece no Gerenciador, sem misturar com a fila aberta.',
  },
  {
    id: 'busca',
    titulo: 'Como buscar',
    oQueE:
      'Typeahead por número de pedido: digite ao menos 2 caracteres e selecione o PD na lista.',
    comoLe:
      'A grade só carrega após a seleção. Se não achar o PD, confira se realmente está encerrado no ERP ou se o número está completo.',
  },
  {
    id: 'colunas',
    titulo: 'Colunas da grade',
    oQueE:
      'Exibe PD, cliente, código, descrição, quantidade pedida, Status ERP e data original relevantes ao item encerrado.',
    comoLe:
      'Leia o Status ERP para entender como o pedido foi fechado. As demais colunas situam o item no contexto comercial/produtivo.',
  },
  {
    id: 'historico',
    titulo: 'Histórico de alterações',
    oQueE:
      'Ícone/ação abre o mesmo histórico de previsão e motivos usado no Gerenciador, com justificativa e download do PDF assinado quando houver anexo.',
    comoLe:
      'Consulte motivos, datas reprogramadas e o PDF de assinatura mesmo depois do encerramento — útil para auditoria e comunicação comercial.',
  },
];

export default function PedidosEncerradosAjudaModal({
  aberto,
  onClose,
}: PedidosEncerradosAjudaModalProps) {
  return (
    <AjudaTelaModal
      aberto={aberto}
      onClose={onClose}
      titulo="Como ler Pedidos Encerrados"
      subtitulo="Busca por PD, grade e histórico de alterações."
      introducao="Consulta de pedidos/itens já encerrados no ERP. Busque o PD, confira a grade e abra o histórico de previsões/motivos quando precisar auditar o que aconteceu."
      secoes={SECOES}
      tituloId="pedidos-encerrados-ajuda-titulo"
    />
  );
}
