import AjudaTelaModal, { type SecaoAjuda } from '../../components/AjudaTelaModal';

export type KpisAjudaModalProps = {
  aberto: boolean;
  onClose: () => void;
};

const SECOES: SecaoAjuda[] = [
  {
    id: 'hub',
    titulo: 'Hub de pastas',
    oQueE:
      'A tela KPIs concentra os painéis do sistema em pastas. Cada card de pasta agrupa painéis relacionados (ex.: Produção).',
    comoLe:
      'Clique na pasta para ver os painéis liberados para o seu grupo. Pastas sem nenhum painel acessível não aparecem.',
  },
  {
    id: 'paineis',
    titulo: 'Cards de painel',
    oQueE:
      'Dentro da pasta, cada card abre a tela do respectivo painel (ex.: Produção Camasi). Painéis migrados para o hub saem do menu lateral.',
    comoLe:
      'Use “Acessar” (hover) ou clique no card. A estrela marca favoritos; eles aparecem no topo do hub.',
  },
  {
    id: 'favoritos',
    titulo: 'Favoritos',
    oQueE:
      'Favoritos ficam salvos neste navegador para o seu login, permitindo acesso rápido aos painéis mais usados.',
    comoLe:
      'Clique na estrela do card para marcar/desmarcar. A seção Favoritos só lista painéis que você ainda pode acessar.',
  },
  {
    id: 'acessos',
    titulo: 'Permissões por painel',
    oQueE:
      'O acesso a cada painel é controlado por permissão de grupo (seção KPIs em Usuários → Grupos). O hub exige kpis.ver ou pelo menos um painel liberado.',
    comoLe:
      'Se uma pasta ou painel não aparecer, peça ao administrador para liberar a permissão correspondente no seu grupo.',
  },
];

export default function KpisAjudaModal({ aberto, onClose }: KpisAjudaModalProps) {
  return (
    <AjudaTelaModal
      aberto={aberto}
      onClose={onClose}
      titulo="Como ler o hub KPIs"
      subtitulo="Pastas, painéis, favoritos e acessos."
      introducao="O hub KPIs é a porta de entrada para os painéis do sistema. Navegue por pastas, marque favoritos e abra apenas os painéis liberados ao seu grupo."
      secoes={SECOES}
      tituloId="kpis-ajuda-titulo"
    />
  );
}
