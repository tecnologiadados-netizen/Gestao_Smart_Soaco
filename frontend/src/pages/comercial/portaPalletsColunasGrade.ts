import type {
  LinhaClienteFunil,
  LinhaClienteMes,
  LinhaConversaoMes,
  LinhaPedidoGerado,
  LinhaPedidoItem,
  LinhaPropostaItem,
} from '../../api/portaPalletsComercial';
import { formatMoeda, formatNumero } from '../../components/painel-comercial/painelComercialUtils';
import type { ColunaGrade } from './GradePortaPallets';
import { formatData, formatDias, labelMes, simNao } from './portaPalletsComercialFormat';

function dataTexto(iso: string): string {
  return iso ? formatData(iso) : '—';
}

function diasValor(v: number | null): number {
  return v == null ? Number.NaN : v;
}

export const COLUNAS_PROPOSTAS: ColunaGrade<LinhaPropostaItem>[] = [
  { id: 'mes', label: 'Mês', texto: (r) => labelMes(r.mes), valor: (r) => r.mes },
  { id: 'proposta', label: 'Proposta', texto: (r) => r.codigoProposta },
  { id: 'abertura', label: 'Abertura', tipo: 'data', texto: (r) => dataTexto(r.dataAbertura), valor: (r) => r.dataAbertura },
  { id: 'cliente', label: 'Cliente', texto: (r) => r.cliente },
  { id: 'produto', label: 'Produto', texto: (r) => r.codigoProduto },
  { id: 'descricao', label: 'Descrição', texto: (r) => r.descricaoProduto, className: 'max-w-[260px] truncate' },
  { id: 'valor', label: 'Valor', tipo: 'moeda', texto: (r) => formatMoeda(r.valor), valor: (r) => r.valor, total: true },
  { id: 'status', label: 'Status', texto: (r) => r.statusLabel },
  { id: 'motivo', label: 'Motivo da rejeição', texto: (r) => r.motivoRejeicao || '—' },
  { id: 'convertida', label: 'Convertida', texto: (r) => simNao(r.propostaConvertida) },
  { id: 'pedido', label: 'Pedido', texto: (r) => r.codigosPedido || '—' },
  { id: 'dias', label: 'Dias', tipo: 'numero', texto: (r) => formatDias(r.dias), valor: (r) => diasValor(r.dias) },
];

export const COLUNAS_PEDIDOS: ColunaGrade<LinhaPedidoItem>[] = [
  { id: 'mes', label: 'Mês', texto: (r) => labelMes(r.mes), valor: (r) => r.mes },
  { id: 'pedido', label: 'Pedido', texto: (r) => r.codigoPedido },
  { id: 'emissao', label: 'Emissão', tipo: 'data', texto: (r) => dataTexto(r.dataEmissao), valor: (r) => r.dataEmissao },
  { id: 'cliente', label: 'Cliente', texto: (r) => r.cliente },
  { id: 'produto', label: 'Produto', texto: (r) => r.codigoProduto },
  { id: 'descricao', label: 'Descrição', texto: (r) => r.descricaoProduto, className: 'max-w-[260px] truncate' },
  {
    id: 'valor',
    label: 'Valor vendido',
    tipo: 'moeda',
    texto: (r) => formatMoeda(r.valorVendido),
    valor: (r) => r.valorVendido,
    total: true,
  },
  { id: 'deProposta', label: 'Veio de proposta', texto: (r) => simNao(r.pedidoDeProposta) },
  { id: 'primeira', label: 'Primeira compra', texto: (r) => simNao(r.primeiraCompra) },
];

