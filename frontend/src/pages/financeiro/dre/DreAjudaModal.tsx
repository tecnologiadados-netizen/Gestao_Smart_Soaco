import { createPortal } from 'react-dom';

export type DreAjudaModalProps = {
  aberto: boolean;
  onClose: () => void;
};

type SecaoAjuda = {
  id: string;
  titulo: string;
  oQueE: string;
  comoLe: string;
  detalhes?: { titulo: string; texto: string }[];
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
];

export default function DreAjudaModal({ aberto, onClose }: DreAjudaModalProps) {
  if (!aberto || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center p-3 sm:p-4 bg-black/70 dark:bg-slate-950/60"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative flex w-full max-w-2xl max-h-[min(92vh,800px)] min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dre-ajuda-titulo"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div className="min-w-0 pr-2">
            <h2 id="dre-ajuda-titulo" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Como ler a DRE
            </h2>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
              Explicação gerencial do que cada bloco representa e como interpretar os números.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700 px-3 py-2">
            A DRE mostra o caminho do faturamento até o lucro: quanto entrou, o que foi descontado, quanto
            custou vender, quanto se gastou para operar e o que sobrou no final do período filtrado.
          </p>

          {SECOES.map((s) => (
            <section
              key={s.id}
              className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/60 overflow-hidden"
            >
              <h3 className="px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 bg-slate-100/80 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-600">
                {s.titulo}
              </h3>
              <div className="px-3 py-3 space-y-3 text-sm leading-relaxed">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    O que é
                  </p>
                  <p className="mt-0.5 text-slate-700 dark:text-slate-200">{s.oQueE}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Como ler na prática
                  </p>
                  <p className="mt-0.5 text-slate-700 dark:text-slate-200">{s.comoLe}</p>
                </div>
                {s.detalhes?.length ? (
                  <ul className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-700">
                    {s.detalhes.map((d) => (
                      <li key={d.titulo}>
                        <p className="font-medium text-slate-800 dark:text-slate-100">{d.titulo}</p>
                        <p className="text-slate-600 dark:text-slate-300">{d.texto}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ))}
        </div>

        <div className="shrink-0 flex justify-end border-t border-slate-200 px-4 py-3 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 transition shadow-sm"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
