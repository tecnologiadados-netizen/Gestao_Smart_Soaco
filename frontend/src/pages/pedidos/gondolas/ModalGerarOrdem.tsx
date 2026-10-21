import { Fragment, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Pencil, X } from 'lucide-react';
import type {
  ComponenteFicha,
  DadosPecaGondola,
  DetalheItemGondola,
  EscolhaFicha,
  ItemCarteiraGondola,
  SetorGondola,
  TipoOrdemGondola,
} from '../../../api/gondolasPortaPaletes';
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

type TipoImpressao = 'PI' | 'PP' | 'ambos';

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
  modelo: string;
  tipo: ComponenteFicha['tipo'];
  quantidadeTotal: number;
  origem: DetalheItemGondola['origem'];
};

function pecasDoDetalhe(detalhe: DetalheItemGondola): PecaLinha[] {
  return detalhe.componentes.flatMap((componente, indice) => componente.ordemGerada ? [] : [{
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
    modelo: componente.modelo ?? '',
    tipo: componente.tipo,
    quantidadeTotal: componente.quantidadeTotal,
    origem: detalhe.origem,
  }]);
}

export default function ModalGerarOrdem({
  aberto,
  itens,
  gerando,
  erro,
  onClose,
  carregarFicha,
  onMedidasSalvas,
  podeEditarMedidas,
  podeEscolherFicha,
  onEscolherFichas,
  onGerar,
}: {
  aberto: boolean;
  itens: ItemCarteiraGondola[];
  gerando: boolean;
  erro: string | null;
  onClose: () => void;
  carregarFicha: (item: ItemCarteiraGondola) => Promise<DetalheItemGondola>;
  onMedidasSalvas: (codigo: string, dados: DadosPecaGondola) => void;
  podeEditarMedidas: boolean;
  /** Sem esta permissão a etapa de escolha não aparece e vale o Nomus. */
  podeEscolherFicha: boolean;
  /** Grava qual ficha fica nos códigos que têm Nomus e planilha. */
  onEscolherFichas: (escolhas: { codigo: string; origem: EscolhaFicha }[]) => Promise<void>;
  /** Grava e imprime a ordem. Devolve o número gravado, ou null se não gravou. */
  onGerar: (setor: SetorGondola, tipo: TipoOrdemGondola, detalhes: DetalheItemGondola[]) => Promise<string | null>;
}) {
  const [setor, setSetor] = useState<SetorGondola | null>(null);
  const [busca, setBusca] = useState('');
  const [detalhes, setDetalhes] = useState<DetalheItemGondola[]>([]);
  const [carregandoPecas, setCarregandoPecas] = useState(false);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<DadosPecaGondola>({
    medida01: '',
    medida02: '',
    modelo: '',
    materiaPrima: '',
  });
  const [salvandoMedida, setSalvandoMedida] = useState(false);
  const [erroMedida, setErroMedida] = useState<string | null>(null);
  const [escolhendoTipo, setEscolhendoTipo] = useState(false);
  const [observacoes, setObservacoes] = useState<Record<string, string>>({});
  const [escolhas, setEscolhas] = useState<Record<string, EscolhaFicha>>({});
  const [salvandoEscolhas, setSalvandoEscolhas] = useState(false);
  const [erroEscolhas, setErroEscolhas] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setEscolhendoTipo(false);
    setObservacoes({});
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

  const semEscolha = useMemo(() => {
    const porCodigo = new Map<string, { codigo: string; descricao: string; pedidos: string[] }>();
    for (const item of doSetor) {
      if (!item.ambasFichas || item.escolhaFicha) continue;
      const chave = item.codigo.trim().toUpperCase();
      const atual = porCodigo.get(chave) ?? { codigo: item.codigo, descricao: item.descricao, pedidos: [] };
      if (!atual.pedidos.includes(item.pedido)) atual.pedidos.push(item.pedido);
      porCodigo.set(chave, atual);
    }
    return [...porCodigo.values()].sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR'));
  }, [doSetor]);
  const precisaEscolher = podeEscolherFicha && semEscolha.length > 0;

  useEffect(() => {
    setEscolhas({});
    setErroEscolhas(null);
  }, [setor]);

  async function confirmarEscolhas() {
    const lista = semEscolha.flatMap((linha) => {
      const origem = escolhas[linha.codigo];
      return origem ? [{ codigo: linha.codigo, origem }] : [];
    });
    if (lista.length < semEscolha.length) return;
    setSalvandoEscolhas(true);
    setErroEscolhas(null);
    try {
      await onEscolherFichas(lista);
    } catch (e) {
      setErroEscolhas(e instanceof Error ? e.message : 'Erro ao guardar a escolha.');
    } finally {
      setSalvandoEscolhas(false);
    }
  }

  useEffect(() => {
    if (precisaEscolher) {
      setDetalhes([]);
      setMarcados(new Set());
      setCarregandoPecas(false);
      return;
    }
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
  }, [setor, doSetor, carregarFicha, precisaEscolher]);

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

  const chavesParaImprimir = useMemo(
    () => new Set(pecasVisiveis.filter((peca) => marcados.has(peca.chave)).map((peca) => peca.chave)),
    [pecasVisiveis, marcados]
  );

  const marcadosPorTipo = useMemo(() => {
    let pi = 0;
    let pp = 0;
    for (const detalhe of detalhes) {
      detalhe.componentes.forEach((componente, indice) => {
        if (!chavesParaImprimir.has(`${detalhe.item.idItem}|${indice}`)) return;
        if (componente.tipo === 'PI') pi += 1;
        else if (componente.tipo === 'PP') pp += 1;
      });
    }
    return { pi, pp };
  }, [detalhes, chavesParaImprimir]);

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
      const salva = await salvarMedidaPecaGondola(peca.codigo, rascunho);
      const dados: DadosPecaGondola = {
        medida01: salva.medida01,
        medida02: salva.medida02,
        modelo: salva.modelo,
        materiaPrima: salva.materiaPrima,
      };
      const alvo = chaveMedida(peca.codigo);
      setDetalhes((atual) =>
        atual.map((detalhe) =>
          detalhe.origem !== 'nomus'
            ? detalhe
            : {
                ...detalhe,
                componentes: detalhe.componentes.map((componente) =>
                  chaveMedida(componente.codigo) === alvo ? { ...componente, ...dados } : componente
                ),
              }
        )
      );
      onMedidasSalvas(peca.codigo, dados);
      setEditando(null);
    } catch (e) {
      setErroMedida(e instanceof Error ? e.message : 'Erro ao guardar as medidas.');
    } finally {
      setSalvandoMedida(false);
    }
  }

  async function confirmar(tipos: TipoImpressao) {
    if (!setor) return;
    setEscolhendoTipo(false);
    const enviadas = new Set<string>();
    const escolhidos = detalhes
      .map((detalhe) => ({
        ...detalhe,
        componentes: detalhe.componentes
          .map((componente, indice) => ({
            componente: {
              ...componente,
              observacao: (observacoes[`${detalhe.item.idItem}|${indice}`] ?? '').trim(),
            },
            chave: `${detalhe.item.idItem}|${indice}`,
          }))
          .filter(
            ({ componente, chave }) =>
              !componente.ordemGerada &&
              chavesParaImprimir.has(chave) &&
              (tipos === 'ambos' || componente.tipo === '' || componente.tipo === tipos)
          )
          .map(({ componente, chave }) => {
            enviadas.add(chave);
            return componente;
          }),
      }))
      .filter((detalhe) => detalhe.componentes.length > 0);
    const numero = await onGerar(setor, tipos === 'ambos' ? 'PLANILHA' : tipos, escolhidos);
    if (!numero) return;
    setDetalhes((atual) =>
      atual.map((detalhe) => ({
        ...detalhe,
        componentes: detalhe.componentes.map((componente, indice) =>
          enviadas.has(`${detalhe.item.idItem}|${indice}`) ? { ...componente, ordemGerada: numero } : componente
        ),
      }))
    );
    setMarcados((atual) => new Set([...atual].filter((chave) => !enviadas.has(chave))));
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
        ) : precisaEscolher ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-soaco-gray/25 px-5 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {semEscolha.length === 1 ? 'Este item tem' : 'Estes itens têm'} ficha no Nomus e na planilha
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-300">
                  Escolha qual lista deve permanecer. O Gestão guarda a escolha por código e não pergunta de novo.
                </p>
              </div>
              <div className="flex gap-2">
                {(
                  [
                    ['nomus', 'Todos Nomus'],
                    ['planilha', 'Todos Planilha'],
                  ] as const
                ).map(([origem, rotulo]) => (
                  <button
                    key={origem}
                    type="button"
                    onClick={() =>
                      setEscolhas(Object.fromEntries(semEscolha.map((linha) => [linha.codigo, origem])))
                    }
                    className="rounded-lg border border-soaco-gray/40 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-soaco-navy/60"
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="sticky top-0 z-10 bg-soaco-navy text-xs text-white">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Código</th>
                    <th className="px-3 py-2 font-semibold">Descrição</th>
                    <th className="px-3 py-2 font-semibold">Pedidos</th>
                    <th className="px-3 py-2 text-right font-semibold">Lista que permanece</th>
                  </tr>
                </thead>
                <tbody>
                  {semEscolha.map((linha) => (
                    <tr key={linha.codigo} className="border-b border-soaco-gray/20">
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-800 dark:text-white">
                        {linha.codigo}
                      </td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{linha.descricao}</td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{linha.pedidos.join(', ')}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1.5" role="radiogroup" aria-label={`Ficha de ${linha.codigo}`}>
                          {(
                            [
                              ['nomus', 'Nomus', 'bg-primary-600 text-white border-primary-500'],
                              ['planilha', 'Planilha', 'bg-[#FFAD00] text-black border-[#FFAD00]'],
                            ] as const
                          ).map(([origem, rotulo, ativoCls]) => {
                            const ativo = escolhas[linha.codigo] === origem;
                            return (
                              <button
                                key={origem}
                                type="button"
                                role="radio"
                                aria-checked={ativo}
                                onClick={() => setEscolhas((atual) => ({ ...atual, [linha.codigo]: origem }))}
                                className={`rounded-md border px-3 py-1 text-xs font-semibold uppercase tracking-wide transition ${
                                  ativo
                                    ? ativoCls
                                    : 'border-soaco-gray/40 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-soaco-navy/60'
                                }`}
                              >
                                {rotulo}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {erroEscolhas && <p className="px-5 py-2 text-sm text-red-600 dark:text-red-300">{erroEscolhas}</p>}
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
                {chavesParaImprimir.size.toLocaleString('pt-BR')} de {pecasVisiveis.length.toLocaleString('pt-BR')} peças
                marcadas{busca.trim() ? ' no filtro' : ''}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {carregandoPecas ? (
                <p className="px-5 py-8 text-center text-sm text-slate-500">Abrindo as fichas dos pedidos…</p>
              ) : erroCarga ? (
                <p className="px-5 py-8 text-center text-sm text-red-600 dark:text-red-300">{erroCarga}</p>
              ) : pecas.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-500">
                  Nenhuma peça disponível neste setor. As que já saíram em ordem estão no Histórico.
                </p>
              ) : (
                <table className="w-full min-w-[1100px] text-left text-sm">
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
                      <th className="px-3 py-2 font-semibold">Modelo</th>
                      <th className="px-3 py-2 font-semibold">Matéria-prima</th>
                      <th className="px-3 py-2 text-right font-semibold">Medida 01</th>
                      <th className="px-3 py-2 text-right font-semibold">Medida 02</th>
                      <th className="px-3 py-2 font-semibold">Observações</th>
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
                            <td colSpan={7} className="px-3 py-2 font-semibold text-white">
                              {grupo.pedido}
                              <span className="ml-2 font-normal text-slate-300">{grupo.cliente}</span>
                            </td>
                          </tr>
                          {[...grupo.itens.values()].map((item) => (
                            <Fragment key={`${grupo.pedido}-${item.codigo}`}>
                              <tr className="bg-soaco-navy/25">
                                <td />
                                <td colSpan={7} className="px-3 py-1.5 text-xs text-slate-300">
                                  {item.pecas[0]?.origem === 'nomus' ? (
                                    <span className="mr-2 rounded bg-primary-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                                      Nomus
                                    </span>
                                  ) : item.pecas[0]?.origem === 'planilha' ? (
                                    <span className="mr-2 rounded bg-[#FFAD00] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">
                                      Planilha
                                    </span>
                                  ) : null}
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
                                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                                    {editando === peca.chave ? (
                                      <input
                                        value={rascunho.modelo}
                                        onChange={(e) => setRascunho((atual) => ({ ...atual, modelo: e.target.value }))}
                                        aria-label={`Modelo de ${peca.descricao}`}
                                        className="h-8 w-28 rounded border border-soaco-gray/40 bg-white px-2 text-slate-900 dark:bg-black dark:text-white"
                                      />
                                    ) : (
                                      peca.modelo || '—'
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                                    {editando === peca.chave ? (
                                      <input
                                        value={rascunho.materiaPrima}
                                        onChange={(e) => setRascunho((atual) => ({ ...atual, materiaPrima: e.target.value }))}
                                        aria-label={`Matéria-prima de ${peca.descricao}`}
                                        className="h-8 w-28 rounded border border-soaco-gray/40 bg-white px-2 text-slate-900 dark:bg-black dark:text-white"
                                      />
                                    ) : (
                                      peca.materiaPrima || '—'
                                    )}
                                  </td>
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
                                          aria-label="Guardar dados da peça"
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
                                        {podeEditarMedidas && peca.origem === 'nomus' && peca.tipo === 'PP' && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditando(peca.chave);
                                              setRascunho({
                                                medida01: peca.medida01,
                                                medida02: peca.medida02,
                                                modelo: peca.modelo,
                                                materiaPrima: peca.materiaPrima,
                                              });
                                              setErroMedida(null);
                                            }}
                                            className="rounded p-1 text-slate-300 hover:bg-white/10 hover:text-white"
                                            title="Editar modelo, matéria-prima e medidas. O Gestão guarda para as próximas ordens."
                                            aria-label={`Editar dados de ${peca.descricao}`}
                                          >
                                            <Pencil className="h-3.5 w-3.5" />
                                          </button>
                                        )}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      value={observacoes[peca.chave] ?? ''}
                                      onChange={(e) =>
                                        setObservacoes((atual) => ({ ...atual, [peca.chave]: e.target.value }))
                                      }
                                      placeholder="Observação"
                                      aria-label={`Observação de ${peca.descricao} do ${peca.pedido}`}
                                      className="h-8 w-full min-w-[9rem] rounded border border-soaco-gray/40 bg-white px-2 text-sm text-slate-900 placeholder:text-slate-400 dark:bg-black dark:text-white"
                                    />
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

        {escolhendoTipo && (
          <div className="border-t border-soaco-gray/25 bg-slate-50 px-5 py-3 dark:bg-black/40">
            <p className="text-sm font-semibold text-slate-800 dark:text-white">O que deseja imprimir?</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(
                [
                  ['PI', 'Apenas PI', marcadosPorTipo.pi],
                  ['PP', 'Apenas PP', marcadosPorTipo.pp],
                ] as const
              ).map(([tipo, rotulo, quantidade]) => (
                <button
                  key={tipo}
                  type="button"
                  disabled={gerando || quantidade === 0}
                  onClick={() => void confirmar(tipo)}
                  className="rounded-lg border border-soaco-gray/40 bg-white px-3 py-2.5 text-left transition hover:border-primary-500 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-soaco-graphite dark:hover:bg-soaco-navy/60"
                >
                  <span className="block text-sm font-semibold text-slate-900 dark:text-white">{rotulo}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-300">
                    {quantidade.toLocaleString('pt-BR')} {quantidade === 1 ? 'peça marcada' : 'peças marcadas'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-soaco-gray/25 px-5 py-3">
          <button
            type="button"
            onClick={escolhendoTipo ? () => setEscolhendoTipo(false) : onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-soaco-navy/60"
          >
            Cancelar
          </button>
          {setor != null && !escolhendoTipo && (
            <button
              type="button"
              onClick={() => setSetor(null)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-soaco-navy/60"
            >
              Trocar setor
            </button>
          )}
          {setor != null && precisaEscolher && (
            <button
              type="button"
              disabled={salvandoEscolhas || semEscolha.some((linha) => !escolhas[linha.codigo])}
              onClick={() => void confirmarEscolhas()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {salvandoEscolhas ? 'Guardando…' : 'Confirmar e continuar'}
            </button>
          )}
          {setor != null && !escolhendoTipo && !precisaEscolher && (
            <button
              type="button"
              disabled={gerando || carregandoPecas || chavesParaImprimir.size === 0}
              onClick={() => {
                if (marcadosPorTipo.pi + marcadosPorTipo.pp === 0) void confirmar('ambos');
                else setEscolhendoTipo(true);
              }}
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
