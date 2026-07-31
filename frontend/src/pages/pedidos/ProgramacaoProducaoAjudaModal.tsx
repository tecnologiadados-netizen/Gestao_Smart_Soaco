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
      'PA Nomus, estoque em produção (informado), bobina e MP alternativa (setores 19/20) apoiam a leitura da linha.',
    comoLe:
      'Use esses campos para decidir se falta material ou se há alternativa. Eles não substituem a validação de OP na conclusão.',
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
