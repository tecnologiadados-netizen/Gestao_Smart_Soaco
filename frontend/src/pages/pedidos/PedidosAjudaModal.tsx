import AjudaTelaModal, { type SecaoAjuda } from '../../components/AjudaTelaModal';

export type PedidosAjudaModalProps = {
  aberto: boolean;
  onClose: () => void;
};

const SECOES: SecaoAjuda[] = [
  {
    id: 'categoria',
    titulo: 'Como a categoria (rota) é definida',
    oQueE:
      'Cada linha da grade recebe uma categoria (TipoF) a partir do romaneio/rota no ERP. Se ainda não há observação de romaneio, o sistema classifica automaticamente pela regra de prioridade abaixo.',
    comoLe:
      'Olhe a coluna de observações/rota para saber em qual “balde” o pedido caiu. A categoria decide qual regra de previsão e de atraso vale para aquela linha.',
    detalhes: [
      {
        titulo: 'Prioridade quando não há romaneio',
        texto:
          '1) Retirada (método Só Móveis ou Só Aço) → 2) Requisição (Teresina + requisição loja = Sim) → 3) Entrega Grande Teresina (municípios da região + requisição = Não) → 4) Inserir em Romaneio (demais casos).',
      },
      {
        titulo: 'Quando já existe rota no ERP',
        texto:
          'O texto de observações do romaneio é usado como está. Se contém “ROTA”, a linha entra como Carradas.',
      },
    ],
  },
  {
    id: 'retirada',
    titulo: 'Retirada',
    oQueE:
      'Pedidos com método de entrega “Retirada na Só Aço” ou “Retirada na Só Móveis”, quando ainda não há romaneio preenchido no ERP.',
    comoLe:
      'A previsão usada no prazo é a data de entrega do item. A linha fica Atrasada se a data de hoje for posterior a essa entrega. Não entra na regra de valor de corte nem na replicação por carrada.',
  },
  {
    id: 'gthe',
    titulo: 'Entrega G. The (Grande Teresina)',
    oQueE:
      'Entregas nos municípios da Grande Teresina (Teresina, Timon, Nazária, Demerval Lobão, Curralinhos) quando não é requisição de loja e ainda não há romaneio.',
    comoLe:
      'Assim como na Retirada, a previsão e o atraso seguem a data de entrega do item — sem valor de corte. Também fica fora da replicação automática por carrada.',
  },
  {
    id: 'romaneio',
    titulo: 'Inserir em romaneio',
    oQueE:
      'Categoria padrão quando o pedido ainda não tem observação de romaneio e não se encaixa em Retirada, Requisição ou Grande Teresina. Indica que ainda precisa ser colocado em uma rota.',
    comoLe:
      'Sempre aplica a regra de valor de corte: se o Valor Pedido Total for menor que o corte, trata como Carrada em formação (previsão com rótulo; produção = maior data das carradas normais + 30 dias). Se for igual ou maior que o corte, previsão e produção usam emissão + dias da faixa ≥ corte (padrão +45). Ajuste manual de previsão prevalece.',
  },
  {
    id: 'carrada',
    titulo: 'Carrada',
    oQueE:
      'Linhas cuja rota começa com “ROTA …” (já definidas no romaneio do ERP). É o fluxo de carga/entrega por rota comercial.',
    comoLe:
      'A previsão automática não usa o “emissão + 30 dias” legado da consulta: o sistema recalcula com a regra de valor de corte. Ao ajustar uma previsão, você pode optar por replicar a data para outros pedidos da mesma ROTA.',
    detalhes: [
      {
        titulo: 'Carrada em formação',
        texto:
          'Rotas cujo nome indica construção/contingência aparecem como “Carrada em formação”: a grade não mostra data de entrega/previsão nesses casos, até a rota se consolidar. A data de produção exibida (e usada em Empenho, Consulta de Estoque e Programação Setorial) é sempre a maior data de produção das carradas normais + 30 dias — a data_producao eventualmente gravada no pedido é ignorada enquanto a rota estiver em formação.',
      },
    ],
  },
  {
    id: 'corte',
    titulo: 'Valor de corte e previsão automática',
    oQueE:
      'Regra configurável (tela Regras de data de entrega) que define a data limite das carradas a partir da emissão do pedido e do valor total do PD.',
    comoLe:
      'Padrão do sistema (Carradas): base = data de emissão; valor = Valor Pedido Total (com IPI). Abaixo de R$ 30.000 → emissão + 60 dias; igual ou acima do corte → emissão + 45 dias. Versões da regra valem conforme a data de emissão do pedido. Se existir ajuste manual gravado, ele prevalece sobre a regra.',
    detalhes: [
      {
        titulo: 'Inserir em Romaneio',
        texto:
          'Bifurcação fixa: valor abaixo do corte → Carrada em formação (produção max+30); valor ≥ corte → emissão + dias da faixa ≥ corte. Não depende mais do checkbox legado “aplicar a mesma regra”.',
      },
      {
        titulo: 'Onde configurar',
        texto:
          'Em Pedidos → Regras de data de entrega você altera corte e dias. A bifurcação de Inserir em Romaneio usa o valor de corte e os dias da faixa ≥ corte.',
      },
    ],
  },
  {
    id: 'atrasado',
    titulo: 'Atrasado / No prazo',
    oQueE:
      'Indicador de prazo da linha na coluna Status. Na grade, o texto “Em dia” do ERP aparece como “No prazo”.',
    comoLe:
      'Para Carradas (e Inserir em Romaneio quando a flag da regra estiver ligada), compara a data de hoje com a data limite da regra de corte. Nas demais categorias, compara com a data de entrega / parâmetro da linha. O filtro “Somente atrasados” usa a previsão atualizada.',
  },
  {
    id: 'faturado',
    titulo: 'Faturado',
    oQueE:
      'Badge na coluna Status quando o item já tem valor de faturamento de entrega futura (mais IPI) maior que zero.',
    comoLe:
      'Não indica atraso nem conclusão do pedido: só sinaliza que já houve faturamento parcial / entrega futura naquele item. Pode aparecer junto com No prazo ou Atrasado.',
  },
  {
    id: 'card',
    titulo: 'Card / Disponível',
    oQueE:
      'Sinais vindos da Comunicação Interna (Comunicação PD / Sycro), refletidos na coluna Status do Gerenciador.',
    comoLe:
      '“Card” e “Disponível” mostram o andamento do diálogo com o cliente/comercial sobre aquele pedido — são independentes do prazo (Atrasado/No prazo) e do Faturado.',
  },
  {
    id: 'ajuste',
    titulo: 'Ajuste manual e replicação',
    oQueE:
      'Ao clicar na previsão na grade, você grava uma nova data com motivo (e observação opcional). Esse ajuste fica no banco local e substitui a previsão automática da regra.',
    comoLe:
      'Em carradas, o sistema pode perguntar se a nova data deve valer só naquele PD/item ou ser replicada para outros da mesma ROTA. Retirada, Grande Teresina, Inserir em Romaneio e Requisição não entram nessa replicação.',
    detalhes: [
      {
        titulo: 'Previsão provisória (não confiável)',
        texto:
          'No toggle “Previsão confiável”, escolha Sim ou Não (o controle sempre abre no meio). Não = data provisória: vale na grade, mas não entra no histórico da Comunicação Interna — use para datas ainda em negociação. Sem ajuste real, a coluna Pedido fica em branco (sem selo Confiável/Não confiável). Em Mais filtros, todos os campos são de múltipla escolha: vendedor, status, método de entrega, previsão confiável, tipo de pedido, grupo/subgrupos, requisição, empresa da venda, TipoF e entrada/a vista até 10 dias.',
      },
      {
        titulo: 'Justificativa (PDF)',
        texto:
          'Ao alterar a previsão, você pode anexar o PDF assinado. Em motivo não abonado o anexo é obrigatório; em motivo abonado é opcional. Se o arquivo for enviado, ele fica disponível no histórico do pedido (incluindo Pedidos Encerrados).',
      },
      {
        titulo: 'Histórico de alterações',
        texto:
          'No modal de histórico, cada card mostra só o que mudou naquele registro (data, Confiável, motivo, observação, anexo). Rota já está no cabeçalho e não se repete no card. Quando a conclusão do sequenciamento só confirma a data vigente e troca Confiável, o card destaca “de Não confiável para Confiável” (ou o inverso), com quem e quando — sem reexibir data nem o motivo automático.',
      },
    ],
  },
  {
    id: 'producao',
    titulo: 'Data de produção na grade',
    oQueE:
      'Coluna de produção do pedido/item, quando preenchida no fluxo de programação ou sequenciamento.',
    comoLe:
      'Se a data de produção estiver vazia, a interface pode exibir a previsão de entrega como referência visual — isso não grava produção automaticamente; é só apoio à leitura.',
  },
];

export default function PedidosAjudaModal({ aberto, onClose }: PedidosAjudaModalProps) {
  return (
    <AjudaTelaModal
      aberto={aberto}
      onClose={onClose}
      titulo="Como ler o Gerenciador de Pedidos"
      subtitulo="Explicação das categorias, status e regras automáticas de previsão."
      introducao="A grade classifica cada linha pela rota/categoria vinda do Nomus e calcula previsão e atraso conforme essa categoria. Um ajuste manual de previsão (gravado no sistema) sobrescreve a regra automática até você alterar de novo."
      secoes={SECOES}
      tituloId="pedidos-ajuda-titulo"
    />
  );
}
