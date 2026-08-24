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
      'A DFC mostra o caixa no tempo. Até hoje entra o que já saiu ou entrou na conta (data de baixa / quitação). A partir de amanhã entra o que ainda está em aberto, pelo vencimento e pelo saldo a baixar — com exceção da linha Receitas de Vendas de Produto (Nomus), que também inclui o vencimento de hoje.',
    comoLe:
      'Se o período “vai para frente”, a grade já mistura as duas fatias. No Excel a coluna Situação marca cada lançamento como Realizado ou Projetado. Esticar a data fim na DRE não faz o mesmo: a DRE é competência (NF emitida), não previsão de caixa. Parcelas de pedido de compra (descrição “Pedido de compra PCxxxx”) não entram: só conta a pagar de documento (NF).',
  },
  {
    id: 'receita-vendas-produto',
    titulo: 'Receitas de Vendas de Produto (Contas a Receber)',
    oQueE:
      'Na projeção Nomus dessa linha (id 2), entram só títulos a receber (tipo R) em aberto, com saldo a baixar e vencimento a partir de hoje (hoje e amanhã em diante).',
    comoLe:
      'Dois caminhos de inclusão: (1) idDocumentoSaida preenchido (NF/documento de saída); ou (2) geraAdiantamento vazio (só NULL), sem idDocumentoSaida e sem idPedido. Pedido com adiantamento sem documento, ou geraAdiantamento preenchido sem NF, fica de fora. Shop9 não usa esses filtros.',
  },
  {
    id: 'projecao-pd',
    titulo: 'Projeção de Receitas (1.1.3)',
    oQueE:
      'Grupo sintético sob Receitas Operacionais. O pai 1.1.3 é só a soma dos filhos. A sublinha 1.1.3.1 (Projeção de Receita Carteira) usa o Saldo a Receber da Carteira Financeira (Só Aço), rateado pelos dias de condicaopagamento.regra a partir da previsão do Gerenciador de Pedidos. 1.1.3.2 Entradas e 1.1.3.4 Vendas à Vista ainda sem regra (zeradas).',
    comoLe:
      'Ex.: regra 30,45,60 e previsão 25/07 → parcelas em 24/08, 08/09 e 23/09 (previsão + N dias), valor = saldo a receber ÷ 3. Fins de semana vão para a terça seguinte. Clique na célula para ver as parcelas. Aparece ao filtrar todas as empresas ou Só Aço.',
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
      introducao="A Demonstração dos Fluxos de Caixa acompanha entradas e saídas por conta, com saldos bancários e a projeção de receitas (Carteira rateada por regra de pagamento). O passado é baixa; o futuro é vencimento."
      secoes={SECOES}
      tituloId="dfc-ajuda-titulo"
    />
  );
}
