import AjudaTelaModal, { type SecaoAjuda } from '../../components/AjudaTelaModal';

export type SycroOrderAjudaModalProps = {
  aberto: boolean;
  onClose: () => void;
};

const SECOES: SecaoAjuda[] = [
  {
    id: 'kanban',
    titulo: 'Colunas do Kanban',
    oQueE:
      'Fluxo visual dos cards: Aberto (PENDING) → Carradas em andamento → G.The/Retiradas → Disponível (por tag) → Faturado (FINISHED, no modal).',
    comoLe:
      'Arraste/atualize o card conforme o andamento comercial. A coluna Disponível depende da tag, não só da faixa de rota.',
  },
  {
    id: 'disponivel',
    titulo: 'Tag Disponível',
    oQueE:
      'Marca o card como disponível para o próximo passo comercial/logístico, movendo-o para a lane “Disponível”.',
    comoLe:
      'Independe da categoria de rota do Gerenciador. No Gerenciador, “Disponível” aparece no Status como sinal vindo desta comunicação.',
  },
  {
    id: 'fila',
    titulo: 'MINHA FILA',
    oQueE:
      'Filtro/visão de cards que aguardam sua resposta, com destaques de entrega hoje/amanhã, atraso >24h e ordenação por urgência.',
    comoLe:
      'Use “ver meus” / time que deve responder para focar o que é ação sua. Priorize entrega imediata e cards parados há mais de 24h.',
  },
  {
    id: 'acao',
    titulo: 'Ação e responsáveis',
    oQueE:
      'Rótulo “🔴 AÇÃO: …” indica quem precisa responder. Há responsável principal e, quando aplicável, segundo responsável.',
    comoLe:
      'Se o card está na sua fila com AÇÃO, a próxima mensagem/decisão é sua. Trocar responsável move a bola sem fechar o card.',
  },
  {
    id: 'previsao',
    titulo: 'Alterar previsão no card',
    oQueE:
      'Pelo card você pode gravar nova previsão com motivo e observação, com opção de replicar por carrada (excluindo categorias que o Gerenciador não replica).',
    comoLe:
      'A previsão do card e a do Gerenciador podem divergir temporariamente — o aviso amarelo sinaliza isso. Mensagem ≠ observação.',
    detalhes: [
      {
        titulo: 'Mensagem',
        texto: 'Chat interno da comunicação PD (histórico do diálogo).',
      },
      {
        titulo: 'Observação',
        texto: 'Complemento do motivo de reprogramação no Gerenciador — não substitui a mensagem do chat.',
      },
      {
        titulo: 'Justificativa (PDF)',
        texto:
          'Com nova data prometida, o PDF assinado fica disponível para anexar. Em motivo não abonado é obrigatório; em motivo abonado é opcional — se anexar, o arquivo é gravado no histórico do pedido (Gerenciador / Pedidos Encerrados).',
      },
    ],
  },
  {
    id: 'novo',
    titulo: 'Novo card e histórico',
    oQueE:
      'Crie card a partir de PD/rota; acompanhe notificações e o histórico do pedido.',
    comoLe:
      'Antes de abrir card novo, confira se já existe comunicação ativa para o mesmo PD. Use o histórico para não repetir perguntas ao comercial.',
  },
  {
    id: 'whatsapp',
    titulo: 'Alerta WhatsApp (Loja × Indústria)',
    oQueE:
      'Ao marcar DISPONÍVEL ou NÃO DISPONÍVEL, o sistema envia WhatsApp (Integração → SMS) para o grupo do escopo do vendedor do PD no Nomus.',
    comoLe:
      'O escopo é o nome do vendedor (sem acento, maiúsculas). Lista da Loja: Gilvania, Miriam, Larissa Cristine, Maria Leopoldina e Roberto. Lista da Indústria: Antonio Luis, Marcos Amorim, Idelgasto, Airton Representações, James, Jonas, Larisse Narlla, Maria Clara, Gold e Henrique Representação. Vendedor fora das duas listas (ou sem vendedor) cai na Indústria.',
  },
];

export default function SycroOrderAjudaModal({ aberto, onClose }: SycroOrderAjudaModalProps) {
  return (
    <AjudaTelaModal
      aberto={aberto}
      onClose={onClose}
      titulo="Como ler a Comunicação PD"
      subtitulo="Kanban, fila, responsáveis, previsão e vínculo com o Gerenciador."
      introducao="Comunicação interna sobre pedidos (Sycro/Comunicação PD). Os cards refletem o diálogo comercial e alimentam sinais (Card/Disponível) no Gerenciador de Pedidos."
      secoes={SECOES}
      tituloId="sycro-ajuda-titulo"
    />
  );
}
