import { useEffect, useState } from 'react';
import {
  buscarProdutosNomusDecomposicao,
  nomeGrupo,
  type DecomposicaoCadastroResumo,
  type DecomposicaoFilhoCadastro,
  type DecomposicaoPaiCadastro,
  type DecomposicaoPecaCadastro,
  type ProdutoNomusOpcao,
  type SetorProducao,
} from '../../../api/decomposicao';

const INPUT =
  'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-2 text-sm';
const LABEL = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1';

type LinhaPeca = {
  key: string;
  descricao: string;
  quantidade: string;
  medidaL: string;
  medidaA: string;
  materiaPrima: string;
};

type LinhaFilho = {
  key: string;
  codigoNomus: string;
  descricao: string;
};

function novaChave(): string {
  return Math.random().toString(36).slice(2, 10);
}

function codigoIgual(a: string, b: string): boolean {
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

function paisComFilho(codigo: string, outros: DecomposicaoCadastroResumo[]): DecomposicaoCadastroResumo[] {
  return outros.filter((pai) => pai.filhos.some((filho) => codigoIgual(filho.codigoNomus, codigo)));
}

function rotuloPai(pai: DecomposicaoCadastroResumo): string {
  return `${pai.codigo} · ${pai.nome} (${nomeGrupo(pai.grupo)})`;
}

function pecasDe(pai: DecomposicaoPaiCadastro | null): LinhaPeca[] {
  if (!pai) return [];
  return (pai.pecas ?? []).map((peca) => ({
    key: novaChave(),
    descricao: peca.descricao,
    quantidade: String(peca.quantidade),
    medidaL: peca.medidaL,
    medidaA: peca.medidaA,
    materiaPrima: peca.materiaPrima,
  }));
}

function linhasDe(pai: DecomposicaoPaiCadastro | null): LinhaFilho[] {
  if (!pai) return [];
  return pai.filhos.map((filho) => ({
    key: novaChave(),
    codigoNomus: filho.codigoNomus,
    descricao: filho.descricao,
  }));
}

export default function ModalProdutoPai({
  pai,
  grupoInicial,
  setores,
  outrosPais,
  salvando,
  erro,
  onClose,
  onSalvar,
}: {
  pai: DecomposicaoPaiCadastro | null;
  grupoInicial: string;
  setores: SetorProducao[];
  outrosPais: DecomposicaoCadastroResumo[];
  salvando: boolean;
  erro: string | null;
  onClose: () => void;
  onSalvar: (body: {
    grupo: string;
    codigo: string;
    nome: string;
    observacao: string;
    filhos: DecomposicaoFilhoCadastro[];
    pecas: DecomposicaoPecaCadastro[];
  }) => void;
}) {
  const [grupo, setGrupo] = useState(pai?.grupo ?? grupoInicial);
  const [codigo, setCodigo] = useState(pai?.codigo ?? '');
  const [nome, setNome] = useState(pai?.nome ?? '');
  const [observacao, setObservacao] = useState(pai?.observacao ?? '');
  const [linhas, setLinhas] = useState<LinhaFilho[]>(() => linhasDe(pai));
  const [pecas, setPecas] = useState<LinhaPeca[]>(() => pecasDe(pai));
  const [busca, setBusca] = useState('');
  const [opcoes, setOpcoes] = useState<ProdutoNomusOpcao[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  useEffect(() => {
    const termo = busca.trim();
    setSelecionados([]);
    if (termo.length < 2) {
      setOpcoes([]);
      setErroBusca(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setBuscando(true);
      setErroBusca(null);
      void buscarProdutosNomusDecomposicao(termo)
        .then(setOpcoes)
        .catch((e: unknown) => {
          setOpcoes([]);
          setErroBusca(e instanceof Error ? e.message : 'Falha ao buscar no NOMUS.');
        })
        .finally(() => setBuscando(false));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [busca]);

  const conflitos = linhas.flatMap((linha) =>
    paisComFilho(linha.codigoNomus, outrosPais).map((outro) => ({
      key: `${linha.codigoNomus}-${outro.id}`,
      codigo: linha.codigoNomus,
      pai: rotuloPai(outro),
    }))
  );

  const jaNestePai = (codigo: string) => linhas.some((linha) => codigoIgual(linha.codigoNomus, codigo));

  const opcoesLivres = opcoes.filter((opcao) => !jaNestePai(opcao.codigo));
  const todosMarcados = opcoesLivres.length > 0 && opcoesLivres.every((opcao) => selecionados.includes(opcao.codigo));

  const alternar = (codigo: string) => {
    if (jaNestePai(codigo)) return;
    setSelecionados((atual) => (atual.includes(codigo) ? atual.filter((item) => item !== codigo) : [...atual, codigo]));
  };

  const alternarTodos = () => {
    setSelecionados(todosMarcados ? [] : opcoesLivres.map((opcao) => opcao.codigo));
  };

  const adicionarSelecionados = () => {
    const escolhidos = opcoes.filter((opcao) => selecionados.includes(opcao.codigo) && !jaNestePai(opcao.codigo));
    if (escolhidos.length === 0) return;
    setErroLocal(null);
    setLinhas((atual) => {
      const novas = escolhidos.filter((produto) => !atual.some((linha) => codigoIgual(linha.codigoNomus, produto.codigo)));
      return [
        ...atual,
        ...novas.map((produto) => ({
          key: novaChave(),
          codigoNomus: produto.codigo,
          descricao: produto.descricao || produto.codigo,
        })),
      ];
    });
    setSelecionados([]);
  };

  const salvar = () => {
    setErroLocal(null);
    if (!grupo.trim()) {
      setErroLocal('Selecione o setor.');
      return;
    }
    if (!nome.trim()) {
      setErroLocal('Informe a descrição do produto pai.');
      return;
    }
    const filhos: DecomposicaoFilhoCadastro[] = [];
    for (const linha of linhas) {
      filhos.push({
        codigoNomus: linha.codigoNomus,
        descricao: linha.descricao,
        quantidade: 1,
        materiaPrimaCodigo: null,
        materiaPrimaDescricao: null,
      });
    }
    const pecasSalvas: DecomposicaoPecaCadastro[] = [];
    for (const peca of pecas) {
      if (!peca.descricao.trim()) continue;
      const quantidade = Math.floor(Number(peca.quantidade));
      if (!Number.isFinite(quantidade) || quantidade < 1) {
        setErroLocal(`Informe a quantidade da peça ${peca.descricao.trim()}.`);
        return;
      }
      pecasSalvas.push({
        descricao: peca.descricao.trim(),
        quantidade,
        medidaL: peca.medidaL.trim(),
        medidaA: peca.medidaA.trim(),
        materiaPrima: peca.materiaPrima.trim(),
      });
    }
    onSalvar({
      grupo,
      codigo: codigo.trim(),
      nome: nome.trim(),
      observacao: observacao.trim(),
      filhos,
      pecas: pecasSalvas,
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {pai ? 'Editar produto pai' : 'Cadastrar produto pai'}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Vincule os produtos filhos do NOMUS e monte as peças de corte: quantidade, L, A e matéria-prima. Dá para
            gravar e voltar depois.
          </p>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {(erro || erroLocal) && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {erroLocal || erro}
            </p>
          )}

          <div>
            <label className={LABEL}>Setor</label>
            <select className={INPUT} value={grupo} onChange={(e) => setGrupo(e.target.value)}>
              <option value="">Selecione o setor</option>
              {setores.map((setor) => (
                <option key={setor.id} value={setor.nome}>
                  {setor.nome}
                </option>
              ))}
            </select>
            {setores.length === 0 && (
              <p className="mt-1 text-xs text-slate-500">Cadastre um setor antes de gravar o produto.</p>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-12">
            <div className="md:col-span-3">
              <label className={LABEL}>Código Simbólico</label>
              <input
                className={INPUT}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="Automático se vazio"
              />
            </div>
            <div className="md:col-span-9">
              <label className={LABEL}>Descrição do produto pai</label>
              <input
                className={INPUT}
                value={nome}
                onChange={(e) => setNome(e.target.value.toUpperCase())}
                placeholder="Ex.: GÔNDOLA COMERCIAL 2M"
              />
            </div>
          </div>

          <div>
            <label className={LABEL}>Observação</label>
            <input
              className={INPUT}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Detalhamento técnico de peças</p>
                <p className="text-xs text-slate-500">Componente, quantidade unitária, medidas em mm e matéria-prima.</p>
              </div>
              <button
                type="button"
                className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
                onClick={() =>
                  setPecas((atual) => [
                    ...atual,
                    { key: novaChave(), descricao: '', quantidade: '1', medidaL: '', medidaA: '', materiaPrima: '' },
                  ])
                }
              >
                Adicionar peça
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="bg-primary-600 text-white">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Componente / peça</th>
                    <th className="px-3 py-2 font-semibold">Qtd</th>
                    <th className="px-3 py-2 font-semibold">L (mm)</th>
                    <th className="px-3 py-2 font-semibold">A (mm)</th>
                    <th className="px-3 py-2 font-semibold">Matéria-prima</th>
                    <th className="px-3 py-2 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {pecas.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                        Nenhuma peça. Use Adicionar peça para informar o detalhamento.
                      </td>
                    </tr>
                  )}
                  {pecas.map((peca) => (
                    <tr key={peca.key} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="px-3 py-2">
                        <input
                          className={INPUT}
                          value={peca.descricao}
                          onChange={(e) =>
                            setPecas((atual) =>
                              atual.map((item) =>
                                item.key === peca.key ? { ...item, descricao: e.target.value.toUpperCase() } : item
                              )
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-700"
                          value={peca.quantidade}
                          onChange={(e) =>
                            setPecas((atual) =>
                              atual.map((item) => (item.key === peca.key ? { ...item, quantidade: e.target.value } : item))
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-700"
                          value={peca.medidaL}
                          onChange={(e) =>
                            setPecas((atual) =>
                              atual.map((item) => (item.key === peca.key ? { ...item, medidaL: e.target.value } : item))
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-700"
                          value={peca.medidaA}
                          onChange={(e) =>
                            setPecas((atual) =>
                              atual.map((item) => (item.key === peca.key ? { ...item, medidaA: e.target.value } : item))
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className={INPUT}
                          value={peca.materiaPrima}
                          onChange={(e) =>
                            setPecas((atual) =>
                              atual.map((item) =>
                                item.key === peca.key ? { ...item, materiaPrima: e.target.value.toUpperCase() } : item
                              )
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          className="text-sm font-medium text-red-600 hover:underline"
                          onClick={() => setPecas((atual) => atual.filter((item) => item.key !== peca.key))}
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <label className={LABEL}>Vincular produto filho do NOMUS</label>
            <input
              className={INPUT}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Código ou descrição (use % para refinar)"
            />
            {buscando && <p className="mt-1 text-xs text-slate-500">Buscando no NOMUS…</p>}
            {erroBusca && <p className="mt-1 text-xs text-red-600">{erroBusca}</p>}
            {opcoes.length > 0 && (
              <div className="mt-1 rounded-lg border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-600">
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary-600"
                      checked={todosMarcados}
                      disabled={opcoesLivres.length === 0}
                      onChange={alternarTodos}
                    />
                    Selecionar todos
                  </label>
                  <button
                    type="button"
                    className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                    disabled={selecionados.length === 0}
                    onClick={adicionarSelecionados}
                  >
                    Vincular selecionados{selecionados.length > 0 ? ` (${selecionados.length})` : ''}
                  </button>
                </div>
                <ul className="max-h-48 overflow-y-auto">
                  {opcoes.map((opcao) => {
                    const jaEm = paisComFilho(opcao.codigo, outrosPais);
                    const nestePai = jaNestePai(opcao.codigo);
                    const marcado = nestePai || selecionados.includes(opcao.codigo);
                    return (
                      <li key={opcao.codigo} className="border-t border-slate-100 first:border-t-0 dark:border-slate-700">
                        <label className="flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 accent-primary-600"
                            checked={marcado}
                            disabled={nestePai}
                            onChange={() => alternar(opcao.codigo)}
                          />
                          <span>
                            <span className="font-semibold text-slate-800 dark:text-slate-100">{opcao.codigo}</span>
                            <span className="ml-2 text-slate-500">{opcao.descricao}</span>
                            {nestePai && (
                              <span className="mt-0.5 block text-xs font-medium text-slate-500">Já vinculado neste pai</span>
                            )}
                            {jaEm.length > 0 && (
                              <span className="mt-0.5 block text-xs font-medium text-amber-700 dark:text-amber-300">
                                Já vinculado a {jaEm.map(rotuloPai).join('; ')}
                              </span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {conflitos.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="font-semibold">Estes filhos já estão em outro pai. Dá para continuar e salvar mesmo assim.</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {conflitos.map((item) => (
                  <li key={item.key}>
                    <span className="font-medium">{item.codigo}</span> já está em {item.pai}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-primary-600 text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Produto filho</th>
                  <th className="px-4 py-3 font-semibold">Descrição</th>
                  <th className="px-4 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {linhas.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                      Nenhum filho ainda. Busque no NOMUS, marque os produtos e use Vincular selecionados.
                    </td>
                  </tr>
                )}
                {linhas.map((linha) => {
                  const jaEm = paisComFilho(linha.codigoNomus, outrosPais);
                  return (
                  <tr
                    key={linha.key}
                    className={`border-t border-slate-100 dark:border-slate-700 ${
                      jaEm.length > 0 ? 'bg-amber-50 dark:bg-amber-950/30' : ''
                    }`}
                  >
                    <td className="px-4 py-2 font-medium text-slate-800 dark:text-slate-100">{linha.codigoNomus}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">
                      {linha.descricao}
                      {jaEm.length > 0 && (
                        <div className="mt-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                          Já em {jaEm.map(rotuloPai).join('; ')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        className="text-sm font-medium text-red-600 hover:underline"
                        onClick={() => setLinhas((atual) => atual.filter((item) => item.key !== linha.key))}
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            onClick={onClose}
            disabled={salvando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            onClick={salvar}
            disabled={salvando}
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
