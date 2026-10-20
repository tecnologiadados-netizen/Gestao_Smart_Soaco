import { Fragment, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Pencil, X } from 'lucide-react';
import type { DetalheItemGondola, ItemCarteiraGondola, SetorGondola } from '../../../api/gondolasPortaPaletes';
import { salvarMedidaPecaGondola } from '../../../api/gondolasPortaPaletes';
import { criarMatcherTextoLivre, PLACEHOLDER_BUSCA_TEXTO_LIVRE } from '../../../utils/textoLivreBusca';

function fmt(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function chaveMedida(codigo: string): string {
  let texto = codigo.toUpperCase().trim().replace(/\s+/g, ' ');
  const ponto = texto.indexOf('.');
  if (ponto !== -1) texto = texto.slice(0, ponto).trim();
  return texto;
}

type PecaLinha = {
  chave: string;
  idItem: number;
  pedido: string;
  cliente: string;
  codigoItem: string;
  descricaoItem: string;
  descricao: string;
  codigo: string;
  materiaPrima: string;
  medida01: string;
  medida02: string;
  quantidadeTotal: number;
  origem: DetalheItemGondola['origem'];
};

function pecasDoDetalhe(detalhe: DetalheItemGondola): PecaLinha[] {
  return detalhe.componentes.map((componente, indice) => ({
    chave: `${detalhe.item.idItem}|${indice}`,
    idItem: detalhe.item.idItem,
    pedido: detalhe.item.pedido,
    cliente: detalhe.item.cliente,
    codigoItem: detalhe.item.codigo,
    descricaoItem: detalhe.item.descricao,
    descricao: componente.descricao || componente.codigo || '—',
    codigo: componente.codigo,
    materiaPrima: componente.materiaPrima,
    medida01: componente.medida01,
    medida02: componente.medida02,
    quantidadeTotal: componente.quantidadeTotal,
    origem: detalhe.origem,
  }));
}

export default function ModalGerarOrdem({
  aberto,
  itens,
  gerando,
  erro,
  onClose,
  carregarFicha,
  onMedidasSalvas,
  onGerar,
}: {
  aberto: boolean;
  itens: ItemCarteiraGondola[];
  gerando: boolean;
  erro: string | null;
  onClose: () => void;
  carregarFicha: (item: ItemCarteiraGondola) => Promise<DetalheItemGondola>;
  onMedidasSalvas: (codigo: string, medida01: string, medida02: string) => void;
  onGerar: (detalhes: DetalheItemGondola[]) => void;
}) {
  const [setor, setSetor] = useState<SetorGondola | null>(null);
  const [busca, setBusca] = useState('');
  const [detalhes, setDetalhes] = useState<DetalheItemGondola[]>([]);
  const [carregandoPecas, setCarregandoPecas] = useState(false);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState({ medida01: '', medida02: '' });
  const [salvandoMedida, setSalvandoMedida] = useState(false);
  const [erroMedida, setErroMedida] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setSetor(null);
    setBusca('');
    setDetalhes([]);
    setMarcados(new Set());
    setErroCarga(null);
    setEditando(null);
    setErroMedida(null);
  }, [aberto]);

  const doSetor = useMemo(
    () => (setor ? itens.filter((item) => item.setor === setor) : []),
    [itens, setor]
  );

  useEffect(() => {
    if (!setor || doSetor.length === 0) {
      setDetalhes([]);
      setMarcados(new Set());
      setCarregandoPecas(false);
      return;
    }
    let cancelado = false;
    setCarregandoPecas(true);
    setErroCarga(null);
    void Promise.all(doSetor.map((item) => carregarFicha(item)))
      .then((lista) => {
        if (cancelado) return;
        setDetalhes(lista);
        setMarcados(new Set(lista.flatMap((detalhe) => pecasDoDetalhe(detalhe).map((peca) => peca.chave))));
      })
      .catch((e: unknown) => {
        if (cancelado) return;
        setDetalhes([]);
        setErroCarga(e instanceof Error ? e.message : 'Erro ao abrir as fichas.');
      })
      .finally(() => {
        if (!cancelado) setCarregandoPecas(false);
      });
    return () => {
      cancelado = true;
    };
  }, [setor, doSetor, carregarFicha]);

  const pecas = useMemo(() => detalhes.flatMap(pecasDoDetalhe), [detalhes]);

  const pecasVisiveis = useMemo(() => {
    const match = criarMatcherTextoLivre(busca);
    return pecas.filter(
      (peca) =>
        match(peca.pedido) ||
        match(peca.cliente) ||
        match(peca.codigoItem) ||
        match(peca.descricaoItem) ||
        match(peca.descricao) ||
        match(peca.materiaPrima)
    );
  }, [pecas, busca]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, { pedido: string; cliente: string; itens: Map<number, { codigo: string; descricao: string; pecas: PecaLinha[] }> }>();
    for (const peca of pecasVisiveis) {
      let grupo = mapa.get(peca.pedido);
      if (!grupo) {
        grupo = { pedido: peca.pedido, cliente: peca.cliente, itens: new Map() };
        mapa.set(peca.pedido, grupo);
      }
      let item = grupo.itens.get(peca.idItem);
      if (!item) {
        item = { codigo: peca.codigoItem, descricao: peca.descricaoItem, pecas: [] };
        grupo.itens.set(peca.idItem, item);
      }
      item.pecas.push(peca);
    }
    return [...mapa.values()];
  }, [pecasVisiveis]);

  if (!aberto) return null;

  const gondolas = itens.filter((item) => item.setor === 'Gôndolas').length;
  const portaPaletes = itens.filter((item) => item.setor === 'Porta Paletes').length;
  const todosVisiveis = pecasVisiveis.length > 0 && pecasVisiveis.every((peca) => marcados.has(peca.chave));

  function alternar(chave: string) {
    setMarcados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(chave)) proximo.delete(chave);
      else proximo.add(chave);
      return proximo;
    });
  }

  function alternarVarias(chaves: string[], marcar: boolean) {
    setMarcados((atual) => {
      const proximo = new Set(atual);
      chaves.forEach((chave) => {
        if (marcar) proximo.add(chave);
        else proximo.delete(chave);
      });
      return proximo;
    });
  }

  async function salvarMedidas(peca: PecaLinha) {
    if (!peca.codigo.trim()) {
      setErroMedida('Esta peça não tem código para guardar a medida.');
      return;
    }
    setSalvandoMedida(true);
    setErroMedida(null);
    try {
      const salva = await salvarMedidaPecaGondola(peca.codigo, rascunho.medida01, rascunho.medida02);
      const alvo = chaveMedida(peca.codigo);
      setDetalhes((atual) =>
        atual.map((detalhe) =>
          detalhe.origem !== 'nomus'
            ? detalhe
            : {
                ...detalhe,
                componentes: detalhe.componentes.map((componente) =>
                  chaveMedida(componente.codigo) === alvo
                    ? { ...componente, medida01: salva.medida01, medida02: salva.medida02 }
                    : componente
                ),
              }
        )
      );
      onMedidasSalvas(peca.codigo, salva.medida01, salva.medida02);
      setEditando(null);
    } catch (e) {
      setErroMedida(e instanceof Error ? e.message : 'Erro ao guardar as medidas.');
    } finally {
      setSalvandoMedida(false);
    }
  }

  function confirmar() {
    const escolhidos = detalhes
      .map((detalhe) => ({
        ...detalhe,
        componentes: detalhe.componentes.filter((_, indice) => marcados.has(`${detalhe.item.idItem}|${indice}`)),
      }))
      .filter((detalhe) => detalhe.componentes.length > 0);
    onGerar(escolhidos);
  }

  return createPortal(
    <div className="fixed inset-0 z-[14000] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-soaco-gray/35 bg-white shadow-xl dark:bg-soaco-graphite"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-gerar-ordem"
      >
        <div className="flex items-start justify-between gap-4 border-b border-soaco-gray/35 bg-soaco-navy px-5 py-4 text-white">
          <div>
            <h2 id="titulo-gerar-ordem" className="text-xl font-semibold tracking-tight">
              Gerar ordem de produção
            </h2>
            <p className="mt-1 text-sm text-white/75">
              {setor
                ? `${setor}. Cada pedido lista as peças da ficha. Todas entram marcadas.`
                : 'Escolha o setor da ordem antes de ver os pedidos e as peças.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {setor == null ? (
          <div className="grid gap-3 px-5 py-6 sm:grid-cols-2">
            {(
              [
                ['Gôndolas', gondolas],
                ['Porta Paletes', portaPaletes],
              ] as const
            ).map(([nome, quantidade]) => (
              <button
                key={nome}
                type="button"
                onClick={() => setSetor(nome)}
                className="rounded-xl border border-soaco-gray/35 px-4 py-5 text-left transition hover:bg-slate-50 dark:hover:bg-soaco-navy/60"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  {nome === 'Porta Paletes' ? 'Porta-paletes' : nome}
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
                  {quantidade.toLocaleString('pt-BR')}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">itens com ficha</p>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-soaco-gray/25 px-5 py-3">
              <input
                className="input-app h-10 min-w-[16rem] flex-1 dark:bg-black"
                value={busca}
                placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
                aria-label="Buscar pedido ou peça"
                onChange={(e) => setBusca(e.target.value)}
              />
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {marcados.size.toLocaleString('pt-BR')} de {pecas.length.toLocaleString('pt-BR')} peças marcadas
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {carregandoPecas ? (
                <p className="px-5 py-8 text-center text-sm text-slate-500">Abrindo as fichas dos pedidos…</p>
              ) : erroCarga ? (
                <p className="px-5 py-8 text-center text-sm text-red-600 dark:text-red-300">{erroCarga}</p>
              ) : pecas.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-500">Nenhuma peça de ficha neste setor.</p>
              ) : (
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-soaco-navy text-xs text-white">
                    <tr>
                      <th className="w-12 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={todosVisiveis}
                          onChange={() =>
                            alternarVarias(
                              pecasVisiveis.map((peca) => peca.chave),
                              !todosVisiveis
                            )
                          }
                          aria-label="Marcar ou desmarcar as peças visíveis"
                          className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                        />
                      </th>
                      <th className="px-3 py-2 font-semibold">Descrição da peça</th>
                      <th className="px-3 py-2 font-semibold">Matéria-prima</th>
                      <th className="px-3 py-2 text-right font-semibold">Medida 01</th>
                      <th className="px-3 py-2 text-right font-semibold">Medida 02</th>
                      <th className="px-3 py-2 text-right font-semibold">Qtd total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupos.map((grupo) => {
                      const chavesPedido = [...grupo.itens.values()].flatMap((item) => item.pecas.map((peca) => peca.chave));
                      const pedidoMarcado = chavesPedido.every((chave) => marcados.has(chave));
                      return (
                        <Fragment key={grupo.pedido}>
                          <tr className="bg-black/40">
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={pedidoMarcado}
                                onChange={() => alternarVarias(chavesPedido, !pedidoMarcado)}
                                aria-label={`Marcar peças do ${grupo.pedido}`}
                                className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                              />
                            </td>
                            <td colSpan={5} className="px-3 py-2 font-semibold text-white">
                              {grupo.pedido}
                              <span className="ml-2 font-normal text-slate-300">{grupo.cliente}</span>
                            </td>
                          </tr>
                          {[...grupo.itens.values()].map((item) => (
                            <Fragment key={`${grupo.pedido}-${item.codigo}`}>
                              <tr className="bg-soaco-navy/25">
                                <td />
                                <td colSpan={5} className="px-3 py-1.5 text-xs text-slate-300">
                                  <span className="font-semibold text-slate-100">{item.codigo}</span>
                                  {item.descricao ? ` · ${item.descricao}` : ''}
                                </td>
                              </tr>
                              {item.pecas.map((peca) => (
                                <tr key={peca.chave} className="border-b border-soaco-gray/20">
                                  <td className="px-3 py-2">
                                    <input
                                      type="checkbox"
                                      checked={marcados.has(peca.chave)}
                                      onChange={() => alternar(peca.chave)}
                                      aria-label={`Incluir ${peca.descricao} do ${peca.pedido}`}
                                      className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-slate-800 dark:text-slate-100">
                                    {peca.descricao}
                                    {peca.codigo && peca.codigo !== peca.descricao ? (
                                      <span className="ml-2 text-xs text-slate-400">{peca.codigo}</span>
                                    ) : null}
                                  </td>
                                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{peca.materiaPrima || '—'}</td>
                                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">
                                    {editando === peca.chave ? (
                                      <input
                                        value={rascunho.medida01}
                                        onChange={(e) => setRascunho((atual) => ({ ...atual, medida01: e.target.value }))}
                                        aria-label={`Medida 01 de ${peca.descricao}`}
                                        className="h-8 w-24 rounded border border-soaco-gray/40 bg-white px-2 text-right text-slate-900 dark:bg-black dark:text-white"
                                      />
                                    ) : (
                                      peca.medida01 || '—'
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">
                                    {editando === peca.chave ? (
                                      <span className="inline-flex items-center justify-end gap-1">
                                        <input
                                          value={rascunho.medida02}
                                          onChange={(e) => setRascunho((atual) => ({ ...atual, medida02: e.target.value }))}
                                          aria-label={`Medida 02 de ${peca.descricao}`}
                                          className="h-8 w-24 rounded border border-soaco-gray/40 bg-white px-2 text-right text-slate-900 dark:bg-black dark:text-white"
                                        />
                                        <button
                                          type="button"
                                          disabled={salvandoMedida}
                                          onClick={() => void salvarMedidas(peca)}
                                          className="rounded p-1 text-emerald-400 hover:bg-white/10"
                                          aria-label="Guardar medidas"
                                        >
                                          <Check className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditando(null)}
                                          className="rounded p-1 text-slate-400 hover:bg-white/10"
                                          aria-label="Cancelar edição"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center justify-end gap-1">
                                        {peca.medida02 || '—'}
                                        {peca.origem === 'nomus' && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditando(peca.chave);
                                              setRascunho({ medida01: peca.medida01, medida02: peca.medida02 });
                                              setErroMedida(null);
                                            }}
                                            className="rounded p-1 text-slate-300 hover:bg-white/10 hover:text-white"
                                            title="Editar medidas. O Gestão guarda para as próximas ordens."
                                            aria-label={`Editar medidas de ${peca.descricao}`}
                                          >
                                            <Pencil className="h-3.5 w-3.5" />
                                          </button>
                                        )}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-900 dark:text-white">
                                    {fmt(peca.quantidadeTotal)}
                                  </td>
                                </tr>
                              ))}
                            </Fragment>
                          ))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {(erroMedida || (erro && setor != null && !carregandoPecas)) && (
          <p className="px-5 py-2 text-sm text-red-600 dark:text-red-300">{erroMedida || erro}</p>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-soaco-gray/25 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-soaco-navy/60"
          >
            Cancelar
          </button>
          {setor != null && (
            <button
              type="button"
              onClick={() => setSetor(null)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-soaco-navy/60"
            >
              Trocar setor
            </button>
          )}
          {setor != null && (
            <button
              type="button"
              disabled={gerando || carregandoPecas || marcados.size === 0}
              onClick={confirmar}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {gerando ? 'Gerando…' : 'Gerar ordem'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
