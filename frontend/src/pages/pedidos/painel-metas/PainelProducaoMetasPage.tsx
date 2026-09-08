import { useEffect, useState, Fragment } from 'react';
import { MonthFilter } from '../../../components/painel-producao/MonthFilter';
import { PainelProducaoShell } from '../../../components/painel-producao/PainelProducaoShell';
import { useAuth } from '../../../contexts/AuthContext';
import {
  fetchPainelProducaoAlcancado,
  fetchPainelProducaoFaixasDesconto,
  fetchPainelProducaoFilters,
  fetchPainelProducaoTargets,
  savePainelProducaoFaixasDesconto,
  savePainelProducaoSetorPenalizacao,
  savePainelProducaoTarget,
  type PainelProducaoAlcancadoSetor,
  type PainelProducaoFaixaDesconto,
} from '../../../api/painelProducao';
import { formatMesLabel } from '../../../utils/painelProducaoFormat';
import { podeEditarFaixasDesconto, podeEditarPainelMetas } from '../../../utils/painelProducaoPermissoes';
import LoaderCirculo from '../../../components/LoaderCirculo';
import { useDuracaoMinima } from '../../../hooks/useDuracaoMinima';

type CampoMeta =
  | 'meta_bronze'
  | 'meta_prata'
  | 'meta_aco'
  | 'valor_bronze'
  | 'valor_prata'
  | 'valor_aco';

type LinhaMeta = Record<CampoMeta, string>;
type GuiaCadastro = 'metas' | 'faixas';
type LinhaFaixa = {
  key: string;
  media_min: string;
  media_max: string;
  percentual_desconto: string;
};

const CAMPOS_META: CampoMeta[] = [
  'meta_bronze',
  'meta_prata',
  'meta_aco',
  'valor_bronze',
  'valor_prata',
  'valor_aco',
];

const CAMPOS_QUANTIDADE: CampoMeta[] = ['meta_bronze', 'meta_prata', 'meta_aco'];

const NIVEIS_META = [
  { nome: 'Bronze', meta: 'meta_bronze', valor: 'valor_bronze', slug: 'bronze' },
  { nome: 'Prata', meta: 'meta_prata', valor: 'valor_prata', slug: 'prata' },
  { nome: 'Aço', meta: 'meta_aco', valor: 'valor_aco', slug: 'aco' },
] as const;

type NivelMetaNome = (typeof NIVEIS_META)[number]['nome'];

const LINHA_VAZIA: LinhaMeta = {
  meta_bronze: '',
  meta_prata: '',
  meta_aco: '',
  valor_bronze: '',
  valor_prata: '',
  valor_aco: '',
};

function paraTexto(valor: number | null | undefined): string {
  return valor == null ? '' : String(valor);
}

