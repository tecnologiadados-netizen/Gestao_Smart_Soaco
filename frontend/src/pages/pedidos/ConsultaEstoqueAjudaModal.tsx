import AjudaTelaModal, { type SecaoAjuda } from '../../components/AjudaTelaModal';

export type ConsultaEstoqueAjudaModalProps = {
  aberto: boolean;
  onClose: () => void;
};

const SECOES: SecaoAjuda[] = [
  {
    id: 'cascata',
    titulo: 'Grade sintética e clique na célula',
    oQueE:
      'A grade traz só valores consolidados (estoque, empenho, SC, Ag Pag, PC, saldo projetado). O detalhe analítico abre sob demanda ao clicar na célula.',
    comoLe:
      'Clique na célula para ver o modal com a mesma regra/fonte do número da grade. O detalhe fica em cache até um novo “Filtrar/Consultar”; a soma do modal deve bater com a coluna.',
  },
  {
    id: 'saldo',
    titulo: 'Saldo projetado',
    oQueE:
      'Indicador de disponibilidade líquida do item: estoque − empenho + solicitação + Ag Pag + pedido de compra.',
    comoLe:
      'Valor ≤ 0 fica em destaque (vermelho): há risco de ruptura se o empenho for consumido antes das entradas. Não é o estoque físico sozinho — já desconta o comprometido e soma entradas esperadas.',
  },
  {
    id: 'empenho',
    titulo: 'Empenho líquido',
    oQueE:
      'Valor da grade = max(0, empenho bruto − estoque em PA): o estoque de produto acabado (via BOM) abate o bruto por completo (piso 0).',
    comoLe:
      'A coluna da grade e o total do modal de empenho usam a mesma lógica. Ative “considerar requisições” se quiser incluir empenhos com atributo Requisitado no cálculo.',
  },
  {
    id: 'pedido',
    titulo: 'Filtro por pedido de venda',
    oQueE:
      'Modo opcional que restringe a consulta a um PD: itens diretos do pedido ou componentes via BOM, com escopo “só este PD” ou “todos os empenhos dos itens”.',
    comoLe:
      'Use “itens diretos” para ver o PA do pedido; use “componentes (BOM)” para enxergar a necessidade de MP/componentes. Confirme volumes grandes (>50 linhas) antes de consultar.',
  },
  {
    id: 'catalogo',
    titulo: 'Filtros de catálogo',
    oQueE:
      'Tipo, grupo, coleta, setor e subgrupo cascateiam entre si; código e descrição aceitam busca de texto livre (use % como curinga).',
    comoLe:
      'Escolha filtros de cima para baixo: ao mudar um nível, as opções dos níveis seguintes se atualizam. Código/descrição não substituem a cascata — combinam com ela.',
  },
  {
    id: 'pa',
    titulo: 'Estoque atual e PA',
    oQueE:
      'O estoque atual da grade é o somatório do saldo nos setores parametrizados. Quantidade de componente que já está no setor de PA compondo o produto pai (via BOM) não entra nesse somatório — já é abatida no empenho líquido (bruto − estoque em PA).',
    comoLe:
      'No modal de saldo, leia setor a setor. Use a dica (?) no cabeçalho de Estoque atual e de Empenho para lembrar essa separação entre saldo físico parametrizado e estoque em PA.',
  },
];

export default function ConsultaEstoqueAjudaModal({ aberto, onClose }: ConsultaEstoqueAjudaModalProps) {
  return (
    <AjudaTelaModal
      aberto={aberto}
      onClose={onClose}
      titulo="Como ler a Consulta de Estoque"
      subtitulo="Grade sintética, saldo projetado, empenho líquido e filtros."
      introducao="Consulta em tempo real (sem histórico gravado). A grade mostra consolidados; o detalhe de cada célula é buscado ao clicar e deve bater exatamente com o valor da coluna."
      secoes={SECOES}
      tituloId="consulta-estoque-ajuda-titulo"
    />
  );
}
