import {
  getField,
  getNumber,
  linhaCarradaKey,
  linhaCodCarrada,
  simItemKey,
  carradaKey,
  type CarradaDataInvalida,
  type PedidoAlterado,
} from './simulacaoCarradas';
import { isCarradaOrdemFinal } from './sequenciamentoCarradasUtils';
import { isCarradaEmFormacao } from '../../utils/rotaCarrada';
import { statusBadgeFieldsFromRow } from '../../utils/statusPedidoBadges';

/** Linha da grade única do modal Concluir (datas + motivos). */
export type LinhaConclusao = {
  key: string;
  idPedido?: string;
  pedido: string;
  cliente: string;
  codigo: string;
  descricao: string;
  carrada: string;
  dataProducao: string;
  dataEntrega: string;
  producaoPassada: boolean;
  entregaPassada: boolean;
  previsaoPassada?: boolean;
  previsaoAtual?: string;
  /** Datas válidas (≥ hoje) ou linha só de motivo (sem data vencida). */
  datasOk: boolean;
  qtdePendenteReal: number;
  exigeMotivo: boolean;
  statusPrazo?: string;
  card?: '' | 'Card' | 'Disponível';
  faturado?: boolean;
};

function simKeyPedidoAlterado(p: PedidoAlterado): string {
  if (isCarradaOrdemFinal(p.rota)) return simItemKey(p.idPedido);
  return carradaKey(p.cod || '—', p.rota);
}

function linhaFromInvalidaItem(
  inv: CarradaDataInvalida,
  ped: PedidoAlterado | undefined
): LinhaConclusao {
  return {
    key: inv.key,
    idPedido: inv.idPedido,
    pedido: inv.pedido ?? ped?.pd ?? '—',
    cliente: inv.cliente ?? ped?.cliente ?? '',
    codigo: inv.codigoProduto || inv.cod || ped?.cod || '—',
    descricao: inv.descricaoProduto || ped?.descricao || '',
    carrada: inv.carrada,
    dataProducao: inv.dataProducao,
    dataEntrega: inv.dataEntrega,
    producaoPassada: !!inv.producaoPassada,
    entregaPassada: !!inv.entregaPassada,
    previsaoPassada: inv.previsaoPassada,
    previsaoAtual: inv.previsaoAtual,
    datasOk: !!inv.concluida,
    qtdePendenteReal: ped?.qtdePendenteReal ?? inv.qtdePendenteReal ?? 0,
    exigeMotivo: !!inv.idPedido || !!ped,
    statusPrazo: inv.statusPrazo,
    card: inv.card,
    faturado: inv.faturado,
  };
}

/**
 * Carrada agregada (ROTA …) sem idPedido → explode nos itens do snapshot
 * para Motivo/Qtde por pedido (evita linha “—” com qtde 0).
 */
function expandirItensDaCarrada(
  inv: CarradaDataInvalida,
  linhasSnapshot: Record<string, unknown>[],
  pedById: Map<string, PedidoAlterado>
): LinhaConclusao[] {
  const out: LinhaConclusao[] = [];
  for (const row of linhasSnapshot) {
    const { carrada } = linhaCodCarrada(row);
    if (isCarradaOrdemFinal(carrada) || isCarradaEmFormacao(carrada)) continue;
    if (linhaCarradaKey(row) !== inv.key) continue;
    const idPedido = getField(row, ['id_pedido', 'idChave']);
    if (!idPedido) continue;
    const qtde = getNumber(row, ['Qtde Pendente Real', 'qtde pendente real']);
    if (qtde === 0) continue;
    const ped = pedById.get(idPedido);
    const badges = statusBadgeFieldsFromRow(row);
    out.push({
      key: inv.key,
      idPedido,
      pedido: getField(row, ['PD', 'pd']) || ped?.pd || '—',
      cliente: getField(row, ['Cliente', 'cliente']) || ped?.cliente || '',
      codigo: getField(row, ['Cod', 'cod']) || ped?.cod || '—',
      descricao:
        getField(row, ['Descricao do produto', 'Descrição do produto']) || ped?.descricao || '',
      carrada: inv.carrada,
      dataProducao: inv.dataProducao,
      dataEntrega: inv.dataEntrega,
      producaoPassada: !!inv.producaoPassada,
      entregaPassada: !!inv.entregaPassada,
      previsaoPassada: inv.previsaoPassada,
      previsaoAtual: inv.previsaoAtual,
      datasOk: !!inv.concluida,
      qtdePendenteReal: ped?.qtdePendenteReal ?? qtde,
      exigeMotivo: true,
      statusPrazo: badges.statusPrazo,
      card: badges.card,
      faturado: badges.faturado,
    });
  }
  return out;
}

/**
 * Une datas vencidas + pedidos com previsão alterada numa grade plana.
 * Carradas agregadas (sem idPedido) são expandidas nos itens do snapshot.
 */
export function montarLinhasConclusao(
  invalidas: CarradaDataInvalida[],
  pedidosEntrega: PedidoAlterado[],
  linhasSnapshot: Record<string, unknown>[] = []
): LinhaConclusao[] {
  const pedById = new Map(pedidosEntrega.map((p) => [p.idPedido, p]));
  const usados = new Set<string>();
  const out: LinhaConclusao[] = [];

  for (const inv of invalidas) {
    if (inv.idPedido) {
      usados.add(inv.idPedido);
      out.push(linhaFromInvalidaItem(inv, pedById.get(inv.idPedido)));
      continue;
    }

    const filhos = expandirItensDaCarrada(inv, linhasSnapshot, pedById);
    if (filhos.length > 0) {
      for (const f of filhos) {
        if (f.idPedido) usados.add(f.idPedido);
        out.push(f);
      }
      continue;
    }

    // Sem itens no snapshot: mantém agregada (sem Motivo).
    out.push(linhaFromInvalidaItem(inv, undefined));
  }

  for (const ped of pedidosEntrega) {
    if (usados.has(ped.idPedido)) continue;
    out.push({
      key: simKeyPedidoAlterado(ped),
      idPedido: ped.idPedido,
      pedido: ped.pd,
      cliente: ped.cliente,
      codigo: ped.cod || '—',
      descricao: ped.descricao || '',
      carrada: ped.rota,
      dataProducao: '',
      dataEntrega: ped.previsaoNova,
      producaoPassada: false,
      entregaPassada: false,
      datasOk: true,
      qtdePendenteReal: ped.qtdePendenteReal,
      exigeMotivo: true,
    });
  }

  return out;
}
