import AjudaTelaModal, { type SecaoAjuda } from '../../components/AjudaTelaModal';

export type ProgramacaoSetorialAjudaModalProps = {
  aberto: boolean;
  onClose: () => void;
};

const SECOES: SecaoAjuda[] = [
  {
    id: 'carregar',
    titulo: 'Carregar × filtrar setor',
    oQueE:
      'O carregamento usa rotas/observações do período. O setor escolhido filtra só a tabela na tela; o save grava todos os setores do período carregado.',
    comoLe:
      'Não confunda filtro visual com escopo gravado: ao salvar, o snapshot inclui o conjunto completo, não apenas o setor filtrado na visualização.',
  },
  {
    id: 'ocultos',
    titulo: 'Setores ocultos',
    oQueE:
      'Setores como “Outros”, “Não considerar na meta” e setor vazio sem Recurso PCP não entram na programação exibida/meta.',
    comoLe:
      'Se um item “sumiu”, verifique se caiu em setor oculto ou sem recurso PCP — não é bug da grade filtrada.',
  },
  {
    id: 'corte-dobra',
    titulo: 'Corte e Dobra (Recurso PCP)',
    oQueE:
      'Setor virtual que agrupa linhas com atributo Recurso = PCP (não confundir com Recurso 1000 / Perfiladeira).',
    comoLe:
      'Use para ver a carga de corte/dobra PCP à parte dos setores nominais da fábrica.',
  },
  {
    id: 'tabelas',
    titulo: 'Programação × Atendidos pelo Estoque',
    oQueE:
      'Duas tabelas: o que precisa produzir versus o que já está coberto por estoque de produto acabado (setor PA no Nomus). O saldo de Intermediários CONT não entra nesse abate — é estoque não controlado e não reduz a quantidade a produzir.',
    comoLe:
      'Priorize a tabela de programação para capacidade. A de atendidos pelo estoque cobre só o que há em PA; Intermediários CONT não “some” da carga de Gôndolas nem de Corte e Dobra.',
  },
  {
    id: 'painel',
    titulo: 'Painel de programações',
    oQueE:
      'Lista de snapshots gravados. Abrir um registro reproduz o momento do save — mudanças posteriores no ERP não alteram aquele snapshot.',
    comoLe:
      'Trate cada item do painel como foto congelada. Para cenário novo, gere outra programação; não espere o snapshot antigo “atualizar sozinho”.',
  },
  {
    id: 'pdf',
    titulo: 'PDF do snapshot',
    oQueE:
      'Exportação com período/setor da visualização, em consolidado ou detalhe.',
    comoLe:
      'Confira o filtro de setor na tela antes de gerar o PDF — o arquivo reflete o que está sendo visualizado naquele momento.',
  },
];

export default function ProgramacaoSetorialAjudaModal({
  aberto,
  onClose,
}: ProgramacaoSetorialAjudaModalProps) {
  return (
    <AjudaTelaModal
      aberto={aberto}
      onClose={onClose}
      titulo="Como ler a Programação Setorial"
      subtitulo="Geração, filtro de setor, snapshot do painel e PDF."
      introducao="Gera e consulta programações por setor/período. O painel guarda snapshots; o filtro de setor na tela não reduz o que foi gravado no save."
      secoes={SECOES}
      tituloId="programacao-setorial-ajuda-titulo"
    />
  );
}
