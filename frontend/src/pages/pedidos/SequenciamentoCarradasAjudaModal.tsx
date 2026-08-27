import AjudaTelaModal, { type SecaoAjuda } from '../../components/AjudaTelaModal';

export type SequenciamentoCarradasAjudaModalProps = {
  aberto: boolean;
  onClose: () => void;
};

const SECOES: SecaoAjuda[] = [
  {
    id: 'modos',
    titulo: 'Consulta ao vivo × rascunho × concluído',
    oQueE:
      'A tela trabalha em três modos: consulta ao vivo (dados do ERP), rascunho editável (com autosave) e snapshot concluído (somente leitura).',
    comoLe:
      'No ao vivo você só reordena para simular. No rascunho grava sequência, datas e motivos na simulação (autosave do snapshot) — sem alterar o Gerenciador nem outros módulos. No concluído a grade é o registro do que foi gravado no ERP na conclusão.',
  },
  {
    id: 'seq',
    titulo: 'Seq. / prioridade e arrastar',
    oQueE:
      'A coluna Seq. define a ordem de prioridade das linhas na simulação e no gravação do sequenciamento.',
    comoLe:
      'Arraste as linhas ou edite a sequência; o sistema pode autopreencher +1 nas seguintes. Pedidos especiais (formação/romaneio conforme regra) tendem a ficar no fim da fila.',
  },
  {
    id: 'datas',
    titulo: 'Datas de produção e entrega',
    oQueE:
      'A simulação recalcula datas sobre um baseline (ERP + ajustes). Produção e entrega podem ser editadas e, em alguns fluxos, replicadas entre si.',
    comoLe:
      'Nos campos de produção e entrega, só é possível selecionar a data de hoje ou datas futuras (dias anteriores ficam desabilitados no calendário). Se as datas da carrada não estiverem unificadas, a gravação pode ser bloqueada com aviso. Carrada em formação oculta a entrega e usa produção = maior data das demais + 30 dias.',
    detalhes: [
      {
        titulo: 'Inserir em Romaneio',
        texto:
          'Valor abaixo do corte de carrada → mesma lógica de formação (produção max+30). Valor ≥ corte → regra de emissão + dias da faixa configurada.',
      },
    ],
  },
  {
    id: 'confiavel-grade',
    titulo: 'Coluna Confiável (grade de carradas)',
    oQueE:
      'Na grade principal do sequenciamento, a coluna Confiável resume e, em rascunho editável, permite definir o estado dos itens da carrada normal (ROTA).',
    comoLe:
      'Em consulta, o selo só aparece por unanimidade: todas as linhas da carrada com o mesmo valor (todas Confiável ou todas Não confiável). Mistura (ex.: vários Confiável + um pedido em branco) ou todas em branco → célula vazia. Em branco ≠ Não confiável: em branco é ausência de escolha/ajuste; Não confiável é escolha explícita. No rascunho editável, use Não / meio / Sim diretamente na célula das carradas normais: a escolha é reproduzida a todos os itens de pedido vinculados àquela carrada. O meio remove somente o override do rascunho e volta a exibir o estado originalmente recebido no snapshot. Carradas especiais (Inserir em Romaneio, Retirada, Entrega em Grande Teresina e Requisição) mostram só o status consolidado na grade principal; para alterá-lo, abra o detalhe da carrada. Nas abas Pedidos e Itens, a primeira coluna Confiável permite editar por PD ou item e o toggle no cabeçalho aplica a todos os registros filtrados. Uma escolha em qualquer aba é reproduzida para todos os itens do mesmo PD, impedindo valores conflitantes. Ao fechar com mudanças, escolha Salvar e sair, Não salvar e sair ou Cancelar. No Reprogramar do calendário (rascunho), dá para confirmar as datas iguais e só mudar Confiável (Sim/Não) sem motivo — motivo só é exigido quando a nova previsão difere da atual. O selo no calendário/heatmap atualiza na hora. Na conclusão do sequenciamento, Confiável também é gravado no Gerenciador mesmo sem mudança de data de entrega (confirmação da previsão atual).',
  },
  {
    id: 'calendario',
    titulo: 'Calendário de produção',
    oQueE:
      'Visão por data de produção com quantidades líquidas após abater estoque congelado, com drill por setor, PD e item.',
    comoLe:
      'Use para ver carga diária e gargalos. As quantidades já consideram o estoque “congelado” no momento da simulação — não é o saldo bruto do ERP. Os setores aparecem em ordem alfabética; “(vazio)”, “Não considerar na meta” e “Outros” ficam nas três últimas linhas da grade (antes do Total Geral). Os quatro botões da legenda (⚠️, Confiável, Não confiável e Em branco) alternam somente a exibição do respectivo ícone nas células e nos níveis de drill; não filtram nem alteram números, linhas ou dados do calendário. O filtro TipoF é múltipla escolha (como Pedido), com as opções presentes na coluna TipoF das linhas; vazio ou todas marcadas = Todos, e pode ser combinado com Pedido e Confiável. Em todos os filtros de múltipla escolha, os itens marcados aparecem no topo da lista. O botão “Somente ⚠️” filtra a grade para mostrar só as quantidades com ⚠️ (itens sem data de produção, posicionados pela previsão atual). Os filtros Pedido, TipoF e Confiável exibem “Todos” quando nenhuma opção ou todas estão marcadas; “Limpar filtros” aparece só com filtro parcial ou “Somente ⚠️” ativo. Ao fechar o calendário (Esc ou Fechar) e reabrir, Pedido, TipoF, Confiável, Somente ⚠️ e a aba Produção/Materiais críticos permanecem como estavam (na mesma aba do navegador; “Limpar filtros” zera e grava o estado limpo). O filtro Confiável restringe a Confiáveis / Não confiáveis / Em branco, com a mesma precedência do rascunho (override → snapshot → em branco). Nas células, no drill e no modal de itens do PD, além do ⚠️ de previsão, aparecem ícones dos estados presentes: todos Confiável → confirmação verde; algum Não confiável → X vermelho; algum Em branco → “?” em caixa; estados mistos mostram todos os ícones presentes. Ao passar o mouse na quantidade da célula, a dica mostra só quatro linhas, nesta ordem: Carradas, Retirada, Entrega G. The e Requisição, com a quantidade de cada uma (a soma coincide com a célula). No drill da qtde do dia: se houver só um TipoF, essa tela é pulada; se esse TipoF tiver só uma carrada, abre direto a lista de pedidos. No breadcrumb, o último nível mostra o código e o nome da carrada em navegação (ex.: “Carrada: RM123 · ROTA …”); clique nesse rótulo para abrir o mesmo modal de detalhe da carrada da grade principal (pedidos, itens e produtos vinculados). O próprio calendário e o modal de itens do PD (ou Reprogramar) são janelas flutuantes: arraste pelo cabeçalho e redimensione pelo canto inferior direito. Ao abrir sozinho, o calendário ocupa aproximadamente 90% da largura e 78% da altura da tela, centralizado com margem para arrastar e redimensionar pelo canto inferior direito; no modal de itens, o botão “Visualizar calendário” (ao lado do aviso de setor) sobe o modal do PD e encaixa o pivô do calendário na metade inferior da tela — ambos permanecem navegáveis; “Ocultar calendário” recentraliza as janelas. Nos modais do calendário, carradas, ajuste e consulta de estoque, o ícone de copiar ao lado de PD, romaneio ou código copia o respectivo número/código. No modal de itens do PD, à direita dos dados do pedido, aparece Observações com o texto livre do pedido no ERP (distinto da rota/carrada). Em rascunho, “Reprogramar” no PD altera só a simulação (produção/previsão no Map sim): a data de produção informada remove o indicador ⚠️ e reposiciona a célula nas novas datas; o Gerenciador e demais módulos só mudam quando o sequenciamento for concluído. “Confirmar esta data” (abaixo da data atual) copia essa data para o campo nova correspondente; a gravação só ocorre ao clicar em Salvar (com motivo/confiável quando a previsão estiver envolvida). Em tipofs especiais (Requisição, Retirada, Entrega Grande Teresina), só os itens marcados no checkbox mudam — não todos os pedidos daquele TipoF. Em tipof carradas (rota ROTA …), ao marcar ao menos um item o sistema confirma e replica as datas a todos os itens de todos os pedidos no mesmo código de romaneio (RM), para datas únicas na carrada.',
  },
  {
    id: 'semaforo',
    titulo: 'Semáforo de materiais',
    oQueE:
      'Indicador de disponibilidade de materiais (almox secundário + pedidos de compra), com horizonte por material. Escopo típico exclui Matéria Prima.',
    comoLe:
      'No cabeçalho de cada data, a bolinha resume o dia inteiro (vermelho = há material em falta; verde = ok). Ao lado esquerdo de cada quantidade da grade, a mesma bolinha avalia só aquela célula (setor × data): vermelho se algum material em falta no dia tem consumo daquele setor; verde caso contrário. Clique na bolinha do cabeçalho para ver todos os materiais do dia; na bolinha da célula, o modal filtra pelo setor. Verde/amarelo/vermelho resumem risco no período analisado. No modal Materiais do dia, a coluna Entrada PC mostra uma única informação por prioridade: (1) quantidade de PC com entrega naquele dia; (2) se não houver, a data de entrega mais antiga de PC aberto no formato dd/mm/aaaa - quantidade (soma dos PCs dessa data); (3) senão “Pré Compra”; (4) senão “Solicitação de Compra”; (5) senão 0. Células com PC/Pré Compra/SC são clicáveis e abrem o detalhe com todas as linhas abertas do item. Esses avisos não entram no cálculo da coluna Falta — a falta continua usando só saldo, consumo e entrada numérica do dia.',
  },
  {
    id: 'motivos',
    titulo: 'Concluir',
    oQueE:
      'Ao concluir, datas/previsões vencidas e mudanças de previsão ficam na mesma grade. A coluna Pedido concentra PD (com copiar), data de emissão, cliente e carrada; Cliente e Carrada deixam de ser colunas visíveis, mas seus filtros Excel ficam nos botões do cabeçalho de Pedido. Código (com copiar), Descrição, datas, Qtde, Motivo e a coluna Confiável / Obs. (toggle compacto “Confiável [Não | meio | Sim]” com o ícone de observação abaixo) completam a linha. Todo item com id de pedido exige motivo. Motivos do calendário já entram nesse estado.',
    comoLe:
      'Ao lado de Fechar use Pendentes / Concluídos / Todos (filtro local do modal, combinável com os filtros Excel). A grade do modal usa as mesmas datas efetivas da simulação da grade principal (produção e entrega por carrada/item). Corrija datas anteriores a hoje — fundo verde só quando produção e entrega são ≥ hoje, entrega ≥ produção, e motivo/confiável preenchidos quando exigidos. Ao editar produção, a entrega **não** é reduzida automaticamente; só sobe se a nova produção passar da entrega já informada (use os ícones →/← para replicar manualmente). Editar datas **não reordena** a grade: a ordem vigente é mantida e a classificação padrão (data de produção, carrada, número do pedido, descrição) só é reaplicada ao clicar em **Atualizar classificação** (ou ao reabrir o modal). Preencha motivo e o toggle Previsão confiável (Não / meio / Sim — sempre inicia no meio; Sim ou Não obrigatório para concluir). Carradas ROTA com vários pedidos aparecem desdobradas por item. Ao confirmar, o sistema grava **produção antes da previsão** no Gerenciador. Fechar ou Cancelar grava o rascunho e mantém simulação, motivos, observações e confiável; ao reabrir, a grade reflete o estado mais recente. Limpeza completa só ocorre após concluir com sucesso ou ao fechar a visualização do sequenciamento. Com motivos preenchidos, você pode anexar um PDF assinado (obrigatório se algum for não abonado; opcional nos demais). Itens em que só o Confiável mudou também são gravados no Gerenciador via confirmação da data vigente — usando a data efetiva da carrada/item; essa confirmação não altera a data e não é bloqueada por divergência com a data de produção do Gerenciador. Carradas em formação ficam fora dessa confirmação (as datas delas não são gerenciadas nesta tela). Se alguma gravação falhar, a mensagem de erro identifica o PD e a carrada da linha.',
  },
  {
    id: 'financeiro',
    titulo: 'Colunas financeiras e % Em dia',
    oQueE:
      'Saldo a faturar, adiantamento, valor à vista (≤ 10 dias) e percentual “Em dia” apoiam a leitura comercial da fila.',
    comoLe:
      'Leia o % Em dia junto com a sequência: priorizar só por valor sem olhar prazo costuma empurrar atrasados. O semáforo financeiro não substitui o de materiais.',
  },
  {
    id: 'colunas',
    titulo: 'Colunas e largura da grade',
    oQueE:
      'Cada cabeçalho tem o ícone de olho riscado para ocultar aquela informação. As colunas ocultas ficam reunidas no botão “Colunas ocultas”, e a escolha e a largura são guardadas neste navegador.',
    comoLe:
      'Use o ícone de olho riscado no cabeçalho para ocultar a coluna e “Colunas ocultas” para reexibi-la individualmente ou todas de uma vez. Para aumentar ou reduzir a largura, arraste a borda direita do cabeçalho.',
  },
];

export default function SequenciamentoCarradasAjudaModal({
  aberto,
  onClose,
}: SequenciamentoCarradasAjudaModalProps) {
  return (
    <AjudaTelaModal
      aberto={aberto}
      onClose={onClose}
      titulo="Como ler o Sequenciamento de Carradas"
      subtitulo="Modos da tela, sequência, datas, calendário e semáforo de materiais."
      introducao="Use esta tela para ordenar carradas, simular datas de produção/entrega e gravar um sequenciamento com motivos. O calendário e o semáforo mostram carga e risco de material sobre a simulação atual."
      secoes={SECOES}
      tituloId="sequenciamento-ajuda-titulo"
    />
  );
}
