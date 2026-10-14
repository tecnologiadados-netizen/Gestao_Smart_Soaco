import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { PERMISSOES } from '../../config/permissoes';
import { ComoLerBtn } from '../../components/AjudaTelaModal';
import CarregandoInformacoesOverlay from '../../components/CarregandoInformacoesOverlay';
import { fmtQtde } from '../../components/pcp/ModalConsultaEstoqueDetalhe';
import { criarMatcherTextoLivre } from '../../utils/textoLivreBusca';
import {
  obterPipelineAcompanhamento,
  type DetalheAcompanhamento,
  type EtapaAcompanhamento,
  type LinhaAcompanhamento,
} from '../../api/acompanhamentoSolicitacao';
import AcompanhamentoSolicitacaoAjudaModal from './AcompanhamentoSolicitacaoAjudaModal';
import AcompanhamentoSolicitacaoDetalheModal from './AcompanhamentoSolicitacaoDetalheModal';

type FiltroEtapa = 'todas' | EtapaAcompanhamento;

const ETAPAS: {
  id: EtapaAcompanhamento;
  titulo: string;
  apoio: string;
  campo: keyof Pick<LinhaAcompanhamento, 'qtdeSolicitado' | 'qtdeComprado' | 'qtdePreEntrada'>;
  ativo: string;
  anel: string;
}[] = [
  {
    id: 'solicitado',
    titulo: 'Solicitado',
    apoio: 'Liberada, sem pedido',
    campo: 'qtdeSolicitado',
    ativo: 'border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-50',
    anel: 'bg-sky-500',
  },
  {
    id: 'comprado',
    titulo: 'Comprado',
    apoio: 'Pedido em aberto',
    campo: 'qtdeComprado',
    ativo: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50',
    anel: 'bg-amber-500',
  },
  {
    id: 'pre_entrada',
    titulo: 'Pré-entrada',
    apoio: 'Pedido encerrado, documento 173',
    campo: 'qtdePreEntrada',
    ativo: 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-50',
    anel: 'bg-violet-500',
  },
];

function qtdeDaEtapa(linha: LinhaAcompanhamento, etapa: EtapaAcompanhamento): number {
  if (etapa === 'solicitado') return linha.qtdeSolicitado;
  if (etapa === 'comprado') return linha.qtdeComprado;
  return linha.qtdePreEntrada;
}

type ColunaDataId = 'emissaoSc' | 'necessidadeSc' | 'emissaoPc' | 'emissaoPre';
type OrdemDir = 'asc' | 'desc';
type FiltroData = { de: string; ate: string };

const FILTROS_DATA: { id: ColunaDataId; label: string }[] = [
  { id: 'emissaoSc', label: 'Emissão da solicitação' },
  { id: 'necessidadeSc', label: 'Necessidade da solicitação' },
  { id: 'emissaoPc', label: 'Emissão do pedido' },
  { id: 'emissaoPre', label: 'Emissão da pré-entrada' },
];

function fmtData(ymd: string | null | undefined): string {
  if (!ymd) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return ymd;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function dataDaLinha(linha: LinhaAcompanhamento, id: ColunaDataId): string | null {
  if (id === 'emissaoSc') return linha.emissaoSolicitacao;
  if (id === 'necessidadeSc') return linha.necessidadeSolicitacao;
  if (id === 'emissaoPc') return linha.emissaoPedido;
  return linha.emissaoPreEntrada;
}

function passaPeriodo(ymd: string | null, filtro: FiltroData | undefined): boolean {
  if (!filtro?.de && !filtro?.ate) return true;
  if (!ymd) return false;
  let de = filtro.de;
  let ate = filtro.ate;
  if (de && ate && de > ate) {
    const tmp = de;
    de = ate;
    ate = tmp;
  }
  if (de && ymd < de) return false;
  if (ate && ymd > ate) return false;
  return true;
}

function compararCodigo(a: LinhaAcompanhamento, b: LinhaAcompanhamento): number {
  return a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true, sensitivity: 'base' });
}

function Seta() {
  return (
    <div className="flex items-center justify-center text-slate-300 dark:text-slate-600" aria-hidden>
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M7.2 4.2a1 1 0 0 1 1.4 0l5 5.2a1 1 0 0 1 0 1.4l-5 5a1 1 0 1 1-1.4-1.4L11.5 10 7.2 5.6a1 1 0 0 1 0-1.4Z" />
      </svg>
    </div>
  );
}

