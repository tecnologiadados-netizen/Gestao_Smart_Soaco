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
      'Os seis cards do topo contam Ruptura, Aguardando PC, Crítico, Atenção, Saudável e Excesso. Clique no card para filtrar grade e carga. Sem giro / Sem histórico existem tipados para o 2º momento (universo com Empenho = 0); no recorte atual quase não aparecem.',
  },
  {
    id: 'barras',
    titulo: 'Distribuição da cobertura (meses)',
    oQueE:
      'Sete barras (< 0, 0–0,5, 0,5–1, 1–2, 2–3, 3–6, > 6) só com itens que têm cobertura calculável (CM > 0). Itens com CM = 0 não entram nas barras, para não distorcer o gráfico.',
    comoLe:
      'Clique na barra para filtrar. A legenda REPOR / VIGIAR / OPERAÇÃO NORMAL / CAPITAL PARADO agrupa as faixas. Capital por faixa usa o mesmo recorte e o valor firme (estoque − empenho) × preço.',
  },
  {
    id: 'acoes',
    titulo: 'Ação sugerida e ordenação',
    oQueE:
      'A ação segue o Status: Aguardando PC → Cobrar entrega do PC; Ruptura com SC/Pré Compra → Acelerar SC/Pré Compra; Ruptura sem pipeline → Comprar AGORA; Crítico → Converter SC ou Abrir SC urgente; Atenção → Programar SC; Excesso → Suspender compra / Bloquear reposição; Sem giro → Avaliar descarte; Sem histórico → Validar cadastro; Saudável → Sem ação.',
    comoLe:
      'A ordenação padrão da grade é por blocos de Status (nunca cobertura como critério primário). Dentro de cada bloco: Ruptura por valor faltante; Aguardando PC por faltante; Crítico/Atenção/Saudável por CM × preço; Excesso por estoque × preço. Nulos de preço vão ao fim do bloco.',
  },
  {
    id: 'visoes',
    titulo: 'Três visões da grade',
    oQueE:
      'Acima da tabela: Atende venda (Empenho > 0 — universo atual), Cobertura (CM > 0) e Sem giro (CM = 0 e Empenho = 0). As abas só filtram a grade; KPIs e gráficos do topo continuam no recorte de cards/barras/comprador.',
    comoLe:
      'Hoje a visão Sem giro fica vazia até o painel incluir itens sem empenho. Mantenha Atende venda para o dia a dia de compra; use Cobertura para olhar só quem tem histórico de consumo.',
  },
  {
    id: 'capital',
    titulo: 'Distribuição do capital',
    oQueE:
      'Barras por faixa, pizza por família e Top 10 usam valor firme = (estoque − empenho) × preço. Na pizza, cada produto com valor firme negativo é ignorado e não reduz a soma da família. O badge Sem preço conta códigos sem entrada qualificada válida.',
    comoLe:
      'Clique na faixa, na família, no produto do Top 10 ou em Sem preço para filtrar a grade. Respeitam o recorte de Status/barra ativo.',
  },
  {
    id: 'comprador',
    titulo: 'Carga por comprador',
    oQueE:
      'Barras empilhadas com urgência: Ruptura + Aguardando PC + Crítico + Atenção. Comprador vem do cadastro Nomus; sem cadastro → “A definir”.',
    comoLe:
      'Clique na linha do comprador ou em um segmento colorido (status) para filtrar a tabela.',
  },
  {
    id: 'preco',
    titulo: 'Preço unitário e valor firme',
    oQueE:
      'Preço = última entrada entre “Compra para material almox secundário”, “Compra para industrialização” e “AJUSTE PARA ATUALIZAR PREÇO DA ÚLTIMA COMPRA (TRIB INCLUÍDA)”, com valor unitário > 0 (incluindo preços fracionários baixos como 0,002). Não se descarta mais por arredondamento a 2 casas nem por limiar 0,005 — a entrada recente prevalece sobre preços antigos.',
    comoLe:
      'Na grade, preços &lt; R$ 0,01 aparecem com até 4 casas. Sem preço só quando não há nenhuma entrada qualificada com valor &gt; 0; esses itens entram no badge Sem preço e ficam de fora das somas em R$ e do Top 10.',
  },
  {
    id: 'fonte',
    titulo: 'Mesma fonte da Consulta de Estoque',
    oQueE:
      'Saldo, empenho líquido, SC, Pré Compra, PC e projetado usam as mesmas regras/SQL da Consulta de Estoque. O universo atual continua Empenho > 0 e almox secundário.',
    comoLe:
      'Células reabrem os mesmos modais analíticos. O toggle “Considerar empenho de requisições?” refaz a consulta na hora.',
  },
  {
    id: 'filtros',
    titulo: 'Filtros e Excel',
    oQueE:
      'Filtrar (código/descrição/coleta/família — opções de família só com itens aptos ao painel), Limpar filtros no topo (também limpa KPI/faixas clicadas), recorte por capital, visão da grade, funil Excel e exportação.',
    comoLe:
      'Limpar filtros no topo zera o modal e desmarca cards/barras/comprador/capital. “Limpar recorte” tira só o recorte visual. “Limpar filtros da grade” desfaz só funil/ordem. O Excel exporta todas as linhas do recorte+visão+funil (valor real de cobertura, sem teto visual).',
  },
];

export default function CoberturaEstoqueAjudaModal({ aberto, onClose }: CoberturaEstoqueAjudaModalProps) {
  return (
    <AjudaTelaModal
      aberto={aberto}
      onClose={onClose}
      titulo="Como ler a Cobertura de Estoque"
      subtitulo="Atendimento da venda, cobertura em meses, Status em cascata e ações."
      introducao="Painel do almoxarifado secundário. Atendimento (estoque ÷ empenho) e Cobertura ((estoque − empenho) ÷ CM) são separados; CM ≤ 0 não inventa divisor. Status, KPIs, barras, capital e grade usam o mesmo modelo."
      secoes={SECOES}
      tituloId="cobertura-estoque-ajuda-titulo"
    />
  );
}
