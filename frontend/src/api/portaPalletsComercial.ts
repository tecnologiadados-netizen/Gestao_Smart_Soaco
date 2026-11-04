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

export interface ItemPedidoGerado {
  idItem: number;
  codigoProduto: string;
  descricaoProduto: string;
  valorVendido: number;
}

export interface LinhaPedidoGerado {
  idPedido: number;
  codigoPedido: string;
  dataEmissao: string;
  cliente: string;
  codigoCliente: string;
  propostasOrigem: string;
  valorVendido: number;
  contaNaVenda: boolean;
  /** Itens de porta-pallet do pedido. A soma é o valor vendido. */
  itens?: ItemPedidoGerado[];
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
  codigoCliente: string;
  dataCadastro: string;
  primeiroContato: string;
  primeiroPedidoEmpresa: string;
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
  anoAnterior: { desde: string; ate: string; meses: MesPortaPallets[] } | null;
}

export interface LinhaPropostaItem {
  idItem: number;
  idProposta: number;
  codigoProposta: string;
  dataAbertura: string;
  mes: string;
  idCliente: number;
  cliente: string;
  codigoCliente: string;
  dataCadastroCliente: string;
  codigoProduto: string;
  descricaoProduto: string;
  valor: number;
  statusItem: number;
  statusLabel: string;
  motivoRejeicao: string;
  observacaoProposta: string;
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
  codigoCliente: string;
  dataCadastroCliente: string;
  codigoProduto: string;
  descricaoProduto: string;
  valorVendido: number;
  primeiraCompra: boolean;
  pedidoDeProposta: boolean;
  propostasVinculadas: string;
}

export interface LinhaClienteMes {
  idCliente: number;
  cliente: string;
  codigoCliente: string;
  dataCadastroCliente: string;
  codigosPedido: string;
  datasPedido: string;
  codigosProposta: string;
  datasProposta: string;
  novo: boolean;
  qtdPedidos: number;
  valor: number;
}

export interface LinhaConversaoMes {
  idProposta: number;
  codigoProposta: string;
  dataAbertura: string;
  idCliente: number;
  cliente: string;
  codigoCliente: string;
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

export interface AuditoriaMensalPortaPallets {
  desde: string;
  ate: string;
  meses: MesPortaPallets[];
  totais: MesPortaPallets;
  propostas: Array<LinhaConversaoMes & { mes: string; clienteNovo: boolean; dataCadastroCliente: string }>;
  pedidosGerados: Array<LinhaPedidoGerado & { mes: string }>;
  clientes: Array<LinhaClienteMes & { mes: string; primeiraCompra: boolean }>;
}

export interface NoFamiliaPortaPalete {
  id: number;
  classificacao: string;
  nome: string;
  filhos: NoFamiliaPortaPalete[];
}

export interface OpcoesPortaPallets {
  empresas: { id: number; nome: string }[];
  vendedores: { nome: string; valor: number }[];
  subgrupos: string[];
  ufs: string[];
  cidades: { nome: string; uf: string }[];
  familias: NoFamiliaPortaPalete[];
}

export type RecortePortaPallets = {
  desde?: string;
  ate?: string;
  refresh?: boolean;
  /** Ids separados por vírgula, ou `todas`. */
  empresas?: string;
  /** Listas separadas por `|`. Família: códigos da árvore (`95.4|95.1`) ou `nenhuma`. */
  vendedores?: string;
  subgrupos?: string;
  ufs?: string;
  cidades?: string;
  familias?: string;
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

export function obterPortaPalletsOpcoes(recorte: RecortePortaPallets = {}): Promise<OpcoesPortaPallets> {
  return apiJson<OpcoesPortaPallets>(`/api/comercial/porta-pallets/opcoes${qs(recorte)}`);
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

export function obterPortaPalletsAuditoriaMensal(recorte: RecortePortaPallets = {}): Promise<AuditoriaMensalPortaPallets> {
  return apiJson<AuditoriaMensalPortaPallets>(`/api/comercial/porta-pallets/auditoria-mensal${qs(recorte)}`);
}

export function obterPortaPalletsDadosAbertos(recorte: RecortePortaPallets = {}): Promise<PortaPalletsDadosAbertos> {
  return apiJson<PortaPalletsDadosAbertos>(`/api/comercial/porta-pallets/dados-abertos${qs(recorte)}`);
}
