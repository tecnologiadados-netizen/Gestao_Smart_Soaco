import AjudaTelaModal, { type SecaoAjuda } from '../../components/AjudaTelaModal';

export type GrupoEconomicoAjudaModalProps = {
  aberto: boolean;
  onClose: () => void;
};

const SECOES: SecaoAjuda[] = [
  {
    id: 'o-que-e',
    titulo: 'O que é',
    oQueE:
      'Relatório dos grupos econômicos cadastrados no Nomus (tabela grupopessoa) e das pessoas vinculadas (pessoa.idGrupoPessoa).',
    comoLe:
      'A grade lista um grupo por linha com a quantidade de pessoas ativas. Clique na linha (ou em “Ver pessoas”) para abrir o detalhe analítico.',
  },
  {
    id: 'cascata',
    titulo: 'Grade e modal (integridade)',
    oQueE:
      'A quantidade de pessoas na grade é a mesma soma do modal. Ambos usam a regra: pessoas ativas com idGrupoPessoa = id do grupo.',
    comoLe:
      'O detalhe é carregado só ao clicar (e fica em cache até o próximo Filtrar). Se a contagem da grade e do modal divergirem, trate como bug de dado/consulta.',
  },
  {
    id: 'filtros',
    titulo: 'Filtros',
    oQueE:
      'Busca de texto livre no nome/descrição do grupo ou em nome, razão social, documento ou código de algum membro. Use % como curinga (ex.: Grupo%, %Claudino).',
    comoLe:
      '“Somente ativos” restringe aos grupos marcados como ativos no Nomus. A busca por pessoa ainda lista o grupo completo no modal (todas as pessoas ativas do grupo).',
  },
];

export default function GrupoEconomicoAjudaModal({ aberto, onClose }: GrupoEconomicoAjudaModalProps) {
  return (
    <AjudaTelaModal
      aberto={aberto}
      onClose={onClose}
      titulo="Como ler — Grupo Econômico"
      subtitulo="Grupos Nomus e pessoas vinculadas."
      introducao="Consulta somente leitura do cadastro Nomus. Não altera dados no ERP."
      secoes={SECOES}
      tituloId="grupo-economico-ajuda-titulo"
    />
  );
}
