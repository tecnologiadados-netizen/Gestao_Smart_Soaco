import { useEffect, useMemo, useState } from 'react';

import { createPortal } from 'react-dom';

import { fetchDreFornecedorOpcoes } from '../../../api/financeiro';

import { criarMatcherTextoLivre, PLACEHOLDER_BUSCA_TEXTO_LIVRE } from '../../../utils/textoLivreBusca';

import { listarOpcoesRateioPlanoContasDre } from './drePlanoContasOpcoes';

import type { DreRateioOrigem } from './dreRateioEmpresas';



export type DreRateioOrigemModalProps = {

  aberto: boolean;

  onClose: () => void;

  onConfirmar: (origem: DreRateioOrigem) => void;

  /** Pré-preenche conta/fornecedores ao editar uma regra existente. */

  origemInicial?: DreRateioOrigem | null;

  modo?: 'adicionar' | 'editar';

};



const OPCOES_PLANO = listarOpcoesRateioPlanoContasDre();



const INPUT_CLASS =

  'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 min-h-[42px]';



type AbaOrigem = 'plano_contas' | 'fornecedores';

type EtapaFornecedor = 'conta' | 'fornecedores';



function ListagemComBusca({

  busca,

  onBusca,

  ariaLabel,

  children,

}: {

  busca: string;

  onBusca: (v: string) => void;

  ariaLabel: string;

  children: React.ReactNode;

}) {

  return (

    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 dark:border-slate-600">

      <div className="shrink-0 border-b border-slate-200 bg-slate-50/90 p-2 dark:border-slate-600 dark:bg-slate-900/50">

        <input

          type="search"

          value={busca}

          onChange={(e) => onBusca(e.target.value)}

          placeholder={PLACEHOLDER_BUSCA_TEXTO_LIVRE}

          className={INPUT_CLASS}

          aria-label={ariaLabel}

        />

      </div>

      <div className="min-h-0 flex-1 overflow-auto">{children}</div>

    </div>

  );

}



