import { createElement } from 'react';
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
  { id: 'codigoCliente', label: 'Cód. interno', texto: (r) => r.codigoCliente || '—' },
  { id: 'cliente', label: 'Cliente', texto: (r) => r.cliente },
  { id: 'produto', label: 'Produto', texto: (r) => r.codigoProduto },
  { id: 'descricao', label: 'Descrição', texto: (r) => r.descricaoProduto, className: 'max-w-[260px] truncate' },
  { id: 'valor', label: 'Valor', tipo: 'moeda', texto: (r) => formatMoeda(r.valor), valor: (r) => r.valor, total: true },
  { id: 'status', label: 'Status', texto: (r) => r.statusLabel },
  { id: 'motivo', label: 'Motivo da rejeição', texto: (r) => r.motivoRejeicao || '—' },
  { id: 'convertida', label: 'Convertida', texto: (r) => simNao(r.propostaConvertida) },
  { id: 'pedido', label: 'Pedido', texto: (r) => r.codigosPedido || '—' },
  { id: 'dias', label: 'Dias para criar pedido', tipo: 'numero', texto: (r) => formatDias(r.dias), valor: (r) => diasValor(r.dias) },
];

export const COLUNAS_PEDIDOS: ColunaGrade<LinhaPedidoItem>[] = [
  { id: 'mes', label: 'Mês', texto: (r) => labelMes(r.mes), valor: (r) => r.mes },
  { id: 'pedido', label: 'Pedido', texto: (r) => r.codigoPedido },
  { id: 'proposta', label: 'Proposta', texto: (r) => r.propostasVinculadas || '—' },
  { id: 'emissao', label: 'Emissão', tipo: 'data', texto: (r) => dataTexto(r.dataEmissao), valor: (r) => r.dataEmissao },
  { id: 'codigoCliente', label: 'Cód. interno', texto: (r) => r.codigoCliente || '—' },
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
  { id: 'primeira', label: 'Primeira compra', texto: (r) => simNao(r.primeiraCompra) },
];

export const COLUNAS_PEDIDOS_GERADOS: ColunaGrade<LinhaPedidoGerado>[] = [
  { id: 'pedido', label: 'Pedido', texto: (r) => r.codigoPedido },
  { id: 'emissao', label: 'Emissão', tipo: 'data', texto: (r) => dataTexto(r.dataEmissao), valor: (r) => r.dataEmissao },
  { id: 'codigoCliente', label: 'Cód. interno', texto: (r) => r.codigoCliente || '—' },
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
];

export const COLUNAS_CLIENTES_FUNIL: ColunaGrade<LinhaClienteFunil>[] = [
  { id: 'codigoCliente', label: 'Cód. interno', texto: (r) => r.codigoCliente || '—' },
  { id: 'cliente', label: 'Cliente', texto: (r) => r.cliente },
  {
    id: 'cadastro',
    label: 'Criação do cliente',
    tipo: 'data',
    texto: (r) => (r.dataCadastro ? formatData(r.dataCadastro) : 'Sem data'),
    valor: (r) => r.dataCadastro,
  },
  {
    id: 'contato',
    label: 'Primeira proposta',
    tipo: 'data',
    texto: (r) => dataTexto(r.primeiroContato),
    valor: (r) => r.primeiroContato,
  },
  {
    id: 'pedidoEmpresa',
    label: '1º pedido na empresa',
    tipo: 'data',
    texto: (r) => (r.primeiroPedidoEmpresa ? formatData(r.primeiroPedidoEmpresa) : 'Nunca comprou'),
    valor: (r) => r.primeiroPedidoEmpresa,
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

function datasLista(isos: string): string {
  const partes = isos
    .split(', ')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (/^\d{4}-\d{2}-\d{2}/.test(s) ? formatData(s.slice(0, 10)) : s));
  return partes.length ? partes.join(', ') : '—';
}

export const COLUNAS_CLIENTES_MES: ColunaGrade<LinhaClienteMes>[] = [
  { id: 'codigoCliente', label: 'Cód. interno', texto: (r) => r.codigoCliente || '—' },
  { id: 'cliente', label: 'Cliente', texto: (r) => r.cliente },
  {
    id: 'cadastro',
    label: 'Criação do cliente',
    tipo: 'data',
    texto: (r) => (r.dataCadastroCliente ? formatData(r.dataCadastroCliente) : '—'),
    valor: (r) => r.dataCadastroCliente,
    render: (r) => {
      const texto = r.dataCadastroCliente ? formatData(r.dataCadastroCliente) : '—';
      if (!r.novo) return texto;
      return createElement(
        'span',
        {
          title: 'Cliente novo: este pedido é a primeira compra dele na empresa (nunca comprou nenhum produto antes)',
          className:
            'inline-block rounded px-1.5 py-0.5 font-medium text-emerald-700 bg-emerald-500/10 ring-1 ring-emerald-500/25 dark:text-emerald-300 dark:bg-emerald-400/10 dark:ring-emerald-400/25',
        },
        texto
      );
    },
  },
  { id: 'proposta', label: 'Proposta', texto: (r) => r.codigosProposta || '—' },
  {
    id: 'dataProposta',
    label: 'Data da proposta',
    texto: (r) => datasLista(r.datasProposta),
    valor: (r) => r.datasProposta.split(', ')[0] ?? '',
  },
  { id: 'pedido', label: 'Pedido', texto: (r) => r.codigosPedido || '—' },
  {
    id: 'dataPedido',
    label: 'Data do pedido',
    texto: (r) => datasLista(r.datasPedido),
    valor: (r) => r.datasPedido.split(', ')[0] ?? '',
  },
  {
    id: 'pedidos',
    label: 'Qtd. pedidos',
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
  { id: 'codigoCliente', label: 'Cód. interno', texto: (r) => r.codigoCliente || '—' },
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
  { id: 'dias', label: 'Dias para criar pedido', tipo: 'numero', texto: (r) => formatDias(r.dias), valor: (r) => diasValor(r.dias) },
];
