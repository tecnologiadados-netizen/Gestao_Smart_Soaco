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
      'Se as datas da carrada não estiverem unificadas, a gravação pode ser bloqueada com aviso. Carrada em formação oculta a entrega e usa produção = maior data das demais + 30 dias.',
    detalhes: [
      {
        titulo: 'Inserir em Romaneio',
        texto:
          'Valor abaixo do corte de carrada → mesma lógica de formação (produção max+30). Valor ≥ corte → regra de emissão + dias da faixa configurada.',
      },
    ],
  },
  {
    id: 'calendario',
    titulo: 'Calendário de produção',
    oQueE:
      'Visão por data de produção com quantidades líquidas após abater estoque congelado, com drill por setor, PD e item.',
    comoLe:
      'Use para ver carga diária e gargalos. As quantidades já consideram o estoque “congelado” no momento da simulação — não é o saldo bruto do ERP. No drill da qtde do dia: se houver só um TipoF, essa tela é pulada; se esse TipoF tiver só uma carrada, abre direto a lista de pedidos. Em rascunho, “Reprogramar” no PD altera só a simulação (produção/previsão no Map sim); o Gerenciador e demais módulos só mudam quando o sequenciamento for concluído. Em tipofs especiais (Requisição, Retirada, Entrega Grande Teresina), só os itens marcados no checkbox mudam — não todos os pedidos daquele TipoF. Em tipof carradas (rota ROTA …), ao marcar ao menos um item o sistema confirma e replica as datas a todos os itens de todos os pedidos no mesmo código de romaneio (RM), para datas únicas na carrada.',
  },
  {
    id: 'semaforo',
    titulo: 'Semáforo de materiais',
    oQueE:
      'Indicador de disponibilidade de materiais (almox secundário + pedidos de compra), com horizonte por material. Escopo típico exclui Matéria Prima.',
    comoLe:
      'Clique no semáforo/material para abrir o horizonte: saldo início, consumo, entrada de PC e saldo projetado dia a dia. Verde/amarelo/vermelho resumem risco no período analisado.',
  },
  {
    id: 'motivos',
    titulo: 'Concluir',
    oQueE:
      'Ao concluir, datas/previsões vencidas e mudanças de previsão ficam na mesma grade: Pedido, Cliente, Código, Descrição, Carrada, datas, Qtde, Motivo, Obs. (ícone) e Confiável. Todo item com id de pedido nessa grade exige motivo (não só os que já tinham previsão alterada no rascunho). Motivos do calendário já entram nesse estado.',
    comoLe:
      'Uma única grade larga: corrija datas anteriores a hoje, preencha motivo/obs/confiável na mesma linha (fundo verde quando ok) e clique em Concluir. Carradas ROTA com vários pedidos aparecem desdobradas por item (com qtde e motivo). Datas ou motivos incompletos impedem fechar. Se algum motivo for não abonado, anexe um PDF assinado (um arquivo vale para todo o lote) antes de concluir.',
  },
  {
    id: 'financeiro',
    titulo: 'Colunas financeiras e % Em dia',
    oQueE:
      'Saldo a faturar, adiantamento, valor à vista (≤ 10 dias) e percentual “Em dia” apoiam a leitura comercial da fila.',
    comoLe:
      'Leia o % Em dia junto com a sequência: priorizar só por valor sem olhar prazo costuma empurrar atrasados. O semáforo financeiro não substitui o de materiais.',
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
