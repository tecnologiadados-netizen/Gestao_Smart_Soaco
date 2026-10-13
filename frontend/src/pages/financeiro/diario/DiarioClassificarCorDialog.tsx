import { useEffect, useRef, useState } from 'react';
import type { CorCabecalhoGrade } from '../../../components/grade/GradeFiltroExcelPortal';

export type PosicaoClassificacaoCor = 'superior' | 'inferior';

export type NivelClassificacaoCor = {
  id: string;
  corId: string;
  posicao: PosicaoClassificacaoCor;
};

function SeletorCorClassificacao({
  cores,
  valor,
  onChange,
}: {
  cores: CorCabecalhoGrade[];
  valor: string;
  onChange: (corId: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const caixaRef = useRef<HTMLDivElement>(null);
  const atual = cores.find((cor) => cor.id === valor);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (evento: MouseEvent) => {
      if (!caixaRef.current?.contains(evento.target as Node)) setAberto(false);
    };
    window.addEventListener('mousedown', fechar);
    return () => window.removeEventListener('mousedown', fechar);
  }, [aberto]);

  return (
    <div className="relative min-w-0 flex-1" ref={caixaRef}>
      <button
        type="button"
        aria-label={atual?.hex ? 'Cor selecionada' : 'Sem preenchimento'}
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className="flex h-7 w-full items-center rounded border border-slate-300 bg-white px-1.5 dark:border-slate-600 dark:bg-slate-700"
      >
        <span
          className={`h-4 min-w-0 flex-1 rounded-sm border border-black/15 ${atual?.hex ? '' : 'text-center text-[10px] leading-4 text-slate-500'}`}
          style={{ backgroundColor: atual?.hex ?? '#ffffff' }}
        >
          {atual?.hex ? '' : 'Sem preenchimento'}
        </span>
      </button>
      {aberto ? (
        <div className="absolute left-0 z-10 mt-1 w-full min-w-[7rem] rounded border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          {cores.map((cor) => (
            <button
              key={cor.id || 'sem'}
              type="button"
              aria-label={cor.hex ?? 'Sem preenchimento'}
              onClick={() => {
                onChange(cor.id);
                setAberto(false);
              }}
              className={`flex w-full items-center rounded px-1 py-1 hover:bg-slate-100 dark:hover:bg-slate-700 ${
                cor.id === valor ? 'ring-1 ring-primary-600' : ''
              }`}
            >
              <span
                className={`h-4 w-full rounded-sm border border-black/15 ${cor.hex ? '' : 'text-center text-[10px] leading-4 text-slate-500'}`}
                style={{ backgroundColor: cor.hex ?? '#ffffff' }}
              >
                {cor.hex ? '' : 'Sem preenchimento'}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function novoNivel(cores: CorCabecalhoGrade[], usados: Set<string>): NivelClassificacaoCor {
  const livre = cores.find((cor) => !usados.has(cor.id)) ?? cores[0];
  return {
    id: crypto.randomUUID(),
    corId: livre?.id ?? '',
    posicao: 'superior',
  };
}

export function DiarioClassificarCorDialog({
  cores,
  niveis,
  onCancelar,
  onConfirmar,
}: {
  cores: CorCabecalhoGrade[];
  niveis: NivelClassificacaoCor[];
  onCancelar: () => void;
  onConfirmar: (niveis: NivelClassificacaoCor[]) => void;
}) {
  const [rascunho, setRascunho] = useState<NivelClassificacaoCor[]>(() =>
    niveis.length > 0 ? niveis.map((nivel) => ({ ...nivel })) : [novoNivel(cores, new Set())],
  );
  const [selecionado, setSelecionado] = useState(0);

  const alterar = (indice: number, patch: Partial<NivelClassificacaoCor>) => {
    setRascunho((atual) => atual.map((nivel, i) => (i === indice ? { ...nivel, ...patch } : nivel)));
  };

  const adicionar = () => {
    setRascunho((atual) => {
      const proximo = novoNivel(cores, new Set(atual.map((nivel) => nivel.corId)));
      setSelecionado(atual.length);
      return [...atual, proximo];
    });
  };

  const excluir = () => {
    setRascunho((atual) => {
      if (atual.length <= 1) return atual;
      const proximo = atual.filter((_, i) => i !== selecionado);
      setSelecionado((indice) => Math.min(indice, proximo.length - 1));
      return proximo;
    });
  };

  return (
    <div className="fixed inset-0 z-[14000] flex items-center justify-center bg-black/40 p-4" onMouseDown={onCancelar}>
      <div
        role="dialog"
        aria-labelledby="classificar-cor-titulo"
        className="w-full max-w-3xl rounded-lg border border-slate-200 bg-white text-slate-800 shadow-2xl dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-4 py-2.5 dark:border-slate-600">
          <h2 id="classificar-cor-titulo" className="text-sm font-semibold">
            Classificar
          </h2>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-600">
          <button
            type="button"
            onClick={adicionar}
            disabled={cores.length === 0}
            className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            Adicionar nível
          </button>
          <button
            type="button"
            onClick={excluir}
            disabled={rascunho.length <= 1}
            className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            Excluir nível
          </button>
        </div>
        <div className="px-4 py-3">
          <div className="grid grid-cols-[9rem_8rem_1fr] gap-2 px-1 pb-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <span>Classificar por</span>
            <span>Classificar em</span>
            <span>Ordem</span>
          </div>
          {cores.length === 0 ? (
            <p className="px-1 py-3 text-xs text-slate-500">Nenhuma cor nesta coluna.</p>
          ) : (
            <div className="space-y-1">
              {rascunho.map((nivel, indice) => (
                  <div
                    key={nivel.id}
                    onClick={() => setSelecionado(indice)}
                    className={`grid grid-cols-[9rem_8rem_1fr] items-center gap-2 rounded px-1 py-1 ${
                      selecionado === indice ? 'bg-primary-50 dark:bg-primary-900/30' : ''
                    }`}
                  >
                    <span className="truncate text-xs">{indice === 0 ? 'Observação' : 'Em seguida por'}</span>
                    <span className="text-xs">Cor da célula</span>
                    <div className="flex min-w-0 items-center gap-1">
                      <SeletorCorClassificacao
                        cores={cores}
                        valor={nivel.corId}
                        onChange={(corId) => alterar(indice, { corId })}
                      />
                      <select
                        aria-label="Posição"
                        value={nivel.posicao}
                        onChange={(e) => alterar(indice, { posicao: e.target.value as PosicaoClassificacaoCor })}
                        className="h-7 rounded border border-slate-300 bg-white px-1 text-[11px] dark:border-slate-600 dark:bg-slate-700"
                      >
                        <option value="superior">Na Parte Superior</option>
                        <option value="inferior">Na Parte Inferior</option>
                      </select>
                    </div>
                  </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-2.5 dark:border-slate-600">
          <button
            type="button"
            disabled={cores.length === 0 || rascunho.some((nivel) => !cores.some((cor) => cor.id === nivel.corId))}
            onClick={() => onConfirmar(rascunho)}
            className="rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            OK
          </button>
          <button
            type="button"
            onClick={onCancelar}
            className="rounded border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
