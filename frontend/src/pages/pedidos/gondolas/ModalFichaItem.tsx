import { Fragment, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import type { ComponenteFicha, DetalheItemGondola } from '../../../api/gondolasPortaPaletes';

function fmt(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function origemLabel(origem: DetalheItemGondola['origem']): string {
  if (origem === 'nomus') return 'Ficha no Nomus';
  if (origem === 'planilha') return 'Planilha do setor';
  return 'Sem ficha';
}

function SeloOrdem({ numero }: { numero?: string }) {
  if (!numero) return null;
  return (
    <span className="ml-2 inline-flex rounded border border-emerald-500/60 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
      Em ordem {numero}
    </span>
  );
}

type GrupoPi = {
  chave: string;
  pi: ComponenteFicha;
  pps: ComponenteFicha[];
};

function agruparPiComPps(componentes: ComponenteFicha[]): GrupoPi[] {
  const grupos: GrupoPi[] = [];
  for (const componente of componentes) {
    const anterior = grupos[grupos.length - 1];
    if (componente.tipo === 'PP' && anterior?.pi.tipo === 'PI') {
      anterior.pps.push(componente);
      continue;
    }
    grupos.push({
      chave: `${componente.tipo}|${componente.codigo}|${grupos.length}`,
      pi: componente,
      pps: [],
    });
  }
  return grupos;
}

export default function ModalFichaItem({
  detalhe,
  carregando,
  erro,
  onTrocarFicha,
  onClose,
}: {
  detalhe: DetalheItemGondola | null;
  carregando: boolean;
  erro: string | null;
  /** Só quando o código tem ficha no Nomus e na planilha. */
  onTrocarFicha?: (origem: 'nomus' | 'planilha') => void;
  onClose: () => void;
}) {
  const nomus = detalhe?.origem === 'nomus';
  const gruposNomus = useMemo(
    () => (nomus && detalhe ? agruparPiComPps(detalhe.componentes) : []),
    [detalhe, nomus]
  );
  const [recolhidos, setRecolhidos] = useState<{ detalheId: number | null; chaves: Set<string> }>({
    detalheId: null,
    chaves: new Set(),
  });
  const detalheId = detalhe?.item.idItem ?? null;

  function alternarGrupo(chave: string) {
    setRecolhidos((atual) => {
      const chaves = atual.detalheId === detalheId ? new Set(atual.chaves) : new Set<string>();
      if (chaves.has(chave)) chaves.delete(chave);
      else chaves.add(chave);
      return { detalheId, chaves };
    });
  }

  const grupoEstaRecolhido = (chave: string) =>
    recolhidos.detalheId === detalheId && recolhidos.chaves.has(chave);

  return createPortal(
    <div
      className="fixed inset-0 z-[14000] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-soaco-gray/35 bg-white shadow-xl dark:bg-soaco-graphite"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-ficha-item"
      >
        <div className="flex items-start justify-between gap-4 border-b border-soaco-gray/35 bg-soaco-navy px-5 py-4 text-white">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {detalhe && (
                <span className="inline-flex rounded-md border border-primary-400 bg-primary-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                  {detalhe.item.setor}
                </span>
              )}
              {detalhe?.ambasFichas && onTrocarFicha ? (
                <span
                  className="inline-flex overflow-hidden rounded-md border border-white/25 text-[11px] font-semibold"
                  role="radiogroup"
                  aria-label="Lista que permanece"
                  title="Este código tem ficha no Nomus e na planilha. Escolha qual lista permanece."
                >
                  {(
                    [
                      ['nomus', 'Ficha no Nomus', 'bg-primary-600 text-white'],
                      ['planilha', 'Planilha do setor', 'bg-[#FFAD00] text-black'],
                    ] as const
                  ).map(([origem, rotulo, ativoCls]) => {
                    const ativo = detalhe.origem === origem;
                    return (
                      <button
                        key={origem}
                        type="button"
                        role="radio"
                        aria-checked={ativo}
                        disabled={carregando || ativo}
                        onClick={() => onTrocarFicha(origem)}
                        className={`px-2.5 py-1 transition disabled:cursor-default ${
                          ativo ? ativoCls : 'text-white/70 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {rotulo}
                      </button>
                    );
                  })}
                </span>
              ) : (
                <span className="inline-flex rounded-md border border-white/25 px-2.5 py-1 text-[11px] font-semibold text-white">
                  {detalhe ? origemLabel(detalhe.origem) : 'Ficha do item'}
                </span>
              )}
            </div>
            <h2 id="titulo-ficha-item" className="mt-2 text-xl font-semibold tracking-tight text-white">
              {detalhe
                ? `${detalhe.item.pedido} · ${detalhe.item.codigo}`
                : carregando
                  ? 'Abrindo a ficha…'
                  : 'Ficha do item'}
            </h2>
            {detalhe && (
              <p className="mt-1 text-sm text-white/75">{detalhe.item.descricao || 'Sem descrição'}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {detalhe && (
          <div className="grid grid-cols-3 gap-3 border-b border-soaco-gray/35 bg-white px-5 py-4 dark:bg-soaco-graphite">
            {[
              ['Qtde pedida', detalhe.item.qtdePedida],
              ['Pendente', detalhe.item.pendente],
              ['Pendente real', detalhe.item.qtdePendenteReal],
            ].map(([rotulo, valor]) => (
              <div
                key={String(rotulo)}
                className="rounded-lg border border-soaco-gray/35 bg-slate-50 px-4 py-3 dark:bg-soaco-navy/45"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">{rotulo}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-white">{fmt(Number(valor))}</p>
              </div>
            ))}
          </div>
        )}

        <div className="overflow-y-auto px-5 py-4">
          {carregando && <p className="text-sm text-slate-500">Consultando a ficha…</p>}
          {erro && <p className="text-sm text-red-600 dark:text-red-300">{erro}</p>}
          {detalhe && detalhe.origem === 'nenhuma' && (
            <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-600">
              Este código não tem ficha de produção no Nomus e também não está na planilha de {detalhe.item.setor}.
            </p>
          )}
          {detalhe && detalhe.origem === 'nomus' && detalhe.componentes.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-600">
              A ficha de produção existe no Nomus e não tem PI nem PP neste nível.
            </p>
          )}
          {detalhe && detalhe.componentes.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-soaco-gray/35">
              <table className="tabela-pedidos-grade w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr>
                    {nomus ? (
                      <>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold">Código</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold">Descrição</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold">Tipo</th>
                      </>
                    ) : (
                      <>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold">Peça</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold">Modelo</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold">Matéria-prima</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold">Medida 01</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold">Medida 02</th>
                      </>
                    )}
                    <th className="px-3 py-2.5 text-right text-xs font-semibold">Na ficha</th>
                    <th className="px-3 py-2.5 text-right text-xs font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {nomus
                    ? gruposNomus.map((grupo) => {
                        const recolhido = grupoEstaRecolhido(grupo.chave);
                        return (
                          <Fragment key={grupo.chave}>
                            <tr>
                              <td className="px-3 py-2.5">
                                <span className="inline-flex items-center gap-1.5">
                                  {grupo.pps.length > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => alternarGrupo(grupo.chave)}
                                      className="rounded p-0.5 text-slate-500 hover:bg-white/10 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                                      aria-expanded={!recolhido}
                                      aria-label={`${recolhido ? 'Expandir' : 'Recolher'} PP de ${grupo.pi.codigo}`}
                                    >
                                      {recolhido ? (
                                        <ChevronRight className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                    </button>
                                  ) : (
                                    <span className="h-5 w-5" />
                                  )}
                                  <span className="inline-flex min-h-7 items-center rounded-md border border-primary-500/70 bg-primary-600 px-2.5 py-1 text-sm font-semibold text-white dark:border-primary-400 dark:bg-primary-500">
                                    {grupo.pi.codigo}
                                  </span>
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">
                                {grupo.pi.descricao}
                                <SeloOrdem numero={grupo.pi.ordemGerada} />
                                {grupo.pps.length > 0 && (
                                  <span className="ml-2 text-xs text-slate-400">
                                    {grupo.pps.length} {grupo.pps.length === 1 ? 'PP' : 'PPs'}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">{grupo.pi.tipo}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">
                                {fmt(grupo.pi.quantidade)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-medium tabular-nums text-slate-800 dark:text-white">
                                {fmt(grupo.pi.quantidadeTotal)}
                              </td>
                            </tr>
                            {!recolhido &&
                              grupo.pps.map((pp, indice) => (
                                <tr key={`${grupo.chave}|${pp.codigo}|${indice}`} className="bg-primary-950/5 dark:bg-primary-950/20">
                                  <td className="px-3 py-2.5 pl-12">
                                    <span className="inline-flex min-h-7 items-center rounded-md border border-primary-500/50 bg-primary-600 px-2.5 py-1 text-sm font-semibold text-white dark:border-primary-400/70 dark:bg-primary-500">
                                      {pp.codigo}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">
                                    {pp.descricao}
                                    <SeloOrdem numero={pp.ordemGerada} />
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">{pp.tipo}</td>
                                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">
                                    {fmt(pp.quantidade)}
                                  </td>
                                  <td className="px-3 py-2.5 text-right font-medium tabular-nums text-slate-800 dark:text-white">
                                    {fmt(pp.quantidadeTotal)}
                                  </td>
                                </tr>
                              ))}
                          </Fragment>
                        );
                      })
                    : detalhe.componentes.map((linha, indice) => (
                        <tr key={`${linha.codigo}|${linha.descricao}|${indice}`}>
                          <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-white">
                            {linha.descricao || '—'}
                            <SeloOrdem numero={linha.ordemGerada} />
                            {linha.codigo ? <div className="text-xs font-normal text-slate-400">{linha.codigo}</div> : null}
                          </td>
                          <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">{linha.modelo || '—'}</td>
                          <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">{linha.materiaPrima || '—'}</td>
                          <td className="px-3 py-2.5 font-mono tabular-nums text-slate-700 dark:text-slate-200">{linha.medida01 || '—'}</td>
                          <td className="px-3 py-2.5 font-mono tabular-nums text-slate-700 dark:text-slate-200">{linha.medida02 || '—'}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-200">
                            {fmt(linha.quantidade)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium tabular-nums text-slate-800 dark:text-white">
                            {fmt(linha.quantidadeTotal)}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
