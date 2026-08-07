import { useEffect, useState } from 'react';
import { MonthFilter } from '../../../components/painel-producao/MonthFilter';
import { PainelProducaoShell } from '../../../components/painel-producao/PainelProducaoShell';
import { useAuth } from '../../../contexts/AuthContext';
import {
  fetchPainelProducaoFaixasDesconto,
  fetchPainelProducaoFilters,
  fetchPainelProducaoTargets,
  savePainelProducaoFaixasDesconto,
  savePainelProducaoSetorPenalizacao,
  savePainelProducaoTarget,
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
                    <th rowSpan={2}>Setor</th>
                    <th rowSpan={2}>Não haverá meta</th>
                    <th colSpan={3} className="targets-group">
                      Meta (quantidade)
                    </th>
                    <th colSpan={3} className="targets-group">
                      Valor a pagar (R$)
                    </th>
                    <th rowSpan={2}>Penalizações</th>
                    {podeEditar && <th rowSpan={2} aria-label="Ações" />}
                  </tr>
                  <tr>
                    <th>Bronze</th>
                    <th>Prata</th>
                    <th>Aço</th>
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
                    return (
                      <tr
                        key={setor}
                        className={[
                          noMeta ? 'targets-row-no-meta' : '',
                          editando ? 'targets-row-editing' : '',
                        ]
                          .filter(Boolean)
                          .join(' ') || undefined}
                      >
                        <td>{setor}</td>
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
                        {CAMPOS_META.map((campo) => (
                          <td key={campo} className="targets-cell-num">
                            <input
                              type="text"
                              inputMode="decimal"
                              className="targets-input"
                              value={linha[campo]}
                              placeholder={noMeta ? '—' : '0'}
                              disabled={noMeta || !podeEditar || !editando}
                              readOnly={!editando}
                              onChange={(e) => alterarCampo(setor, campo, e.target.value)}
                              aria-label={`${campo.replace('_', ' ')} de ${setor}`}
                            />
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
                ? 'A meta do painel é a do nível Aço. Em cada setor, use Penalizações para ligar ou desligar o desconto qualitativo na apuração.'
                : 'Visualização das metas de produção por setor e nível.'
              : podeEditarFaixas
                ? 'A apuração da montagem usa automaticamente as faixas cadastradas para este mês. Use Editar faixas para alterar.'
                : 'A apuração da montagem usa automaticamente as faixas cadastradas para este mês.'}
          </p>
        </main>
      </div>
    </PainelProducaoShell>
  );
}
