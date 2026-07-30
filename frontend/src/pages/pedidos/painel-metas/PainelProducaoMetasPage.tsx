import { useEffect, useState } from 'react';
import { MonthFilter } from '../../../components/painel-producao/MonthFilter';
import { PainelProducaoShell } from '../../../components/painel-producao/PainelProducaoShell';
import { useAuth } from '../../../contexts/AuthContext';
import {
  fetchPainelProducaoFilters,
  fetchPainelProducaoTargets,
  savePainelProducaoTarget,
  type PainelProducaoTargetRow,
} from '../../../api/painelProducao';
import { formatMesLabel } from '../../../utils/painelProducaoFormat';
import { podeEditarPainelMetas } from '../../../utils/painelProducaoPermissoes';
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

  const [setores, setSetores] = useState<string[]>([]);
  const [meses, setMeses] = useState<string[]>([]);
  const [mes, setMes] = useState('');
  const [linhas, setLinhas] = useState<Record<string, LinhaMeta>>({});
  const [semMeta, setSemMeta] = useState<Record<string, boolean>>({});
  const [editingSetores, setEditingSetores] = useState<Set<string>>(() => new Set());
  const [editSnapshots, setEditSnapshots] = useState<
    Record<string, { linha: LinhaMeta; semMeta: boolean }>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
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
        const rows: PainelProducaoTargetRow[] = await fetchPainelProducaoTargets(mes);
        if (cancelled) return;
        const linhaMap: Record<string, LinhaMeta> = {};
        const semMap: Record<string, boolean> = {};
        for (const row of rows) {
          semMap[row.setor] = !!row.sem_meta;
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
            <div className="targets-card-header">
              <h2>Metas por setor — {formatMesLabel(mes)}</h2>
              {podeEditar && (
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
            </div>

            {error && <p className="targets-feedback error">{error}</p>}
            {success && <p className="targets-feedback success">{success}</p>}

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
                          <td key={campo}>
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
          </div>

          <p className="targets-hint">
            {podeEditar
              ? 'A meta do painel é a do nível Aço. A apuração usa o maior nível alcançado pela produção e paga o valor fixo desse nível, menos a penalização qualitativa.'
              : 'Visualização das metas de produção por setor e nível.'}
          </p>
        </main>
      </div>
    </PainelProducaoShell>
  );
}
