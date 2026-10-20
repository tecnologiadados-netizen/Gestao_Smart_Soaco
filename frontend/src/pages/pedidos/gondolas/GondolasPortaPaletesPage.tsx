import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Printer, RefreshCw, Upload, Warehouse } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { PERMISSOES } from '../../../config/permissoes';
import { ComoLerBtn } from '../../../components/AjudaTelaModal';
import CarregandoInformacoesOverlay from '../../../components/CarregandoInformacoesOverlay';
import GradeCelulaModalBtn from '../../../components/pcp/GradeCelulaModalBtn';
import GradeFiltroCabecalhoBtn from '../../../components/grade/GradeFiltroCabecalhoBtn';
import GradeFiltroExcelPortal from '../../../components/grade/GradeFiltroExcelPortal';
import { MensagemSemRegistros } from '../../../components/MensagemSemRegistros';
import { useGradeFiltrosExcel } from '../../../hooks/useGradeFiltrosExcel';
import {
  detalharItemGondola,
  importarPlanilhaGondola,
  listarItensGondolas,
  type DetalheItemGondola,
  type ItemCarteiraGondola,
  type ResumoPlanilhaGondola,
  type SetorGondola,
} from '../../../api/gondolasPortaPaletes';
import GondolasAjudaModal from './GondolasAjudaModal';
import ModalFichaItem from './ModalFichaItem';
import ModalGerarOrdem from './ModalGerarOrdem';
import { imprimirOrdemGondolas } from './imprimirOrdemGondolas';