export const COLUNAS_PEDIDOS_GERADOS: ColunaGrade<LinhaPedidoGerado>[] = [
  { id: 'pedido', label: 'Pedido', texto: (r) => r.codigoPedido },
  { id: 'emissao', label: 'Emissão', tipo: 'data', texto: (r) => dataTexto(r.dataEmissao), valor: (r) => r.dataEmissao },
  { id: 'cliente', label: 'Cliente', texto: (r) => r.cliente },
  { id: 'origem', label: 'Proposta de origem', texto: (r) => r.propostasOrigem },
  {
    id: 'valor',
    label: 'Valor vendido',
    tipo: 'moeda',
    texto: (r) => formatMoeda(r.valorVendido),
    valor: (r) => r.valorVendido,
    total: true,
  },
  { id: 'venda', label: 'Conta na venda', texto: (r) => simNao(r.contaNaVenda) },
];

export const COLUNAS_CLIENTES_FUNIL: ColunaGrade<LinhaClienteFunil>[] = [
  { id: 'cliente', label: 'Cliente', texto: (r) => r.cliente },
  {
    id: 'cadastro',
    label: 'Cadastro',
    tipo: 'data',
    texto: (r) => (r.dataCadastro ? formatData(r.dataCadastro) : 'Sem data'),
    valor: (r) => r.dataCadastro,
  },
  {
    id: 'contato',
    label: 'Primeiro contato',
    tipo: 'data',
    texto: (r) => dataTexto(r.primeiroContato),
    valor: (r) => r.primeiroContato,
  },
  {
    id: 'dias',
    label: 'Dias',
    tipo: 'numero',
    texto: (r) => (r.diasCadastroAteContato == null ? '—' : formatNumero(r.diasCadastroAteContato)),
    valor: (r) => diasValor(r.diasCadastroAteContato),
  },
  { id: 'novo', label: 'Novo', texto: (r) => simNao(r.novo) },
  {
    id: 'propostas',
    label: 'Propostas',
    tipo: 'numero',
    texto: (r) => formatNumero(r.qtdPropostas),
    valor: (r) => r.qtdPropostas,
    total: true,
  },
  {
    id: 'pedidos',
    label: 'Pedidos',
    tipo: 'numero',
    texto: (r) => formatNumero(r.qtdPedidos),
    valor: (r) => r.qtdPedidos,
    total: true,
  },
  {
    id: 'valor',
    label: 'Valor vendido',
    tipo: 'moeda',
    texto: (r) => formatMoeda(r.valorVendido),
    valor: (r) => r.valorVendido,
    total: true,
  },
];

export const COLUNAS_CLIENTES_MES: ColunaGrade<LinhaClienteMes>[] = [
  { id: 'cliente', label: 'Cliente', texto: (r) => r.cliente },
  {
    id: 'pedidos',
    label: 'Pedidos',
    tipo: 'numero',
    texto: (r) => formatNumero(r.qtdPedidos),
    valor: (r) => r.qtdPedidos,
    total: true,
  },
  {
    id: 'valor',
    label: 'Valor vendido',
    tipo: 'moeda',
    texto: (r) => formatMoeda(r.valor),
    valor: (r) => r.valor,
    total: true,
  },
];

export const COLUNAS_CONVERSAO: ColunaGrade<LinhaConversaoMes>[] = [
  { id: 'proposta', label: 'Proposta', texto: (r) => r.codigoProposta },
  { id: 'abertura', label: 'Abertura', tipo: 'data', texto: (r) => dataTexto(r.dataAbertura), valor: (r) => r.dataAbertura },
  { id: 'cliente', label: 'Cliente', texto: (r) => r.cliente },
  { id: 'valor', label: 'Valor', tipo: 'moeda', texto: (r) => formatMoeda(r.valor), valor: (r) => r.valor, total: true },
  { id: 'convertida', label: 'Convertida', texto: (r) => simNao(r.convertida) },
  { id: 'pedidos', label: 'Pedidos', texto: (r) => r.codigosPedido || '—' },
  {
    id: 'primeiroPedido',
    label: 'Primeiro pedido',
    tipo: 'data',
    texto: (r) => dataTexto(r.dataPrimeiroPedido),
    valor: (r) => r.dataPrimeiroPedido,
  },
  { id: 'dias', label: 'Dias', tipo: 'numero', texto: (r) => formatDias(r.dias), valor: (r) => diasValor(r.dias) },
];
