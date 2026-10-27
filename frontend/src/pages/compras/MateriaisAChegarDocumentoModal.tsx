import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import ModalConsultaEstoqueDetalhe, { fmtQtde } from '../../components/pcp/ModalConsultaEstoqueDetalhe';
import ModalAlterarDataEntregaCompra, {
  type ItemAlterarDataEntregaCompra,
} from '../../components/ModalAlterarDataEntregaCompra';
import {
  alterarDataEntregaMateriaisAChegar,
  obterDocumentoAcompanhamento,
  type DocumentoAcompanhamento,
  type EscopoDocumentoAcompanhamento,
  type ItemDocumentoAcompanhamento,
  type RefDocumento,
  type StatusItemDocumento,
  type StatusNomusItemPedidoCompra,
  type TipoDocumentoAcompanhamento,
} from '../../api/acompanhamentoSolicitacao';
import PrazoEntregaBadge from './PrazoEntregaBadge';

export type AlvoDocumento = {
  tipo: TipoDocumentoAcompanhamento;
  id: number;
  numero: string;
  /** Produto de onde o usuário veio, destacado na lista. */
  idProdutoOrigem?: number;
  /** Na aba de datas, mostra somente os status aceitos por essa consulta. */
  escopo?: EscopoDocumentoAcompanhamento;
};

type Props = {
  alvo: AlvoDocumento | null;
  cacheRef: MutableRefObject<Map<string, DocumentoAcompanhamento>>;
  /** Documento anterior na navegação, para o botão Voltar. */
  anterior: AlvoDocumento | null;
  /** Permissão "Materiais a chegar — alterar datas de entrega". */
  podeAlterarData: boolean;
  onVoltar: () => void;
  onAbrirDocumento: (alvo: AlvoDocumento) => void;
  onVerNaGrade: (codigo: string) => void;
  onFiltrarGrade: (tipo: TipoDocumentoAcompanhamento, numero: string) => void;
  onDataEntregaAlterada: () => void;
  onClose: () => void;
};

const Z_MODAL = 14030;

const TITULO_TIPO: Record<TipoDocumentoAcompanhamento, string> = {
  pedido: 'Pedido de compra',
  pre_entrada: 'Pré-entrada',
};

const CLASSE_LINK =
  'font-medium text-sky-700 underline decoration-dotted underline-offset-2 hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-100';

const CLASSE_FORA =
  'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-500 dark:bg-slate-700/60 dark:text-slate-100';

const STATUS: Record<StatusItemDocumento, { rotulo: string; dica: string; classe: string; naGrade: boolean }> = {
  comprado: {
    rotulo: 'Comprado',
    dica: 'Pedido em aberto com saldo. Soma na etapa Comprado da grade.',
    classe: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/60 dark:bg-amber-500/15 dark:text-amber-100',
    naGrade: true,
  },
  pre_entrada: {
    rotulo: 'Pré-entrada',
    dica: 'Pedido atendido com documento 173. Soma na etapa Pré-entrada da grade.',
    classe: 'border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-500/60 dark:bg-violet-500/20 dark:text-violet-100',
    naGrade: true,
  },
  aberto_fora_grade: {
    rotulo: 'Em aberto, sem solicitação',
    dica: 'Saldo a receber, mas sem solicitação da empresa vinculada. Fica fora da grade.',
    classe: CLASSE_FORA,
    naGrade: false,
  },
  pre_entrada_fora_grade: {
    rotulo: 'Pré-entrada, pedido não atendido',
    dica: 'Documento ainda é pré-entrada, mas o item do pedido não está atendido (ou não tem pedido). Fica fora da grade.',
    classe: CLASSE_FORA,
    naGrade: false,
  },
  encerrado: {
    rotulo: 'Encerrado com saldo',
    dica: 'Item encerrado no pedido sem receber tudo. Fica fora da grade.',
    classe: CLASSE_FORA,
    naGrade: false,
  },
  recebido: {
    rotulo: 'Recebido',
    dica: 'Material já entrou (documento efetivado ou pedido atendido sem pré-entrada). Fica fora da grade.',
    classe: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/60 dark:bg-emerald-500/15 dark:text-emerald-100',
    naGrade: false,
  },
  cancelado: {
    rotulo: 'Cancelado / corte',
    dica: 'Item cancelado ou cortado no pedido. Fica fora da grade.',
    classe: 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/50 dark:bg-red-500/15 dark:text-red-200',
    naGrade: false,
  },
};

