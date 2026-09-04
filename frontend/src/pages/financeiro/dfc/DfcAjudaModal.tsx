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
      'A DFC mostra o caixa no tempo. Títulos já quitados entram pela data de baixa (realizado). Títulos em aberto entram pelo vencimento a partir de hoje (projetado), usando o saldo a baixar.',
    comoLe:
      'Na coluna de hoje você vê tanto o que já entrou/saiu da conta quanto o que ainda vence hoje e está em aberto. No Excel a coluna Situação marca cada lançamento como Realizado ou Projetado. Use a aba Resumido para a visão agrupada (Saldo, A receber, A pagar, Sem Priorização, Saldo final). O botão Dashboard abre KPIs e o resumo no modal. Parcelas de pedido de compra (descrição “Pedido de compra PCxxxx”) não entram: só conta a pagar de documento (NF).',
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
    id: 'cenarios',
    titulo: 'Cenários',
    oQueE:
      'Filtro multiselect nos filtros principais da DFC. Cada opção (1–4) corresponde à classificação de prioridade de pagamento cadastrada no plano de contas ou por lançamento.',
    comoLe:
      'Cenários afetam somente títulos a vencer (receitas e saídas projetadas). O realizado (baixas no passado e hoje) sempre aparece, mesmo com cenário selecionado. Na aba Resumida, A receber e A pagar respeitam o cenário; a linha Sem Priorização continua mostrando todos os títulos projetados sem classificação. Para cadastrar ou alterar prioridades, use o botão «Prioridade de pagamento».',
  },
  {
    id: 'prioridade-pagamento',
    titulo: 'Prioridade de pagamento',
    oQueE:
      'Classificação de contas e títulos a pagar (1–4) para organizar a projeção de saídas. Override por lançamento prevalece sobre a do plano de contas.',
    comoLe:
      'Na aba Plano de Contas, cada linha é conta × empresa (inclui RN e Só Refrigeração). Na aba Lançamento entram títulos em aberto: Nomus (agendamentos P sem pedido de compra) e Shop9 (Financeiro_Contas a pagar — RN/Refrigeração), no intervalo da DFC ampliado em +90 dias para a vencer. Prioridade Shop9 usa tipoRef S (Ordem do título). A DRE não tem esta classificação por lançamento — só a DFC.',
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
