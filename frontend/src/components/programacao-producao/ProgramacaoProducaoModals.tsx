import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import ResizableModalShell from '../ResizableModalShell';
import { useHorizontalWheelScroll } from '../../hooks/useHorizontalWheelScroll';
import {
  fetchBobinasProgramacaoBusca,
  fetchBobinasProgramacaoPorCodigos,
  fetchEstoqueBobinaSetores,
  saveCatalogoBobinasProgramacao,
  saveCatalogoDescricaoProgramacao,
  type BobinaProgramacaoBusca,
} from '../../api/programacaoProducao';
import SingleSelectWithSearch, { type OptionItem } from '../SingleSelectWithSearch';
import {
  bobinasAlternativasParaCatalogo,
  catalogoBobinaAlternativa,
  normalizarBobinasAlternativasLinha,
  syncBobinaAlternativaDisplay,
} from '../../utils/programacaoProducaoBobinaAlternativa';
import {
  aplicarCatalogoProgramacaoProducao,
  patchCatalogoBobinaRuntime,
  patchCatalogoDescricaoRuntime,
} from '../../utils/programacaoProducaoCatalogoRuntime';
import ModalOpsNomus from './ModalOpsNomus';
import type { OrdemProducaoNomusSelecionada } from './types';
import {
  formatNum,
  parseNumInputBranco,
  somaEstoqueProcesso,
} from './programacaoProducaoCalculos';
import { validarBobinasAlternativasLinha } from '../../utils/programacaoProducaoBobinaAlternativa';
import type {
  BobinaAlternativaItem,
  EstoqueEmProcesso,
  EstoqueMpAlternativaDetalheItem,
  LinhaProgramacaoProducao,
} from './types';
import { ESTOQUE_PROCESSO_VAZIO } from './programacaoProducaoCalculos';
import ModalQtdeProduzir from './ModalQtdeProduzir';

const LABEL_SELECT = 'text-xs font-medium text-slate-600 dark:text-slate-400 block mb-0.5';
const INPUT_SELECT =
  'rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 py-1 text-sm min-w-0 w-full focus:ring-2 focus:ring-primary-500';
const BTN_ICON =
  'p-1 rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 text-xs';

const BTN_SECONDARY =
  'px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium text-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600';

const BTN_PRIMARY =
  'px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm transition';

const INPUT =
  'w-full rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-1.5 text-sm dark:bg-slate-900 dark:text-slate-100';

type ModalBaseProps = {
  title: string;
  subtitle?: string;
  /** Subtítulo em várias linhas (sem truncar). */
  subtitleMultiline?: boolean;
  headerExtra?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  defaultWidth?: number;
  defaultHeight?: number;
};

function ModalBase({
  title,
  subtitle,
  subtitleMultiline,
  headerExtra,
  onClose,
  children,
  footer,
  defaultWidth = 520,
  defaultHeight = 440,
}: ModalBaseProps) {
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  useHorizontalWheelScroll(bodyScrollRef);

  return (
    <ResizableModalShell
      onClose={onClose}
      defaultWidth={defaultWidth}
      defaultHeight={defaultHeight}
      ariaLabelledBy="pp-modal-title"
    >
      <div className="flex h-full min-h-0 flex-col pb-1">
        <div className="shrink-0 border-b border-slate-200 p-4 dark:border-slate-600">
          <h2 id="pp-modal-title" className="text-base font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h2>
          {subtitle && (
            <p
              className={`mt-1 text-sm text-slate-500 dark:text-slate-400 ${
                subtitleMultiline ? 'whitespace-pre-wrap break-words' : 'truncate'
              }`}
            >
              {subtitle}
            </p>
          )}
          {headerExtra}
        </div>
        <div ref={bodyScrollRef} className="min-h-0 flex-1 overflow-auto p-4">
          {children}
        </div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 p-4 dark:border-slate-600">
            {footer}
          </div>
        )}
      </div>
    </ResizableModalShell>
  );
}

