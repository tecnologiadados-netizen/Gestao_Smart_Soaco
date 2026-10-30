import { apiJson } from './client';

export type IndicadorPortaPallets =
  | 'propostas'
  | 'pedidos'
  | 'clientes'
  | 'primeira'
  | 'conversao'
  | 'tempo'
  | 'pedidos_gerados'
  | 'clientes_com_pedido'
  | 'clientes_total'
  | 'clientes_novos'
  | 'novos_com_pedido';

export interface LinhaPedidoGerado {
  idPedido: number;
  codigoPedido: string;
  dataEmissao: string;
  cliente: string;
  propostasOrigem: string;
  valorVendido: number;
  contaNaVenda: boolean;
}

export interface ConciliacaoPedidos {
  pedidosCard: number;
  pedidosFunil: number;
  semProposta: number;
  propostaAnterior: number;
  geradosForaDaVenda: number;
  geradosForaDoPeriodo: number;
}

export interface FunilPortaPallets {
  propostas: number;
  valorPropostas: number;
  convertidas: number;
  pedidosGerados: number;
  valorPedidosGerados: number;
  conciliacao: ConciliacaoPedidos;
  tempoMedioDias: number | null;
  clientesTotal: number;
  clientesComPedido: number;
  clientesNovos: number;
  novosComPedido: number;
}

export interface LinhaClienteFunil {
  idCliente: number;
  cliente: string;
  dataCadastro: string;
  primeiroContato: string;
  diasCadastroAteContato: number | null;
  novo: boolean;
  qtdPropostas: number;
  qtdPedidos: number;
  valorVendido: number;
}

export interface MesPortaPallets {
  mes: string;
  qtdPropostas: number;
  valorPropostas: number;
  qtdConvertidas: number;
  qtdPedidosGerados: number;
  valorPedidosGerados: number;
  qtdPedidos: number;
  valorVendido: number;
  qtdClientes: number;
  qtdPrimeiraCompra: number;
  ticketMedio: number | null;
  taxaConversao: number | null;
  tempoMedioDias: number | null;
}

export interface PortaPalletsMensal {
  grupo: string;
  desde: string;
  ate: string;
  meses: MesPortaPallets[];
  totais: MesPortaPallets;
  funil: FunilPortaPallets;
}

export interface LinhaPropostaItem {
  idItem: number;
  idProposta: number;
  codigoProposta: string;
  dataAbertura: string;
  mes: string;
  idCliente: number;
  cliente: string;
  dataCadastroCliente: string;
  codigoProduto: string;
  descricaoProduto: string;
  valor: number;
  statusItem: number;
  statusLabel: string;
  motivoRejeicao: string;
  codigosPedido: string;
  dataPrimeiroPedido: string;
  propostaConvertida: boolean;
  dias: number | null;
}

export interface LinhaPedidoItem {
  idItem: number;
  idPedido: number;
  codigoPedido: string;
  dataEmissao: string;
  mes: string;
  idCliente: number;
  cliente: string;
  dataCadastroCliente: string;
  codigoProduto: string;
  descricaoProduto: string;
  valorVendido: number;
  primeiraCompra: boolean;
  pedidoDeProposta: boolean;
}

export interface LinhaClienteMes {
  idCliente: number;
  cliente: string;
  qtdPedidos: number;
  valor: number;
}

export interface LinhaConversaoMes {
  idProposta: number;
  codigoProposta: string;
  dataAbertura: string;
  cliente: string;
  valor: number;
  convertida: boolean;
  codigosPedido: string;
  dataPrimeiroPedido: string;
  dias: number | null;
}

export type DetalhePortaPallets =
  | { indicador: 'propostas'; rows: LinhaPropostaItem[] }
  | { indicador: 'pedidos'; rows: LinhaPedidoItem[] }
  | { indicador: 'pedidos_gerados'; rows: LinhaPedidoGerado[] }
  | { indicador: 'clientes' | 'primeira'; rows: LinhaClienteMes[] }
  | { indicador: 'conversao' | 'tempo'; rows: LinhaConversaoMes[] }
  | {
      indicador: 'clientes_total' | 'clientes_com_pedido' | 'clientes_novos' | 'novos_com_pedido';
      rows: LinhaClienteFunil[];
    };

export interface PortaPalletsDadosAbertos {
  propostas: LinhaPropostaItem[];
  pedidos: LinhaPedidoItem[];
}

export type RecortePortaPallets = {
  desde?: string;
  ate?: string;
  refresh?: boolean;
};

function qs(params: RecortePortaPallets & { indicador?: string; mes?: string }): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '' || v === false) continue;
    if (k === 'refresh') {
      sp.set('refresh', '1');
      continue;
    }
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export function obterPortaPalletsMensal(recorte: RecortePortaPallets = {}): Promise<PortaPalletsMensal> {
  return apiJson<PortaPalletsMensal>(`/api/comercial/porta-pallets/mensal${qs(recorte)}`);
}

export function obterPortaPalletsDetalhe(
  indicador: IndicadorPortaPallets,
  recorte: RecortePortaPallets & { mes?: string } = {}
): Promise<DetalhePortaPallets> {
  return apiJson<DetalhePortaPallets>(
    `/api/comercial/porta-pallets/detalhe${qs({ indicador, ...recorte })}`
  );
}

export function obterPortaPalletsDadosAbertos(recorte: RecortePortaPallets = {}): Promise<PortaPalletsDadosAbertos> {
  return apiJson<PortaPalletsDadosAbertos>(`/api/comercial/porta-pallets/dados-abertos${qs(recorte)}`);
}
