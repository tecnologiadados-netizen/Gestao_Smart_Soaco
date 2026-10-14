import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  criarSetorProducao,
  excluirDecomposicaoPai,
  excluirSetorProducao,
  listarCadastrosDecomposicao,
  listarSetoresProducao,
  obterDecomposicaoPai,
  salvarDecomposicaoPai,
  type DecomposicaoCadastroResumo,
  type DecomposicaoFilhoCadastro,
  type DecomposicaoPaiCadastro,
  type DecomposicaoPecaCadastro,
  type SetorProducao,
} from '../../../api/decomposicao';
import { criarMatcherTextoLivre, PLACEHOLDER_BUSCA_TEXTO_LIVRE } from '../../../utils/textoLivreBusca';
import ModalProdutoPai from './ModalProdutoPai';

export default function ModalCadastrosDecomposicao({
  setorInicial,
  onClose,
  onAlterado,
}: {
  setorInicial: string;
  onClose: () => void;
  onAlterado: (setorSalvo?: string) => void;
}) {
  const [setores, setSetores] = useState<SetorProducao[]>([]);
  const [novoSetor, setNovoSetor] = useState('');
  const [pais, setPais] = useState<DecomposicaoCadastroResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');
  const [form, setForm] = useState<DecomposicaoPaiCadastro | 'novo' | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [listaPais, listaSetores] = await Promise.all([
        listarCadastrosDecomposicao(),
        listarSetoresProducao(),
      ]);
      setPais(listaPais);
      setSetores(listaSetores);
    } catch (e) {
      setPais([]);
      setErro(e instanceof Error ? e.message : 'Erro ao carregar os cadastros.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const match = useMemo(() => criarMatcherTextoLivre(filtro), [filtro]);
  const doGrupo = useMemo(
    () =>
      pais.filter(
        (pai) =>
          match(pai.codigo) ||
          match(pai.nome) ||
          match(pai.grupo) ||
          match(pai.observacao ?? '') ||
          pai.filhos.some((filho) => match(filho.codigoNomus) || match(filho.descricao)) ||
          (pai.pecas ?? []).some((peca) => match(peca.descricao) || match(peca.materiaPrima))
      ),
    [pais, match]
  );

  const adicionarSetor = async () => {
    setErro(null);
    try {
      const setor = await criarSetorProducao(novoSetor);
      setNovoSetor('');
      onAlterado();
      await carregar();
      setSetores((atual) => (atual.some((item) => item.id === setor.id) ? atual : [...atual, setor]));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao cadastrar o setor.');
    }
  };

  const removerSetor = async (setor: SetorProducao) => {
    if (!window.confirm(`Excluir o setor ${setor.nome}?`)) return;
    setErro(null);
    try {
      await excluirSetorProducao(setor.id);
      onAlterado();
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir o setor.');
    }
  };

  const abrirEdicao = async (id: number) => {
    setErro(null);
    setErroForm(null);
    try {
      setForm(await obterDecomposicaoPai(id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao abrir o pai.');
    }
  };

  const salvar = async (body: {
    grupo: string;
    codigo: string;
    nome: string;
    observacao: string;
    filhos: DecomposicaoFilhoCadastro[];
    pecas: DecomposicaoPecaCadastro[];
  }) => {
    setSalvando(true);
    setErroForm(null);
    try {
      const id = form && form !== 'novo' ? form.id : null;
      await salvarDecomposicaoPai(id, body);
      setForm(null);
      onAlterado(body.grupo);
      await carregar();
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (pai: DecomposicaoCadastroResumo) => {
    if (!window.confirm(`Excluir o produto pai ${pai.codigo}, as peças e os vínculos dos filhos?`)) return;
    setExcluindoId(pai.id);
    setErro(null);
    try {
      await excluirDecomposicaoPai(pai.id);
      onAlterado();
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir.');
    } finally {
      setExcluindoId(null);
    }
  };

  const paiAberto = form && form !== 'novo' ? form : null;
  const outrosPais = pais.filter((pai) => pai.id !== paiAberto?.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Cadastros</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Setores de produção e os produtos pai de cada setor, com os filhos do NOMUS.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
            onClick={() => {
              setErroForm(null);
              setForm('novo');
            }}
          >
            Novo
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-5 py-4">
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Setores</p>
            <div className="mt-2 flex gap-2">
              <input
                className="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700"
                value={novoSetor}
                onChange={(e) => setNovoSetor(e.target.value.toUpperCase())}
                placeholder="Ex.: BALCÕES, CADEIRAS, GÔNDOLAS"
              />
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium dark:border-slate-600"
                onClick={() => void adicionarSetor()}
              >
                Adicionar
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {setores.length === 0 && <p className="text-sm text-slate-500">Nenhum setor cadastrado.</p>}
              {setores.map((setor) => (
                <span
                  key={setor.id}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-2 py-1 text-sm dark:bg-slate-700"
                >
                  {setor.nome}
                  <button type="button" className="text-red-600" onClick={() => void removerSetor(setor)}>
                    Excluir
                  </button>
                </span>
              ))}
            </div>
          </div>

          {erro && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
          )}
          <input
            className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
          />

          {carregando ? (
            <p className="py-8 text-center text-sm text-slate-500">Carregando cadastros…</p>
          ) : doGrupo.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Nenhum produto pai. Use Novo para cadastrar.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-primary-600 text-white">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Código simbólico</th>
                    <th className="px-4 py-3 font-semibold">Setor</th>
                    <th className="px-4 py-3 font-semibold">Produto pai</th>
                    <th className="px-4 py-3 font-semibold">Peças</th>
                    <th className="px-4 py-3 font-semibold">Filhos vinculados</th>
                    <th className="px-4 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {doGrupo.map((pai) => (
                    <tr key={pai.id} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{pai.codigo}</td>
                      <td className="px-4 py-3">{pai.grupo}</td>
                      <td className="px-4 py-3">
                        <div className="text-slate-800 dark:text-slate-100">{pai.nome}</div>
                        {pai.observacao && <div className="text-xs text-slate-500">{pai.observacao}</div>}
                      </td>
                      <td className="px-4 py-3">{pai.pecas?.length ?? 0}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {pai.filhos.length === 0
                          ? 'Nenhum'
                          : pai.filhos.map((filho) => filho.codigoNomus).join(', ')}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          className="mr-3 text-sm font-medium text-slate-700 hover:underline dark:text-slate-200"
                          onClick={() => void abrirEdicao(pai.id)}
                        >
                          Vínculos
                        </button>
                        <button
                          type="button"
                          className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                          disabled={excluindoId === pai.id}
                          onClick={() => void excluir(pai)}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
      </div>

      {form != null && (
        <ModalProdutoPai
          pai={paiAberto}
          grupoInicial={setorInicial}
          setores={setores}
          outrosPais={outrosPais}
          salvando={salvando}
          erro={erroForm}
          onClose={() => setForm(null)}
          onSalvar={(body) => void salvar(body)}
        />
      )}
    </div>
  );
}
