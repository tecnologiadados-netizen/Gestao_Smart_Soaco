import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { PERMISSOES } from '../../../config/permissoes';
import { ComoLerBtn } from '../../../components/AjudaTelaModal';
import CarregandoInformacoesOverlay from '../../../components/CarregandoInformacoesOverlay';
import GradeFiltroCabecalhoBtn from '../../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../../components/grade/GradeFiltroExcelPortal';
import { MensagemSemRegistros } from '../../../components/MensagemSemRegistros';
import { useGradeFiltrosExcel } from '../../../hooks/useGradeFiltrosExcel';
import { criarMatcherTextoLivre, PLACEHOLDER_BUSCA_TEXTO_LIVRE } from '../../../utils/textoLivreBusca';
import {
  detalharDecomposicao,
  emitirOrdemProducao,
  listarCadastrosDecomposicao,
  listarDecomposicao,
  listarOrdensProducao,
  listarSetoresProducao,
  obterDecomposicaoPai,
  salvarDecomposicaoPai,
  type DecomposicaoCadastroResumo,
  type DecomposicaoDetalhe,
  type DecomposicaoFilhoCadastro,
  type DecomposicaoPaiCadastro,
  type DecomposicaoPaiGrade,
  type DecomposicaoPecaCadastro,
  type OrdemProducao,
  type SetorProducao,
} from '../../../api/decomposicao';
import DecomposicaoAjudaModal from './DecomposicaoAjudaModal';
import ModalCadastrosDecomposicao from './ModalCadastrosDecomposicao';
import ModalDetalheDecomposicao from './ModalDetalheDecomposicao';
import ModalGerarOrdem from './ModalGerarOrdem';
import ModalProdutoPai from './ModalProdutoPai';
import ModalVerOrdem from './ModalVerOrdem';
import { imprimirOrdemProducao } from './imprimirOrdemProducao';

