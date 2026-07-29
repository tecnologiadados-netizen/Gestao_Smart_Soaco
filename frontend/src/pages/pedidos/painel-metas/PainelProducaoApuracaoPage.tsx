import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchPainelProducaoApuracao,
  fetchPainelProducaoApuracaoDetalhe,
  fetchPainelProducaoFilters,
  type PainelProducaoApuracaoDetalhe,
  type PainelProducaoApuracaoDetalheTipo,
  type PainelProducaoApuracaoRow,
} from '../../../api/painelProducao';
import { MonthFilter } from '../../../components/painel-producao/MonthFilter';
import { PainelProducaoShell } from '../../../components/painel-producao/PainelProducaoShell';
import { formatMesLabel } from '../../../utils/painelProducaoFormat';

function formatNumero(valor: number, maxDecimals = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(valor);
}

function formatMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

function portalTarget(): HTMLElement {
  return (
    document.querySelector<HTMLElement>('.painel-producao-module .dashboard') ?? document.body
  );
}

function LoadingOverlay() {
  return (
    <div className="loading-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="loading-overlay-card">
        <div className="loading-spinner" aria-hidden="true">
          <span className="loading-spinner-ring" />
          <span className="loading-spinner-core" />
        </div>
        <p className="loading-overlay-text">Apurando metas...</p>
      </div>
    </div>
  );
}