function fmt(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function dataBr(iso: string): string {
  if (!iso || iso.length < 10) return '—';
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

const painel = 'rounded-xl border border-soaco-gray/35 bg-white dark:bg-soaco-graphite';

const thGrade = 'px-2 py-2.5 text-left text-xs font-semibold whitespace-nowrap align-middle';

const COLUNAS = [
  { id: 'pedido', label: 'Pedido', alinhamento: 'left' },
  { id: 'cliente', label: 'Cliente', alinhamento: 'left' },
  { id: 'codigo', label: 'Código', alinhamento: 'left' },
  { id: 'descricao', label: 'Descrição', alinhamento: 'left' },
  { id: 'setor', label: 'Setor', alinhamento: 'left' },
  { id: 'entrega', label: 'Entrega', alinhamento: 'left' },
  { id: 'status', label: 'Status', alinhamento: 'left' },
  { id: 'pedida', label: 'Pedida', alinhamento: 'right' },
  { id: 'pendente', label: 'Pendente', alinhamento: 'right' },
  { id: 'pendenteReal', label: 'Pendente real', alinhamento: 'right' },
] as const;

const COLUNAS_NUMERO = new Set<string>(['pedida', 'pendente', 'pendenteReal']);

function textoCelula(item: ItemCarteiraGondola, coluna: string): string {
  switch (coluna) {
    case 'pedido':
      return item.pedido;
    case 'cliente':
      return item.cliente;
    case 'codigo':
      return item.codigo;
    case 'descricao':
      return item.descricao;
    case 'setor':
      return item.setor;
    case 'entrega':
      return dataBr(item.dataEntrega);
    case 'status':
      return item.status;
    case 'pedida':
      return fmt(item.qtdePedida);
    case 'pendente':
      return fmt(item.pendente);
    case 'pendenteReal':
      return fmt(item.qtdePendenteReal);
    default:
      return '';
  }
}

function valorOrdenacao(item: ItemCarteiraGondola, coluna: string): string | number {
  if (coluna === 'pedida') return item.qtdePedida;
  if (coluna === 'pendente') return item.pendente;
  if (coluna === 'pendenteReal') return item.qtdePendenteReal;
  if (coluna === 'entrega') return item.dataEntrega || '';
  return textoCelula(item, coluna);
}

function podeVerTela(hasPermission: (codigo: string) => boolean): boolean {
  return (
    hasPermission(PERMISSOES.PCP_VER_TELA) ||
    hasPermission(PERMISSOES.PCP_TOTAL) ||
    hasPermission(PERMISSOES.PEDIDOS_VER) ||
    hasPermission(PERMISSOES.PCP_ORDEM_PRODUCAO_VER) ||
    hasPermission(PERMISSOES.PCP_ORDEM_PRODUCAO_GERAR)
  );
}

export default function GondolasPortaPaletesPage() {
  const { hasPermission } = useAuth();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [itens, setItens] = useState<ItemCarteiraGondola[]>([]);
  const [planilha, setPlanilha] = useState<ResumoPlanilhaGondola | null>(null);
  const [consultou, setConsultou] = useState(false);
  const [setor, setSetor] = useState<'' | SetorGondola>('');
  const [ajuda, setAjuda] = useState(false);
  const [importando, setImportando] = useState<SetorGondola | null>(null);
  const [avisoImportacao, setAvisoImportacao] = useState<string | null>(null);

  const [detalheId, setDetalheId] = useState<number | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheItemGondola | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [erroDetalhe, setErroDetalhe] = useState<string | null>(null);
  const [ordemAberta, setOrdemAberta] = useState(false);
  const [gerandoOrdem, setGerandoOrdem] = useState(false);
  const [erroOrdem, setErroOrdem] = useState<string | null>(null);
  const detalheCacheRef = useRef(new Map<number, DetalheItemGondola>());

  const filtrar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    setAvisoImportacao(null);
    detalheCacheRef.current.clear();
    setDetalheId(null);
    setDetalhe(null);
    try {
      const data = await listarItensGondolas();
      setItens(data.itens);
      setPlanilha(data.planilha);
      setConsultou(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar a carteira.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void filtrar();
  }, [filtrar]);

  const visiveis = useMemo(
    () => (setor ? itens.filter((item) => item.setor === setor) : itens),
    [itens, setor]
  );

  const grade = useGradeFiltrosExcel({
    rows: visiveis,
    columnIds: COLUNAS.map((coluna) => coluna.id),
    getCellText: textoCelula,
    valueForSort: valorOrdenacao,
    dateColumnIds: ['entrega'],
  });
  const linhas = grade.rowsExibidas;
  const colunaNumero = COLUNAS_NUMERO.has(grade.colunaFiltroAberta ?? '');
  const itensComFicha = useMemo(() => itens.filter((item) => item.temFicha), [itens]);

  const resumo = useMemo(() => {
    let gondolas = 0;
    let portaPaletes = 0;
    let pendenteReal = 0;
    for (const item of itens) {
      if (item.setor === 'Gôndolas') gondolas += 1;
      else portaPaletes += 1;
      pendenteReal += item.qtdePendenteReal;
    }
    return { gondolas, portaPaletes, pendenteReal };
  }, [itens]);

  const registrarMedidas = useCallback((codigo: string, medida01: string, medida02: string) => {
    const alvo = codigo.toUpperCase().trim().replace(/\s+/g, ' ').split('.')[0]?.trim() ?? '';
    if (!alvo) return;
    for (const [id, detalhe] of detalheCacheRef.current) {
      if (detalhe.origem !== 'nomus') continue;
      detalheCacheRef.current.set(id, {
        ...detalhe,
        componentes: detalhe.componentes.map((componente) => {
          const chave = componente.codigo.toUpperCase().trim().replace(/\s+/g, ' ').split('.')[0]?.trim() ?? '';
          return chave === alvo ? { ...componente, medida01, medida02 } : componente;
        }),
      });
    }
  }, []);

  const carregarFicha = useCallback(async (item: ItemCarteiraGondola) => {
    const cache = detalheCacheRef.current.get(item.idItem);
    if (cache) return cache;
    const data = await detalharItemGondola(item.idItem);
    detalheCacheRef.current.set(item.idItem, data);
    return data;
  }, []);

  async function gerarOrdem(detalhes: DetalheItemGondola[]) {
    if (detalhes.length === 0) {
      setErroOrdem('Marque ao menos uma peça.');
      return;
    }
    setGerandoOrdem(true);
    setErroOrdem(null);
    try {
      await imprimirOrdemGondolas(detalhes);
      setOrdemAberta(false);
    } catch (e) {
      setErroOrdem(e instanceof Error ? e.message : 'Erro ao gerar a ordem.');
    } finally {
      setGerandoOrdem(false);
    }
  }

  async function abrirItem(item: ItemCarteiraGondola) {
    setDetalheId(item.idItem);
    setErroDetalhe(null);
    const cache = detalheCacheRef.current.get(item.idItem);
    if (cache) {
      setDetalhe(cache);
      return;
    }
    setDetalhe(null);
    setCarregandoDetalhe(true);
    try {
      const data = await detalharItemGondola(item.idItem);
      detalheCacheRef.current.set(item.idItem, data);
      setDetalhe(data);
    } catch (e) {
      setErroDetalhe(e instanceof Error ? e.message : 'Erro ao abrir a ficha.');
    } finally {
      setCarregandoDetalhe(false);
    }
  }

  async function importar(setorArquivo: SetorGondola, arquivo: File | undefined) {
    if (!arquivo) return;
    setImportando(setorArquivo);
    setAvisoImportacao(null);
    setErro(null);
    try {
      const data = await importarPlanilhaGondola(setorArquivo, arquivo);
      const lista = await listarItensGondolas();
      setItens(lista.itens);
      setPlanilha(lista.planilha);
      detalheCacheRef.current.clear();
      setAvisoImportacao(`${setorArquivo}: ${data.importadas.toLocaleString('pt-BR')} linhas na planilha.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao importar a planilha.');
    } finally {
      setImportando(null);
    }
  }

  if (!podeVerTela(hasPermission)) return <Navigate to="/sem-acesso" replace />;

  const cartoes: { id: '' | SetorGondola; titulo: string; valor: string; detalhe: string }[] = [
    {
      id: '',
      titulo: 'Carteira',
      valor: itens.length.toLocaleString('pt-BR'),
      detalhe: `${fmt(resumo.pendenteReal)} pendente real`,
    },
    {
      id: 'Gôndolas',
      titulo: 'Gôndolas',
      valor: resumo.gondolas.toLocaleString('pt-BR'),
      detalhe: 'itens em aberto',
    },
    {
      id: 'Porta Paletes',
      titulo: 'Porta-paletes',
      valor: resumo.portaPaletes.toLocaleString('pt-BR'),
      detalhe: 'itens em aberto',
    },
  ];

  return (
    <div className="relative space-y-5">
      {carregando && <CarregandoInformacoesOverlay />}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">PCP</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Gôndolas e porta-paletes
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Clique no item para abrir a ficha de produção. O detalhe vem do Nomus ou, se a ficha não existir, da planilha.
          </p>
        </div>
        <ComoLerBtn onClick={() => setAjuda(true)} title="Como ler gôndolas e porta-paletes" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {cartoes.map((cartao) => {
          const ativo = setor === cartao.id;
          return (
            <button
              key={cartao.titulo}
              type="button"
              aria-pressed={ativo}
              onClick={() => setSetor(cartao.id)}
              className={`${painel} px-4 py-3.5 text-left transition hover:bg-slate-50 dark:hover:bg-soaco-navy/60 ${
                ativo ? 'ring-2 ring-primary-600 ring-offset-2 ring-offset-white dark:ring-offset-black' : ''
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {cartao.titulo}
              </p>
              <p className="mt-1.5 text-[1.65rem] font-semibold leading-none tracking-tight tabular-nums text-slate-900 dark:text-white">
                {cartao.valor}
              </p>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{cartao.detalhe}</p>
            </button>
          );
        })}
      </div>

      <div className={`${painel} flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700"
            onClick={() => void filtrar()}
          >
            <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#FFAD00] px-4 text-sm font-semibold text-black shadow-sm transition hover:bg-[#E69C00]"
            onClick={() => {
              setErroOrdem(null);
              setOrdemAberta(true);
            }}
          >
            <Printer className="h-4 w-4" />
            Gerar ordem
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <p className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
            <Warehouse className="h-3.5 w-3.5 shrink-0" />
            <span>
              Planilha {planilha?.origem === 'importada' ? 'importada' : 'inicial'}:{' '}
              <span className="font-medium text-slate-700 dark:text-slate-100">
                {(planilha?.gondolas ?? 0).toLocaleString('pt-BR')}
              </span>{' '}
              gôndolas ·{' '}
              <span className="font-medium text-slate-700 dark:text-slate-100">
                {(planilha?.portaPaletes ?? 0).toLocaleString('pt-BR')}
              </span>{' '}
              porta-paletes
            </span>
          </p>
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-soaco-gray/40 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-soaco-navy/60">
            <Upload className="h-3.5 w-3.5" />
            {importando === 'Gôndolas' ? 'Importando…' : 'Importar gôndolas'}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={importando != null}
              onChange={(e) => {
                void importar('Gôndolas', e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-soaco-gray/40 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-soaco-navy/60">
            <Upload className="h-3.5 w-3.5" />
            {importando === 'Porta Paletes' ? 'Importando…' : 'Importar porta-paletes'}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={importando != null}
              onChange={(e) => {
                void importar('Porta Paletes', e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>

      {erro && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {erro}
        </p>
      )}
      {avisoImportacao && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {avisoImportacao}
        </p>
      )}

      <div className={`${painel} tabela-pedidos-outer overflow-hidden`}>
        <div className="flex items-center justify-between gap-3 border-b border-soaco-gray/35 px-4 py-2.5">
          <p className="text-sm text-slate-600 dark:text-slate-200">
            {linhas.length.toLocaleString('pt-BR')} {linhas.length === 1 ? 'item' : 'itens'}
            {setor ? ` · ${setor}` : ''}
          </p>
          <p className="flex flex-wrap items-center justify-end gap-3 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded bg-primary-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Nomus
              </span>
              Ficha no Nomus
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="rounded bg-[#FFAD00] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">
                Planilha
              </span>
              Ficha importada
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />
              Sem ficha
            </span>
          </p>
        </div>
        <div ref={grade.tableScrollRef} className="tabela-pedidos-scroll overflow-x-auto">
          <table className="tabela-pedidos-grade w-full min-w-[1040px] text-left text-sm">
            <thead>
              <tr>
                {COLUNAS.map((coluna) => (
                  <th key={coluna.id} className={`${thGrade} ${coluna.alinhamento === 'right' ? 'text-right' : ''}`}>
                    <div className={`flex min-w-0 items-center gap-1 ${coluna.alinhamento === 'right' ? 'justify-end' : 'justify-between'}`}>
                      <span>{coluna.label}</span>
                      <GradeFiltroCabecalhoBtn
                        ativo={grade.colunaComFiltroAtivo(coluna.id)}
                        onClick={(e) => grade.abrirFiltroExcel(coluna.id, e)}
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((item) => (
                <tr key={item.idItem} className="cursor-pointer" onClick={() => void abrirItem(item)}>
                  <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-slate-100">{item.pedido}</td>
                  <td className="max-w-[190px] truncate px-3 py-2.5 text-slate-700 dark:text-slate-200" title={item.cliente}>
                    {item.cliente}
                  </td>
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <span className="inline-flex items-center gap-1.5">
                      <GradeCelulaModalBtn
                        align="left"
                        title={
                          item.origem === 'nomus'
                            ? `Ficha no Nomus · ${item.codigo}`
                            : item.origem === 'planilha'
                              ? `Ficha na planilha · ${item.codigo}`
                              : `${item.codigo} sem ficha no Nomus e na planilha`
                        }
                        className={
                          item.temFicha
                            ? 'inline-flex min-h-7 items-center justify-center rounded-md border border-emerald-600/40 bg-emerald-100 px-2.5 py-1 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-400/60'
                            : 'inline-flex min-h-7 items-center justify-center rounded-md border border-red-600/40 bg-red-100 px-2.5 py-1 text-sm font-semibold text-red-800 shadow-sm transition hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-400/60'
                        }
                        onClick={() => void abrirItem(item)}
                      >
                        {item.codigo}
                      </GradeCelulaModalBtn>
                      {item.origem === 'nomus' && (
                        <span className="rounded bg-primary-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Nomus
                        </span>
                      )}
                      {item.origem === 'planilha' && (
                        <span className="rounded bg-[#FFAD00] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black">
                          Planilha
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="max-w-[280px] truncate px-3 py-2.5 text-slate-700 dark:text-slate-200" title={item.descricao}>
                    {item.descricao}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">{item.setor}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-700 dark:text-slate-200">
                    {dataBr(item.dataEntrega)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">{item.status}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{fmt(item.qtdePedida)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{fmt(item.pendente)}</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums text-slate-800 dark:text-white">
                    {fmt(item.qtdePendenteReal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {consultou && linhas.length === 0 && <MensagemSemRegistros />}
      </div>

      {grade.colunaFiltroAberta && grade.filtroAbertoRect && (
        <GradeFiltroExcelPortal
          colunaAberta={grade.colunaFiltroAberta}
          rect={grade.filtroAbertoRect}
          dropdownRef={grade.filtroDropdownRef}
          excelFilterDrafts={grade.excelFilterDrafts}
          setExcelFilterDrafts={grade.setExcelFilterDrafts}
          valoresUnicosPorColuna={grade.valoresUnicosPorColuna}
          showNumericFilters={colunaNumero}
          showDateRangeFilters={grade.colunaFiltroAberta === 'entrega'}
          sortAscLabel={colunaNumero ? 'Menor para Maior' : undefined}
          sortDescLabel={colunaNumero ? 'Maior para Menor' : undefined}
          onSortAsc={(colId) => {
            grade.setSortState({ key: colId, direction: 'asc' });
            grade.setSortLevels([]);
            grade.fecharFiltroExcel();
          }}
          onSortDesc={(colId) => {
            grade.setSortState({ key: colId, direction: 'desc' });
            grade.setSortLevels([]);
            grade.fecharFiltroExcel();
          }}
          onAplicar={grade.aplicarFiltroExcel}
          onCancelar={grade.fecharFiltroExcel}
        />
      )}

      {detalheId != null && (
        <ModalFichaItem
          detalhe={detalhe}
          carregando={carregandoDetalhe}
          erro={erroDetalhe}
          onClose={() => {
            setDetalheId(null);
            setErroDetalhe(null);
          }}
        />
      )}
      <ModalGerarOrdem
        aberto={ordemAberta}
        itens={itensComFicha}
        gerando={gerandoOrdem}
        erro={erroOrdem}
        onClose={() => setOrdemAberta(false)}
        carregarFicha={carregarFicha}
        onMedidasSalvas={registrarMedidas}
        onGerar={(detalhes) => void gerarOrdem(detalhes)}
      />
      <GondolasAjudaModal aberto={ajuda} onClose={() => setAjuda(false)} />
    </div>
  );
}