function TabelaSetores({
  loading,
  erro,
  setores,
  emptyMsg,
}: {
  loading: boolean;
  erro: string | null;
  setores: { nome_setor: string; saldo: number }[];
  emptyMsg: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useHorizontalWheelScroll(scrollRef, true, true);

  if (loading) return <p className="text-sm text-slate-500">Carregando…</p>;
  if (erro) return <p className="text-sm text-red-600 dark:text-red-300">{erro}</p>;
  if (!setores.length) return <p className="text-sm text-slate-500">{emptyMsg}</p>;

  const totalSaldo = setores.reduce((s, x) => s + x.saldo, 0);

  return (
    <div ref={scrollRef} className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-600">
            <th className="py-1.5 text-left font-semibold text-slate-700 dark:text-slate-200">Setor</th>
            <th className="py-1.5 text-right font-semibold text-slate-700 dark:text-slate-200">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {setores.map((s) => (
            <tr key={s.nome_setor} className="border-b border-slate-100 dark:border-slate-700">
              <td className="py-1.5 text-slate-800 dark:text-slate-200">{s.nome_setor}</td>
              <td className="py-1.5 text-right tabular-nums">{formatNum(s.saldo)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-slate-300 dark:border-slate-500 font-semibold">
            <td className="py-1.5 text-slate-800 dark:text-slate-100">Total</td>
            <td className="py-1.5 text-right tabular-nums">{formatNum(totalSaldo)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function ModalEstoqueBobina({
  linha,
  onClose,
}: {
  linha: LinhaProgramacaoProducao;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [setores, setSetores] = useState<{ nome_setor: string; saldo: number }[]>([]);

  useEffect(() => {
    if (!linha.idBobina) {
      setLoading(false);
      setErro('Sem bobina vinculada a este componente.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    void fetchEstoqueBobinaSetores(linha.idBobina)
      .then((r) => {
        if (cancelled) return;
        setSetores(r.setores);
        setErro(r.erro ?? null);
      })
      .catch((e) => {
        if (!cancelled) setErro(e instanceof Error ? e.message : 'Erro ao carregar.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [linha.idBobina]);

  return (
    <ModalBase
      title="Estoque atual bobina"
      subtitle={[linha.cod_bobina, linha.descricao_bobina].filter(Boolean).join(' — ')}
      onClose={onClose}
      footer={
        <button type="button" className={BTN_SECONDARY} onClick={onClose}>
          Fechar
        </button>
      }
    >
      <TabelaSetores
        loading={loading}
        erro={erro}
        setores={setores}
        emptyMsg="Nenhum saldo nos setores consultados."
      />
    </ModalBase>
  );
}

function TabelaDetalheMpAlternativa({ itens }: { itens: EstoqueMpAlternativaDetalheItem[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useHorizontalWheelScroll(scrollRef, true, true);

  if (!itens.length) {
    return <p className="text-sm text-slate-500">Nenhuma bobina alternativa consultada.</p>;
  }

  const totalGalpao = itens.reduce((s, i) => s + i.saldoGalpaoBobina, 0);
  const totalMp = itens.reduce((s, i) => s + i.saldoMpProcessada, 0);
  const totalGeral = itens.reduce((s, i) => s + i.saldoTotal, 0);

  return (
    <div ref={scrollRef} className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[32rem]">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-600">
            <th className="text-left py-1.5 font-medium text-slate-600 dark:text-slate-300">MP</th>
            <th className="text-left py-1.5 font-medium text-slate-600 dark:text-slate-300">Descrição</th>
            <th className="text-right py-1.5 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
              Galpão Bobina
            </th>
            <th className="text-right py-1.5 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
              MP Processada
            </th>
            <th className="text-right py-1.5 font-medium text-slate-600 dark:text-slate-300">Total</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item) => (
            <tr key={item.cod} className="border-b border-slate-100 dark:border-slate-700">
              <td className="py-1.5 font-mono text-slate-800 dark:text-slate-100">{item.cod}</td>
              <td className="py-1.5 text-slate-600 dark:text-slate-300 pr-2">{item.descricao ?? '—'}</td>
              <td className="py-1.5 text-right tabular-nums">{formatNum(item.saldoGalpaoBobina)}</td>
              <td className="py-1.5 text-right tabular-nums">{formatNum(item.saldoMpProcessada)}</td>
              <td className="py-1.5 text-right tabular-nums font-medium">{formatNum(item.saldoTotal)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-slate-300 dark:border-slate-500 font-semibold">
            <td className="py-1.5 text-slate-800 dark:text-slate-100" colSpan={2}>
              Total
            </td>
            <td className="py-1.5 text-right tabular-nums">{formatNum(totalGalpao)}</td>
            <td className="py-1.5 text-right tabular-nums">{formatNum(totalMp)}</td>
            <td className="py-1.5 text-right tabular-nums">{formatNum(totalGeral)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function ModalEstoqueMpAlternativa({
  linha,
  onClose,
}: {
  linha: LinhaProgramacaoProducao;
  onClose: () => void;
}) {
  const errAlt = linha.estoque_mp_alternativa_erro ?? validarBobinasAlternativasLinha(linha);
  const itens = linha.estoque_mp_alternativa_detalhe ?? [];

  const subtitle = [linha.cod_componente, linha.descricao_simplificada?.trim()]
    .filter(Boolean)
    .join(' — ');

  return (
    <ModalBase
      title="Detalhe estoque MP alternativa"
      subtitle={subtitle || linha.cod_componente}
      onClose={onClose}
      defaultWidth={640}
      defaultHeight={400}
      footer={
        <button type="button" className={BTN_SECONDARY} onClick={onClose}>
          Fechar
        </button>
      }
    >
      {errAlt ? (
        <p className="text-sm text-red-600 dark:text-red-400">{errAlt}</p>
      ) : (
        <TabelaDetalheMpAlternativa itens={itens} />
      )}
    </ModalBase>
  );
}

/** Estoque em PA (snapshot Nomus) + estoque em produção (usuário). */
export function ModalEstoque({
  linha,
  readOnly,
  onClose,
  onSave,
}: {
  linha: LinhaProgramacaoProducao;
  readOnly: boolean;
  onClose: () => void;
  onSave: (v: EstoqueEmProcesso) => void;
}) {
  const [vals, setVals] = useState<EstoqueEmProcesso>({
    ...(linha.estoque_em_processo ?? ESTOQUE_PROCESSO_VAZIO),
  });

  const fields: { key: keyof EstoqueEmProcesso; label: string }[] = [
    { key: 'perfiladeira', label: 'Perfiladeira' },
    { key: 'corteDobra', label: 'Corte e Dobra' },
    { key: 'solda', label: 'Solda' },
    { key: 'pintura', label: 'Pintura' },
    { key: 'montagem', label: 'Montagem' },
  ];

  const estoquePa = linha.estoque_atual_componente;
  const estoqueProducao = somaEstoqueProcesso(vals);

  const subtitleEstoque = [linha.cod_componente, linha.descricao_simplificada?.trim()]
    .filter(Boolean)
    .join(' — ');

  return (
    <ModalBase
      title="Estoque"
      subtitle={subtitleEstoque || linha.cod_componente}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={BTN_SECONDARY} onClick={onClose}>
            {readOnly ? 'Fechar' : 'Cancelar'}
          </button>
          {!readOnly && (
            <button
              type="button"
              className={BTN_PRIMARY}
              onClick={() => {
                onSave(vals);
                onClose();
              }}
            >
              Aplicar
            </button>
          )}
        </>
      }
    >
      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900/40">
        <div className="flex justify-between gap-2">
          <span className="text-slate-600 dark:text-slate-400">Estoque em PA (Nomus)</span>
          <span className="font-medium tabular-nums">{formatNum(estoquePa)}</span>
        </div>
        <div className="flex justify-between gap-2 mt-1">
          <span className="text-slate-600 dark:text-slate-400">Estoque em produção</span>
          <span className="font-medium tabular-nums">{formatNum(estoqueProducao)}</span>
        </div>
        <div className="flex justify-between gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-600 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatNum(estoquePa + estoqueProducao)}</span>
        </div>
      </div>

      <h3 className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-2">
        Estoque em produção
      </h3>
      <div className="flex flex-col gap-3">
        {fields.map(({ key, label }) => (
          <label key={key} className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</span>
            <input
              type="number"
              min={0}
              step="any"
              disabled={readOnly}
              className={`${INPUT} mt-1`}
              value={vals[key] === 0 ? '' : vals[key]}
              onChange={(e) =>
                setVals((v) => ({
                  ...v,
                  [key]: parseNumInputBranco(e.target.value),
                }))
              }
            />
          </label>
        ))}
      </div>
    </ModalBase>
  );
}

export function ModalGrupoProduto({
  linha,
  readOnly,
  onClose,
  onSave,
}: {
  linha: LinhaProgramacaoProducao;
  readOnly: boolean;
  onClose: () => void;
  onSave: (texto: string | null) => void;
}) {
  const [texto, setTexto] = useState(linha.grupo_produto ?? '');

  return (
    <ModalBase
      title="Grupo de produto"
      subtitle={linha.cod_componente}
      onClose={onClose}
      defaultWidth={400}
      defaultHeight={260}
      footer={
        <>
          <button type="button" className={BTN_SECONDARY} onClick={onClose}>
            {readOnly ? 'Fechar' : 'Cancelar'}
          </button>
          {!readOnly && (
            <button
              type="button"
              className={BTN_PRIMARY}
              onClick={() => {
                onSave(texto.trim() || null);
                onClose();
              }}
            >
              Aplicar
            </button>
          )}
        </>
      }
    >
      <input
        type="text"
        disabled={readOnly}
        className={INPUT}
        value={texto}
        placeholder="Grupo de produto"
        autoFocus={!readOnly}
        onChange={(e) => setTexto(e.target.value)}
      />
    </ModalBase>
  );
}

export function ModalDescricaoSimplificada({
  linha,
  readOnly,
  onClose,
  onSave,
}: {
  linha: LinhaProgramacaoProducao;
  readOnly: boolean;
  onClose: () => void;
  onSave: (texto: string | null) => void;
}) {
  const [texto, setTexto] = useState(linha.descricao_simplificada ?? '');

  return (
    <ModalBase
      title="Descrição simplificada"
      subtitle={linha.cod_componente}
      onClose={onClose}
      defaultWidth={440}
      defaultHeight={300}
      footer={
        <>
          <button type="button" className={BTN_SECONDARY} onClick={onClose}>
            {readOnly ? 'Fechar' : 'Cancelar'}
          </button>
          {!readOnly && (
            <button
              type="button"
              className={BTN_PRIMARY}
              onClick={() => {
                onSave(texto.trim() || null);
                onClose();
              }}
            >
              Aplicar
            </button>
          )}
        </>
      }
    >
      <textarea
        rows={4}
        disabled={readOnly}
        className={`${INPUT} resize-y min-h-[5rem]`}
        value={texto}
        placeholder="Descrição simplificada"
        autoFocus={!readOnly}
        onChange={(e) => setTexto(e.target.value)}
      />
    </ModalBase>
  );
}

function bobinaToOption(item: BobinaAlternativaItem): OptionItem | null {
  if (!item.cod?.trim() || item.idProduto == null) return null;
  return {
    id: item.idProduto,
    nome: item.cod.trim(),
    descricao: item.descricao,
  };
}

function bobinaBuscaToOption(b: BobinaProgramacaoBusca): OptionItem {
  return { id: b.id, nome: b.codigo, descricao: b.descricao };
}

export function ModalBobinasAlternativas({
  linha,
  readOnly,
  onClose,
  onSave,
}: {
  linha: LinhaProgramacaoProducao;
  readOnly: boolean;
  onClose: () => void;
  onSave: (itens: BobinaAlternativaItem[]) => void;
}) {
  const catalog = catalogoBobinaAlternativa(linha.cod_componente);
  const [itens, setItens] = useState<BobinaAlternativaItem[]>(() => {
    const norm = normalizarBobinasAlternativasLinha(linha);
    return [...(norm.bobinas_alternativas ?? [])];
  });
  const [bobinas, setBobinas] = useState<BobinaProgramacaoBusca[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [erroApply, setErroApply] = useState<string | null>(null);
  const [bobinaPrincipal, setBobinaPrincipal] = useState<{
    cod: string;
    descricao: string | null;
  } | null>(null);

  const carregarBusca = useCallback(async (termo: string) => {
    setSearchLoading(true);
    setErroBusca(null);
    try {
      const { data, erro } = await fetchBobinasProgramacaoBusca({ q: termo, limit: 80 });
      const sorted = [...data].sort((a, b) =>
        (a.descricao ?? a.codigo).localeCompare(b.descricao ?? b.codigo, 'pt-BR', {
          sensitivity: 'base',
        })
      );
      setBobinas(sorted);
      if (erro) setErroBusca(erro);
    } catch (e) {
      setErroBusca(e instanceof Error ? e.message : 'Erro ao buscar bobinas.');
      setBobinas([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarBusca('');
  }, [carregarBusca]);

  useEffect(() => {
    const codMp = catalog?.codigo_mp?.trim();
    if (!codMp) {
      setBobinaPrincipal(null);
      return;
    }
    let cancelled = false;
    void fetchBobinasProgramacaoPorCodigos([codMp]).then(({ data }) => {
      if (cancelled) return;
      const found = data.find((d) => d.codigo.trim() === codMp);
      setBobinaPrincipal({
        cod: codMp,
        descricao: found?.descricao ?? null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [catalog?.codigo_mp, linha.cod_componente]);

  useEffect(() => {
    const cods = itens
      .filter((i) => i.cod?.trim() && (i.idProduto == null || !i.descricao?.trim()))
      .map((i) => i.cod.trim());
    if (!cods.length) return;
    let cancelled = false;
    fetchBobinasProgramacaoPorCodigos(cods).then(({ data }) => {
      if (cancelled || !data.length) return;
      const porCod = new Map(data.map((d) => [d.codigo.trim(), d]));
      setItens((prev) =>
        prev.map((item) => {
          const found = porCod.get(item.cod.trim());
          if (!found) return item;
          return {
            cod: found.codigo,
            descricao: found.descricao,
            idProduto: found.id,
          };
        })
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const optionsBase: OptionItem[] = useMemo(
    () => bobinas.map(bobinaBuscaToOption),
    [bobinas]
  );

  const moveItem = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= itens.length) return;
    setItens((list) => {
      const copy = [...list];
      const [removed] = copy.splice(idx, 1);
      copy.splice(next, 0, removed);
      return copy;
    });
  };

  const updateItem = (idx: number, patch: Partial<BobinaAlternativaItem>) => {
    setItens((list) => list.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  };

  const removeItem = (idx: number) => {
    setItens((list) => list.filter((_, i) => i !== idx));
  };

  const handleApply = () => {
    setErroApply(null);
    const incompletos = itens.filter((i) => i.cod?.trim() && i.idProduto == null);
    if (incompletos.length) {
      setErroApply('Selecione cada bobina na lista do sistema (busca com clique, sem digitar código livre).');
      return;
    }
    const limpos = itens.filter((i) => i.cod?.trim() && i.idProduto != null);
    const errVal = validarBobinasAlternativasLinha(linha, limpos);
    if (errVal) {
      setErroApply(errVal);
      return;
    }
    onSave(limpos);
    onClose();
  };

  return (
    <ModalBase
      title="Bobinas alternativas"
      defaultWidth={680}
      defaultHeight={520}
      headerExtra={
        <div className="mt-1 space-y-2 border-b border-slate-200 dark:border-slate-600 pb-2">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
            <span className="font-mono font-semibold text-slate-800 dark:text-slate-100 shrink-0">
              {linha.cod_componente}
            </span>
            <span className="text-slate-600 dark:text-slate-300 break-words min-w-0">
              {linha.descricao_componente}
            </span>
          </div>
          {bobinaPrincipal && (
            <div className="text-xs text-slate-600 dark:text-slate-300">
              <span className="font-medium text-slate-700 dark:text-slate-200">Bobina principal: </span>
              <span className="font-mono">{bobinaPrincipal.cod}</span>
              {bobinaPrincipal.descricao?.trim() && (
                <span className="block mt-0.5 whitespace-pre-wrap break-words text-slate-500 dark:text-slate-400">
                  {bobinaPrincipal.descricao}
                </span>
              )}
            </div>
          )}
        </div>
      }
      onClose={onClose}
      footer={
        <>
          <button type="button" className={BTN_SECONDARY} onClick={onClose}>
            {readOnly ? 'Fechar' : 'Cancelar'}
          </button>
          {!readOnly && (
            <button type="button" className={BTN_PRIMARY} onClick={handleApply}>
              Aplicar
            </button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {erroBusca && <p className="text-xs text-amber-600 dark:text-amber-400">{erroBusca}</p>}
        {erroApply && <p className="text-xs text-red-600 dark:text-red-300">{erroApply}</p>}
        <div className="space-y-3">
          {itens.length === 0 && (
            <p className="text-sm text-slate-500">Nenhuma alternativa cadastrada para este componente.</p>
          )}
          {itens.map((item, idx) => {
            const selected = bobinaToOption(item);
            const options =
              selected && !optionsBase.some((o) => o.id === selected.id)
                ? [selected, ...optionsBase]
                : optionsBase;
            return (
              <div
                key={`${idx}-${item.idProduto ?? 'x'}-${item.cod}`}
                className="flex gap-2 items-end border border-slate-200 dark:border-slate-600 rounded-lg p-2"
              >
                <div className="flex flex-col gap-0.5 shrink-0 w-14">
                  <span className="text-[10px] font-semibold uppercase text-slate-500">Prior.</span>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    Alt {idx + 1}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <SingleSelectWithSearch
                    label="Código bobina"
                    placeholder="Buscar bobina (MP…)…"
                    labelClass={LABEL_SELECT}
                    inputClass={INPUT_SELECT}
                    options={options}
                    value={selected}
                    clearable={!readOnly}
                    onChange={(opt) => {
                      if (!opt) {
                        updateItem(idx, { cod: '', descricao: null, idProduto: null });
                        return;
                      }
                      updateItem(idx, {
                        cod: opt.nome,
                        descricao: opt.descricao ?? null,
                        idProduto: opt.id,
                      });
                    }}
                    onSearchChange={readOnly ? undefined : carregarBusca}
                    searchLoading={searchLoading}
                    listMaxHeight="160px"
                  />
                  {item.descricao?.trim() && (
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 truncate" title={item.descricao}>
                      {item.descricao}
                    </p>
                  )}
                </div>
                {!readOnly && (
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      type="button"
                      className={BTN_ICON}
                      title="Aumentar prioridade"
                      disabled={idx === 0}
                      onClick={() => moveItem(idx, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={BTN_ICON}
                      title="Diminuir prioridade"
                      disabled={idx === itens.length - 1}
                      onClick={() => moveItem(idx, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className={BTN_ICON}
                      title="Remover"
                      onClick={() => removeItem(idx)}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {!readOnly && (
          <button
            type="button"
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
            onClick={() =>
              setItens((list) => [...list, { cod: '', descricao: null, idProduto: null }])
            }
          >
            + Adicionar alternativa
          </button>
        )}
      </div>
    </ModalBase>
  );
}

export type ModalGradeTipo =
  | { tipo: 'estoque_bobina'; linha: LinhaProgramacaoProducao }
  | { tipo: 'estoque_mp_alternativa'; linha: LinhaProgramacaoProducao }
  | { tipo: 'estoque'; linha: LinhaProgramacaoProducao; idComponente: number }
  | { tipo: 'qtde_produzir'; linha: LinhaProgramacaoProducao; idComponente: number }
  | { tipo: 'descricao_simplificada'; linha: LinhaProgramacaoProducao; idComponente: number }
  | { tipo: 'grupo_produto'; linha: LinhaProgramacaoProducao; idComponente: number }
  | { tipo: 'bobinas_alternativas'; linha: LinhaProgramacaoProducao; idComponente: number }
  | { tipo: 'ops_nomus'; linha: LinhaProgramacaoProducao; idComponente: number };

export function ProgramacaoProducaoModalHost({
  modal,
  readOnly,
  editarOpNomus = false,
  visualizarSomente = false,
  linhaAtual,
  onClose,
  onUpdateLinha,
}: {
  modal: ModalGradeTipo | null;
  readOnly: boolean;
  /** Status processado: permite editar OP Nomus (consulta Nomus ao vivo). */
  editarOpNomus?: boolean;
  /** Concluída: modais somente leitura (inclui OP Nomus). */
  visualizarSomente?: boolean;
  /** Linha atual da grade (qtde produzir etc.), evita snapshot desatualizado no modal. */
  linhaAtual?: (idComponente: number) => LinhaProgramacaoProducao | undefined;
  onClose: () => void;
  onUpdateLinha: (idComponente: number, patch: Partial<LinhaProgramacaoProducao>) => void;
}) {
  if (!modal) return null;

  if (modal.tipo === 'estoque_bobina') {
    return <ModalEstoqueBobina linha={modal.linha} onClose={onClose} />;
  }
  if (modal.tipo === 'estoque_mp_alternativa') {
    return <ModalEstoqueMpAlternativa linha={modal.linha} onClose={onClose} />;
  }
  if (modal.tipo === 'estoque') {
    return (
      <ModalEstoque
        linha={modal.linha}
        readOnly={readOnly}
        onClose={onClose}
        onSave={(v) => onUpdateLinha(modal.idComponente, { estoque_em_processo: v })}
      />
    );
  }
  if (modal.tipo === 'descricao_simplificada') {
    return (
      <ModalDescricaoSimplificada
        linha={modal.linha}
        readOnly={readOnly}
        onClose={onClose}
        onSave={(texto) => {
          onUpdateLinha(modal.idComponente, { descricao_simplificada: texto });
          if (!readOnly) {
            const cod = modal.linha.cod_componente;
            patchCatalogoDescricaoRuntime(cod, texto);
            void saveCatalogoDescricaoProgramacao(cod, texto).then((descricoes) => {
              aplicarCatalogoProgramacaoProducao({ descricoes });
            });
          }
        }}
      />
    );
  }
  if (modal.tipo === 'grupo_produto') {
    return (
      <ModalGrupoProduto
        linha={modal.linha}
        readOnly={readOnly}
        onClose={onClose}
        onSave={(texto) => onUpdateLinha(modal.idComponente, { grupo_produto: texto })}
      />
    );
  }
  if (modal.tipo === 'bobinas_alternativas') {
    return (
      <ModalBobinasAlternativas
        linha={modal.linha}
        readOnly={readOnly}
        onClose={onClose}
        onSave={(itens) => {
          onUpdateLinha(
            modal.idComponente,
            syncBobinaAlternativaDisplay({ ...modal.linha, bobinas_alternativas: itens })
          );
          if (!readOnly) {
            const cod = modal.linha.cod_componente;
            const entry = bobinasAlternativasParaCatalogo(cod, itens);
            patchCatalogoBobinaRuntime(cod, entry);
            void saveCatalogoBobinasProgramacao(cod, entry).then((bobinas) => {
              aplicarCatalogoProgramacaoProducao({ bobinas });
            });
          }
        }}
      />
    );
  }
  if (modal.tipo === 'qtde_produzir') {
    return (
      <ModalQtdeProduzir
        linha={modal.linha}
        readOnly={readOnly}
        onClose={onClose}
        onSave={(v) => onUpdateLinha(modal.idComponente, { qtde_produzir: v })}
      />
    );
  }
  if (modal.tipo === 'ops_nomus') {
    const linha = linhaAtual?.(modal.idComponente) ?? modal.linha;
    return (
      <ModalOpsNomus
        key={`ops-${modal.idComponente}`}
        linha={linha}
        readOnly={visualizarSomente || !editarOpNomus}
        onClose={onClose}
        onSave={(ordens: OrdemProducaoNomusSelecionada[]) => {
          const resumo =
            ordens.length === 0 ? null : ordens.map((o) => o.ordem).join(', ');
          onUpdateLinha(modal.idComponente, {
            ordens_producao_nomus: ordens,
            ordem_producao_nomus: resumo,
          });
        }}
      />
    );
  }
  return null;
}
