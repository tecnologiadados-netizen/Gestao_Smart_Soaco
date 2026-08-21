import AjudaTelaModal, { ComoLerBtn, type SecaoAjuda } from '../../components/AjudaTelaModal';

export type RfvClientesAjudaModalProps = {
  aberto: boolean;
  onClose: () => void;
};

const SECOES: SecaoAjuda[] = [
  {
    id: 'rfv',
    titulo: 'O que é RFV',
    oQueE:
      'RFV classifica clientes por Recência (última compra no período), Frequência (PDs distintos) e Valor (faturamento). Cada dimensão recebe score de quintil 1–5 dentro do recorte filtrado.',
    comoLe:
      'Última compra = data de emissão do PD mais recente do cliente dentro do período filtrado (não inclui vendas anteriores ao início do filtro). Recência (R) = dias entre essa data e o fim do período (data fim do filtro): score R maior = compra mais recente. Scores F e V maiores = mais pedidos e mais valor. A matriz usa Recência no eixo horizontal e a média arredondada de F e V (FV) no vertical.',
  },
  {
    id: 'segmentos',
    titulo: 'Segmentos semânticos',
    oQueE:
      'Campeões, Clientes fiéis, Potenciais fiéis, Em risco, Perdidos etc. são rótulos de negócio derivados dos scores R, F e V — a primeira regra que encaixa define o segmento.',
    comoLe:
      'A matriz segue o layout clássico de análise RFV: eixo horizontal = Recência (1–5), vertical = média de Frequência + Valor (FV). Cada bloco colorido reúne os clientes do segmento; clique para filtrar a tabela. Use a tabela à direita para ver faturamento e quantidade detalhados.',
  },
  {
    id: 'filtros',
    titulo: 'Filtros e período',
    oQueE:
      'Município, UF, vendedor, região e grupo usam listas de múltipla escolha (mesmo padrão das grades). Ao abrir, o painel carrega automaticamente os últimos 48 meses — o período máximo permitido na base comercial.',
    comoLe:
      'Selecione um ou mais itens em cada lista e clique em Filtrar. Quintis e segmentos são recalculados sobre o subconjunto filtrado.',
  },
  {
    id: 'distribuicao',
    titulo: 'Barras R / F / V',
    oQueE:
      'Cada dimensão é dividida em quintis (scores 1–5). Por definição, a quantidade de clientes tende a ser parecida em cada faixa.',
    comoLe:
      'A altura da barra representa o faturamento da faixa; o número acima indica quantos clientes caíram naquele score. Clique para filtrar a tabela.',
  },
  {
    id: 'drill',
    titulo: 'Drilldown, matriz e grade',
    oQueE:
      'Clique em uma célula da matriz, linha da tabela de segmentos ou barra R/F/V para filtrar a tabela de clientes. A grade de clientes tem filtros Excel no cabeçalho de cada coluna.',
    comoLe:
      'Botão “Limpar seleção” ou novo “Filtrar” restaura a visão completa. A contagem de clientes na tabela deve bater com o bloco/segmento clicado.',
  },
  {
    id: 'fonte',
    titulo: 'Fonte e limites',
    oQueE:
      'Mesma base do Histórico de Vendas: Só Aço, vendas abertas e encerradas, excluindo canceladas (status 6). Período máximo: 48 meses por data de emissão.',
    comoLe:
      'Filtros dimensionais (município, vendedor, região, grupo etc.) recalculam quintis sobre o subconjunto — scores são relativos ao recorte, não globais fixos.',
  },
];

export default function RfvClientesAjudaModal({ aberto, onClose }: RfvClientesAjudaModalProps) {
  return (
    <AjudaTelaModal
      aberto={aberto}
      onClose={onClose}
      titulo="Classificação de Clientes — RFV"
      subtitulo="Como ler este painel"
      introducao="Segmentação RFV por cliente com matriz semântica, distribuição por scores e tabela analítica com drilldown."
      secoes={SECOES}
    />
  );
}

export { ComoLerBtn };
