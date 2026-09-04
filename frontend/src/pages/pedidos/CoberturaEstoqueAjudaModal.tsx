import AjudaTelaModal, { type SecaoAjuda } from '../../components/AjudaTelaModal';

export type CoberturaEstoqueAjudaModalProps = {
  aberto: boolean;
  onClose: () => void;
};

const SECOES: SecaoAjuda[] = [
  {
    id: 'atende-vs-cobertura',
    titulo: 'Atendimento da venda × Cobertura (meses)',
    oQueE:
      'São dois indicadores distintos. Atendimento da venda = Estoque ÷ Empenho (só com empenho > 0): quanto do empenho o estoque físico cobre hoje. Cobertura em meses = (Estoque − Empenho) ÷ CM: depois de honrar o empenho, por quantos meses de consumo o saldo restante dura. Se CM ≤ 0, a cobertura fica “—” — o painel nunca mais divide por 0,01.',
    comoLe:
      'Na grade, Atende venda aparece em % (teto visual 100%) com barra Descoberto / Parcial / Atendido. Cobertura mostra meses (teto visual < −3 / > 12; o valor real segue no sort e no Excel). Itens só com empenho e CM zero caem em Ruptura / Aguardando PC ou Sem histórico — nunca em cobertura inventada.',
  },
  {
    id: 'status',
    titulo: 'Status em cascata',
    oQueE:
      'O Status (cards e coluna) avalia nesta ordem e para no primeiro match: (1) Empenho > 0, Estoque < Empenho e PC ≥ faltante → Aguardando PC; (2) Empenho > 0 e Estoque < Empenho → Ruptura; (3) CM = 0, Empenho = 0 e Estoque > 0 → Sem giro; (4) CM = 0 → Sem histórico; (5) cobertura < 0,5 → Crítico; (6) < 1 → Atenção; (7) ≤ 3 → Saudável; (8) > 3 → Excesso.',
    comoLe:
      'Acima dos seis cards de Status ficam três totais em R$: Valor em estoque (saldo × preço, sem descontar empenho nem PC), Valor em estoque firme ((estoque − empenho) × preço) e Valor sem movimentação (saldo × preço só dos itens sem entrada/saída no almox secundário há ≥ 60 dias, ou sem histórico). Esses totais usam o universo do Filtrar e não encolhem ao clicar em recortes — clique em um deles para filtrar grade, gráficos e fila de ação (itens com preço; sem movimentação restringe aos parados há ≥ 60 dias). Os seis cards abaixo contam Ruptura, Aguardando PC, Crítico, Atenção, Saudável e Excesso — clique para filtrar grade e fila. Sem giro / Sem histórico aparecem no universo padrão (com e sem empenho).',
  },
  {
    id: 'barras',
    titulo: 'Distribuição da cobertura (meses)',
    oQueE:
      'Sete barras (< 0, 0–0,5, 0,5–1, 1–2, 2–3, 3–6, > 6). Cobertura em meses só existe com CM > 0; a faixa < 0 também inclui itens sem CM cujo valor firme é negativo (estoque abaixo do empenho), para o capital e o clique na barra refletirem o déficit.',
    comoLe:
      'Clique na barra para filtrar. A legenda REPOR / VIGIAR / OPERAÇÃO NORMAL / CAPITAL PARADO agrupa as faixas. Capital por faixa usa o mesmo recorte e o valor firme (estoque − empenho) × preço — na < 0 entram também os sem cobertura (CM = 0) com capital negativo.',
  },
  {
    id: 'acoes',
    titulo: 'Ação sugerida e ordenação',
    oQueE:
      'A ação segue o Status: Aguardando PC → Cobrar entrega do PC; Ruptura com SC/Pré Compra → Acelerar SC/Pré Compra; Ruptura sem pipeline → Comprar AGORA; Crítico → Converter SC ou Abrir SC urgente; Atenção → Programar SC; Excesso → Suspender compra / Bloquear reposição; Sem giro → Avaliar descarte; Sem histórico → Validar cadastro; Saudável → Sem ação.',
    comoLe:
      'A ordenação padrão da grade é por blocos de Status (nunca cobertura como critério primário). Dentro de cada bloco: Ruptura por valor faltante; Aguardando PC por faltante; Crítico/Atenção/Saudável por CM × preço; Excesso por estoque × preço. Nulos de preço vão ao fim do bloco. O card Fila de ação no topo consolida as mesmas ações — clique para filtrar a grade.',
  },
  {
    id: 'visoes',
    titulo: 'Visões da grade',
    oQueE:
      'Acima da tabela: Todos (consolida o recorte), Atende venda (Empenho > 0), Cobertura (CM > 0) e Sem giro (CM = 0 e Empenho = 0). As abas só filtram a grade; KPIs e gráficos do topo continuam no recorte de cards/barras/ação.',
    comoLe:
      'O padrão é Todos — a contagem da grade bate com o total de itens do recorte (e com a linha da fila de ação, se uma estiver selecionada). Use Atende venda para o dia a dia de compra; Cobertura para quem tem histórico de consumo; Sem giro para parados sem empenho. Com o toggle “somente com empenho” ligado no modal Filtrar, Sem giro fica vazia.',
  },
  {
    id: 'capital',
    titulo: 'Distribuição do capital',
    oQueE:
      'Barras por faixa, pizza por família e Top 10 usam valor firme = (estoque − empenho) × preço — o mesmo do card “Valor em estoque firme”. O card “Valor em estoque” é o bruto (saldo × preço), sem descontar empenho nem PC. O card “Valor sem movimentação” soma o mesmo bruto só para itens cuja última movimentação no almox secundário (setores 2/19, entrada ou saída) tem 60 dias ou mais — ou nunca movimentaram. Na pizza, cada produto com valor firme negativo é ignorado e não reduz a soma da família. O badge Sem preço com estoque conta produtos sem entrada qualificada válida (ou preço zero) que ainda têm saldo físico &gt; 0.',
    comoLe:
      'Clique na faixa, na família, no produto do Top 10 ou em Sem preço com estoque para filtrar a grade. Respeitam o recorte de valor/Status/barra ativo. Os três cards de valor do topo também são clicáveis (mesmo critério de cada total) e mostram sempre o valor consolidado do painel após Filtrar.',
  },
  {
    id: 'fila-acao',
    titulo: 'Fila de ação',
    oQueE:
      'Agrupa os itens do recorte pelo próximo passo sugerido (mesma regra da coluna Ação sugerida). A ordem é urgente → atenção → acompanhar, e dentro de cada bloco pelos itens. O número é a quantidade; o valor em R$ (quando aparece) é a soma do faltante (empenho − estoque) × preço — só nas ações com falta física.',
    comoLe:
      'Clique na linha para filtrar a grade só daquela ação (visão Todos = mesma quantidade). Clique de novo para soltar. A soma das linhas da fila é o total de itens do recorte. Cores: vermelho/rosa = urgente (comprar, cobrar PC, acelerar SC); laranja/amarelo = atenção (abrir/converter/programar SC); azul = excesso com pipeline; cinza = sem giro/cadastro; verde = sem ação.',
  },
  {
    id: 'preco',
    titulo: 'Preço unitário e valor firme',
    oQueE:
      'Preço = última entrada entre “Compra para material almox secundário”, “Compra para industrialização” e “AJUSTE PARA ATUALIZAR PREÇO DA ÚLTIMA COMPRA (TRIB INCLUÍDA)”, com valor unitário > 0 (incluindo preços fracionários baixos como 0,002). Não se descarta mais por arredondamento a 2 casas nem por limiar 0,005 — a entrada recente prevalece sobre preços antigos. Valor em estoque = saldo × preço; valor firme = (saldo − empenho) × preço; valor sem movimentação = saldo × preço dos itens sem mov. há ≥ 60 dias. Pedido de compra não entra nesses totais.',
    comoLe:
      'Na grade, preços &lt; R$ 0,01 aparecem com até 4 casas. Sem preço só quando não há nenhuma entrada qualificada com valor &gt; 0; o badge Sem preço com estoque restringe a saldo &gt; 0. Esses produtos ficam de fora das somas em R$ (cards, barras, pizza e Top 10).',
  },
  {
    id: 'fonte',
    titulo: 'Mesma fonte da Consulta de Estoque',
    oQueE:
      'Saldo, empenho líquido, SC, Pré Compra, PC e projetado usam as mesmas regras/SQL da Consulta de Estoque. O painel fixa almox secundário. Por padrão inclui produtos com e sem empenho; no modal Filtrar, o toggle “Considerar somente produtos com empenho?” restringe a empenho &gt; 0. Itens com CM, empenho, estoque, SC e Pré Compra todos iguais a zero são excluídos do universo (PC sozinho &gt; 0 ainda entra).',
    comoLe:
      'Células reabrem os mesmos modais analíticos. O toggle “Considerar empenho de requisições?” no topo refaz a consulta na hora. O toggle de empenho fica no modal Filtrar e só vale após clicar em Filtrar.',
  },
  {
    id: 'filtros',
    titulo: 'Filtros e Excel',
    oQueE:
      'Toggles no topo (requisições) e no modal Filtrar (somente com empenho, código/descrição/coleta/família), Limpar filtros no topo (também limpa KPI/faixas clicadas e volta o universo ao padrão com/sem empenho), recorte por capital, visão da grade, funil Excel e exportação.',
    comoLe:
      'Limpar filtros no topo zera o modal, desmarca cards/barras/ação/capital e restaura o universo padrão (com e sem empenho). “Limpar recorte” tira só o recorte visual. “Limpar filtros” na grade desfaz só funil/ordem das colunas. O Excel exporta todas as linhas do recorte+visão+funil (valor real de cobertura, sem teto visual).',
  },
];

export default function CoberturaEstoqueAjudaModal({ aberto, onClose }: CoberturaEstoqueAjudaModalProps) {
  return (
    <AjudaTelaModal
      aberto={aberto}
      onClose={onClose}
      titulo="Como ler a Cobertura de Estoque"
      subtitulo="Atendimento da venda, cobertura em meses, Status em cascata e ações."
      introducao="Painel do almoxarifado secundário. Atendimento (estoque ÷ empenho) e Cobertura ((estoque − empenho) ÷ CM) são separados; CM ≤ 0 não inventa divisor. Status, KPIs, barras, fila de ação, capital e grade usam o mesmo modelo."
      secoes={SECOES}
      tituloId="cobertura-estoque-ajuda-titulo"
    />
  );
}