function ApuracaoDetalheTabela({
  detalhe,
}: {
  detalhe: PainelProducaoApuracaoDetalhe;
}) {
  const mostraAlteracao = detalhe.tipo === 'alteracoes';
  return (
    <div className="apuracao-tooltip-body">
      <div className="apuracao-tooltip-header">
        <strong>{detalhe.titulo}</strong>
        <span>
          {formatNumero(detalhe.total, 0)}
          {detalhe.tipo === 'alteracoes' ? ' alterações' : ' pedidos'}
          {detalhe.linhas.length !== detalhe.total
            ? ` · ${formatNumero(detalhe.linhas.length, 0)} itens`
            : ''}
        </span>
      </div>
      <div className="apuracao-tooltip-scroll">
        <table className="apuracao-tooltip-table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Produto</th>
              <th>Descrição</th>
              {!mostraAlteracao && <th>Status</th>}
              {!mostraAlteracao && <th>Encerramento</th>}
              {mostraAlteracao && <th>Data alteração</th>}
              {mostraAlteracao && <th>Motivo</th>}
              {mostraAlteracao && <th>Usuário</th>}
            </tr>
          </thead>
          <tbody>
            {detalhe.linhas.map((linha, index) => (
              <tr key={`${linha.pedido}-${linha.codigo_produto}-${linha.data_alteracao ?? ''}-${index}`}>
                <td>{linha.pedido}</td>
                <td>{linha.cliente}</td>
                <td>{linha.codigo_produto}</td>
                <td className="apuracao-tooltip-desc">{linha.descricao}</td>
                {!mostraAlteracao && <td>{linha.status ?? '—'}</td>}
                {!mostraAlteracao && <td>{linha.data_encerramento ?? '—'}</td>}
                {mostraAlteracao && <td>{linha.data_alteracao ?? '—'}</td>}
                {mostraAlteracao && <td>{linha.motivo ?? '—'}</td>}
                {mostraAlteracao && <td>{linha.usuario ?? '—'}</td>}
              </tr>
            ))}
            {detalhe.linhas.length === 0 && (
              <tr>
                <td colSpan={mostraAlteracao ? 7 : 6}>Nenhum registro.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApuracaoMemorialCalculo({ row }: { row: PainelProducaoApuracaoRow }) {
  return (
    <div className="apuracao-tooltip-body">
      <div className="apuracao-tooltip-header">
        <strong>Memorial de cálculo</strong>
        <span>{row.setor}</span>
      </div>
      <div className="apuracao-memorial">
        <div className="apuracao-memorial-row">
          <span>Meta atingida</span>
          <strong>
            {row.meta_atingida}
            <small>
              {formatNumero(row.producao_realizada)} {row.unidade} produzidos
              {row.meta_nivel_atingido != null
                ? ` · nível a partir de ${formatNumero(row.meta_nivel_atingido)} ${row.unidade}`
                : ''}
            </small>
          </strong>
        </div>
        <div className="apuracao-memorial-row">
          <span>Valor do nível</span>
          <strong>{formatMoeda(row.valor_nivel)}</strong>
        </div>
        <div className="apuracao-memorial-row">
          <span>Percentual de desconto</span>
          <strong className={row.percentual_penalizacao_qualitativa > 0 ? 'is-desconto' : ''}>
            −{formatNumero(row.percentual_penalizacao_qualitativa, 0)}%
            <small>
              {formatMoeda(
                Math.round(
                  row.valor_nivel * (row.percentual_penalizacao_qualitativa / 100) * 100,
                ) / 100,
              )}{' '}
              de desconto
            </small>
          </strong>
        </div>
        <div className="apuracao-memorial-row is-total">
          <span>Valor a pagar</span>
          <strong>{formatMoeda(row.valor_a_pagar)}</strong>
        </div>
      </div>
      <div className="apuracao-memorial-niveis">
        <table className="apuracao-tooltip-table">
          <thead>
            <tr>
              <th>Nível</th>
              <th>Meta ({row.unidade})</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            {row.niveis.map((nivel) => (
              <tr key={nivel.nivel} className={nivel.atingido ? 'is-atingido' : undefined}>
                <td>{nivel.nivel}</td>
                <td>{nivel.meta == null ? '—' : formatNumero(nivel.meta)}</td>
                <td>{nivel.valor == null ? '—' : formatMoeda(nivel.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CelulaMemorialValor({
  row,
  className,
}: {
  row: PainelProducaoApuracaoRow;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);

  function close() {
    setAberto(false);
  }

  useEffect(() => {
    if (!aberto) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [aberto]);

  return (
    <td className={className}>
      <div className="apuracao-celula-detalhe is-clickable">
        <button
          type="button"
          className="apuracao-celula-valor"
          aria-expanded={aberto}
          aria-haspopup="dialog"
          onClick={() => setAberto((atual) => !atual)}
        >
          {formatMoeda(row.valor_a_pagar)}
        </button>
        {aberto &&
          createPortal(
            <div className="apuracao-tooltip-overlay" onClick={close}>
              <div
                className="apuracao-tooltip apuracao-tooltip-memorial"
                role="dialog"
                aria-label="Memorial de cálculo"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className="apuracao-tooltip-close"
                  aria-label="Fechar memorial"
                  onClick={close}
                >
                  ×
                </button>
                <ApuracaoMemorialCalculo row={row} />
              </div>
            </div>,
            portalTarget(),
          )}
      </div>
    </td>
  );
}

function CelulaComDetalhe({
  mes,
  tipo,
  valor,
  className,
  children,
  cacheRef,
}: {
  mes: string;
  tipo: PainelProducaoApuracaoDetalheTipo;
  valor: number;
  className?: string;
  children: ReactNode;
  cacheRef: MutableRefObject<Map<string, PainelProducaoApuracaoDetalhe>>;
}) {
  const [aberto, setAberto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<PainelProducaoApuracaoDetalhe | null>(null);

  async function carregar() {
    if (!mes || valor <= 0) return;
    const key = `${mes}:${tipo}`;
    const cached = cacheRef.current.get(key);
    if (cached) {
      setDetalhe(cached);
      setErro(null);
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const data = await fetchPainelProducaoApuracaoDetalhe(mes, tipo);
      cacheRef.current.set(key, data);
      setDetalhe(data);
    } catch (err) {
      setDetalhe(null);
      setErro(err instanceof Error ? err.message : 'Falha ao carregar o detalhe.');
    } finally {
      setLoading(false);
    }
  }

  function open() {
    if (valor <= 0) return;
    setAberto(true);
    void carregar();
  }

  function close() {
    setAberto(false);
  }

  useEffect(() => {
    if (!aberto) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [aberto]);

  return (
    <td className={className}>
      <div className={`apuracao-celula-detalhe${valor > 0 ? ' is-clickable' : ''}`}>
        <button
          type="button"
          className="apuracao-celula-valor"
          disabled={valor <= 0}
          aria-expanded={aberto}
          aria-haspopup="dialog"
          onClick={() => {
            if (aberto) {
              close();
              return;
            }
            open();
          }}
        >
          {children}
        </button>
        {aberto &&
          createPortal(
            <div
              className="apuracao-tooltip-overlay"
              onClick={close}
            >
              <div
                className="apuracao-tooltip"
                role="dialog"
                aria-label="Detalhe da apuração"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className="apuracao-tooltip-close"
                  aria-label="Fechar detalhe"
                  onClick={close}
                >
                  ×
                </button>
                {loading && <p className="apuracao-tooltip-state">Carregando detalhe…</p>}
                {erro && <p className="apuracao-tooltip-state is-error">{erro}</p>}
                {!loading && !erro && detalhe && <ApuracaoDetalheTabela detalhe={detalhe} />}
              </div>
            </div>,
            portalTarget(),
          )}
      </div>
    </td>
  );
}

export default function PainelProducaoApuracaoPage() {
  const [meses, setMeses] = useState<string[]>([]);
  const [mes, setMes] = useState('');
  const [rows, setRows] = useState<PainelProducaoApuracaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const detalheCacheRef = useRef(new Map<string, PainelProducaoApuracaoDetalhe>());

  useEffect(() => {
    let cancelled = false;
    async function carregarFiltros() {
      try {
        const data = await fetchPainelProducaoFilters();
        if (cancelled) return;
        setMeses(data.meses ?? []);
        setMes(data.default_mes ?? data.meses?.[0] ?? '');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Falha ao carregar os meses.');
          setLoading(false);
        }
      }
    }
    void carregarFiltros();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mes) return;
    let cancelled = false;
    async function carregarApuracao() {
      detalheCacheRef.current.clear();
      setLoading(true);
      setError(null);
      try {
        const data = await fetchPainelProducaoApuracao(mes);
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) {
          setRows([]);
          setError(err instanceof Error ? err.message : 'Falha ao apurar as metas.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void carregarApuracao();
    return () => {
      cancelled = true;
    };
  }, [mes]);

  return (
    <PainelProducaoShell>
      <div className="dashboard apuracao-page">
        <header className="header">
          <div className="title-bar">Apuração de Metas</div>
          <div className="filters">
            <MonthFilter
              id="apuracao-mes-select"
              mes={mes}
              meses={meses}
              onChange={setMes}
              disabled={loading}
            />
          </div>
        </header>

        {loading && <LoadingOverlay />}

        <main className="apuracao-main">
          <div className="card apuracao-card">
            <div className="apuracao-card-header">
              <div>
                <h2>Validação — {formatMesLabel(mes)}</h2>
                <p>
                  Fase inicial restrita ao setor de Móveis de aço. Clique nas células
                  destacadas para ver o detalhe.
                </p>
              </div>
            </div>

            {error && <p className="targets-feedback error">{error}</p>}

            <div className="apuracao-table-wrap">
              <table className="apuracao-table">
                <thead>
                  <tr>
                    <th>Setor</th>
                    <th>Pedidos encerrados no mês</th>
                    <th>Pedidos com alteração não abonada</th>
                    <th>Alterações não abonadas</th>
                    <th>Média de alteração por PD</th>
                    <th>Meta quantitativa</th>
                    <th>Realizado</th>
                    <th>Atingimento quantitativo</th>
                    <th>Penalização qualitativa</th>
                    <th>Meta atingida</th>
                    <th>Valor a pagar</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.setor}-${row.mes}`}>
                      <td className="apuracao-setor">{row.setor}</td>
                      <CelulaComDetalhe
                        mes={mes}
                        tipo="pedidos_encerrados"
                        valor={row.pedidos_encerrados}
                        cacheRef={detalheCacheRef}
                      >
                        {formatNumero(row.pedidos_encerrados, 0)}
                      </CelulaComDetalhe>
                      <CelulaComDetalhe
                        mes={mes}
                        tipo="pedidos_com_alteracao"
                        valor={row.pedidos_com_alteracao_nao_abonada}
                        cacheRef={detalheCacheRef}
                      >
                        {formatNumero(row.pedidos_com_alteracao_nao_abonada, 0)}
                      </CelulaComDetalhe>
                      <CelulaComDetalhe
                        mes={mes}
                        tipo="alteracoes"
                        valor={row.alteracoes_nao_abonadas}
                        cacheRef={detalheCacheRef}
                      >
                        {formatNumero(row.alteracoes_nao_abonadas, 0)}
                      </CelulaComDetalhe>
                      <td className="apuracao-media">
                        {formatNumero(row.media_alteracoes_por_pedido)}
                      </td>
                      <td>
                        {formatNumero(row.meta_quantitativa)} {row.unidade}
                      </td>
                      <td>
                        {formatNumero(row.producao_realizada)} {row.unidade}
                      </td>
                      <td>{formatNumero(row.percentual_meta_quantitativa)}%</td>
                      <td
                        className={
                          row.percentual_penalizacao_qualitativa > 0
                            ? 'apuracao-penalizado'
                            : 'apuracao-integral'
                        }
                      >
                        −{formatNumero(row.percentual_penalizacao_qualitativa, 0)}%
                      </td>
                      <td className="apuracao-nivel">{row.meta_atingida}</td>
                      <CelulaMemorialValor row={row} className="apuracao-resultado" />
                    </tr>
                  ))}
                  {!loading && rows.length === 0 && !error && (
                    <tr>
                      <td colSpan={11} className="apuracao-empty">
                        Nenhum dado encontrado para o mês.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {rows[0] && (
              <div className="apuracao-legenda">
                <span>
                  Justificativa não abonada para a montagem:{' '}
                  <strong>{rows[0].motivo_nao_abonado}</strong>.
                </span>
                <span>
                  Média = alterações não abonadas ÷ pedidos com alteração não abonada.
                </span>
                <span>
                  Valor a pagar = valor fixo do nível atingido − penalização qualitativa. Os níveis
                  e seus valores são cadastrados em Painel Metas → Cadastro de Metas.
                </span>
              </div>
            )}
          </div>
        </main>
      </div>
    </PainelProducaoShell>
  );
}
