import AjudaTelaModal, { type SecaoAjuda } from '../../components/AjudaTelaModal';

export type EstoqueKitsAjudaModalProps = {
  aberto: boolean;
  onClose: () => void;
};

const SECOES: SecaoAjuda[] = [
  {
    id: 'conceito',
    titulo: 'Por que controlar kits',
    oQueE:
      'Quando a loja vende um bebedouro sem filtro e/ou sem engate, esses itens ficam no estoque físico da loja e precisam ser controlados à parte do ERP.',
    comoLe:
      'Use Entrada quando o kit fica na loja (produto saiu sem o kit). Use Saída quando o kit sai/é entregue/consumido. O saldo atual é o que ainda está na loja.',
  },
  {
    id: 'lancamento',
    titulo: 'Entrada (Nomus) e saída (Shop9)',
    oQueE:
      'Entrada fica amarrada ao documento de saída do Nomus e ao pedido de venda. Saída fica amarrada à sequência de venda do Shop9 e exige o responsável pela entrega / conferente. A quantidade vem do produto vinculado e não pode ser alterada.',
    comoLe:
      'Entrada: 1) Escolha Entrada. 2) Informe o documento de saída Nomus. 3) Confira o pedido e o produto. 4) Escolha Kit completo, Filtro ou Engate e confirme. Saída: 1) Escolha Saída. 2) Informe a sequência Shop9. 3) Selecione o responsável pela entrega / conferente (Francisco Cássio, João Victor ou Iran). 4) Confira o produto da sequência. 5) Escolha o kit e confirme. Kit completo lança a quantidade em Filtro e Engate. Se escolher só Filtro ou só Engate, os dados ficam travados e basta confirmar. Na grade, a coluna PD / Seq. mostra o pedido (entrada) ou SEQ nnnn (saída); Conferente aparece nas saídas.',
  },
  {
    id: 'produtos',
    titulo: 'Estoque atual',
    oQueE:
      'A aba Estoque atual mostra o saldo de cada kit (Filtro e Engate) com as entradas e saídas acumuladas do item.',
    comoLe:
      'Cards em destaque vermelho / selo “Estoque baixo” aparecem quando o saldo do kit fica abaixo de 10 unidades. Entradas e saídas nos cards do kit são em unidades acumuladas daquele produto.',
  },
  {
    id: 'inventario',
    titulo: 'Inventário',
    oQueE:
      'Contagem física que ajusta o saldo do sistema para a quantidade contada. Exige permissão específica de inventário.',
    comoLe:
      'Informe a quantidade contada de cada kit e confirme. O histórico guarda sistema × contado e a diferença.',
  },
];

export default function EstoqueKitsAjudaModal({ aberto, onClose }: EstoqueKitsAjudaModalProps) {
  return (
    <AjudaTelaModal
      aberto={aberto}
      onClose={onClose}
      titulo="Como ler — Estoque de kits da loja"
      subtitulo="Entrada pelo Nomus, saída pela sequência Shop9, kit e inventário."
      introducao="Controle dos kits remanescentes na loja: entrada amarrada ao documento/pedido Nomus; saída amarrada à sequência de venda do Shop9."
      secoes={SECOES}
      tituloId="loja-estoque-kits-ajuda-titulo"
    />
  );
}