const ORDEM_STATUS: StatusItemDocumento[] = [
  'comprado',
  'pre_entrada',
  'aberto_fora_grade',
  'pre_entrada_fora_grade',
  'encerrado',
  'recebido',
  'cancelado',
];

const STATUS_NOMUS: Record<StatusNomusItemPedidoCompra, { rotulo: string; dica: string; classe: string }> = {
  'Atendido totalmente': {
    rotulo: 'Atendido totalmente',
    dica: 'Status atual do item no pedido de compra do Nomus.',
    classe: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/60 dark:bg-emerald-500/15 dark:text-emerald-100',
  },
  Liberado: {
    rotulo: 'Liberado',
    dica: 'Status atual do item no pedido de compra do Nomus.',
    classe: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/60 dark:bg-amber-500/15 dark:text-amber-100',
  },
  'Aguardando liberação': {
    rotulo: 'Aguardando liberação',
    dica: 'Status atual do item no pedido de compra do Nomus.',
    classe: 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-500 dark:bg-slate-700/60 dark:text-slate-100',
  },
  'Atendido parcialmente': {
    rotulo: 'Atendido parcialmente',
    dica: 'Status atual do item no pedido de compra do Nomus.',
    classe: 'border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-500/60 dark:bg-orange-500/15 dark:text-orange-100',
  },
  'Atendido com corte': {
    rotulo: 'Atendido com corte',
    dica: 'Status atual do item no pedido de compra do Nomus.',
    classe: 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/50 dark:bg-red-500/15 dark:text-red-200',
  },
  Cancelado: {
    rotulo: 'Cancelado',
    dica: 'Status atual do item no pedido de compra do Nomus.',
    classe: 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/50 dark:bg-red-500/15 dark:text-red-200',
  },
  Desconhecido: {
    rotulo: 'Desconhecido',
    dica: 'Código de status não reconhecido no item do pedido de compra do Nomus.',
    classe: CLASSE_FORA,
  },
};

const ORDEM_STATUS_NOMUS: StatusNomusItemPedidoCompra[] = [
  'Liberado',
  'Atendido parcialmente',
  'Atendido totalmente',
  'Aguardando liberação',
  'Atendido com corte',
  'Cancelado',
  'Desconhecido',
];

function configStatusExibido(item: ItemDocumentoAcompanhamento, ehPedido: boolean) {
  if (ehPedido && item.statusNomus) return STATUS_NOMUS[item.statusNomus];
  return STATUS[item.status];
}

function chave(alvo: AlvoDocumento): string {
  return `${alvo.tipo}:${alvo.id}:${alvo.escopo ?? 'completo'}`;
}

function celula(valor: string | null | undefined): string {
  const t = valor?.trim();
  return t ? t : '—';
}

function LinksDocumento({
  refs,
  tipo,
  onAbrir,
}: {
  refs: RefDocumento[];
  tipo: TipoDocumentoAcompanhamento;
  onAbrir: (alvo: AlvoDocumento) => void;
}) {
  if (refs.length === 0) return <>—</>;
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-0.5">
      {refs.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onAbrir({ tipo, id: r.id, numero: r.numero })}
          className={CLASSE_LINK}
          title={`Abrir ${TITULO_TIPO[tipo].toLowerCase()} ${r.numero}`}
        >
          {r.numero}
        </button>
      ))}
    </span>
  );
}

