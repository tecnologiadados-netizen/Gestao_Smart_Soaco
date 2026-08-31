import AjudaTelaModal, { type SecaoAjuda } from '../../components/AjudaTelaModal';

export type ProgramacaoProducaoAjudaModalProps = {
  aberto: boolean;
  onClose: () => void;
};

const SECOES: SecaoAjuda[] = [
  {
    id: 'ciclo',
    titulo: 'Ciclo do registro',
    oQueE:
      'Cada programação segue: em processamento → processado (em geral só OP Nomus editável) → concluído (somente leitura).',
    comoLe:
      'Monte roteiros e quantidades em processamento; processe para travar a base; conclua quando OPs/validações estiverem ok.',
  },
  {
    id: 'escala',
    titulo: 'Escala de trabalho dos recursos',
    oQueE:
      'Cada recurso pode ter faixas de funcionamento no mesmo dia (ex.: 07:00–11:30 e 13:00–17:15) e dias da semana. O intervalo entre faixas (almoço) não é parada real. A Perfiladeira 1000 (R001) alimenta o painel Produção Camasi.',
    comoLe:
      'Cadastre a escala em PCP → Configuração → Recursos. O painel Camasi só conta produção e paradas que cruzam essas faixas; hora extra fica de fora por enquanto.',
  },
  {
    id: 'roteiros',
    titulo: 'Roteiros e recursos',
    oQueE:
      'Sequência de recursos com quantidade a produzir. Há fluxo Perfiladeira e fluxo manual; roteiros duplicados não são permitidos.',
    comoLe:
      'Preencha sequência e quantidade em conjunto. Inconsistência (um preenchido sem o outro) gera alerta na validação/processamento.',
  },
  {
    id: 'pdf',
    titulo: 'PDF Perfiladeira 1000',
    oQueE:
      'Tipo de impressão “Perfiladeira” corresponde ao Recurso 1000 (Perfiladeira 1000), distinto do PDF manual. Colunas: Sequência, Código, Desc Simpl, Roteiro, Qtde a produzir, Observação (da grade) e OP Nomus. Não inclui Med 1, Med 2 nem Chapa.',
    comoLe:
      'Escolha Perfiladeira no modal de PDF para o layout da 1000. Observação e OP Nomus vêm do que foi registrado na programação; o PDF manual mantém Med 1/Med 2/Chapa.',
  },
  {
    id: 'ops',
    titulo: 'Conclusão e OPs Nomus',
    oQueE:
      'Roteiros com Perfiladeira exigem saldo de OPs Nomus suficiente (≥ quantidade perfiladeira) para concluir.',
    comoLe:
      'Se a conclusão bloquear, confira OPs lançadas no Nomus versus a qtde da Perfiladeira no roteiro.',
  },
  {
    id: 'estoques',
    titulo: 'Estoques da linha',
    oQueE:
      'PA Nomus, estoque em produção (informado), bobina e MP alternativa (setores 19/20) apoiam a leitura da linha. A coluna Estoque mostra o Total = PA Nomus + estoque em produção.',
    comoLe:
      'Use esses campos para decidir se falta material ou se há alternativa. Eles não substituem a validação de OP na conclusão.',
  },
  {
    id: 'saldo-projetado',
    titulo: 'Saldo Projetado, Qtde MP Faltante e Cobertura',
    oQueE:
      'Saldo Projetado = Estoque Total (PA Nomus + estoque em produção) − Empenho. Qtde MP Faltante = (Empenho − Estoque Total, mínimo zero) × peso unitário da bobina. Cobertura = Saldo Projetado ÷ VM (VM zerada deixa a cobertura em branco).',
    comoLe:
      'As três colunas recalculam na hora quando você informa o estoque em produção no modal de Estoque, por isso o inventário precisa estar correto antes de decidir produção ou compra. Programações gravadas antes desta mudança continuam exibindo o cálculo antigo, que considerava apenas o PA Nomus — a nova base vale só para programações criadas a partir de agora.',
  },
  {
    id: 'inventario',
    titulo: 'Inventário em produção',
    oQueE:
      'Importação/exportação de planilha de estoque em processo para alimentar a programação.',
    comoLe:
      'Mantenha a planilha atualizada antes de processar grandes lotes — divergência de inventário distorce a necessidade aparente.',
  },
];

export default function ProgramacaoProducaoAjudaModal({
  aberto,
  onClose,
}: ProgramacaoProducaoAjudaModalProps) {
  return (
    <AjudaTelaModal
      aberto={aberto}
      onClose={onClose}
      titulo="Como ler a Programação de Produção (Recurso 1000)"
      subtitulo="Ciclo do registro, roteiros, PDF Perfiladeira e OPs Nomus."
      introducao="Programação de produção com foco na Perfiladeira 1000 (Recurso 1000) e roteiros associados. Siga o ciclo de status e valide sequência, quantidades e OPs antes de concluir."
      secoes={SECOES}
      tituloId="programacao-producao-ajuda-titulo"
    />
  );
}