function fmt(valor: number | null): string {
  if (valor == null) return '—';
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

const COLUNAS_PAI = [
  { id: 'codigo', label: 'Código simbólico' },
  { id: 'setor', label: 'Setor' },
  { id: 'nome', label: 'Produto pai' },
  { id: 'filhos', label: 'Filhos' },
  { id: 'pecas', label: 'Peças' },
  { id: 'quantidade', label: 'Quantidade do pai' },
] as const;

const COLUNAS_PAI_IDS = COLUNAS_PAI.map((coluna) => coluna.id);
const COLUNAS_PAI_NUMERICAS = new Set<string>(['filhos', 'pecas', 'quantidade']);

function textoCelulaPai(pai: DecomposicaoPaiGrade, columnId: string): string {
  switch (columnId) {
    case 'codigo':
      return pai.codigo;
    case 'setor':
      return pai.grupo;
    case 'nome':
      return pai.nome;
    case 'filhos':
      return String(pai.qtdFilhos);
    case 'pecas':
      return String(pai.qtdPecas);
    case 'quantidade':
      return fmt(pai.sugestao);
    default:
      return '';
  }
}

function valorOrdenacaoPai(pai: DecomposicaoPaiGrade, columnId: string): string | number {
  if (columnId === 'filhos') return pai.qtdFilhos;
  if (columnId === 'pecas') return pai.qtdPecas;
  if (columnId === 'quantidade') return pai.sugestao ?? Number.NaN;
  return textoCelulaPai(pai, columnId);
}

export default function DecomposicaoPage() {
  const { hasPermission } = useAuth();
  const podeVer =
    hasPermission(PERMISSOES.PCP_VER_TELA) ||
    hasPermission(PERMISSOES.PCP_TOTAL) ||
    hasPermission(PERMISSOES.PEDIDOS_VER);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [avisoCarteira, setAvisoCarteira] = useState<string | null>(null);
  const [pais, setPais] = useState<DecomposicaoPaiGrade[]>([]);
  const [ordens, setOrdens] = useState<OrdemProducao[]>([]);
  const [paiOrdem, setPaiOrdem] = useState<DecomposicaoPaiGrade | null>(null);
  const [ordemAberta, setOrdemAberta] = useState<OrdemProducao | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erroGerar, setErroGerar] = useState<string | null>(null);
  const [setores, setSetores] = useState<SetorProducao[]>([]);
  const [setorFiltro, setSetorFiltro] = useState('');
  const [filtro, setFiltro] = useState('');
  const [ajuda, setAjuda] = useState(false);
  const [aba, setAba] = useState<'pais' | 'historico'>('pais');

  const [cadastrosAberto, setCadastrosAberto] = useState(false);
  const [paiEdicao, setPaiEdicao] = useState<DecomposicaoPaiCadastro | null>(null);
  const [outrosPais, setOutrosPais] = useState<DecomposicaoCadastroResumo[]>([]);
  const [abrindoEdicao, setAbrindoEdicao] = useState<number | null>(null);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);

  const [detalheId, setDetalheId] = useState<number | null>(null);
  const [detalhe, setDetalhe] = useState<DecomposicaoDetalhe | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [erroDetalhe, setErroDetalhe] = useState<string | null>(null);
  const detalheCacheRef = useRef(new Map<number, DecomposicaoDetalhe>());

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    setErro(null);
    detalheCacheRef.current.clear();
    try {
      const data = await listarDecomposicao();
      setPais(data.pais);
      setOrdens(await listarOrdensProducao().catch(() => []));
      setSetores(await listarSetoresProducao().catch(() => []));
      setAvisoCarteira(
        data.carteiraDisponivel
          ? null
          : data.carteiraErro || 'A carteira do NOMUS não pôde ser lida. O cadastro continua disponível.'
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar a decomposição.');
      setPais([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!podeVer) return;
    void carregar();
  }, [podeVer, carregar]);

  const match = useMemo(() => criarMatcherTextoLivre(filtro), [filtro]);
  const doGrupo = useMemo(
    () => pais.filter((pai) => !setorFiltro || pai.grupo === setorFiltro),
    [pais, setorFiltro]
  );
  const filtrados = useMemo(
    () =>
      doGrupo.filter(
        (pai) => match(pai.codigo) || match(pai.nome) || match(pai.grupo) || match(pai.observacao ?? '')
      ),
    [doGrupo, match]
  );
  const gradePais = useGradeFiltrosExcel<DecomposicaoPaiGrade>({
    rows: filtrados,
    columnIds: COLUNAS_PAI_IDS,
    getCellText: textoCelulaPai,
    valueForSort: valorOrdenacaoPai,
  });
  const paisExibidos = gradePais.rowsExibidas;
  const colunaNumerica = gradePais.colunaFiltroAberta != null && COLUNAS_PAI_NUMERICAS.has(gradePais.colunaFiltroAberta);

  const ordensDoGrupo = useMemo(
    () =>
      ordens.filter(
        (ordem) =>
          (!setorFiltro || ordem.grupo === setorFiltro) &&
          (match(ordem.numero) || match(ordem.codigoPai) || match(ordem.nomePai) || match(ordem.observacao ?? ''))
      ),
    [ordens, setorFiltro, match]
  );

  const abrirEdicao = async (id: number) => {
    setAbrindoEdicao(id);
    setErro(null);
    try {
      const [pai, lista] = await Promise.all([obterDecomposicaoPai(id), listarCadastrosDecomposicao()]);
      setOutrosPais(lista.filter((item) => item.id !== pai.id));
      setErroEdicao(null);
      setPaiEdicao(pai);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao abrir o produto pai.');
    } finally {
      setAbrindoEdicao(null);
    }
  };

  const salvarEdicao = async (body: {
    grupo: string;
    codigo: string;
    nome: string;
    observacao: string;
    filhos: DecomposicaoFilhoCadastro[];
    pecas: DecomposicaoPecaCadastro[];
  }) => {
    if (!paiEdicao) return;
    setSalvandoEdicao(true);
    setErroEdicao(null);
    try {
      await salvarDecomposicaoPai(paiEdicao.id, body);
      setPaiEdicao(null);
      await carregar(true);
    } catch (e) {
      setErroEdicao(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const confirmarOrdem = async (body: { quantidade: number; observacao: string }) => {
    if (!paiOrdem) return;
    setGerando(true);
    setErroGerar(null);
    try {
      const ordem = await emitirOrdemProducao({ paiId: paiOrdem.id, ...body });
      setPaiOrdem(null);
      setOrdemAberta(ordem);
      await carregar(true);
    } catch (e) {
      setErroGerar(e instanceof Error ? e.message : 'Erro ao gerar a ordem.');
    } finally {
      setGerando(false);
    }
  };

  const abrirDetalhe = async (id: number) => {
    setDetalheId(id);
    setErroDetalhe(null);
    const cached = detalheCacheRef.current.get(id);
    if (cached) {
      setDetalhe(cached);
      setCarregandoDetalhe(false);
      return;
    }
    setDetalhe(null);
    setCarregandoDetalhe(true);
    try {
      const data = await detalharDecomposicao(id);
      detalheCacheRef.current.set(id, data.pai);
      setDetalhe(data.pai);
      if (!data.carteiraDisponivel) {
        setErroDetalhe(data.carteiraErro || 'Carteira do NOMUS indisponível.');
      }
    } catch (e) {
      setErroDetalhe(e instanceof Error ? e.message : 'Erro ao abrir o detalhe.');
    } finally {
      setCarregandoDetalhe(false);
    }
  };

  if (!podeVer) return <Navigate to="/sem-acesso" replace />;

  return (
    <div className="relative space-y-4">
      {carregando && <CarregandoInformacoesOverlay />}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
            Ordem de produção
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
            O catálogo não fica preso a um tipo de produto. Filtre pelo setor, gere a ordem em cada pai e imprima o papel para a produção.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ComoLerBtn onClick={() => setAjuda(true)} title="Como ler a ordem de produção" />
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            onClick={() => void carregar()}
          >
            Atualizar carteira
          </button>
          <button
            type="button"
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
            onClick={() => setCadastrosAberto(true)}
          >
            Cadastros
          </button>
        </div>
      </div>

      {erro && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>
      )}
      {avisoCarteira && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{avisoCarteira}</p>
      )}

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700" role="tablist" aria-label="Ordem de produção">
        {(
          [
            ['pais', 'Produtos pai'],
            ['historico', 'Histórico'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={aba === id}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              aba === id
                ? 'border-primary-600 text-primary-700 dark:text-primary-300'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
            onClick={() => setAba(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="block max-w-xs text-sm">
        <span className="mb-1 block font-medium text-slate-700 dark:text-slate-300">Setor</span>
        <select
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          value={setorFiltro}
          onChange={(e) => setSetorFiltro(e.target.value)}
        >
          <option value="">Todos os setores</option>
          {setores.map((setor) => (
            <option key={setor.id} value={setor.nome}>
              {setor.nome}
            </option>
          ))}
        </select>
      </label>

      <input
        className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}
      />

      {aba === 'pais' && (
      <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Produtos pai</h2>
          <p className="mt-1 text-xs text-slate-500">Verde: tem saldo para produzir.</p>
        </div>
        {gradePais.temFiltrosOuOrdem && (
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            onClick={() => gradePais.limparFiltrosGrade()}
          >
            Limpar filtros da grade
          </button>
        )}
      </div>

      {!carregando && filtrados.length === 0 ? (
        <MensagemSemRegistros />
      ) : (
        <div
          ref={gradePais.tableScrollRef}
          className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
        >
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-primary-600 text-white">
              <tr>
                {COLUNAS_PAI.map((coluna) => {
                  const sortAtivo =
                    gradePais.sortState?.key === coluna.id || gradePais.sortLevels.some((nivel) => nivel.id === coluna.id);
                  return (
                    <th key={coluna.id} className="px-4 py-3 font-semibold whitespace-nowrap">
                      <div className="flex items-center justify-between gap-2">
                        <span>{coluna.label}</span>
                        <GradeFiltroCabecalhoBtn
                          ativo={gradePais.colunaComFiltroAtivo(coluna.id) || sortAtivo}
                          onClick={(e) => gradePais.abrirFiltroExcel(coluna.id, e)}
                        />
                      </div>
                    </th>
                  );
                })}
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {paisExibidos.length === 0 ? (
                <tr>
                  <td colSpan={COLUNAS_PAI.length + 1} className="px-4 py-8 text-center text-slate-500">
                    Nenhum produto com os filtros da grade. Ajuste ou limpe os filtros por coluna.
                  </td>
                </tr>
              ) : (
              paisExibidos.map((pai) => {
                const temSaldo = (pai.sugestao ?? 0) > 0;
                return (
                <tr
                  key={pai.id}
                  className={
                    temSaldo
                      ? 'border-t border-l-4 border-emerald-500/80 bg-emerald-500/10'
                      : 'border-t border-slate-100 dark:border-slate-700'
                  }
                >
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{pai.codigo}</td>
                  <td className="px-4 py-3">{pai.grupo}</td>
                  <td className="px-4 py-3">
                    <div className="text-slate-800 dark:text-slate-100">{pai.nome}</div>
                    {pai.observacao && <div className="text-xs text-slate-500">{pai.observacao}</div>}
                  </td>
                  <td className="px-4 py-3">{pai.qtdFilhos}</td>
                  <td className="px-4 py-3">{pai.qtdPecas}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      title="Saldo em aberto dos filhos"
                      className="font-semibold text-primary-700 underline-offset-2 hover:underline dark:text-primary-300"
                      onClick={() => void abrirDetalhe(pai.id)}
                    >
                      {fmt(pai.sugestao)}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="mr-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-500 dark:text-slate-100 dark:hover:bg-slate-700"
                      disabled={abrindoEdicao === pai.id}
                      onClick={() => void abrirEdicao(pai.id)}
                    >
                      {abrindoEdicao === pai.id ? 'Abrindo…' : 'Editar'}
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white hover:bg-primary-700"
                      onClick={() => {
                        setErroGerar(null);
                        setPaiOrdem(pai);
                      }}
                    >
                      Gerar ordem
                    </button>
                  </td>
                </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>
      )}

      {gradePais.colunaFiltroAberta && gradePais.filtroAbertoRect && (
        <GradeFiltroExcelPortal
          colunaAberta={gradePais.colunaFiltroAberta}
          rect={gradePais.filtroAbertoRect}
          dropdownRef={gradePais.filtroDropdownRef}
          excelFilterDrafts={gradePais.excelFilterDrafts}
          setExcelFilterDrafts={gradePais.setExcelFilterDrafts}
          valoresUnicosPorColuna={gradePais.valoresUnicosPorColuna}
          sortAscLabel={colunaNumerica ? 'Menor para Maior' : 'De A a Z'}
          sortDescLabel={colunaNumerica ? 'Maior para Menor' : 'De Z a A'}
          showNumericFilters={colunaNumerica}
          onSortAsc={(colId) => {
            gradePais.setSortState({ key: colId, direction: 'asc' });
            gradePais.setSortLevels([]);
            gradePais.fecharFiltroExcel();
          }}
          onSortDesc={(colId) => {
            gradePais.setSortState({ key: colId, direction: 'desc' });
            gradePais.setSortLevels([]);
            gradePais.fecharFiltroExcel();
          }}
          onAplicar={gradePais.aplicarFiltroExcel}
          onCancelar={gradePais.fecharFiltroExcel}
        />
      )}
      </>
      )}

      {aba === 'historico' && (
      <section className="space-y-2">
        {ordensDoGrupo.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma ordem gerada neste filtro.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-primary-600 text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold">Data</th>
                  <th className="px-4 py-3 font-semibold">Usuário</th>
                  <th className="px-4 py-3 font-semibold">Ordem</th>
                  <th className="px-4 py-3 font-semibold">Produto pai</th>
                  <th className="px-4 py-3 font-semibold">Quantidade</th>
                  <th className="px-4 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {ordensDoGrupo.map((ordem) => (
                  <tr key={ordem.id} className="border-t border-slate-100 dark:border-slate-700">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-800 dark:text-slate-100">
                      {new Date(ordem.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">{ordem.criadoPorLogin || '—'}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{ordem.numero}</td>
                    <td className="px-4 py-3">
                      <div>{ordem.codigoPai}</div>
                      <div className="text-xs text-slate-500">{ordem.nomePai}</div>
                    </td>
                    <td className="px-4 py-3">{fmt(ordem.quantidade)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        className="mr-3 text-sm font-medium text-slate-700 hover:underline dark:text-slate-200"
                        onClick={() => setOrdemAberta(ordem)}
                      >
                        Ver
                      </button>
                      <button
                        type="button"
                        className="text-sm font-medium text-primary-700 hover:underline dark:text-primary-300"
                        onClick={() => void imprimirOrdemProducao(ordem)}
                      >
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      <DecomposicaoAjudaModal aberto={ajuda} onClose={() => setAjuda(false)} />

      {paiEdicao && (
        <ModalProdutoPai
          pai={paiEdicao}
          grupoInicial={paiEdicao.grupo}
          setores={setores}
          outrosPais={outrosPais}
          salvando={salvandoEdicao}
          erro={erroEdicao}
          onClose={() => setPaiEdicao(null)}
          onSalvar={(body) => void salvarEdicao(body)}
        />
      )}

      {paiOrdem && (
        <ModalGerarOrdem
          pai={paiOrdem}
          salvando={gerando}
          erro={erroGerar}
          onClose={() => setPaiOrdem(null)}
          onConfirmar={(body) => void confirmarOrdem(body)}
        />
      )}

      {ordemAberta && (
        <ModalVerOrdem
          ordem={ordemAberta}
          onClose={() => setOrdemAberta(null)}
          onAtualizada={(ordem) => {
            setOrdemAberta(ordem);
            setOrdens((lista) => lista.map((item) => (item.id === ordem.id ? ordem : item)));
          }}
        />
      )}

      {cadastrosAberto && (
        <ModalCadastrosDecomposicao
          setorInicial={setorFiltro}
          onClose={() => setCadastrosAberto(false)}
          onAlterado={(setorSalvo) => {
            if (setorSalvo) setSetorFiltro(setorSalvo);
            void carregar(true);
          }}
        />
      )}

      {detalheId != null && (
        <ModalDetalheDecomposicao
          detalhe={detalhe}
          carregando={carregandoDetalhe}
          erro={erroDetalhe}
          onClose={() => {
            setDetalheId(null);
            setDetalhe(null);
            setErroDetalhe(null);
          }}
        />
      )}
    </div>
  );
}
