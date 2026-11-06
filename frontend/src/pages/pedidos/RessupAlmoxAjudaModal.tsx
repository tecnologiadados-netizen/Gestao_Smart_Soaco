import AjudaTelaModal, { type SecaoAjuda } from '../../components/AjudaTelaModal';

export type RessupAlmoxAjudaModalProps = {
  aberto: boolean;
  onClose: () => void;
};

const SECOES: SecaoAjuda[] = [
  {
    id: 'ciclo',
    titulo: 'Ciclo da análise',
    oQueE:
      'Cada análise passa por status: em processamento → processado → concluído.',
    comoLe:
      'Em processamento você edita sugestão (qtde/data). Após processar, abre a etapa de aprovação. Concluído fica somente leitura. Histórico lista snapshots gravados.',
  },
  {
    id: 'saldo',
    titulo: 'Saldo projetado e cobertura',
    oQueE:
      'Saldo projetado = −Empenho + Solicitação + Estoque atual + PC Pend + Pré Compra. Cobertura = saldo ÷ CM (se CM = 0, o divisor usa 0,01). A coluna Pré Entrada é informativa (material a caminho) e não entra nessa fórmula.',
    comoLe:
      'Saldo baixo ou cobertura curta indica prioridade de compra. Compare com CM e com o dia da compra recorrente do item. Se PC Pend estiver zerado, confira Pré Entrada antes de concluir que não há material a chegar.',
  },
  {
    id: 'empenho',
    titulo: 'Qtde Emp / empenho líquido',
    oQueE:
      'Mesma regra da Consulta de Estoque: empenho líquido = max(0, bruto − estoque em PA), consolidado na grade; detalhe por pedido no modal.',
    comoLe:
      'Clique em Empenho ou PC Pend: a soma do modal deve ser igual à célula. O flag “considerar requisições” altera o que entra no empenho.',
  },
  {
    id: 'pre-entrada',
    titulo: 'Pré Entrada',
    oQueE:
      'Quantidade em documento de pré-entrada (tipo 173) ligada a item de pedido já atendido. Quando o PC Pend zera após a pré-entrada, essa coluna mostra o saldo que ainda está a caminho (ainda não entrou de fato no estoque).',
    comoLe:
      'Célula com quantidade ganha destaque violeta e abre o modal analítico (solicitação, pedido, documento, NF, fornecedor, emissão e situação). A soma do modal = valor da grade. Clique no pedido ou no documento no modal para ver todos os itens. Sai da coluna quando o documento deixa de ser pré-entrada.',
  },
  {
    id: 'sug-aprov',
    titulo: 'Sugestão × aprovação',
    oQueE:
      'Qtde/Data Sugestão são editáveis em processamento. Campos de Aprovação só após processar; há atalho para copiar Sug → Aprov.',
    comoLe:
      'Trabalhe a sugestão com base no saldo/cobertura; na aprovação confirme ou ajuste. Observações por coluna (ícone) registram justificativas sem poluir a grade.',
  },
  {
    id: 'filtros',
    titulo: 'Filtros e dia da compra',
    oQueE:
      'Filtros por código, descrição, coleta e dia da semana da compra, além do flag de requisições. Snapshot mescla API com edições do usuário.',
    comoLe:
      'Nome da coleta e Dia da compra são seleção exata da lista: a grade traz apenas as opções marcadas, sem correspondência parcial pelo nome. Código e descrição continuam como busca de texto (aceitam % para refinar). Use o dia da compra para montar a lista do dia. Ao reabrir um histórico, a tela pode reconsultar o ERP e mesclar com o que você já editou.',
  },
  {
    id: 'integridade',
    titulo: 'Integridade grade = modal',
    oQueE:
      'Padrão de consultas em cascata: grade enxuta + detalhe lazy da mesma fonte SQL/regra.',
    comoLe:
      'Nunca trate o modal como “amostra”: se o número da grade e a soma do detalhe divergirem, há bug — a regra exige igualdade. No modal de Pré Compra, clique no código da coluna SC para abrir essa solicitação (usuário, emissão, necessidade e saldo).',
  },
];

export default function RessupAlmoxAjudaModal({ aberto, onClose }: RessupAlmoxAjudaModalProps) {
  return (
    <AjudaTelaModal
      aberto={aberto}
      onClose={onClose}
      titulo="Como ler o Ressuprimento Almox"
      subtitulo="Ciclo da análise, saldo, cobertura, sugestão e aprovação."
      introducao="Análise de ressuprimento do almox com snapshot gravável. A grade consolida necessidade e disponibilidade; clique nas células analíticas para o detalhe completo da mesma regra."
      secoes={SECOES}
      tituloId="ressup-almox-ajuda-titulo"
    />
  );
}
