import { createPortal } from 'react-dom';

export type PedidosAjudaModalProps = {
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
    id: 'categoria',
    titulo: 'Como a categoria (rota) é definida',
    oQueE:
      'Cada linha da grade recebe uma categoria (TipoF) a partir do romaneio/rota no ERP. Se ainda não há observação de romaneio, o sistema classifica automaticamente pela regra de prioridade abaixo.',
    comoLe:
      'Olhe a coluna de observações/rota para saber em qual “balde” o pedido caiu. A categoria decide qual regra de previsão e de atraso vale para aquela linha.',
    detalhes: [
      {
        titulo: 'Prioridade quando não há romaneio',
        texto:
          '1) Retirada (método Só Móveis ou Só Aço) → 2) Requisição (Teresina + requisição loja = Sim) → 3) Entrega Grande Teresina (municípios da região + requisição = Não) → 4) Inserir em Romaneio (demais casos).',
      },
      {
        titulo: 'Quando já existe rota no ERP',
        texto:
          'O texto de observações do romaneio é usado como está. Se contém “ROTA”, a linha entra como Carradas.',
      },
    ],
  },
  {
    id: 'retirada',
    titulo: 'Retirada',
    oQueE:
      'Pedidos com método de entrega “Retirada na Só Aço” ou “Retirada na Só Móveis”, quando ainda não há romaneio preenchido no ERP.',
    comoLe:
      'A previsão usada no prazo é a data de entrega do item. A linha fica Atrasada se a data de hoje for posterior a essa entrega. Não entra na regra de valor de corte nem na replicação por carrada.',
  },
  {
    id: 'gthe',
    titulo: 'Entrega G. The (Grande Teresina)',
    oQueE:
      'Entregas nos municípios da Grande Teresina (Teresina, Timon, Nazária, Demerval Lobão, Curralinhos) quando não é requisição de loja e ainda não há romaneio.',
    comoLe:
      'Assim como na Retirada, a previsão e o atraso seguem a data de entrega do item — sem valor de corte. Também fica fora da replicação automática por carrada.',
  },
  {
    id: 'romaneio',
    titulo: 'Inserir em romaneio',
    oQueE:
      'Categoria padrão quando o pedido ainda não tem observação de romaneio e não se encaixa em Retirada, Requisição ou Grande Teresina. Indica que ainda precisa ser colocado em uma rota.',
    comoLe:
      'Por padrão a previsão é a data de entrega do item. Se, em Regras de data de entrega, a opção “Aplicar a mesma regra a Inserir em Romaneio” estiver ligada, passa a valer a mesma lógica de carrada (emissão + dias conforme o valor de corte).',
  },
  {
    id: 'carrada',
    titulo: 'Carrada',
    oQueE:
      'Linhas cuja rota começa com “ROTA …” (já definidas no romaneio do ERP). É o fluxo de carga/entrega por rota comercial.',
    comoLe:
      'A previsão automática não usa o “emissão + 30 dias” legado da consulta: o sistema recalcula com a regra de valor de corte. Ao ajustar uma previsão, você pode optar por replicar a data para outros pedidos da mesma ROTA.',
    detalhes: [
      {
        titulo: 'Carrada em formação',
        texto:
          'Rotas cujo nome indica construção/contingência aparecem como “Carrada em formação”: a grade não mostra data de entrega/previsão nesses casos, até a rota se consolidar.',
      },
    ],
  },
  {
    id: 'corte',
    titulo: 'Valor de corte e previsão automática',
    oQueE:
      'Regra configurável (tela Regras de data de entrega) que define a data limite das carradas a partir da emissão do pedido e do valor total do PD.',
    comoLe:
      'Padrão do sistema: base = data de emissão; valor = Valor Pedido Total (com IPI). Abaixo de R$ 30.000 → emissão + 60 dias; igual ou acima do corte → emissão + 45 dias. Versões da regra valem conforme a data de emissão do pedido. Se existir ajuste manual gravado, ele prevalece sobre a regra.',
    detalhes: [
      {
        titulo: 'Onde configurar',
        texto:
          'Em Pedidos → Regras de data de entrega você altera corte, dias e se a regra também vale para “Inserir em Romaneio”.',
      },
    ],
  },
  {
    id: 'atrasado',
    titulo: 'Atrasado / No prazo',
    oQueE:
      'Indicador de prazo da linha na coluna Status. Na grade, o texto “Em dia” do ERP aparece como “No prazo”.',
    comoLe:
      'Para Carradas (e Inserir em Romaneio quando a flag da regra estiver ligada), compara a data de hoje com a data limite da regra de corte. Nas demais categorias, compara com a data de entrega / parâmetro da linha. O filtro “Somente atrasados” usa a previsão atualizada.',
  },
  {
    id: 'faturado',
    titulo: 'Faturado',
    oQueE:
      'Badge na coluna Status quando o item já tem valor de faturamento de entrega futura (mais IPI) maior que zero.',
    comoLe:
      'Não indica atraso nem conclusão do pedido: só sinaliza que já houve faturamento parcial / entrega futura naquele item. Pode aparecer junto com No prazo ou Atrasado.',
  },
  {
    id: 'card',
    titulo: 'Card / Disponível',
    oQueE:
      'Sinais vindos da Comunicação Interna (Comunicação PD / Sycro), refletidos na coluna Status do Gerenciador.',
    comoLe:
      '“Card” e “Disponível” mostram o andamento do diálogo com o cliente/comercial sobre aquele pedido — são independentes do prazo (Atrasado/No prazo) e do Faturado.',
  },
  {
    id: 'ajuste',
    titulo: 'Ajuste manual e replicação',
    oQueE:
      'Ao clicar na previsão na grade, você grava uma nova data com motivo (e observação opcional). Esse ajuste fica no banco local e substitui a previsão automática da regra.',
    comoLe:
      'Em carradas, o sistema pode perguntar se a nova data deve valer só naquele PD/item ou ser replicada para outros da mesma ROTA. Retirada, Grande Teresina, Inserir em Romaneio e Requisição não entram nessa replicação.',
    detalhes: [
      {
        titulo: 'Previsão provisória (não confiável)',
        texto:
          'Se você desmarcar “Previsão confiável”, a data vale na grade mas não entra no histórico da Comunicação Interna — use para datas ainda em negociação.',
      },
    ],
  },
  {
    id: 'producao',
    titulo: 'Data de produção na grade',
    oQueE:
      'Coluna de produção do pedido/item, quando preenchida no fluxo de programação ou sequenciamento.',
    comoLe:
      'Se a data de produção estiver vazia, a interface pode exibir a previsão de entrega como referência visual — isso não grava produção automaticamente; é só apoio à leitura.',
  },
];

export default function PedidosAjudaModal({ aberto, onClose }: PedidosAjudaModalProps) {
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
        aria-labelledby="pedidos-ajuda-titulo"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div className="min-w-0 pr-2">
            <h2 id="pedidos-ajuda-titulo" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Como ler o Gerenciador de Pedidos
            </h2>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
              Explicação das categorias, status e regras automáticas de previsão.
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
            A grade classifica cada linha pela rota/categoria vinda do Nomus e calcula previsão e atraso
            conforme essa categoria. Um ajuste manual de previsão (gravado no sistema) sobrescreve a regra
            automática até você alterar de novo.
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
    document.body
  );
}
