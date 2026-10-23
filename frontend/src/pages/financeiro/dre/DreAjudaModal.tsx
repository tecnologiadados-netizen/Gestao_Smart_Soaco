import AjudaTelaModal, { type SecaoAjuda } from '../../../components/AjudaTelaModal';

export type DreAjudaModalProps = {
  aberto: boolean;
  onClose: () => void;
};

const SECOES: SecaoAjuda[] = [
  {
    id: 'faturamento',
    titulo: 'Faturamento bruto (direto e indireto)',
    oQueE:
      'É tudo o que a empresa faturou no período, antes de tirar impostos, devoluções e descontos. Na DRE ele aparece separado por empresa (Só Aço, Só Móveis, Só Refrigeração e RN Marques) e, quando faz sentido, entre venda direta e indireta.',
    comoLe:
      'Use para ver o tamanho da operação de cada loja/empresa. O total de receita bruta é a soma dessas partes conforme o filtro de empresas que você aplicou.',
    detalhes: [
      {
        titulo: 'Direto',
        texto:
          'Vendas feitas no canal próprio da empresa — por exemplo, faturamento da indústria Só Aço e das vendas diretas de Só Móveis, Refrigeração e RN Marques. É a venda “da casa” para o cliente final ou canal próprio.',
      },
      {
        titulo: 'Indireto',
        texto:
          'Vendas que passam por outro arranjo comercial (repasse / markup entre empresas do grupo). Mostra o faturamento bruto desse canal e, quando o MKP está ativo, também a visão líquida depois do markup acordado por grupo de produto. Em Só Móveis, a parte indireta reflete a margem desse markup alocada à loja.',
      },
      {
        titulo: 'Por loja / empresa',
        texto:
          'Cada bloco (Só Aço, Só Móveis, Refrigeração, RN Marques) só entra na grade quando a empresa correspondente está selecionada no filtro. Assim você compara o faturamento de cada operação sem misturar o que não quer ver.',
      },
    ],
  },
  {
    id: 'deducoes',
    titulo: 'Deduções sobre o faturamento',
    oQueE:
      'São os valores que “comem” a receita bruta antes de chegar na receita líquida: devoluções, cancelamentos, descontos incondicionais e impostos sobre as vendas (incluindo Simples, quando aplicável).',
    comoLe:
      'Quanto maior a dedução em relação ao faturamento, menor a receita que realmente fica disponível. Acompanhe devoluções e descontos por período para ver se o problema é comercial, operacional ou fiscal.',
  },
  {
    id: 'cpv',
    titulo: 'CPV / CMV (custo do que foi vendido)',
    oQueE:
      'É o custo dos produtos vendidos no período. Em linguagem de fábrica costuma-se falar CPV; no varejo, CMV — na prática, ambos medem quanto custou produzir ou adquirir o que saiu em venda.',
    comoLe:
      'Compare com o faturamento e com o lucro bruto: se o custo sobe mais rápido que a receita, a margem aperta. Na DRE o custo também aparece em direto e indireto por empresa, alinhado ao mesmo critério do faturamento (indústria, lojas e canais do grupo).',
    detalhes: [
      {
        titulo: 'Direto × indireto no custo',
        texto:
          'O custo direto acompanha as vendas do canal próprio. O custo indireto acompanha o canal com markup / repasse entre empresas, para a margem fazer sentido nas duas visões de receita.',
      },
    ],
  },
  {
    id: 'despesas',
    titulo: 'Despesas',
    oQueE:
      'São os gastos de operação que não estão no CPV/CMV: pessoal, despesas operacionais, administrativas, comerciais, serviços de terceiros e despesas financeiras, entre outros blocos da árvore.',
    comoLe:
      'Leia por grupo (operacional, administrativo, comercial etc.) para ver onde a empresa está gastando. Rateios entre empresas redistribuem alguns custos (por exemplo pró-labore ou fornecedores) conforme a regra configurada no botão Rateio — isso muda o desenho por empresa, não o fato de o gasto ter ocorrido no grupo.',
  },
  {
    id: 'ebitda',
    titulo: 'EBITDA',
    oQueE:
      'É o resultado da operação principal depois do lucro bruto e das despesas administrativas, comerciais e de serviços de terceiros — ainda sem despesas financeiras e sem impostos sobre o lucro.',
    comoLe:
      'Serve para olhar a capacidade de geração de resultado da operação, sem o efeito de juros e tributos sobre o lucro. Se o EBITDA cai e a receita se mantém, o problema costuma estar em custo da mercadoria ou em despesas de estrutura/comerciais.',
  },
  {
    id: 'lucro',
    titulo: 'Lucro líquido',
    oQueE:
      'É o que sobra depois do EBITDA, descontadas as despesas financeiras e os tributos sobre o lucro (como CSLL e IR). É o resultado final do período antes das retiradas/distribuição de lucros, quando houver essa linha na árvore.',
    comoLe:
      'É o indicador de “quanto a operação gerou de resultado líquido” no filtro escolhido. Compare com o faturamento bruto (análise vertical) e com meses anteriores para ver se a empresa está melhorando de verdade ou só girando mais volume com menos margem.',
  },
  {
    id: 'excel',
    titulo: 'Exportar Excel',
    oQueE:
      'Gera um XLSX com a árvore da DRE (mesmos números da grade) e as linhas analíticas do período: receitas, devoluções e saídas por competência — sem o recorte dos modais.',
    comoLe:
      'Clique em Aplicar e depois em Exportar Excel (ao lado de Como ler). A DRE não projeta caixa futuro: meses à frente tendem a ficar vazios. O “pra frente” (baixa vs vencimento e PDs) está no DFC.',
    detalhes: [
      {
        titulo: 'Abas',
        texto:
          'Filtros (intervalo, visão, empresas, plano, MKP, rateio), DRE (árvore com AV/AH/Total/Média e MKP se ativo), Receitas (NF/item), Devoluções e Saídas (Nomus + Shop9 por competência). A soma das abas analíticas por conta/período deve bater com a célula da árvore.',
      },
    ],
  },
];

export default function DreAjudaModal({ aberto, onClose }: DreAjudaModalProps) {
  return (
    <AjudaTelaModal
      aberto={aberto}
      onClose={onClose}
      titulo="Como ler a DRE"
      subtitulo="Explicação gerencial do que cada bloco representa e como interpretar os números."
      introducao="A DRE mostra o caminho do faturamento até o lucro: quanto entrou, o que foi descontado, quanto custou vender, quanto se gastou para operar e o que sobrou no final do período filtrado."
      secoes={SECOES}
      tituloId="dre-ajuda-titulo"
    />
  );
}
