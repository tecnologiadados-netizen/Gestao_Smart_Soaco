import AjudaTelaModal, { type SecaoAjuda } from '../../components/AjudaTelaModal';

export type CoberturaEstoqueAjudaModalProps = {
  aberto: boolean;
  onClose: () => void;
};

const SECOES: SecaoAjuda[] = [
  {
    id: 'fonte',
    titulo: 'Mesma fonte da Consulta de Estoque',
    oQueE:
      'Saldo, empenho líquido, solicitação, Ag Pag, pedido de compra e saldo projetado usam as mesmas regras/SQL da Consulta de Estoque.',
    comoLe:
      'Para o mesmo filtro e a mesma opção de requisições, os números do painel batem com a Consulta. O detalhe de cada célula reabre os mesmos modais analíticos.',
  },
  {
    id: 'regua',
    titulo: 'Régua de status (v1)',
    oQueE:
      'Classificação só com saldo, empenho e saldo projetado — sem mínimo/máximo nem consumo médio.',
    comoLe:
      'Ruptura: saldo projetado < 0. Zerado: = 0. Frágil: projetado > 0 mas estoque físico < empenho. Nivelado: físico cobre o empenho com razão ≤ 3. Excesso/parado: sem empenho com saldo, ou razão saldo/empenho > 3.',
  },
  {
    id: 'saldo',
    titulo: 'Saldo projetado',
    oQueE: 'estoque − empenho + solicitação + Ag Pag + pedido de compra (empenho líquido, com abatimento de PA).',
    comoLe:
      'É o indicador-chave do painel. Valores negativos apontam risco de ruptura se o empenho for consumido antes das entradas.',
  },
  {
    id: 'filtros',
    titulo: 'Filtros e cascata',
    oQueE:
      'Os filtros são os mesmos da Consulta (tipo, grupo, coleta, setor, subgrupos, código/descrição). É obrigatório informar ao menos um.',
    comoLe:
      'Clique em Filtrar para recalcular. Clique nos KPIs de status para restringir a tabela. Use “Abrir na Consulta de Estoque” para a grade operacional.',
  },
];

export default function CoberturaEstoqueAjudaModal({ aberto, onClose }: CoberturaEstoqueAjudaModalProps) {
  return (
    <AjudaTelaModal
      aberto={aberto}
      onClose={onClose}
      titulo="Como ler a Cobertura de Estoque"
      subtitulo="Status de cobertura, saldo projetado e mesma fonte da Consulta."
      introducao="Painel gerencial sobre a posição de estoque. Consolida itens por status de cobertura e permite drill até o detalhe analítico já usado na Consulta de Estoque."
      secoes={SECOES}
      tituloId="cobertura-estoque-ajuda-titulo"
    />
  );
}
