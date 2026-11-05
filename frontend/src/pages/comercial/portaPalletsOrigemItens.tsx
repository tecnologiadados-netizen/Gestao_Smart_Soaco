import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { ItemPedidoGerado, LinhaPedidoGerado, LinhaPropostaItem } from '../../api/portaPalletsComercial';
import { formatMoeda } from '../../components/painel-comercial/painelComercialUtils';
import type { SortLevel } from '../../hooks/useGradeFiltrosExcel';
import GradePortaPallets, { type ColunaGrade } from './GradePortaPallets';
import { formatData, formatDias, labelMes, simNao } from './portaPalletsComercialFormat';

export type PropostaAgrupada = {
  idProposta: number;
  codigoProposta: string;
  dataAbertura: string;
  mes: string;
  cnpj: string;
  vendedor: string;
  cliente: string;
  valor: number;
  observacaoProposta: string;
  propostaConvertida: boolean;
  codigosPedido: string;
  dias: number | null;
  itens: LinhaPropostaItem[];
};

function dataTexto(iso: string): string {
  return iso ? formatData(iso) : '—';
}

function diasValor(v: number | null): number {
  return v == null ? Number.NaN : v;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Uma linha por proposta. O valor é a soma dos itens, que abrem no segundo modal. */
export function agruparPropostas(rows: LinhaPropostaItem[]): PropostaAgrupada[] {
  const map = new Map<number, PropostaAgrupada>();
  for (const item of rows) {
    let atual = map.get(item.idProposta);
    if (!atual) {
      atual = {
        idProposta: item.idProposta,
        codigoProposta: item.codigoProposta,
        dataAbertura: item.dataAbertura,
        mes: item.mes,
        cnpj: item.cnpj,
        vendedor: item.vendedor,
        cliente: item.cliente,
        valor: 0,
        observacaoProposta: item.observacaoProposta,
        propostaConvertida: item.propostaConvertida,
        codigosPedido: '',
        dias: item.dias,
        itens: [],
      };
      map.set(item.idProposta, atual);
    }
    atual.valor += item.valor;
    atual.itens.push(item);
    if (!atual.observacaoProposta && item.observacaoProposta) atual.observacaoProposta = item.observacaoProposta;
    if (item.codigosPedido) {
      const codigos = new Set(atual.codigosPedido.split(', ').filter(Boolean));
      for (const codigo of item.codigosPedido.split(', ')) if (codigo) codigos.add(codigo);
      atual.codigosPedido = [...codigos].join(', ');
    }
  }
  for (const linha of map.values()) {
    linha.valor = round2(linha.valor);
    linha.itens.sort((a, b) => a.codigoProduto.localeCompare(b.codigoProduto, 'pt-BR') || a.idItem - b.idItem);
  }
  return [...map.values()];
}

function botaoDocumento(texto: string, onClick: () => void) {
  return (
    <button
      type="button"
      title="Ver itens"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="font-semibold text-primary-600 hover:underline dark:text-primary-400"
    >
      {texto}
    </button>
  );
}

function cortado(texto: string, largura: string) {
  return (
    <span title={texto} className={`block truncate ${largura}`}>
      {texto}
    </span>
  );
}

const COLUNAS_ITENS_PROPOSTA: ColunaGrade<LinhaPropostaItem>[] = [
  { id: 'produto', label: 'Produto', texto: (r) => r.codigoProduto },
  { id: 'descricao', label: 'Descrição', texto: (r) => r.descricaoProduto, className: 'max-w-[320px] truncate' },
  { id: 'valor', label: 'Valor', tipo: 'moeda', texto: (r) => formatMoeda(r.valor), valor: (r) => r.valor, total: true },
  { id: 'status', label: 'Status', texto: (r) => r.statusLabel },
  { id: 'motivo', label: 'Motivo da rejeição', texto: (r) => r.motivoRejeicao || '—' },
];

const COLUNAS_ITENS_PEDIDO: ColunaGrade<ItemPedidoGerado>[] = [
  { id: 'produto', label: 'Produto', texto: (r) => r.codigoProduto },
  {
    id: 'descricao',
    label: 'Descrição',
    texto: (r) => r.descricaoProduto,
    className: 'max-w-[360px] truncate',
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

function colunasProposta(compacta: boolean, abrir: (row: PropostaAgrupada) => void): ColunaGrade<PropostaAgrupada>[] {
  const proposta: ColunaGrade<PropostaAgrupada> = {
    id: 'proposta',
    label: 'Proposta',
    texto: (r) => r.codigoProposta,
    render: (r) => botaoDocumento(r.codigoProposta, () => abrir(r)),
  };
  const abertura: ColunaGrade<PropostaAgrupada> = {
    id: 'abertura',
    label: 'Abertura',
    tipo: 'data',
    texto: (r) => dataTexto(r.dataAbertura),
    valor: (r) => r.dataAbertura,
  };
  const valor: ColunaGrade<PropostaAgrupada> = {
    id: 'valor',
    label: 'Valor',
    tipo: 'moeda',
    texto: (r) => formatMoeda(r.valor),
    valor: (r) => r.valor,
    total: true,
  };
  const pedido: ColunaGrade<PropostaAgrupada> = {
    id: 'pedido',
    label: 'Pedido',
    texto: (r) => r.codigosPedido || '—',
  };
  if (compacta) {
    return [
      proposta,
      abertura,
      {
        id: 'cliente',
        label: 'Cliente',
        texto: (r) => r.cliente,
        render: (r) => cortado(r.cliente, 'max-w-[220px]'),
      },
      valor,
      pedido,
      {
        id: 'observacao',
        label: 'Observação',
        texto: (r) => r.observacaoProposta || '—',
        render: (r) => cortado(r.observacaoProposta || '—', 'max-w-[260px]'),
      },
    ];
  }
  return [
    { id: 'mes', label: 'Mês', texto: (r) => labelMes(r.mes), valor: (r) => r.mes },
    proposta,
    abertura,
    { id: 'cnpj', label: 'CNPJ', texto: (r) => r.cnpj || '—' },
    { id: 'vendedor', label: 'Vendedor', texto: (r) => r.vendedor || '—' },
    { id: 'cliente', label: 'Cliente', texto: (r) => r.cliente },
    valor,
    {
      id: 'observacao',
      label: 'Observação da proposta',
      texto: (r) => r.observacaoProposta || '—',
      render: (r) => cortado(r.observacaoProposta || '—', 'max-w-[280px]'),
    },
    { id: 'convertida', label: 'Convertida', texto: (r) => simNao(r.propostaConvertida) },
    pedido,
    {
      id: 'dias',
      label: 'Dias para criar pedido',
      tipo: 'numero',
      texto: (r) => formatDias(r.dias),
      valor: (r) => diasValor(r.dias),
    },
  ];
}

function colunasPedido(
  compacta: boolean,
  abrir: (row: LinhaPedidoGerado) => void
): ColunaGrade<LinhaPedidoGerado>[] {
  const pedido: ColunaGrade<LinhaPedidoGerado> = {
    id: 'pedido',
    label: 'Pedido',
    texto: (r) => r.codigoPedido,
    render: (r) => botaoDocumento(r.codigoPedido, () => abrir(r)),
  };
  const emissao: ColunaGrade<LinhaPedidoGerado> = {
    id: 'emissao',
    label: 'Emissão',
    tipo: 'data',
    texto: (r) => dataTexto(r.dataEmissao),
    valor: (r) => r.dataEmissao,
  };
  const valor: ColunaGrade<LinhaPedidoGerado> = {
    id: 'valor',
    label: 'Valor vendido',
    tipo: 'moeda',
    texto: (r) => formatMoeda(r.valorVendido),
    valor: (r) => r.valorVendido,
    total: true,
  };
  const origem: ColunaGrade<LinhaPedidoGerado> = {
    id: 'origem',
    label: 'Proposta de origem',
    texto: (r) => r.propostasOrigem,
  };
  if (compacta) {
    return [
      pedido,
      emissao,
      {
        id: 'cliente',
        label: 'Cliente',
        texto: (r) => r.cliente,
        render: (r) => cortado(r.cliente, 'max-w-[280px]'),
      },
      origem,
      valor,
    ];
  }
  return [
    pedido,
    emissao,
    { id: 'cnpj', label: 'CNPJ', texto: (r) => r.cnpj || '—' },
    { id: 'vendedor', label: 'Vendedor', texto: (r) => r.vendedor || '—' },
    { id: 'cliente', label: 'Cliente', texto: (r) => r.cliente },
    origem,
    valor,
  ];
}

type GradeOrigemProps = {
  tituloExportacao: string;
  compacta?: boolean;
  defaultSortLevels: SortLevel[];
};

export function GradePropostasOrigem({
  rows,
  tituloExportacao,
  compacta = false,
  defaultSortLevels,
}: GradeOrigemProps & { rows: LinhaPropostaItem[] }) {
  const grupos = useMemo(() => agruparPropostas(rows), [rows]);
  const [aberta, setAberta] = useState<PropostaAgrupada | null>(null);
  const colunas = useMemo(() => colunasProposta(compacta, setAberta), [compacta]);
  return (
    <>
      <GradePortaPallets
        rows={grupos}
        colunas={colunas}
        rowKey={(r) => r.idProposta}
        defaultSortLevels={defaultSortLevels}
        tituloExportacao={tituloExportacao}
        compacta={compacta}
      />
      {aberta ? (
        <ModalItensDocumento
          titulo={`Itens da proposta ${aberta.codigoProposta}`}
          subtitulo={`${aberta.cliente} · valor da proposta ${formatMoeda(aberta.valor)}`}
          onClose={() => setAberta(null)}
        >
          <GradePortaPallets
            rows={aberta.itens}
            colunas={COLUNAS_ITENS_PROPOSTA}
            rowKey={(r) => r.idItem}
            defaultSortLevels={[{ id: 'valor', dir: 'desc' }]}
            tituloExportacao={`Itens da proposta ${aberta.codigoProposta}`}
            compacta
          />
        </ModalItensDocumento>
      ) : null}
    </>
  );
}

export function GradePedidosGeradosOrigem({
  rows,
  tituloExportacao,
  compacta = false,
  defaultSortLevels,
}: GradeOrigemProps & { rows: LinhaPedidoGerado[] }) {
  const [aberto, setAberto] = useState<LinhaPedidoGerado | null>(null);
  const colunas = useMemo(() => colunasPedido(compacta, setAberto), [compacta]);
  const itens = aberto?.itens ?? [];
  return (
    <>
      <GradePortaPallets
        rows={rows}
        colunas={colunas}
        rowKey={(r) => r.idPedido}
        defaultSortLevels={defaultSortLevels}
        tituloExportacao={tituloExportacao}
        compacta={compacta}
      />
      {aberto ? (
        <ModalItensDocumento
          titulo={`Itens do pedido ${aberto.codigoPedido}`}
          subtitulo={`${aberto.cliente} · valor vendido ${formatMoeda(aberto.valorVendido)}`}
          onClose={() => setAberto(null)}
        >
          {itens.length === 0 ? (
            <p className="py-8 text-sm text-slate-500">Nenhum item de porta-pallet neste pedido.</p>
          ) : (
            <GradePortaPallets
              rows={itens}
              colunas={COLUNAS_ITENS_PEDIDO}
              rowKey={(r) => r.idItem}
              defaultSortLevels={[{ id: 'valor', dir: 'desc' }]}
              tituloExportacao={`Itens do pedido ${aberto.codigoPedido}`}
              compacta
            />
          )}
        </ModalItensDocumento>
      ) : null}
    </>
  );
}

function ModalItensDocumento({
  titulo,
  subtitulo,
  onClose,
  children,
}: {
  titulo: string;
  subtitulo: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10080] flex items-center justify-center bg-black/75 p-3 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[min(88vh,760px)] w-full max-w-4xl min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="porta-pallets-itens-titulo"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-600">
          <div className="min-w-0">
            <h2 id="porta-pallets-itens-titulo" className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              {titulo}
            </h2>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{subtitulo}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600"
            aria-label="Fechar itens"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
