import AjudaTelaModal, { type SecaoAjuda } from '../../../components/AjudaTelaModal';

export type DfcAjudaModalProps = {
  aberto: boolean;
  onClose: () => void;
};

const SECOES: SecaoAjuda[] = [
  {
    id: 'realizado-projetado',
    titulo: 'Realizado vs projetado',
    oQueE:
      'A DFC mostra o caixa no tempo. Até hoje entra o que já saiu ou entrou na conta (data de baixa / quitação). A partir de amanhã entra o que ainda está em aberto, pelo vencimento e pelo saldo a baixar.',
    comoLe:
      'Se o período “vai para frente”, a grade já mistura as duas fatias. No Excel a coluna Situação marca cada lançamento como Realizado ou Projetado. Esticar a data fim na DRE não faz o mesmo: a DRE é competência (NF emitida), não previsão de caixa. Parcelas de pedido de compra (descrição “Pedido de compra PCxxxx”) não entram: só conta a pagar de documento (NF).',
  },
  {
    id: 'projecao-pd',
    titulo: 'Projeção de Receitas (PDs Só Aço)',
    oQueE:
      'Linha extra da árvore (1.1.3) com o saldo a faturar das parcelas de pedido de venda Só Aço, na data projetada de vencimento. Fins de semana vão para a terça seguinte.',
    comoLe:
      'Aparece ao filtrar todas as empresas ou Só Aço. Clique na célula para ver as parcelas. O Excel traz essa lista na aba Projeção de receitas.',
  },
  {
    id: 'excel',
    titulo: 'Exportar Excel',
    oQueE:
      'Gera um XLSX com a árvore da tela (mesmos números) e o detalhe do período, sem o recorte de 2.000 linhas dos modais.',
    comoLe:
      'Clique em Aplicar e depois em Exportar Excel. O arquivo inclui Filtros+KPIs, a árvore DFC, lançamentos (com Situação, prioridade e REPROGR), projeção de PDs, saldos bancários e vencido a pagar.',
  },
];

export default function DfcAjudaModal({ aberto, onClose }: DfcAjudaModalProps) {
  return (
    <AjudaTelaModal
      aberto={aberto}
      onClose={onClose}
      titulo="Como ler a DFC"
      subtitulo="Caixa realizado, projetado e o que o Excel entrega."
      introducao="A Demonstração dos Fluxos de Caixa acompanha entradas e saídas por conta, com saldos bancários e uma projeção de receitas de PD. O passado é baixa; o futuro é vencimento."
      secoes={SECOES}
      tituloId="dfc-ajuda-titulo"
    />
  );
}
