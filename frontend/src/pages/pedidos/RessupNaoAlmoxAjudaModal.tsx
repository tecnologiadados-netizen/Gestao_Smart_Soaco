import AjudaTelaModal, { type SecaoAjuda } from '../../components/AjudaTelaModal';

export type RessupNaoAlmoxAjudaModalProps = {
  aberto: boolean;
  onClose: () => void;
};

const SECOES: SecaoAjuda[] = [
  {
    id: 'diff',
    titulo: 'Diferença vs Ressup Almox',
    oQueE:
      'Mesmo ciclo de análise (processamento → processado → concluído), mas o escopo é por coletas de não-almox (exclui/destaca setor de almox secundário etc.) e não usa filtro “dia da compra”.',
    comoLe:
      'Escolha coletas/códigos do escopo de fábrica (não almox). Exportações PDF/Excel seguem as colunas dessa visão.',
  },
  {
    id: 'cobertura',
    titulo: 'Cobertura por VM',
    oQueE:
      'Cobertura = saldo projetado ÷ VM. Cobertura Sug e Nova Cobertura (após processado) recalculam somando qtde sugestão/aprovação.',
    comoLe:
      'Use VM (venda média) como ritmo de consumo. Ao sugerir/aprovar quantidade, confira se a nova cobertura fica no horizonte desejado.',
  },
  {
    id: 'estoque',
    titulo: 'Estoque exibido / em produção',
    oQueE:
      'O estoque da grade pode incorporar visão do modal (produção + pintado) e é preservado no re-filtro quando aplicável.',
    comoLe:
      'Não confunda estoque físico único com o valor efetivo usado no saldo: a tela pode misturar setores/produção conforme o código.',
  },
  {
    id: 'pintado',
    titulo: 'Código pintado',
    oQueE:
      'Catálogo mapeia código → código pintado; isso impacta a busca de estoque e a leitura do item na grade.',
    comoLe:
      'Se o estoque “não bate” com o código digitado, verifique se há equivalente pintado — a consulta pode estar olhando o par mapeado.',
  },
  {
    id: 'saldo',
    titulo: 'Saldo projetado',
    oQueE:
      'Mesma ideia do Almox: −Empenho + Solicitação + Estoque efetivo + PC Pend + Ag Pag.',
    comoLe:
      'Vermelho/ruptura sinaliza prioridade. Clique em Empenho/PC Pend para validar a conta no modal (soma = célula).',
  },
  {
    id: 'empenho',
    titulo: 'Empenho e PC Pend',
    oQueE:
      'Cascata lazy com cache; empenho líquido = max(0, bruto − estoque em PA), mesma regra Almox/Consulta.',
    comoLe:
      'Novo Filtrar limpa o cache. Integridade inegociável: valor da grade = soma do detalhe.',
  },
];

export default function RessupNaoAlmoxAjudaModal({ aberto, onClose }: RessupNaoAlmoxAjudaModalProps) {
  return (
    <AjudaTelaModal
      aberto={aberto}
      onClose={onClose}
      titulo="Como ler o Ressuprimento Não Almox"
      subtitulo="Escopo por coletas, cobertura por VM, estoque/pintado e cascata."
      introducao="Análise de ressuprimento fora do almox, com o mesmo ciclo de status do Almox, mas cobertura por VM e regras de estoque/código pintado próprias do escopo de fábrica."
      secoes={SECOES}
      tituloId="ressup-nao-almox-ajuda-titulo"
    />
  );
}