function paraNumero(texto: string): number | null {
  const bruto = texto.trim();
  if (bruto === '') return null;
  const numero = Number(bruto.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(numero) && numero >= 0 ? numero : Number.NaN;
}

function formatarQuantidade(texto: string): string {
  const numero = paraNumero(texto);
  if (numero == null || Number.isNaN(numero)) return '—';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(numero);
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

function formatarMoedaTexto(texto: string): string {
  const numero = paraNumero(texto);
  if (numero == null || Number.isNaN(numero)) return '—';
  return formatarMoeda(numero);
}

function formatarProducao(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(valor);
}

function identificarNivelAtingido(producao: number, linha: LinhaMeta): NivelMetaNome | null {
  let atingido: NivelMetaNome | null = null;
  for (const nivel of NIVEIS_META) {
    const meta = paraNumero(linha[nivel.meta]);
    if (meta == null || Number.isNaN(meta) || meta <= 0) continue;
    if (producao >= meta) atingido = nivel.nome;
  }
  return atingido;
}

function paraDecimal(texto: string): number {
  const numero = Number(texto.trim().replace(',', '.'));
  return Number.isFinite(numero) && numero >= 0 ? numero : Number.NaN;
}

function faixaParaLinha(faixa: PainelProducaoFaixaDesconto): LinhaFaixa {
  return {
    key: String(faixa.id ?? faixa.ordem),
    media_min: String(faixa.media_min).replace('.', ','),
    media_max: faixa.media_max == null ? '' : String(faixa.media_max).replace('.', ','),
    percentual_desconto: String(faixa.percentual_desconto).replace('.', ','),
  };
}

function LoadingOverlay({ message = 'Carregando...', show = true }: { message?: string; show?: boolean }) {
  const visivel = useDuracaoMinima(show);
  if (!visivel) return null;

  return (
    <div className="loading-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="loading-overlay-card">
        <LoaderCirculo tamanho={64} cores={['#FFAD00', '#9BA3E8']} />
        <p className="loading-overlay-text">{message}</p>
      </div>
    </div>
  );
}

function NivelBadge({
  nivel,
  semMeta,
}: {
  nivel: NivelMetaNome | null;
  semMeta?: boolean;
}) {
  if (semMeta) {
    return <span className="targets-nivel-badge is-none">Sem meta</span>;
  }
  if (!nivel) {
    return <span className="targets-nivel-badge is-none">Não atingida</span>;
  }
  const slug = nivel === 'Aço' ? 'aco' : nivel.toLowerCase();
  return <span className={`targets-nivel-badge is-${slug}`}>{nivel}</span>;
}

export default function PainelProducaoMetasPage() {
  const { hasPermission } = useAuth();
  const podeEditar = podeEditarPainelMetas(hasPermission);
  const podeEditarFaixas = podeEditarFaixasDesconto(hasPermission);

  const [setores, setSetores] = useState<string[]>([]);
  const [meses, setMeses] = useState<string[]>([]);
  const [mes, setMes] = useState('');
  const [guia, setGuia] = useState<GuiaCadastro>('metas');
  const [linhas, setLinhas] = useState<Record<string, LinhaMeta>>({});
  const [semMeta, setSemMeta] = useState<Record<string, boolean>>({});
  const [considerarPenalizacoes, setConsiderarPenalizacoes] = useState<Record<string, boolean>>(
    {},
  );
  const [editingSetores, setEditingSetores] = useState<Set<string>>(() => new Set());
  const [editSnapshots, setEditSnapshots] = useState<
    Record<string, { linha: LinhaMeta; semMeta: boolean }>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savingPenalizacaoSetor, setSavingPenalizacaoSetor] = useState<string | null>(null);
  const [faixas, setFaixas] = useState<LinhaFaixa[]>([]);
  const [faixasSnapshot, setFaixasSnapshot] = useState<LinhaFaixa[]>([]);
  const [editandoFaixas, setEditandoFaixas] = useState(false);
  const [savingFaixas, setSavingFaixas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [setoresExpandidos, setSetoresExpandidos] = useState<Set<string>>(() => new Set());
  const [alcancadoPorSetor, setAlcancadoPorSetor] = useState<
    Record<string, PainelProducaoAlcancadoSetor>
  >({});

  useEffect(() => {
    let cancelled = false;
    async function loadFilters() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchPainelProducaoFilters();
        if (cancelled) return;
        const list = data.setores ?? [];
        setSetores(list);
        setMeses(data.meses ?? []);
        setMes(
          data.default_mes && data.meses?.includes(data.default_mes)
            ? data.default_mes
            : data.meses?.[0] ?? '',
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Falha ao carregar filtros.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadFilters();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mes) return;
    let cancelled = false;
    async function loadTargets() {
      setLoading(true);
      setError(null);
      setSuccess(null);
      try {
        const [rows, faixasCarregadas] = await Promise.all([
          fetchPainelProducaoTargets(mes),
          fetchPainelProducaoFaixasDesconto(mes),
        ]);
        if (cancelled) return;
        const linhaMap: Record<string, LinhaMeta> = {};
        const semMap: Record<string, boolean> = {};
        const penalMap: Record<string, boolean> = {};
        for (const row of rows) {
          semMap[row.setor] = !!row.sem_meta;
          penalMap[row.setor] = row.considerar_penalizacoes !== false;
          linhaMap[row.setor] = row.sem_meta
            ? { ...LINHA_VAZIA }
            : {
                meta_bronze: paraTexto(row.meta_bronze),
                meta_prata: paraTexto(row.meta_prata),
                meta_aco: paraTexto(row.meta_aco ?? row.target),
                valor_bronze: paraTexto(row.valor_bronze),
                valor_prata: paraTexto(row.valor_prata),
                valor_aco: paraTexto(row.valor_aco),
              };
        }
        setLinhas(linhaMap);
        setSemMeta(semMap);
        setConsiderarPenalizacoes(penalMap);
        setFaixas(faixasCarregadas.map(faixaParaLinha));
        setFaixasSnapshot([]);
        setEditandoFaixas(false);
        setEditingSetores(new Set());
        setEditSnapshots({});
        setSetoresExpandidos(new Set());
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Falha ao carregar metas.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadTargets();
    return () => {
      cancelled = true;
    };
  }, [mes]);

  useEffect(() => {
    if (!mes) return;
    let cancelled = false;
    setAlcancadoPorSetor({});
    async function loadAlcancado() {
      try {
        const rows = await fetchPainelProducaoAlcancado(mes);
        if (cancelled) return;
        const mapa: Record<string, PainelProducaoAlcancadoSetor> = {};
        for (const row of rows) mapa[row.setor] = row;
        setAlcancadoPorSetor(mapa);
      } catch {
        if (!cancelled) setAlcancadoPorSetor({});
      }
    }
    void loadAlcancado();
    return () => {
      cancelled = true;
    };
  }, [mes]);

  async function alternarPenalizacaoSetor(setor: string) {
    if (!mes || !podeEditar || savingPenalizacaoSetor) return;
    const atual = considerarPenalizacoes[setor] !== false;
    const novoValor = !atual;
    setSavingPenalizacaoSetor(setor);
    setError(null);
    setSuccess(null);
    try {
      const result = await savePainelProducaoSetorPenalizacao({
        mes,
        setor,
        considerar_penalizacoes: novoValor,
      });
      setConsiderarPenalizacoes((prev) => ({
        ...prev,
        [setor]: result.considerar_penalizacoes,
      }));
      setSuccess(
        result.considerar_penalizacoes
          ? `Penalizações ativadas para ${setor}.`
          : `Penalizações desligadas para ${setor}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar penalizações.');
    } finally {
      setSavingPenalizacaoSetor(null);
    }
  }

  function iniciarEdicaoFaixas() {
    setFaixasSnapshot(faixas.map((faixa) => ({ ...faixa })));
    setEditandoFaixas(true);
    setError(null);
    setSuccess(null);
  }

  function cancelarEdicaoFaixas() {
    setFaixas(faixasSnapshot.map((faixa) => ({ ...faixa })));
    setFaixasSnapshot([]);
    setEditandoFaixas(false);
    setError(null);
    setSuccess(null);
  }

  function alterarFaixa(key: string, campo: keyof Omit<LinhaFaixa, 'key'>, valor: string) {
    setFaixas((prev) =>
      prev.map((faixa) => (faixa.key === key ? { ...faixa, [campo]: valor } : faixa)),
    );
    setSuccess(null);
  }

  function adicionarFaixa() {
    setFaixas((prev) => [
      ...prev,
      {
        key: `nova-${Date.now()}`,
        media_min: '',
        media_max: '',
        percentual_desconto: '',
      },
    ]);
  }

  function removerFaixa(key: string) {
    setFaixas((prev) => prev.filter((faixa) => faixa.key !== key));
  }

  async function salvarFaixas() {
    setSavingFaixas(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = faixas.map((faixa, index) => {
        const mediaMin = paraDecimal(faixa.media_min);
        const mediaMax = faixa.media_max.trim() === '' ? null : paraDecimal(faixa.media_max);
        const desconto = paraDecimal(faixa.percentual_desconto);
        if (
          Number.isNaN(mediaMin) ||
          (mediaMax != null && Number.isNaN(mediaMax)) ||
          Number.isNaN(desconto)
        ) {
          throw new Error(`Preencha corretamente os valores da faixa ${index + 1}.`);
        }
        return {
          media_min: mediaMin,
          media_max: mediaMax,
          percentual_desconto: desconto,
        };
      });
      const salvas = await savePainelProducaoFaixasDesconto({ mes, faixas: payload });
      setFaixas(salvas.map(faixaParaLinha));
      setFaixasSnapshot([]);
      setEditandoFaixas(false);
      setSuccess('Faixas de desconto salvas com sucesso.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar faixas de desconto.');
    } finally {
      setSavingFaixas(false);
    }
  }

  function linhaDoSetor(setor: string): LinhaMeta {
    return linhas[setor] ?? LINHA_VAZIA;
  }

  function alternarExpansao(setor: string) {
    setSetoresExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(setor)) next.delete(setor);
      else next.add(setor);
      return next;
    });
  }

  function alterarCampo(setor: string, campo: CampoMeta, valor: string) {
    setLinhas((prev) => ({
      ...prev,
      [setor]: { ...(prev[setor] ?? LINHA_VAZIA), [campo]: valor },
    }));
    setSuccess(null);
  }

  function startEdit(setor: string) {
    setEditSnapshots((prev) => ({
      ...prev,
      [setor]: { linha: linhaDoSetor(setor), semMeta: !!semMeta[setor] },
    }));
    setEditingSetores((prev) => new Set(prev).add(setor));
    setSetoresExpandidos((prev) => new Set(prev).add(setor));
    setSuccess(null);
  }

  function cancelEdit(setor: string) {
    const snapshot = editSnapshots[setor];
    if (snapshot) {
      setLinhas((prev) => ({ ...prev, [setor]: snapshot.linha }));
      setSemMeta((prev) => ({ ...prev, [setor]: snapshot.semMeta }));
    }
    setEditingSetores((prev) => {
      const next = new Set(prev);
      next.delete(setor);
      return next;
    });
    setEditSnapshots((prev) => {
      const next = { ...prev };
      delete next[setor];
      return next;
    });
    setError(null);
    setSuccess(null);
  }

  function startEditAll() {
    const snapshots: Record<string, { linha: LinhaMeta; semMeta: boolean }> = {};
    for (const setor of setores) {
      snapshots[setor] = { linha: linhaDoSetor(setor), semMeta: !!semMeta[setor] };
    }
    setEditSnapshots(snapshots);
    setEditingSetores(new Set(setores));
    setSetoresExpandidos(new Set(setores));
    setSuccess(null);
  }

  function cancelEditAll() {
    const setoresEditando = [...editingSetores];
    const snapshots = { ...editSnapshots };
    setLinhas((prev) => {
      const next = { ...prev };
      for (const setor of setoresEditando) {
        const snapshot = snapshots[setor];
        if (snapshot) next[setor] = snapshot.linha;
      }
      return next;
    });
    setSemMeta((prev) => {
      const next = { ...prev };
      for (const setor of setoresEditando) {
        const snapshot = snapshots[setor];
        if (snapshot) next[setor] = snapshot.semMeta;
      }
      return next;
    });
    setEditingSetores(new Set());
    setEditSnapshots({});
    setError(null);
    setSuccess(null);
  }

  function finishEdit(setor: string) {
    setEditingSetores((prev) => {
      const next = new Set(prev);
      next.delete(setor);
      return next;
    });
    setEditSnapshots((prev) => {
      const next = { ...prev };
      delete next[setor];
      return next;
    });
  }

  async function saveTarget(setor: string) {
    if (!podeEditar) return;
    const noMeta = !!semMeta[setor];
    const linha = linhaDoSetor(setor);
    const numeros: Partial<Record<CampoMeta, number | null>> = {};

    if (!noMeta) {
      for (const campo of CAMPOS_META) {
        const numero = paraNumero(linha[campo]);
        if (Number.isNaN(numero)) {
          setError(`Valor inválido para ${setor}.`);
          return;
        }
        numeros[campo] = numero;
      }
    }

    setSaving(setor);
    setError(null);
    setSuccess(null);
    try {
      await savePainelProducaoTarget({
        setor,
        mes_ano: `${mes}-01`,
        // A meta principal do painel é a do nível mais alto (Aço).
        target: noMeta ? 0 : numeros.meta_aco ?? 0,
        sem_meta: noMeta,
        ...numeros,
      });
      setSuccess(
        noMeta
          ? `${setor} marcado como "Não haverá meta".`
          : `Meta de ${setor} salva com sucesso.`,
      );
      finishEdit(setor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar meta.');
    } finally {
      setSaving(null);
    }
  }

  async function saveAll() {
    for (const setor of [...editingSetores]) {
      await saveTarget(setor);
    }
  }

  const algumEditando = editingSetores.size > 0;

  if (loading && !mes) {
    return (
      <PainelProducaoShell>
        <div className="dashboard targets-page">
          <LoadingOverlay message="Carregando..." />
        </div>
      </PainelProducaoShell>
    );
  }

  return (
    <PainelProducaoShell>
      <div className="dashboard targets-page">
        <header className="header">
          <div className="title-bar">Cadastro de Metas</div>
          <div className="filters">
            <MonthFilter
              id="targets-mes-select"
              mes={mes}
              meses={meses}
              onChange={setMes}
              onMesesChange={(lista, selected) => {
                setMeses(lista);
                setMes(selected);
              }}
              allowInsert={podeEditar}
              disabled={loading}
            />
          </div>
        </header>

        <LoadingOverlay show={loading} message="Carregando metas..." />

        <main className="targets-main">
          <div className="card targets-card">
            <div className="targets-tabs" role="tablist" aria-label="Cadastro de metas">
              <button
                type="button"
                role="tab"
                aria-selected={guia === 'metas'}
                className={guia === 'metas' ? 'is-active' : undefined}
                onClick={() => setGuia('metas')}
              >
                Metas por setor
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={guia === 'faixas'}
                className={guia === 'faixas' ? 'is-active' : undefined}
                onClick={() => setGuia('faixas')}
              >
                Faixas de desconto
              </button>
            </div>

            <div className="targets-card-header">
              <h2>
                {guia === 'metas' ? 'Metas por setor' : 'Faixas de desconto'} —{' '}
                {formatMesLabel(mes)}
              </h2>
              {podeEditar && guia === 'metas' && (
                <div className="targets-header-actions">
                  {algumEditando ? (
                    <>
                      <button
                        type="button"
                        className="targets-cancel-all"
                        onClick={cancelEditAll}
                        disabled={!!saving}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="targets-save-all"
                        onClick={saveAll}
                        disabled={!!saving || editingSetores.size === 0}
                      >
                        Salvar todas
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="targets-edit-all"
                      onClick={startEditAll}
                      disabled={!!saving || setores.length === 0}
                    >
                      Editar todas
                    </button>
                  )}
                </div>
              )}
              {podeEditarFaixas && guia === 'faixas' && (
                <div className="targets-header-actions">
                  {editandoFaixas ? (
                    <>
                      <button
                        type="button"
                        className="targets-cancel-all"
                        onClick={cancelarEdicaoFaixas}
                        disabled={savingFaixas}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="targets-save-all"
                        onClick={() => void salvarFaixas()}
                        disabled={savingFaixas || faixas.length === 0}
                      >
                        {savingFaixas ? 'Salvando…' : 'Salvar faixas'}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="targets-edit-all"
                      onClick={iniciarEdicaoFaixas}
                    >
                      Editar faixas
                    </button>
                  )}
                </div>
              )}
            </div>

            {error && <p className="targets-feedback error">{error}</p>}
            {success && <p className="targets-feedback success">{success}</p>}

            {guia === 'metas' ? (
              <>
                <div className="targets-table-wrap">
              <table className="targets-table targets-table-niveis">
                <thead>
                  <tr>
                    <th rowSpan={2} className="targets-th-expand" aria-label="Expandir" />
                    <th rowSpan={2}>Setor</th>
                    <th rowSpan={2}>Não haverá meta</th>
                    <th colSpan={3} className="targets-group">
                      Meta (quantidade)
                    </th>
                    <th rowSpan={2}>Penalizações</th>
                    <th rowSpan={2}>Alcançado</th>
                    {podeEditar && <th rowSpan={2} aria-label="Ações" />}
                  </tr>
                  <tr>
                    <th>Bronze</th>
                    <th>Prata</th>
                    <th>Aço</th>
                  </tr>
                </thead>
                <tbody>
                  {setores.map((setor) => {
                    const noMeta = !!semMeta[setor];
                    const editando = editingSetores.has(setor);
                    const linha = linhaDoSetor(setor);
                    const expandido = setoresExpandidos.has(setor);
                    const alcancado = alcancadoPorSetor[setor];
                    const nivelAtingido =
                      noMeta || alcancado == null
                        ? null
                        : identificarNivelAtingido(alcancado.producao, linha);
                    const colSpan = 8 + (podeEditar ? 1 : 0);
                    return (
                      <Fragment key={setor}>
                      <tr
                        className={[
                          noMeta ? 'targets-row-no-meta' : '',
                          editando ? 'targets-row-editing' : '',
                          expandido ? 'targets-row-expanded' : '',
                        ]
                          .filter(Boolean)
                          .join(' ') || undefined}
                      >
                        <td className="targets-cell-expand">
                          <button
                            type="button"
                            className={`targets-expand-btn${expandido ? ' is-open' : ''}`}
                            onClick={() => alternarExpansao(setor)}
                            aria-expanded={expandido}
                            aria-label={
                              expandido
                                ? `Recolher valores de ${setor}`
                                : `Expandir valores de ${setor}`
                            }
                          >
                            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                              <path
                                d="M4.2 6.2 8 10l3.8-3.8"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="targets-setor-btn"
                            onClick={() => alternarExpansao(setor)}
                          >
                            {setor}
                          </button>
                        </td>
                        <td>
                          <label className="targets-checkbox-label">
                            <input
                              type="checkbox"
                              className="targets-checkbox"
                              checked={noMeta}
                              disabled={!podeEditar || !editando}
                              onChange={(e) => {
                                setSemMeta((prev) => ({ ...prev, [setor]: e.target.checked }));
                                if (e.target.checked) {
                                  setLinhas((prev) => ({ ...prev, [setor]: { ...LINHA_VAZIA } }));
                                }
                                setSuccess(null);
                              }}
                              aria-label={`Não haverá meta para ${setor}`}
                            />
                            <span>Não haverá meta</span>
                          </label>
                        </td>
                        {CAMPOS_QUANTIDADE.map((campo) => (
                          <td key={campo} className="targets-cell-num">
                            {editando ? (
                              <input
                                type="text"
                                inputMode="decimal"
                                className="targets-input"
                                value={linha[campo]}
                                placeholder={noMeta ? '—' : '0'}
                                disabled={noMeta || !podeEditar}
                                onChange={(e) => alterarCampo(setor, campo, e.target.value)}
                                aria-label={`${campo.replace('_', ' ')} de ${setor}`}
                              />
                            ) : (
                              <span className="targets-valor-leitura">
                                {noMeta ? '—' : formatarQuantidade(linha[campo])}
                              </span>
                            )}
                          </td>
                        ))}
                        <td>
                          {(() => {
                            const penalAtiva = considerarPenalizacoes[setor] !== false;
                            const salvandoPenal = savingPenalizacaoSetor === setor;
                            return (
                              <button
                                type="button"
                                className={`targets-penalizacoes-btn${penalAtiva ? ' is-on' : ' is-off'}`}
                                onClick={() => void alternarPenalizacaoSetor(setor)}
                                disabled={
                                  !podeEditar || noMeta || !!saving || !!savingPenalizacaoSetor
                                }
                                title={
                                  penalAtiva
                                    ? 'Clique para não aplicar penalizações neste setor'
                                    : 'Clique para aplicar penalizações neste setor'
                                }
                                aria-pressed={penalAtiva}
                              >
                                {salvandoPenal
                                  ? '…'
                                  : penalAtiva
                                    ? 'Ativas'
                                    : 'Desligadas'}
                              </button>
                            );
                          })()}
                        </td>
                        <td className="targets-cell-alcancado">
                          {noMeta ? (
                            <div className="targets-alcancado">
                              <span className="targets-alcancado-qtd">—</span>
                              <NivelBadge nivel={null} semMeta />
                            </div>
                          ) : alcancado == null ? (
                            <div className="targets-alcancado">
                              <span className="targets-alcancado-qtd">—</span>
                            </div>
                          ) : (
                            <div className="targets-alcancado">
                              <span className="targets-alcancado-qtd">
                                {formatarProducao(alcancado.producao)}{' '}
                                <span className="targets-alcancado-unidade">
                                  {alcancado.unidade}
                                </span>
                              </span>
                              <NivelBadge nivel={nivelAtingido} />
                            </div>
                          )}
                        </td>
                        {podeEditar && (
                          <td>
                            <div className="targets-row-actions">
                              {editando ? (
                                <>
                                  <button
                                    type="button"
                                    className="targets-cancel-btn"
                                    onClick={() => cancelEdit(setor)}
                                    disabled={saving === setor}
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    className="targets-save-btn"
                                    onClick={() => saveTarget(setor)}
                                    disabled={saving === setor}
                                  >
                                    {saving === setor ? 'Salvando...' : 'Salvar'}
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className="targets-edit-btn"
                                  onClick={() => startEdit(setor)}
                                  disabled={!!saving}
                                >
                                  Editar
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                      {expandido && (
                        <tr className="targets-expand-row">
                          <td colSpan={colSpan}>
                            <div className="targets-expand-panel">
                              {noMeta ? (
                                <p className="targets-expand-empty">
                                  {setor} está marcado como “Não haverá meta”.
                                </p>
                              ) : (
                                <>
                                  <div className="targets-expand-resumo">
                                    <span>
                                      Alcançado:{' '}
                                      <strong>
                                        {alcancado
                                          ? `${formatarProducao(alcancado.producao)} ${alcancado.unidade}`
                                          : '—'}
                                      </strong>
                                    </span>
                                    {alcancado ? (
                                      <NivelBadge nivel={nivelAtingido} />
                                    ) : (
                                      <span className="targets-nivel-badge is-none">
                                        Produção indisponível
                                      </span>
                                    )}
                                  </div>
                                  <div className="targets-nivel-cards">
                                    {NIVEIS_META.map((nivel) => {
                                      const atingido = nivelAtingido === nivel.nome;
                                      return (
                                        <article
                                          key={nivel.nome}
                                          className={`targets-nivel-card is-${nivel.slug}${
                                            atingido ? ' is-atingido' : ''
                                          }`}
                                        >
                                          <header>
                                            <span
                                              className={`kpi-meta-nivel-symbol kpi-meta-nivel-symbol--${nivel.slug}`}
                                              aria-hidden="true"
                                            >
                                              <svg viewBox="0 0 16 16" width="12" height="12">
                                                <circle cx="8" cy="8" r="7" />
                                                <circle
                                                  cx="8"
                                                  cy="8"
                                                  r="3.4"
                                                  fill="none"
                                                  stroke="rgba(255,255,255,0.72)"
                                                  strokeWidth="1.35"
                                                />
                                              </svg>
                                            </span>
                                            {nivel.nome}
                                            {atingido && (
                                              <span className="targets-nivel-card-flag">
                                                Batida
                                              </span>
                                            )}
                                          </header>
                                          <dl>
                                            <div>
                                              <dt>Meta</dt>
                                              <dd>{formatarQuantidade(linha[nivel.meta])}</dd>
                                            </div>
                                            <div>
                                              <dt>Valor a pagar</dt>
                                              <dd>
                                                {editando ? (
                                                  <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    className="targets-input targets-expand-input"
                                                    value={linha[nivel.valor]}
                                                    placeholder={noMeta ? '—' : '0'}
                                                    disabled={noMeta || !podeEditar}
                                                    onChange={(e) =>
                                                      alterarCampo(
                                                        setor,
                                                        nivel.valor,
                                                        e.target.value,
                                                      )
                                                    }
                                                    aria-label={`Valor a pagar ${nivel.nome} de ${setor}`}
                                                  />
                                                ) : (
                                                  formatarMoedaTexto(linha[nivel.valor])
                                                )}
                                              </dd>
                                            </div>
                                          </dl>
                                        </article>
                                      );
                                    })}
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
                </div>

                {setores.length === 0 && (
                  <p className="state-message">Nenhum setor encontrado.</p>
                )}
              </>
            ) : (
              <div className="targets-faixas">
                <p className="targets-faixas-intro">
                  Estas faixas valem para todos os setores de montagem no mês selecionado.
                </p>
                <div className="targets-table-wrap">
                  <table className="targets-table targets-faixas-table">
                    <thead>
                      <tr>
                        <th>Média inicial</th>
                        <th>Média final</th>
                        <th>Desconto (%)</th>
                        {editandoFaixas && <th aria-label="Ações" />}
                      </tr>
                    </thead>
                    <tbody>
                      {faixas.map((faixa, index) => (
                        <tr key={faixa.key}>
                          <td>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="targets-input"
                              value={faixa.media_min}
                              readOnly={!editandoFaixas}
                              onChange={(event) =>
                                alterarFaixa(faixa.key, 'media_min', event.target.value)
                              }
                              aria-label={`Média inicial da faixa ${index + 1}`}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="targets-input"
                              value={faixa.media_max}
                              placeholder="Sem limite"
                              readOnly={!editandoFaixas}
                              onChange={(event) =>
                                alterarFaixa(faixa.key, 'media_max', event.target.value)
                              }
                              aria-label={`Média final da faixa ${index + 1}`}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              inputMode="decimal"
                              className="targets-input"
                              value={faixa.percentual_desconto}
                              readOnly={!editandoFaixas}
                              onChange={(event) =>
                                alterarFaixa(
                                  faixa.key,
                                  'percentual_desconto',
                                  event.target.value,
                                )
                              }
                              aria-label={`Desconto da faixa ${index + 1}`}
                            />
                          </td>
                          {editandoFaixas && (
                            <td>
                              <button
                                type="button"
                                className="targets-cancel-btn"
                                onClick={() => removerFaixa(faixa.key)}
                                disabled={faixas.length === 1}
                              >
                                Remover
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {editandoFaixas && (
                  <button
                    type="button"
                    className="targets-add-faixa"
                    onClick={adicionarFaixa}
                  >
                    Adicionar faixa
                  </button>
                )}
                <p className="targets-faixas-note">
                  Deixe a média final vazia somente na última faixa para representar “sem limite”.
                </p>
              </div>
            )}
          </div>

          <p className="targets-hint">
            {guia === 'metas'
              ? podeEditar
                ? 'A meta do painel é a do nível Aço. O valor a pagar de cada nível fica na expansão da linha. A coluna Alcançado mostra a produção do mês e o maior nível batido (Bronze, Prata ou Aço).'
                : 'Visualização das metas de produção por setor e nível. Expanda a linha para ver o valor a pagar e o nível alcançado.'
              : podeEditarFaixas
                ? 'A apuração da montagem usa automaticamente as faixas cadastradas para este mês. Use Editar faixas para alterar.'
                : 'A apuração da montagem usa automaticamente as faixas cadastradas para este mês.'}
          </p>
        </main>
      </div>
    </PainelProducaoShell>
  );
}
