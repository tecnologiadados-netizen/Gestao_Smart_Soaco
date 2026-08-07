import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchPainelProducaoApuracao,
  fetchPainelProducaoApuracaoDetalhe,
  fetchPainelProducaoFilters,
  type PainelProducaoApuracaoArea,
  type PainelProducaoApuracaoDetalhe,
  type PainelProducaoApuracaoDetalheTipo,
  type PainelProducaoApuracaoRow,
} from '../../../api/painelProducao';
import { resolveUploadUrl } from '../../../api/client';
import { MonthFilter } from '../../../components/painel-producao/MonthFilter';
import { PainelProducaoShell } from '../../../components/painel-producao/PainelProducaoShell';
import { formatMesLabel } from '../../../utils/painelProducaoFormat';
import { exportarApuracaoDetalheExcel } from '../../../utils/painelProducaoExcelExport';
import { exportarApuracaoMetasPdf } from '../../../utils/painelProducaoApuracaoPdf';
import LoaderCirculo from '../../../components/LoaderCirculo';
import { useDuracaoMinima } from '../../../hooks/useDuracaoMinima';

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

function LoadingOverlay({ show = true }: { show?: boolean }) {
  const visivel = useDuracaoMinima(show);
  if (!visivel) return null;

  return (
    <div className="loading-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="loading-overlay-card">
        <LoaderCirculo tamanho={64} cores={['#FFAD00', '#9BA3E8']} />
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
  const mostraAlteracao =
    detalhe.tipo === 'alteracoes' || detalhe.tipo === 'alteracoes_ruptura';
  const mostraStatus =
    detalhe.tipo === 'pedidos_encerrados' || detalhe.tipo === 'pedidos_com_alteracao';
  const mostraDocSaida = !mostraAlteracao;
  const [exportando, setExportando] = useState(false);

  async function baixarExcel() {
    if (detalhe.linhas.length === 0 || exportando) return;
    setExportando(true);
    try {
      await exportarApuracaoDetalheExcel(detalhe);
    } catch (err) {
      console.error(err);
      window.alert(err instanceof Error ? err.message : 'Falha ao gerar o Excel.');
    } finally {
      setExportando(false);
    }
  }

  const colSpan = mostraAlteracao ? 9 : mostraStatus ? 7 : mostraDocSaida ? 6 : 5;

  return (
    <div className="apuracao-tooltip-body">
      <div className="apuracao-tooltip-header">
        <strong>{detalhe.titulo}</strong>
        <div className="apuracao-tooltip-header-actions">
          <span>
            {formatNumero(detalhe.total, 0)}
            {mostraAlteracao ? ' alterações' : ' pedidos'}
            {detalhe.linhas.length !== detalhe.total
              ? ` · ${formatNumero(detalhe.linhas.length, 0)} itens`
              : ''}
          </span>
          <button
            type="button"
            className="apuracao-tooltip-export"
            onClick={() => void baixarExcel()}
            disabled={detalhe.linhas.length === 0 || exportando}
            title="Baixar dados em Excel"
          >
            {exportando ? 'Gerando…' : 'Excel'}
          </button>
        </div>
      </div>
      <div className="apuracao-tooltip-scroll">
        <table className="apuracao-tooltip-table">
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Produto</th>
              <th>Descrição</th>
              <th>Quantidade</th>
              {mostraStatus && <th>Status</th>}
              {mostraDocSaida && <th>Doc. de saída</th>}
              {mostraAlteracao && <th>Data alteração</th>}
              {mostraAlteracao && <th>Motivo</th>}
              {mostraAlteracao && <th>Usuário</th>}
              {mostraAlteracao && <th>Anexo</th>}
            </tr>
          </thead>
          <tbody>
            {detalhe.linhas.map((linha, index) => (
              <tr key={`${linha.pedido}-${linha.codigo_produto}-${linha.data_alteracao ?? ''}-${index}`}>
                <td>{linha.pedido}</td>
                <td>{linha.cliente}</td>
                <td>{linha.codigo_produto}</td>
                <td className="apuracao-tooltip-desc">{linha.descricao}</td>
                <td className="apuracao-tooltip-qtde">
                  {linha.quantidade == null ? '—' : formatNumero(linha.quantidade)}
                </td>
                {mostraStatus && <td>{linha.status ?? '—'}</td>}
                {mostraDocSaida && <td>{linha.data_encerramento ?? '—'}</td>}
                {mostraAlteracao && <td>{linha.data_alteracao ?? '—'}</td>}
                {mostraAlteracao && <td>{linha.motivo ?? '—'}</td>}
                {mostraAlteracao && <td>{linha.usuario ?? '—'}</td>}
                {mostraAlteracao && (
                  <td>
                    {linha.anexo_assinatura_path ? (
                      <a
                        href={resolveUploadUrl(linha.anexo_assinatura_path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:underline"
                      >
                        {linha.anexo_assinatura_nome?.trim() || 'PDF'}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                )}
              </tr>
            ))}
            {detalhe.linhas.length === 0 && (
              <tr>
                <td colSpan={colSpan}>Nenhum registro.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ApuracaoMemorialMontagem({ row }: { row: PainelProducaoApuracaoRow }) {
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

function ApuracaoMemorialProducao({
  row,
  detalhe,
  loading,
  erro,
  cacheRef,
}: {
  row: PainelProducaoApuracaoRow;
  detalhe: PainelProducaoApuracaoDetalhe | null;
  loading: boolean;
  erro: string | null;
  cacheRef: MutableRefObject<Map<string, PainelProducaoApuracaoDetalhe>>;
}) {
  return (
    <div className="apuracao-tooltip-body">
      <div className="apuracao-tooltip-header">
        <strong>Memorial de cálculo</strong>
        <span>{row.setor}</span>
      </div>
      <div className="apuracao-memorial">
        <div className="apuracao-memorial-row">
          <span>Condição mínima (3 setores)</span>
          <strong className={row.elegivel_minimo_setores ? '' : 'is-desconto'}>
            {row.elegivel_minimo_setores ? 'Atendida' : 'Não atendida'}
            <small>
              {formatNumero(row.setores_atingiram_meta ?? 0, 0)} setor(es) com nível atingido
            </small>
          </strong>
        </div>
        <div className="apuracao-memorial-row">
          <span>Distribuição</span>
          <strong>
            Bronze {row.distribuicao_niveis?.Bronze ?? 0} · Prata{' '}
            {row.distribuicao_niveis?.Prata ?? 0} · Aço {row.distribuicao_niveis?.Aço ?? 0}
          </strong>
        </div>
        <div className="apuracao-memorial-row">
          <span>Valor bruto</span>
          <strong>{formatMoeda(row.valor_bruto ?? row.valor_nivel)}</strong>
        </div>
        <div className="apuracao-memorial-row">
          <span>Parcelas com impacto (ruptura PP)</span>
          <strong className={(row.parcelas_penalizadas ?? 0) > 0 ? 'is-desconto' : ''}>
            {formatNumero(row.parcelas_penalizadas ?? 0, 0)}
          </strong>
        </div>
        <div className="apuracao-memorial-row is-total">
          <span>Valor a pagar</span>
          <strong>{formatMoeda(row.valor_a_pagar)}</strong>
        </div>
      </div>

      {loading && <p className="apuracao-tooltip-state">Carregando parcelas…</p>}
      {erro && <p className="apuracao-tooltip-state is-error">{erro}</p>}

      {!loading && !erro && detalhe?.parcelas && (
        <TabelaParcelasProducao
          parcelas={detalhe.parcelas}
          mes={row.mes}
          cacheRef={cacheRef}
        />
      )}
    </div>
  );
}

function TabelaParcelasProducao({
  parcelas,
  totalLabel,
  mes,
  cacheRef,
}: {
  parcelas: NonNullable<PainelProducaoApuracaoDetalhe['parcelas']>;
  totalLabel?: string;
  mes: string;
  cacheRef: MutableRefObject<Map<string, PainelProducaoApuracaoDetalhe>>;
}) {
  return (
    <div className="apuracao-memorial-niveis">
      {totalLabel && (
        <div className="apuracao-tooltip-header apuracao-contexto-subheader">
          <span />
          <span>{totalLabel}</span>
        </div>
      )}
      <table className="apuracao-tooltip-table">
        <thead>
          <tr>
            <th>Setor montagem</th>
            <th>Nível</th>
            <th>Base</th>
            <th>Média ruptura</th>
            <th>Herdado</th>
            <th>Parcela</th>
          </tr>
        </thead>
        <tbody>
          {parcelas.map((parcela) => (
            <tr
              key={parcela.setor_montagem}
              className={parcela.impacto_producao ? 'is-penalizado' : undefined}
            >
              <td>{parcela.setor_montagem}</td>
              <td>{parcela.nivel ?? '—'}</td>
              <td>{formatMoeda(parcela.valor_base)}</td>
              <td>
                <CelulaMediaRuptura
                  mes={mes}
                  setor={parcela.setor_montagem}
                  media={parcela.media_ruptura}
                  alteracoes={parcela.alteracoes_ruptura}
                  pedidos={parcela.pedidos_com_ruptura}
                  cacheRef={cacheRef}
                />
              </td>
              <td>
                {parcela.impacto_producao
                  ? `−${formatNumero(parcela.percentual_herdado, 0)}%`
                  : '—'}
              </td>
              <td>{formatMoeda(parcela.parcela_final)}</td>
            </tr>
          ))}
          {parcelas.length === 0 && (
            <tr>
              <td colSpan={6}>Nenhum setor neste contexto.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function CelulaMediaRuptura({
  mes,
  setor,
  media,
  alteracoes,
  pedidos,
  cacheRef,
}: {
  mes: string;
  setor: string;
  media: number;
  alteracoes: number;
  pedidos: number;
  cacheRef: MutableRefObject<Map<string, PainelProducaoApuracaoDetalhe>>;
}) {
  const [aberto, setAberto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<PainelProducaoApuracaoDetalhe | null>(null);

  async function open() {
    if (alteracoes <= 0) return;
    setAberto(true);
    const key = `${mes}:${setor}:alteracoes_ruptura`;
    const cached = cacheRef.current.get(key);
    if (cached) {
      setDetalhe(cached);
      setErro(null);
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const data = await fetchPainelProducaoApuracaoDetalhe(mes, 'alteracoes_ruptura', setor);
      cacheRef.current.set(key, data);
      setDetalhe(data);
    } catch (err) {
      setDetalhe(null);
      setErro(err instanceof Error ? err.message : 'Falha ao carregar as alterações.');
    } finally {
      setLoading(false);
    }
  }

  function close() {
    setAberto(false);
  }

  useEffect(() => {
    if (!aberto) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [aberto]);

  return (
    <>
      <button
        type="button"
        className={`apuracao-celula-valor apuracao-media-ruptura${alteracoes > 0 ? ' is-clickable' : ''}`}
        disabled={alteracoes <= 0}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        onClick={(event) => {
          event.stopPropagation();
          if (aberto) {
            close();
            return;
          }
          void open();
        }}
      >
        {formatNumero(media)}
        <small className="apuracao-cell-hint">
          {' '}
          ({formatNumero(alteracoes, 0)}/{formatNumero(pedidos, 0)})
        </small>
      </button>
      {aberto &&
        createPortal(
          <div
            className="apuracao-tooltip-overlay apuracao-tooltip-overlay-nested"
            onClick={(event) => {
              event.stopPropagation();
              close();
            }}
          >
            <div
              className="apuracao-tooltip is-wide"
              role="dialog"
              aria-label={`Alterações por ruptura de PP — ${setor}`}
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
              {loading && <p className="apuracao-tooltip-state">Carregando alterações…</p>}
              {erro && <p className="apuracao-tooltip-state is-error">{erro}</p>}
              {!loading && !erro && detalhe && <ApuracaoDetalheTabela detalhe={detalhe} />}
            </div>
          </div>,
          portalTarget(),
        )}
    </>
  );
}

type ContextoProducaoFiltro =
  | { tipo: 'nivel'; nivel: 'Bronze' | 'Prata' | 'Aço' }
  | { tipo: 'penalizadas' };

async function carregarParcelasProducao(
  row: PainelProducaoApuracaoRow,
  cacheRef: MutableRefObject<Map<string, PainelProducaoApuracaoDetalhe>>,
): Promise<PainelProducaoApuracaoDetalhe> {
  const key = `${row.mes}:${row.setor}:memorial_producao`;
  const cached = cacheRef.current.get(key);
  if (cached) return cached;
  const data = await fetchPainelProducaoApuracaoDetalhe(
    row.mes,
    'memorial_producao',
    row.setor,
  );
  cacheRef.current.set(key, data);
  return data;
}

function CelulaContextoProducao({
  row,
  valor,
  filtro,
  className,
  cacheRef,
  children,
}: {
  row: PainelProducaoApuracaoRow;
  valor: number;
  filtro: ContextoProducaoFiltro;
  className?: string;
  cacheRef: MutableRefObject<Map<string, PainelProducaoApuracaoDetalhe>>;
  children: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [parcelas, setParcelas] = useState<
    NonNullable<PainelProducaoApuracaoDetalhe['parcelas']>
  >([]);

  const titulo =
    filtro.tipo === 'nivel'
      ? `Setores com meta ${filtro.nivel}`
      : 'Parcelas penalizadas (ruptura PP ≥ 2)';

  async function open() {
    if (valor <= 0) return;
    setAberto(true);
    setLoading(true);
    setErro(null);
    try {
      const data = await carregarParcelasProducao(row, cacheRef);
      const todas = data.parcelas ?? [];
      const filtradas =
        filtro.tipo === 'nivel'
          ? todas.filter((p) => p.nivel === filtro.nivel)
          : todas.filter((p) => p.impacto_producao);
      setParcelas(filtradas);
    } catch (err) {
      setParcelas([]);
      setErro(err instanceof Error ? err.message : 'Falha ao carregar o contexto.');
    } finally {
      setLoading(false);
    }
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
            void open();
          }}
        >
          {children}
        </button>
        {aberto &&
          createPortal(
            <div className="apuracao-tooltip-overlay" onClick={close}>
              <div
                className="apuracao-tooltip apuracao-tooltip-memorial is-wide"
                role="dialog"
                aria-label={titulo}
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
                <div className="apuracao-tooltip-body">
                  <div className="apuracao-tooltip-header">
                    <strong>{titulo}</strong>
                    <span>
                      {formatNumero(valor, 0)}{' '}
                      {filtro.tipo === 'nivel' ? 'setor(es)' : 'parcela(s)'}
                    </span>
                  </div>
                  {loading && <p className="apuracao-tooltip-state">Carregando detalhe…</p>}
                  {erro && <p className="apuracao-tooltip-state is-error">{erro}</p>}
                  {!loading && !erro && (
                    <TabelaParcelasProducao
                      parcelas={parcelas}
                      mes={row.mes}
                      cacheRef={cacheRef}
                      totalLabel={
                        filtro.tipo === 'nivel'
                          ? `Base unitária: ${formatMoeda(
                              filtro.nivel === 'Bronze'
                                ? 8.3
                                : filtro.nivel === 'Prata'
                                  ? 16.6
                                  : 25,
                            )}`
                          : 'Média ruptura ≥ 2 → herda penalização da montagem'
                      }
                    />
                  )}
                </div>
              </div>
            </div>,
            portalTarget(),
          )}
      </div>
    </td>
  );
}

function CelulaMemorialValor({
  row,
  className,
  cacheRef,
}: {
  row: PainelProducaoApuracaoRow;
  className?: string;
  cacheRef: MutableRefObject<Map<string, PainelProducaoApuracaoDetalhe>>;
}) {
  const [aberto, setAberto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<PainelProducaoApuracaoDetalhe | null>(null);
  const isProducao = row.area === 'producao';

  async function carregarMemorialProducao() {
    if (!isProducao) return;
    setLoading(true);
    setErro(null);
    try {
      const data = await carregarParcelasProducao(row, cacheRef);
      setDetalhe(data);
    } catch (err) {
      setDetalhe(null);
      setErro(err instanceof Error ? err.message : 'Falha ao carregar o memorial.');
    } finally {
      setLoading(false);
    }
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
      <div className="apuracao-celula-detalhe is-clickable">
        <button
          type="button"
          className="apuracao-celula-valor"
          aria-expanded={aberto}
          aria-haspopup="dialog"
          onClick={() => {
            const next = !aberto;
            setAberto(next);
            if (next && isProducao) void carregarMemorialProducao();
          }}
        >
          {formatMoeda(row.valor_a_pagar)}
        </button>
        {aberto &&
          createPortal(
            <div className="apuracao-tooltip-overlay" onClick={close}>
              <div
                className={`apuracao-tooltip apuracao-tooltip-memorial${isProducao ? ' is-wide' : ''}`}
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
                {isProducao ? (
                  <ApuracaoMemorialProducao
                    row={row}
                    detalhe={detalhe}
                    loading={loading}
                    erro={erro}
                    cacheRef={cacheRef}
                  />
                ) : (
                  <ApuracaoMemorialMontagem row={row} />
                )}
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
  setor,
  tipo,
  valor,
  className,
  children,
  cacheRef,
}: {
  mes: string;
  setor: string;
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
    if (!mes || !setor || valor <= 0) return;
    const key = `${mes}:${setor}:${tipo}`;
    const cached = cacheRef.current.get(key);
    if (cached) {
      setDetalhe(cached);
      setErro(null);
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      const data = await fetchPainelProducaoApuracaoDetalhe(mes, tipo, setor);
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
            <div className="apuracao-tooltip-overlay" onClick={close}>
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

function CelulaMetaQuantitativa({ row }: { row: PainelProducaoApuracaoRow }) {
  const [aberto, setAberto] = useState(false);
  const clicavel = row.niveis.some((n) => n.meta != null);

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
    <td>
      <div className={`apuracao-celula-detalhe${clicavel ? ' is-clickable' : ''}`}>
        <button
          type="button"
          className="apuracao-celula-valor"
          disabled={!clicavel}
          aria-expanded={aberto}
          aria-haspopup="dialog"
          onClick={() => {
            if (!clicavel) return;
            setAberto((v) => !v);
          }}
        >
          {formatNumero(row.meta_quantitativa)} {row.unidade}
        </button>
        {aberto &&
          createPortal(
            <div className="apuracao-tooltip-overlay" onClick={close}>
              <div
                className="apuracao-tooltip"
                role="dialog"
                aria-label="Metas quantitativas por nível"
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
                <div className="apuracao-tooltip-body">
                  <div className="apuracao-tooltip-header">
                    <strong>Metas quantitativas por nível</strong>
                    <span>
                      {row.setor} · grade = Aço ({formatNumero(row.meta_quantitativa)} {row.unidade})
                    </span>
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
  const [area, setArea] = useState<PainelProducaoApuracaoArea>('montagem');
  const [rows, setRows] = useState<PainelProducaoApuracaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const detalheCacheRef = useRef(new Map<string, PainelProducaoApuracaoDetalhe>());

  const rowsFiltradas = useMemo(
    () => rows.filter((row) => row.area === area),
    [rows, area],
  );

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

  async function atualizarApuracao() {
    if (!mes || loading) return;
    detalheCacheRef.current.clear();
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPainelProducaoApuracao(mes, { refresh: true });
      setRows(data);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Falha ao apurar as metas.');
    } finally {
      setLoading(false);
    }
  }

  async function baixarPdfGrade() {
    if (exportandoPdf || loading || rowsFiltradas.length === 0) return;
    setExportandoPdf(true);
    try {
      await exportarApuracaoMetasPdf({
        mes,
        mesLabel: formatMesLabel(mes),
        areaLabel: area === 'montagem' ? 'Montagem' : 'Produção',
        rows: rowsFiltradas,
      });
    } catch (err) {
      console.error(err);
      window.alert(err instanceof Error ? err.message : 'Falha ao gerar o PDF.');
    } finally {
      setExportandoPdf(false);
    }
  }

  return (
    <PainelProducaoShell>
      <div className="dashboard apuracao-page">
        <header className="header">
          <div className="title-bar">Apuração de Metas</div>
          <div className="filters">
            <label className="apuracao-area-filter" htmlFor="apuracao-area-select">
              <span>Área</span>
              <select
                id="apuracao-area-select"
                value={area}
                disabled={loading}
                onChange={(e) => setArea(e.target.value as PainelProducaoApuracaoArea)}
              >
                <option value="montagem">Montagem</option>
                <option value="producao">Produção</option>
              </select>
            </label>
            <MonthFilter
              id="apuracao-mes-select"
              mes={mes}
              meses={meses}
              onChange={setMes}
              disabled={loading}
            />
            <button
              type="button"
              className="apuracao-refresh-btn"
              onClick={() => void atualizarApuracao()}
              disabled={loading || !mes}
              title="Recarrega do Nomus (limpa cache). Use após corrigir o setor do produto no ERP."
            >
              {loading ? 'Atualizando…' : 'Atualizar'}
            </button>
          </div>
        </header>

        <LoadingOverlay show={loading} />

        <main className="apuracao-main">
          <div className="card apuracao-card">
            <div className="apuracao-card-header">
              <div>
                <h2>
                  Validação — {formatMesLabel(mes)} ·{' '}
                  {area === 'montagem' ? 'Montagem' : 'Produção'}
                </h2>
                <p>
                  {area === 'montagem'
                    ? 'Todos os setores de montagem ativos. Os setores com cadastro de níveis incompleto são exibidos, mas não alimentam os setores de produção.'
                    : 'Setores de produção (Perfiladeiras, Corte e Dobra, Solda e Pintura): valor indireto conforme níveis atingidos pela montagem. Clique no valor a pagar para o memorial.'}
                </p>
              </div>
              <button
                type="button"
                className="apuracao-pdf-btn"
                onClick={() => void baixarPdfGrade()}
                disabled={loading || exportandoPdf || rowsFiltradas.length === 0}
                title="Baixar PDF da tabela (formato padrão do sistema)"
              >
                {exportandoPdf ? 'Gerando…' : 'PDF'}
              </button>
            </div>

            {error && <p className="targets-feedback error">{error}</p>}

            <div className="apuracao-table-wrap">
              {area === 'montagem' ? (
                <table className="apuracao-table">
                  <thead>
                    <tr>
                      <th>Setor</th>
                      <th>Pedidos atendidos no mês</th>
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
                    {rowsFiltradas.map((row) => (
                      <tr key={`${row.setor}-${row.mes}`}>
                        <td className="apuracao-setor">
                          {row.setor}
                          {!row.cadastro_niveis_completo && (
                            <small className="apuracao-setor-alerta">
                              Níveis incompletos
                            </small>
                          )}
                        </td>
                        <CelulaComDetalhe
                          mes={mes}
                          setor={row.setor}
                          tipo="pedidos_encerrados"
                          valor={row.pedidos_encerrados}
                          cacheRef={detalheCacheRef}
                        >
                          {formatNumero(row.pedidos_encerrados, 0)}
                        </CelulaComDetalhe>
                        <CelulaComDetalhe
                          mes={mes}
                          setor={row.setor}
                          tipo="pedidos_com_alteracao"
                          valor={row.pedidos_com_alteracao_nao_abonada}
                          cacheRef={detalheCacheRef}
                        >
                          {formatNumero(row.pedidos_com_alteracao_nao_abonada, 0)}
                        </CelulaComDetalhe>
                        <CelulaComDetalhe
                          mes={mes}
                          setor={row.setor}
                          tipo="alteracoes"
                          valor={row.alteracoes_nao_abonadas}
                          cacheRef={detalheCacheRef}
                        >
                          {formatNumero(row.alteracoes_nao_abonadas, 0)}
                        </CelulaComDetalhe>
                        <td className="apuracao-media">
                          {formatNumero(row.media_alteracoes_por_pedido)}
                        </td>
                        <CelulaMetaQuantitativa row={row} />
                        {row.unidade === 'pedidos' ? (
                          <CelulaComDetalhe
                            mes={mes}
                            setor={row.setor}
                            tipo="producao_realizada"
                            valor={row.producao_realizada}
                            cacheRef={detalheCacheRef}
                          >
                            {formatNumero(row.producao_realizada)} {row.unidade}
                          </CelulaComDetalhe>
                        ) : (
                          <td>
                            {formatNumero(row.producao_realizada)} {row.unidade}
                          </td>
                        )}
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
                        <CelulaMemorialValor
                          row={row}
                          className="apuracao-resultado"
                          cacheRef={detalheCacheRef}
                        />
                      </tr>
                    ))}
                    {!loading && rowsFiltradas.length === 0 && !error && (
                      <tr>
                        <td colSpan={11} className="apuracao-empty">
                          Nenhum setor de montagem ativo encontrado para o mês.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="apuracao-table">
                  <thead>
                    <tr>
                      <th>Setor</th>
                      <th>Setores com meta</th>
                      <th>Bronze</th>
                      <th>Prata</th>
                      <th>Aço</th>
                      <th>Valor bruto</th>
                      <th>Parcelas penalizadas</th>
                      <th>Condição mínima</th>
                      <th>Valor a pagar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsFiltradas.map((row) => (
                      <tr key={`${row.setor}-${row.mes}`}>
                        <td className="apuracao-setor">{row.setor}</td>
                        <td>{formatNumero(row.setores_atingiram_meta ?? 0, 0)}</td>
                        <CelulaContextoProducao
                          row={row}
                          valor={row.distribuicao_niveis?.Bronze ?? 0}
                          filtro={{ tipo: 'nivel', nivel: 'Bronze' }}
                          cacheRef={detalheCacheRef}
                        >
                          {formatNumero(row.distribuicao_niveis?.Bronze ?? 0, 0)}
                        </CelulaContextoProducao>
                        <CelulaContextoProducao
                          row={row}
                          valor={row.distribuicao_niveis?.Prata ?? 0}
                          filtro={{ tipo: 'nivel', nivel: 'Prata' }}
                          cacheRef={detalheCacheRef}
                        >
                          {formatNumero(row.distribuicao_niveis?.Prata ?? 0, 0)}
                        </CelulaContextoProducao>
                        <CelulaContextoProducao
                          row={row}
                          valor={row.distribuicao_niveis?.Aço ?? 0}
                          filtro={{ tipo: 'nivel', nivel: 'Aço' }}
                          cacheRef={detalheCacheRef}
                        >
                          {formatNumero(row.distribuicao_niveis?.Aço ?? 0, 0)}
                        </CelulaContextoProducao>
                        <td>{formatMoeda(row.valor_bruto ?? 0)}</td>
                        <CelulaContextoProducao
                          row={row}
                          valor={row.parcelas_penalizadas ?? 0}
                          filtro={{ tipo: 'penalizadas' }}
                          className={
                            (row.parcelas_penalizadas ?? 0) > 0
                              ? 'apuracao-penalizado'
                              : undefined
                          }
                          cacheRef={detalheCacheRef}
                        >
                          {formatNumero(row.parcelas_penalizadas ?? 0, 0)}
                        </CelulaContextoProducao>
                        <td
                          className={
                            row.elegivel_minimo_setores
                              ? 'apuracao-integral'
                              : 'apuracao-penalizado'
                          }
                        >
                          {row.elegivel_minimo_setores ? 'OK (≥ 3)' : 'Insuficiente'}
                        </td>
                        <CelulaMemorialValor
                          row={row}
                          className="apuracao-resultado"
                          cacheRef={detalheCacheRef}
                        />
                      </tr>
                    ))}
                    {!loading && rowsFiltradas.length === 0 && !error && (
                      <tr>
                        <td colSpan={9} className="apuracao-empty">
                          Nenhum dado de produção para o mês.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {rowsFiltradas[0] && (
              <div className="apuracao-legenda">
                {area === 'montagem' ? (
                  <>
                    <span>
                      Penalização pela média de alterações não abonadas (
                      <strong>{rowsFiltradas[0].motivo_nao_abonado}</strong>
                      ), conforme as faixas cadastradas para o mês. Setores com penalizações
                      desligadas pagam o valor integral.
                    </span>
                    <span>
                      Valor a pagar = valor do nível atingido com o desconto aplicado. Setores com
                      níveis incompletos não entram nos setores de produção.
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      Perfiladeiras, Corte e Dobra, Solda e Pintura: Bronze{' '}
                      <strong>R$ 8,30</strong>, Prata <strong>R$ 16,60</strong>, Aço{' '}
                      <strong>R$ 25,00</strong> por setor de montagem — mínimo de{' '}
                      <strong>3 setores</strong>.
                    </span>
                    <span>
                      Herda o desconto da montagem só se a média de ruptura de PP (
                      <strong>{rowsFiltradas[0].motivo_nao_abonado}</strong>) for ≥ 2 e o setor
                      estiver com penalizações ativas.
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </PainelProducaoShell>
  );
}