export default function AcompanhamentoSolicitacaoPage() {
  const { hasPermission, profileLoaded } = useAuth();
  const podeVer =
    hasPermission(PERMISSOES.PCP_VER_TELA) ||
    hasPermission(PERMISSOES.PCP_TOTAL) ||
    hasPermission(PERMISSOES.PEDIDOS_VER);

  const [linhas, setLinhas] = useState<LinhaAcompanhamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');
  const [filtrosData, setFiltrosData] = useState<Partial<Record<ColunaDataId, FiltroData>>>({});
  const [ordemData, setOrdemData] = useState<{ id: ColunaDataId; dir: OrdemDir } | null>(null);
  const [modalDataId, setModalDataId] = useState<ColunaDataId | null>(null);
  const [etapaFiltro, setEtapaFiltro] = useState<FiltroEtapa>('todas');
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [alvo, setAlvo] = useState<{
    idProduto: number;
    etapa: EtapaAcompanhamento;
    codigo: string;
    descricao: string;
    qtdeGrade: number;
  } | null>(null);
  const cacheRef = useRef(new Map<string, DetalheAcompanhamento>());

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    cacheRef.current.clear();
    const r = await obterPipelineAcompanhamento();
    if (r.error) {
      setLinhas([]);
      setErro(r.error);
    } else {
      setLinhas(r.linhas);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    if (podeVer) void carregar();
  }, [podeVer, carregar]);

  const temFiltroData = useMemo(
    () => FILTROS_DATA.some((c) => filtrosData[c.id]?.de || filtrosData[c.id]?.ate) || ordemData != null,
    [filtrosData, ordemData]
  );

  const visiveis = useMemo(() => {
    const match = criarMatcherTextoLivre(filtro);
    const lista = linhas.filter((l) => {
      if (!match(`${l.codigo} ${l.descricao}`)) return false;
      for (const col of FILTROS_DATA) {
        if (!passaPeriodo(dataDaLinha(l, col.id), filtrosData[col.id])) return false;
      }
      if (etapaFiltro !== 'todas' && qtdeDaEtapa(l, etapaFiltro) <= 0) return false;
      return true;
    });
    lista.sort((a, b) => {
      if (!ordemData) return compararCodigo(a, b);
      const av = dataDaLinha(a, ordemData.id) ?? '';
      const bv = dataDaLinha(b, ordemData.id) ?? '';
      if (!av && !bv) return compararCodigo(a, b);
      if (!av) return 1;
      if (!bv) return -1;
      const cmp = av.localeCompare(bv);
      if (cmp !== 0) return ordemData.dir === 'asc' ? cmp : -cmp;
      return compararCodigo(a, b);
    });
    return lista;
  }, [linhas, filtro, filtrosData, etapaFiltro, ordemData]);

  const limparFiltrosData = useCallback(() => {
    setFiltrosData({});
    setOrdemData(null);
    setModalDataId(null);
  }, []);

  const resumo = useMemo(() => {
    return ETAPAS.map((etapa) => {
      let produtos = 0;
      let qtde = 0;
      for (const l of visiveis) {
        const q = qtdeDaEtapa(l, etapa.id);
        if (q > 0) {
          produtos += 1;
          qtde += q;
        }
      }
      return { ...etapa, produtos, qtde: Math.round(qtde * 100) / 100 };
    });
  }, [visiveis]);

  if (!profileLoaded) return null;
  if (!podeVer) return <Navigate to="/sem-acesso" replace />;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 md:p-4">
      <CarregandoInformacoesOverlay
        show={carregando}
        mensagem="Lendo solicitações, pedidos e pré-entradas…"
        mode="contained"
      />

      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-start gap-2">
          <div>
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Acompanhamento de solicitação
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              O que ainda está a caminho: da solicitação liberada até a pré-entrada.
            </p>
          </div>
          <ComoLerBtn
            onClick={() => setAjudaAberta(true)}
            title="Como ler o acompanhamento de solicitação"
          />
        </div>
        <button
          type="button"
          onClick={() => void carregar()}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Atualizar
        </button>
      </div>

      <div className="flex shrink-0 items-stretch gap-1.5">
        {resumo.map((etapa, i) => (
          <Fragment key={etapa.id}>
            {i > 0 ? <Seta /> : null}
            <button
              type="button"
              onClick={() => setEtapaFiltro((atual) => (atual === etapa.id ? 'todas' : etapa.id))}
              className={`min-w-0 flex-1 rounded-xl border px-3 py-3 text-left shadow-sm transition ${
                etapaFiltro === etapa.id ? `${etapa.ativo} ring-2 ring-offset-1 ring-slate-400` : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800'
              }`}
              aria-pressed={etapaFiltro === etapa.id}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${etapa.anel}`} />
                <span className="text-sm font-semibold">{etapa.titulo}</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{etapa.apoio}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums leading-none">{etapa.produtos}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {etapa.produtos === 1 ? 'produto' : 'produtos'} · {fmtQtde(etapa.qtde)}
              </p>
            </button>
          </Fragment>
        ))}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <input
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Código ou descrição. Use % para refinar (ex.: CHAPA%)"
          className="min-w-[16rem] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          aria-label="Filtrar produto"
        />
        {FILTROS_DATA.map((col) => {
          const periodo = filtrosData[col.id];
          const ativo = Boolean(periodo?.de || periodo?.ate || ordemData?.id === col.id);
          const seta = ordemData?.id === col.id ? (ordemData.dir === 'asc' ? ' ↑' : ' ↓') : '';
          return (
            <button
              key={col.id}
              type="button"
              onClick={() => setModalDataId(col.id)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                ativo
                  ? 'border-primary-600 bg-primary-50 text-primary-800 dark:border-primary-500 dark:bg-primary-950/40 dark:text-primary-100'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
              }`}
              title={col.label}
            >
              {col.label}
              {seta}
            </button>
          );
        })}
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {visiveis.length} {visiveis.length === 1 ? 'produto' : 'produtos'}
        </span>
        {temFiltroData ? (
          <button
            type="button"
            onClick={limparFiltrosData}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            Limpar datas
          </button>
        ) : null}
      </div>

      {erro ? (
        <p className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {erro}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 space-y-2 overflow-auto pb-2">
        {!carregando && visiveis.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-600">
            Nenhum produto nesta etapa do caminho.
          </p>
        ) : (
          visiveis.map((linha) => (
            <article
              key={linha.idProduto}
              className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <header className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-semibold text-slate-900 dark:text-slate-50">{linha.codigo}</span>
                <span className="text-sm text-slate-600 dark:text-slate-300">{linha.descricao}</span>
                {linha.unidadeMedida ? (
                  <span className="text-xs text-slate-400">{linha.unidadeMedida}</span>
                ) : null}
              </header>
              <div className="flex items-stretch gap-1.5">
                {ETAPAS.map((etapa, i) => {
                  const qtde = qtdeDaEtapa(linha, etapa.id);
                  const preenchida = qtde > 0;
                  return (
                    <Fragment key={etapa.id}>
                      {i > 0 ? <Seta /> : null}
                      <button
                        type="button"
                        disabled={!preenchida}
                        onClick={() =>
                          setAlvo({
                            idProduto: linha.idProduto,
                            etapa: etapa.id,
                            codigo: linha.codigo,
                            descricao: linha.descricao,
                            qtdeGrade: qtde,
                          })
                        }
                        className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-left ${
                          preenchida
                            ? `${etapa.ativo} hover:brightness-[0.98]`
                            : 'cursor-default border-dashed border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-900/40'
                        }`}
                        title={preenchida ? `Ver detalhe de ${etapa.titulo}` : `${etapa.titulo}: sem quantidade`}
                      >
                        <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-70">
                          {etapa.titulo}
                        </span>
                        <span className="mt-0.5 block text-lg font-semibold tabular-nums leading-tight">
                          {preenchida ? fmtQtde(qtde) : '—'}
                        </span>
                        {etapa.id === 'solicitado' && preenchida ? (
                          <span className="mt-0.5 block text-[10px] font-normal leading-tight opacity-80">
                            Emissão {fmtData(linha.emissaoSolicitacao)}
                            <br />
                            Necessidade {fmtData(linha.necessidadeSolicitacao)}
                          </span>
                        ) : null}
                        {etapa.id === 'comprado' && preenchida ? (
                          <span className="mt-0.5 block text-[10px] font-normal leading-tight opacity-80">
                            Emissão {fmtData(linha.emissaoPedido)}
                          </span>
                        ) : null}
                        {etapa.id === 'pre_entrada' && preenchida ? (
                          <span className="mt-0.5 block text-[10px] font-normal leading-tight opacity-80">
                            Emissão {fmtData(linha.emissaoPreEntrada)}
                          </span>
                        ) : null}
                      </button>
                    </Fragment>
                  );
                })}
              </div>
            </article>
          ))
        )}
      </div>

      <FiltroDataModal
        colunaId={modalDataId}
        filtro={modalDataId ? filtrosData[modalDataId] : undefined}
        ordem={ordemData}
        onClose={() => setModalDataId(null)}
        onAplicar={(id, periodo, dir) => {
          setFiltrosData((prev) => {
            const next = { ...prev };
            if (!periodo.de && !periodo.ate) delete next[id];
            else next[id] = periodo;
            return next;
          });
          setOrdemData((atual) => {
            if (dir) return { id, dir };
            if (atual?.id === id) return null;
            return atual;
          });
          setModalDataId(null);
        }}
        onLimpar={(id) => {
          setFiltrosData((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
          setOrdemData((atual) => (atual?.id === id ? null : atual));
          setModalDataId(null);
        }}
      />

      <AcompanhamentoSolicitacaoAjudaModal aberto={ajudaAberta} onClose={() => setAjudaAberta(false)} />
      <AcompanhamentoSolicitacaoDetalheModal alvo={alvo} cacheRef={cacheRef} onClose={() => setAlvo(null)} />
    </div>
  );
}

function FiltroDataModal({
  colunaId,
  filtro,
  ordem,
  onClose,
  onAplicar,
  onLimpar,
}: {
  colunaId: ColunaDataId | null;
  filtro: FiltroData | undefined;
  ordem: { id: ColunaDataId; dir: OrdemDir } | null;
  onClose: () => void;
  onAplicar: (id: ColunaDataId, periodo: FiltroData, dir: OrdemDir | null) => void;
  onLimpar: (id: ColunaDataId) => void;
}) {
  const coluna = FILTROS_DATA.find((c) => c.id === colunaId) ?? null;
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [dir, setDir] = useState<OrdemDir | null>(null);

  useEffect(() => {
    if (!colunaId) return;
    setDe(filtro?.de ?? '');
    setAte(filtro?.ate ?? '');
    setDir(ordem?.id === colunaId ? ordem.dir : null);
  }, [colunaId, filtro, ordem]);

  useEffect(() => {
    if (!colunaId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [colunaId, onClose]);

  if (!coluna || !colunaId) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="filtro-data-titulo"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="filtro-data-titulo" className="text-base font-semibold text-slate-900 dark:text-slate-50">
          {coluna.label}
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Período e ordem desta data. Produto sem data nesta etapa fica de fora do período.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            Data início
            <input
              type="date"
              value={de}
              onChange={(e) => setDe(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            Data fim
            <input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
        </div>
        <fieldset className="mt-4">
          <legend className="text-xs font-medium text-slate-600 dark:text-slate-300">Ordem</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDir('asc')}
              className={`rounded-lg border px-3 py-2 text-sm ${
                dir === 'asc'
                  ? 'border-primary-600 bg-primary-50 font-medium text-primary-800 dark:border-primary-500 dark:bg-primary-950/40 dark:text-primary-100'
                  : 'border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200'
              }`}
              aria-pressed={dir === 'asc'}
            >
              Crescente
            </button>
            <button
              type="button"
              onClick={() => setDir('desc')}
              className={`rounded-lg border px-3 py-2 text-sm ${
                dir === 'desc'
                  ? 'border-primary-600 bg-primary-50 font-medium text-primary-800 dark:border-primary-500 dark:bg-primary-950/40 dark:text-primary-100'
                  : 'border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-200'
              }`}
              aria-pressed={dir === 'desc'}
            >
              Decrescente
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Crescente: da mais antiga para a mais recente. Decrescente: da mais recente para a mais antiga.
          </p>
        </fieldset>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onLimpar(colunaId)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onAplicar(colunaId, { de, ate }, dir)}
            className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
