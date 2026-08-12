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
    titulo: 'Lançamento por documento de saída',
    oQueE:
      'Só entram movimentações ligadas a documento de saída do Nomus. O fluxo começa pela escolha do tipo (entrada ou saída); em seguida o sistema pede o documento, o pedido vinculado e os produtos/quantidades.',
    comoLe:
      '1) Escolha Entrada ou Saída. 2) Digite o número do documento de saída e selecione na lista. 3) Confira o pedido vinculado. 4) Escolha o produto do documento (quantidade preenche sozinha). 5) Informe o kit (Filtro/Engate) e confirme. Na grade Últimas movimentações, use o ▾ de cada coluna para filtrar/ordenar.',
  },
  {
    id: 'produtos',
    titulo: 'Estoque atual e resumo',
    oQueE:
      'No topo, quatro indicadores: saldo total na loja, unidades de entrada, unidades de saída e quantidade de inventários (com total de registros no histórico). Abaixo, o saldo de cada kit (Filtro/Engate) com entradas e saídas do item.',
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
      subtitulo="Documento de saída Nomus, pedido vinculado, kit e inventário."
      introducao="Controle dos kits remanescentes na loja, sempre amarrado a um documento de saída do Nomus e ao pedido de venda vinculado."
      secoes={SECOES}
      tituloId="loja-estoque-kits-ajuda-titulo"
    />
  );
}