export default function DreRateioOrigemModal({

  aberto,

  onClose,

  onConfirmar,

  origemInicial = null,

  modo = 'adicionar',

}: DreRateioOrigemModalProps) {

  const [aba, setAba] = useState<AbaOrigem>('plano_contas');

  const [buscaPlano, setBuscaPlano] = useState('');

  const [planoSel, setPlanoSel] = useState(

    OPCOES_PLANO.find((o) => o.codigo === '13.1.1')?.pathKey ?? '',

  );



  const [etapaFornecedor, setEtapaFornecedor] = useState<EtapaFornecedor>('conta');

  const [contaFornecedor, setContaFornecedor] = useState('');

  const [buscaFornecedores, setBuscaFornecedores] = useState('');

  const [fornecedoresSelecionados, setFornecedoresSelecionados] = useState<string[]>([]);

  const [fornecedorOpcoes, setFornecedorOpcoes] = useState<string[]>([]);

  const [carregandoFornecedores, setCarregandoFornecedores] = useState(false);

  const [erroFornecedores, setErroFornecedores] = useState<string | null>(null);



  useEffect(() => {

    if (!aberto) return;

    if (origemInicial) {

      if (origemInicial.tipo === 'plano_contas') {

        setAba('plano_contas');

        setBuscaPlano('');

        setPlanoSel(origemInicial.pathKey);

      } else {

        setAba('fornecedores');

        setEtapaFornecedor('fornecedores');

        setContaFornecedor(origemInicial.pathKeyConta);

        setBuscaFornecedores('');

        setFornecedoresSelecionados([...origemInicial.nomes]);

      }

      setErroFornecedores(null);

      setFornecedorOpcoes([]);

      return;

    }

    setAba('plano_contas');

    setBuscaPlano('');

    setPlanoSel(OPCOES_PLANO.find((o) => o.codigo === '13.1.1')?.pathKey ?? '');

    setEtapaFornecedor('conta');

    setContaFornecedor('');

    setBuscaFornecedores('');

    setFornecedoresSelecionados([]);

    setFornecedorOpcoes([]);

    setErroFornecedores(null);

  }, [aberto, origemInicial]);



  useEffect(() => {

    if (aba !== 'fornecedores') {

      setEtapaFornecedor('conta');

      setBuscaFornecedores('');

    }

  }, [aba]);



  const matchPlano = useMemo(() => criarMatcherTextoLivre(buscaPlano), [buscaPlano]);

  const matchFornecedores = useMemo(() => criarMatcherTextoLivre(buscaFornecedores), [buscaFornecedores]);



  const planosFiltrados = useMemo(

    () => OPCOES_PLANO.filter((o) => matchPlano(o.label) || matchPlano(o.codigo)),

    [matchPlano],

  );



  const contasFornecedorFiltradas = useMemo(

    () => OPCOES_PLANO.filter((o) => matchFornecedores(o.label) || matchFornecedores(o.codigo)),

    [matchFornecedores],

  );



  const contaFornecedorMeta = useMemo(

    () => OPCOES_PLANO.find((o) => o.pathKey === contaFornecedor),

    [contaFornecedor],

  );



  const fornecedoresIds = fornecedoresSelecionados;



  const fornecedoresFiltrados = useMemo(

    () => fornecedorOpcoes.filter((n) => matchFornecedores(n)),

    [fornecedorOpcoes, matchFornecedores],

  );



  const fornecedoresSelecionadosSet = useMemo(() => new Set(fornecedoresIds), [fornecedoresIds]);



  const toggleFornecedor = (nome: string) => {
    setFornecedoresSelecionados((prev) => {
      const set = new Set(prev);
      if (set.has(nome)) set.delete(nome);
      else set.add(nome);
      return [...set];
    });
  };

  const toggleTodosFornecedores = () => {
    const todosVisiveis = fornecedoresFiltrados.every((n) => fornecedoresSelecionadosSet.has(n));
    setFornecedoresSelecionados((prev) => {
      const set = new Set(prev);
      if (todosVisiveis) {
        for (const n of fornecedoresFiltrados) set.delete(n);
      } else {
        for (const n of fornecedoresFiltrados) set.add(n);
      }
      return [...set];
    });
  };



  const selecionarContaFornecedor = (pathKey: string) => {

    setContaFornecedor(pathKey);

    setEtapaFornecedor('fornecedores');

    setBuscaFornecedores('');

    setFornecedoresSelecionados([]);

  };



  const voltarParaContas = () => {

    setEtapaFornecedor('conta');

    setBuscaFornecedores('');

    setFornecedorOpcoes([]);

    setErroFornecedores(null);

  };



  useEffect(() => {

    if (!aberto || aba !== 'fornecedores' || etapaFornecedor !== 'fornecedores' || !contaFornecedor) return;

    let cancelled = false;

    setCarregandoFornecedores(true);

    setErroFornecedores(null);

    void fetchDreFornecedorOpcoes({ pathKey: contaFornecedor }).then((r) => {

      if (cancelled) return;

      setCarregandoFornecedores(false);

      if (r.erro) setErroFornecedores(r.erro);

      setFornecedorOpcoes(r.nomes);

    });

    return () => {

      cancelled = true;

    };

  }, [aberto, aba, etapaFornecedor, contaFornecedor]);



  const podeConfirmar =

    aba === 'plano_contas'

      ? Boolean(planoSel)

      : Boolean(contaFornecedor && fornecedoresIds.length > 0);



  const handleConfirmar = () => {

    if (aba === 'plano_contas') {

      const meta = OPCOES_PLANO.find((o) => o.pathKey === planoSel);

      if (!meta) return;

      onConfirmar({

        tipo: 'plano_contas',

        codigo: meta.codigo,

        pathKey: meta.pathKey,

        nome: meta.nome,

      });

    } else {

      const meta = contaFornecedorMeta;

      if (!meta || fornecedoresIds.length === 0) return;

      onConfirmar({

        tipo: 'fornecedores',

        codigoConta: meta.codigo,

        pathKeyConta: meta.pathKey,

        nomeConta: meta.nome,

        nomes: fornecedoresIds,

      });

    }

    onClose();

  };



  if (!aberto || typeof document === 'undefined') return null;



  return createPortal(

    <div

      className="fixed inset-0 z-[10060] flex items-center justify-center p-3 sm:p-6 bg-black/70 dark:bg-slate-950/60"

      onClick={onClose}

      role="presentation"

    >

      <div

        className="relative flex w-full max-w-4xl min-h-[min(82vh,760px)] max-h-[min(96vh,920px)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800"

        onClick={(e) => e.stopPropagation()}

        role="dialog"

        aria-modal="true"

        aria-labelledby="dre-rateio-origem-titulo"

      >

        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-600">

          <div className="min-w-0 pr-2">

            <h2 id="dre-rateio-origem-titulo" className="text-xl font-semibold text-slate-800 dark:text-slate-100">

              {modo === 'editar' ? 'Editar origem' : 'Adicionar origem'}

            </h2>

            <p className="mt-1 text-sm sm:text-base text-slate-600 dark:text-slate-400">

              {modo === 'editar'

                ? 'Altere a conta ou os fornecedores desta regra. Os percentuais por empresa são mantidos.'

                : 'Escolha plano de contas ou fornecedores. Cada origem adicionada pode ter percentuais próprios.'}

            </p>

          </div>

          <button

            type="button"

            onClick={onClose}

            className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600"

            aria-label="Fechar"

          >

            ×

          </button>

        </div>



        <div className="shrink-0 flex gap-1 border-b border-slate-200 px-5 pt-2 dark:border-slate-600">

          <button

            type="button"

            onClick={() => setAba('plano_contas')}

            className={`px-4 py-2.5 text-sm sm:text-base font-medium rounded-t-lg border-b-2 transition ${

              aba === 'plano_contas'

                ? 'border-primary-600 text-primary-700 dark:text-primary-300'

                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'

            }`}

          >

            Plano de contas

          </button>

          <button

            type="button"

            onClick={() => setAba('fornecedores')}

            className={`px-4 py-2.5 text-sm sm:text-base font-medium rounded-t-lg border-b-2 transition ${

              aba === 'fornecedores'

                ? 'border-primary-600 text-primary-700 dark:text-primary-300'

                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'

            }`}

          >

            Fornecedores

          </button>

        </div>



        <div className="min-h-0 flex-1 overflow-hidden flex flex-col px-5 py-4">

          {aba === 'plano_contas' ? (

            <div className="flex min-h-0 flex-1 flex-col gap-3">

              <ListagemComBusca

                busca={buscaPlano}

                onBusca={setBuscaPlano}

                ariaLabel="Pesquisar plano de contas"

              >

                <ul className="divide-y divide-slate-100 dark:divide-slate-700">

                  {planosFiltrados.map((o) => (

                    <li key={o.pathKey}>

                      <button

                        type="button"

                        onClick={() => setPlanoSel(o.pathKey)}

                        className={`w-full text-left px-4 py-3 text-sm sm:text-base transition ${

                          planoSel === o.pathKey

                            ? 'bg-primary-50 text-primary-900 dark:bg-primary-950/40 dark:text-primary-100'

                            : 'hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-800 dark:text-slate-200'

                        }`}

                      >

                        {o.label}

                      </button>

                    </li>

                  ))}

                  {planosFiltrados.length === 0 ? (

                    <li className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400 text-center">

                      Nenhuma conta encontrada.

                    </li>

                  ) : null}

                </ul>

              </ListagemComBusca>

              <p className="shrink-0 text-sm text-slate-500 dark:text-slate-400">

                Contas com filhas por empresa (ex.: 13.1.12 Pró-labore) distribuem o total nas linhas filhas conforme

                os percentuais.

              </p>

            </div>

          ) : (

            <div className="flex min-h-0 flex-1 flex-col gap-3">

              {etapaFornecedor === 'fornecedores' && contaFornecedorMeta ? (

                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">

                  <button

                    type="button"

                    onClick={voltarParaContas}

                    className="text-sm font-medium text-primary-700 hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200"

                  >

                    ← Trocar conta

                  </button>

                  <span className="text-sm text-slate-600 dark:text-slate-400">{contaFornecedorMeta.label}</span>

                  {fornecedoresIds.length > 0 ? (

                    <span className="text-sm font-medium text-primary-700 dark:text-primary-300">

                      {fornecedoresIds.length} selecionado{fornecedoresIds.length === 1 ? '' : 's'}

                    </span>

                  ) : null}

                </div>

              ) : null}



              {erroFornecedores ? (

                <p className="shrink-0 text-sm text-amber-700 dark:text-amber-300">{erroFornecedores}</p>

              ) : null}



              <ListagemComBusca

                busca={buscaFornecedores}

                onBusca={setBuscaFornecedores}

                ariaLabel={

                  etapaFornecedor === 'conta' ? 'Pesquisar conta DRE' : 'Pesquisar fornecedor'

                }

              >

                {etapaFornecedor === 'conta' ? (

                  <ul className="divide-y divide-slate-100 dark:divide-slate-700">

                    {contasFornecedorFiltradas.map((o) => (

                      <li key={o.pathKey}>

                        <button

                          type="button"

                          onClick={() => selecionarContaFornecedor(o.pathKey)}

                          className="w-full text-left px-4 py-3 text-sm sm:text-base transition hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-800 dark:text-slate-200"

                        >

                          {o.label}

                        </button>

                      </li>

                    ))}

                    {contasFornecedorFiltradas.length === 0 ? (

                      <li className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400 text-center">

                        Nenhuma conta encontrada.

                      </li>

                    ) : null}

                  </ul>

                ) : carregandoFornecedores ? (

                  <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400 text-center animate-pulse">

                    Carregando fornecedores…

                  </p>

                ) : (

                  <>

                    {fornecedoresFiltrados.length > 0 ? (

                      <label className="flex cursor-pointer items-start gap-3 border-b border-slate-100 px-4 py-3 text-sm sm:text-base hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50">

                        <input

                          type="checkbox"

                          checked={fornecedoresFiltrados.every((n) => fornecedoresSelecionadosSet.has(n))}

                          onChange={toggleTodosFornecedores}

                          className="mt-1 shrink-0 rounded border-slate-400 text-primary-600 focus:ring-primary-500"

                        />

                        <span className="font-medium text-slate-600 dark:text-slate-300">

                          Selecionar todos (visíveis)

                        </span>

                      </label>

                    ) : null}

                    {fornecedoresFiltrados.map((nome) => (

                      <label

                        key={nome}

                        className="flex cursor-pointer items-start gap-3 border-b border-slate-100 px-4 py-3 text-sm sm:text-base last:border-b-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50"

                      >

                        <input

                          type="checkbox"

                          checked={fornecedoresSelecionadosSet.has(nome)}

                          onChange={() => toggleFornecedor(nome)}

                          className="mt-1 shrink-0 rounded border-slate-400 text-primary-600 focus:ring-primary-500"

                        />

                        <span className="min-w-0 flex-1 break-words leading-snug text-slate-800 dark:text-slate-100">

                          {nome}

                        </span>

                      </label>

                    ))}

                    {fornecedoresFiltrados.length === 0 ? (

                      <p className="px-4 py-6 text-sm sm:text-base text-slate-500 dark:text-slate-400 text-center">

                        {fornecedorOpcoes.length === 0

                          ? 'Nenhum fornecedor nesta conta.'

                          : 'Nenhum fornecedor corresponde à busca.'}

                      </p>

                    ) : null}

                  </>

                )}

              </ListagemComBusca>



              <p className="shrink-0 text-sm text-slate-500 dark:text-slate-400">

                {etapaFornecedor === 'conta'

                  ? 'Escolha a conta DRE na listagem. Em seguida, marque os fornecedores do rateio.'

                  : 'Lista histórica no Nomus e no Shop9 (todas as filiais, sem filtro de período). Somente os selecionados entram no rateio.'}

              </p>

            </div>

          )}

        </div>



        <div className="shrink-0 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40">

          <button

            type="button"

            onClick={onClose}

            className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"

          >

            Cancelar

          </button>

          <button

            type="button"

            onClick={handleConfirmar}

            disabled={!podeConfirmar}

            className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition shadow-sm"

          >

            {modo === 'editar' ? 'Confirmar alterações' : 'Confirmar e adicionar'}

          </button>

        </div>

      </div>

    </div>,

    document.body,

  );

}