export default function MateriaisAChegarDocumentoModal({
  alvo,
  cacheRef,
  anterior,
  podeAlterarData,
  onVoltar,
  onAbrirDocumento,
  onVerNaGrade,
  onFiltrarGrade,
  onDataEntregaAlterada,
  onClose,
}: Props) {
  const [resultado, setResultado] = useState<{
    key: string;
    documento: DocumentoAcompanhamento;
  } | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [alterarItem, setAlterarItem] = useState<ItemAlterarDataEntregaCompra | null>(null);
  const linhaOrigemRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    setAlterarItem(null);
  }, [alvo?.tipo, alvo?.id, alvo?.escopo]);

  const onLoad = useCallback(async () => {
    if (!alvo) return {};
    const key = chave(alvo);
    const cached = cacheRef.current.get(key);
    if (cached) {
      setResultado({ key, documento: cached });
      return {};
    }
    const r = await obterDocumentoAcompanhamento(alvo.tipo, alvo.id, alvo.escopo);
    if (r.error || !r.documento) return { error: r.error ?? 'Não foi possível carregar o documento.' };
    cacheRef.current.set(key, r.documento);
    setResultado({ key, documento: r.documento });
    return {};
  }, [alvo, cacheRef]);

  const doc = alvo && resultado?.key === chave(alvo) ? resultado.documento : null;

  useEffect(() => {
    if (!doc) return;
    const t = setTimeout(() => linhaOrigemRef.current?.scrollIntoView({ block: 'nearest' }), 0);
    return () => clearTimeout(t);
  }, [doc]);

  const contagem = useMemo(() => {
    if (doc?.tipo === 'pedido') {
      const mapa = new Map<StatusNomusItemPedidoCompra, number>();
      for (const item of doc.itens) {
        if (!item.statusNomus) continue;
        mapa.set(item.statusNomus, (mapa.get(item.statusNomus) ?? 0) + 1);
      }
      return ORDEM_STATUS_NOMUS.filter((s) => mapa.has(s)).map((s) => ({
        chave: s,
        qtde: mapa.get(s) ?? 0,
        ...STATUS_NOMUS[s],
      }));
    }
    const mapa = new Map<StatusItemDocumento, number>();
    for (const item of doc?.itens ?? []) mapa.set(item.status, (mapa.get(item.status) ?? 0) + 1);
    return ORDEM_STATUS.filter((s) => mapa.has(s)).map((s) => ({
      chave: s,
      qtde: mapa.get(s) ?? 0,
      ...STATUS[s],
    }));
  }, [doc]);

  const alertasData = useMemo(() => (doc?.itens ?? []).filter((i) => i.alertaDataEntrega).length, [doc]);

  const onDataSalva = useCallback(() => {
    if (alvo) cacheRef.current.delete(chave(alvo));
    setRecarga((r) => r + 1);
    onDataEntregaAlterada();
  }, [alvo, cacheRef, onDataEntregaAlterada]);

  const ehPedido = alvo?.tipo === 'pedido';
  const titulo = alvo ? `${TITULO_TIPO[alvo.tipo]} ${doc?.numero ?? alvo.numero}` : '';
  const subtitulo = doc
    ? [
        doc.fornecedor ? `Fornecedor: ${doc.fornecedor}` : null,
        doc.dataEmissao ? `${ehPedido ? 'Emissão' : 'Emissão da NF'}: ${doc.dataEmissao}` : null,
        doc.numeroNfe ? `NF-e: ${doc.numeroNfe}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : alvo?.escopo === 'datas_entrega'
      ? 'Itens Liberados, Atendidos parcialmente ou Atendidos totalmente com pré-entrada.'
      : 'Todos os itens do documento e onde cada um está no caminho.';

  return (
    <>
      <ModalConsultaEstoqueDetalhe
        open={alvo != null}
        detailKey={alvo ? `doc-${chave(alvo)}-${recarga}` : null}
        titulo={titulo}
        subtitulo={subtitulo}
        onClose={onClose}
        onLoad={onLoad}
        largo
        backdropMode="fixed"
        zIndex={Z_MODAL}
      >
        {({ carregando, erro }) => {
          if (erro) return <p className="text-sm text-red-600">{erro}</p>;
          if (carregando || !doc || !alvo) return <p className="text-sm text-slate-500">Carregando documento…</p>;
          return (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {anterior ? (
                  <button
                    type="button"
                    onClick={onVoltar}
                    className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    ← {TITULO_TIPO[anterior.tipo]} {anterior.numero}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onFiltrarGrade(doc.tipo, doc.numero)}
                  className="rounded-lg border border-sky-600 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-100 dark:border-sky-500 dark:bg-sky-500/15 dark:text-sky-100 dark:hover:bg-sky-500/25"
                  title={`Fecha os modais e filtra a grade por ${ehPedido ? 'este pedido' : 'este documento'}`}
                >
                  Filtrar a grade por {ehPedido ? 'este pedido' : 'este documento'}
                </button>
                {doc.efetivado ? (
                  <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-500/60 dark:bg-emerald-500/15 dark:text-emerald-100">
                    Documento já efetivado (não é mais pré-entrada)
                  </span>
                ) : null}
                {alertasData > 0 ? (
                  <span
                    className="rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-800 dark:border-red-500/60 dark:bg-red-500/15 dark:text-red-200"
                    title="Itens com entrega atrasada, sem data ou vencendo nos próximos 7 dias"
                  >
                    {alertasData} {alertasData === 1 ? 'item' : 'itens'} com data de entrega a atualizar
                  </span>
                ) : null}
                <span className="ml-auto flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400">
                    {doc.itens.length} {doc.itens.length === 1 ? 'item' : 'itens'}:
                  </span>
                  {contagem.map((c) => (
                    <span
                      key={c.chave}
                      className={`rounded-full border px-2 py-0.5 font-medium ${c.classe}`}
                      title={c.dica}
                    >
                      {c.qtde} {c.rotulo.toLowerCase()}
                    </span>
                  ))}
                </span>
              </div>

              {doc.itens.length === 0 ? (
                <p className="text-sm text-slate-500">Documento sem itens.</p>
              ) : (
                <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                    <thead className="sticky top-0 z-[1] bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                      <tr>
                        <th className="px-3 py-2 font-medium">Produto</th>
                        <th className="px-2 py-2 font-medium">Status</th>
                        <th className="px-2 py-2 text-right font-medium">{ehPedido ? 'Pedido' : 'Qtde'}</th>
                        {ehPedido ? (
                          <>
                            <th className="px-2 py-2 text-right font-medium">Atendido</th>
                            <th className="px-2 py-2 text-right font-medium">Saldo</th>
                            <th className="px-2 py-2 font-medium">Entrega</th>
                          </>
                        ) : null}
                        <th className="px-2 py-2 font-medium">Solicitação</th>
                        <th className="px-2 py-2 font-medium">{ehPedido ? 'Pré-entrada' : 'Pedido'}</th>
                        <th className="px-2 py-2 text-right font-medium" title="Quantidade que o item soma na grade">
                          Em caminho
                        </th>
                        <th className="px-2 py-2" aria-label="Ações" />
                      </tr>
                    </thead>
                    <tbody>
                      {doc.itens.map((item) => {
                        const st = configStatusExibido(item, ehPedido);
                        const origem = alvo.idProdutoOrigem != null && item.idProduto === alvo.idProdutoOrigem;
                        return (
                          <tr
                            key={item.idItem}
                            ref={origem ? linhaOrigemRef : undefined}
                            className={`border-t align-top ${
                              origem
                                ? 'border-sky-300 bg-sky-50 dark:border-sky-500/40 dark:bg-sky-500/[0.12]'
                                : 'border-slate-100 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/30'
                            }`}
                          >
                            <td
                              className={`px-3 py-2 ${origem ? 'border-l-4 border-l-sky-500' : 'border-l-4 border-l-transparent'}`}
                              title={item.descricao}
                            >
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold text-slate-900 dark:text-slate-50">{item.codigo}</span>
                                {item.unidadeMedida ? (
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400">{item.unidadeMedida}</span>
                                ) : null}
                                {origem ? (
                                  <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                                    Pesquisado
                                  </span>
                                ) : null}
                              </div>
                              <span
                                className={`mt-0.5 block max-w-[24rem] truncate text-xs ${
                                  origem ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {item.descricao}
                              </span>
                            </td>
                            <td className="px-2 py-2">
                              <span
                                className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${st.classe}`}
                                title={st.dica}
                              >
                                {st.rotulo}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums">{fmtQtde(item.qtde)}</td>
                            {ehPedido ? (
                              <>
                                <td className="px-2 py-2 text-right tabular-nums">{fmtQtde(item.qtdeAtendida ?? 0)}</td>
                                <td className="px-2 py-2 text-right tabular-nums">{fmtQtde(item.saldo ?? 0)}</td>
                                <td className="px-2 py-2">
                                  <span className="block whitespace-nowrap">{celula(item.dataEntrega)}</span>
                                  {item.alertaDataEntrega ? (
                                    <span className="mt-1 block">
                                      <PrazoEntregaBadge dias={item.diasEntrega} />
                                    </span>
                                  ) : null}
                                </td>
                              </>
                            ) : null}
                            <td className="px-2 py-2">{celula(item.solicitacoes)}</td>
                            <td className="px-2 py-2">
                              {ehPedido ? (
                                <LinksDocumento
                                  refs={item.preEntradas}
                                  tipo="pre_entrada"
                                  onAbrir={(a) => onAbrirDocumento({ ...a, idProdutoOrigem: item.idProduto })}
                                />
                              ) : (
                                <LinksDocumento
                                  refs={item.pedidos}
                                  tipo="pedido"
                                  onAbrir={(a) => onAbrirDocumento({ ...a, idProdutoOrigem: item.idProduto })}
                                />
                              )}
                            </td>
                            <td className="px-2 py-2 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                              {st.naGrade ? fmtQtde(item.qtdeCaminho) : '—'}
                            </td>
                            <td className="px-2 py-2 text-right">
                              <div className="flex flex-col items-end gap-1">
                                {ehPedido && item.alertaDataEntrega && podeAlterarData ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setAlterarItem({
                                        idItemPedidoCompra: item.idItem,
                                        pedido: doc.numero,
                                        codigoProduto: item.codigo,
                                        descricaoProduto: item.descricao,
                                        dataEntrega: item.dataEntregaYmd ?? '',
                                      })
                                    }
                                    className="whitespace-nowrap rounded border border-red-400 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-800 hover:bg-red-100 dark:border-red-500/60 dark:bg-red-500/15 dark:text-red-100 dark:hover:bg-red-500/25"
                                    title="Atualizar a data de entrega deste item no Nomus"
                                  >
                                    Alterar data
                                  </button>
                                ) : null}
                                {st.naGrade ? (
                                  <button
                                    type="button"
                                    onClick={() => onVerNaGrade(item.codigo)}
                                    className="whitespace-nowrap rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                                    title="Fecha os modais e filtra a grade por este código"
                                  >
                                    Ver na grade
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                {ehPedido
                  ? 'Status é a situação atual do item no pedido de compra do Nomus. '
                  : 'Status indica onde o item da pré-entrada está no caminho. '}
                Em caminho é o que o item soma na etapa da grade, pela mesma regra.
                {ehPedido && alertasData > 0 && !podeAlterarData
                  ? ' Para alterar a data de entrega é preciso a permissão "Materiais a chegar — alterar datas de entrega".'
                  : ''}
              </p>
            </div>
          );
        }}
      </ModalConsultaEstoqueDetalhe>
      <ModalAlterarDataEntregaCompra
        item={alterarItem}
        podeEditar={podeAlterarData}
        podeGerenciarMotivos={false}
        salvar={alterarDataEntregaMateriaisAChegar}
        zIndex={Z_MODAL + 20}
        onClose={() => setAlterarItem(null)}
        onSalvo={onDataSalva}
      />
    </>
  );
}
