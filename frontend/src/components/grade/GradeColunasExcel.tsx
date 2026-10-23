import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { Columns3, GripVertical, RotateCcw } from 'lucide-react';

export type GradeColunaConfiguravel = {
  id: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  largura?: number;
  larguraMinima?: number;
  fixa?: boolean;
};

type PreferenciasColunas = {
  ordem: string[];
  ocultas: string[];
  larguras: Record<string, number>;
};

const LARGURA_PADRAO = 140;
const LARGURA_MINIMA = 64;

function lerPreferencias(storageKey: string): PreferenciasColunas {
  try {
    const salvo = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Partial<PreferenciasColunas>;
    return {
      ordem: Array.isArray(salvo.ordem) ? salvo.ordem.filter((id): id is string => typeof id === 'string') : [],
      ocultas: Array.isArray(salvo.ocultas) ? salvo.ocultas.filter((id): id is string => typeof id === 'string') : [],
      larguras: salvo.larguras && typeof salvo.larguras === 'object' ? salvo.larguras : {},
    };
  } catch {
    return { ordem: [], ocultas: [], larguras: {} };
  }
}

export function useGradeColunasExcel(
  storageKey: string,
  colunas: readonly GradeColunaConfiguravel[],
) {
  const idsAtuais = useMemo(() => colunas.map((coluna) => coluna.id), [colunas]);
  const [preferencias, setPreferencias] = useState<PreferenciasColunas>(() => lerPreferencias(storageKey));
  const arrastadaRef = useRef<string | null>(null);

  const ordem = useMemo(() => {
    const validas = preferencias.ordem.filter((id) => idsAtuais.includes(id));
    return [...validas, ...idsAtuais.filter((id) => !validas.includes(id))];
  }, [idsAtuais, preferencias.ordem]);

  const ocultas = useMemo(
    () => new Set(preferencias.ocultas.filter((id) => idsAtuais.includes(id))),
    [idsAtuais, preferencias.ocultas],
  );

  const colunasOrdenadas = useMemo(
    () => ordem.map((id) => colunas.find((coluna) => coluna.id === id)).filter(Boolean) as GradeColunaConfiguravel[],
    [colunas, ordem],
  );
  const colunasVisiveis = useMemo(
    () => colunasOrdenadas.filter((coluna) => !ocultas.has(coluna.id)),
    [colunasOrdenadas, ocultas],
  );

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ ...preferencias, ordem }));
  }, [ordem, preferencias, storageKey]);

  const largura = (id: string) => {
    const coluna = colunas.find((item) => item.id === id);
    return Math.max(
      coluna?.larguraMinima ?? LARGURA_MINIMA,
      Number(preferencias.larguras[id]) || coluna?.largura || LARGURA_PADRAO,
    );
  };

  const estiloColuna = (id: string): CSSProperties => {
    const width = largura(id);
    return { width, minWidth: width, maxWidth: width };
  };

  const definirVisibilidade = (id: string, visivel: boolean) => {
    const coluna = colunas.find((item) => item.id === id);
    if (!coluna || coluna.fixa) return;
    setPreferencias((atual) => {
      const next = new Set(atual.ocultas);
      if (visivel) next.delete(id);
      else next.add(id);
      return { ...atual, ocultas: [...next] };
    });
  };

  const mover = (origem: string, destino: string) => {
    if (origem === destino) return;
    setPreferencias((atual) => {
      const lista = [...ordem];
      const de = lista.indexOf(origem);
      const para = lista.indexOf(destino);
      if (de < 0 || para < 0) return atual;
      lista.splice(de, 1);
      lista.splice(para, 0, origem);
      return { ...atual, ordem: lista };
    });
  };

  const propsArrastar = (id: string) => ({
    draggable: true,
    onDragStart: (evento: DragEvent<HTMLElement>) => {
      arrastadaRef.current = id;
      evento.dataTransfer.effectAllowed = 'move';
      evento.dataTransfer.setData('text/plain', id);
    },
    onDragOver: (evento: DragEvent<HTMLElement>) => {
      evento.preventDefault();
      evento.dataTransfer.dropEffect = 'move';
    },
    onDrop: (evento: DragEvent<HTMLElement>) => {
      evento.preventDefault();
      const origem = arrastadaRef.current || evento.dataTransfer.getData('text/plain');
      if (origem) mover(origem, id);
      arrastadaRef.current = null;
    },
    onDragEnd: () => {
      arrastadaRef.current = null;
    },
  });

  const iniciarRedimensionamento = (id: string, evento: ReactMouseEvent) => {
    evento.preventDefault();
    evento.stopPropagation();
    const inicialX = evento.clientX;
    const inicial = largura(id);
    const minimo = colunas.find((coluna) => coluna.id === id)?.larguraMinima ?? LARGURA_MINIMA;
    const onMove = (move: globalThis.MouseEvent) => {
      const nova = Math.max(minimo, Math.round(inicial + move.clientX - inicialX));
      setPreferencias((atual) => ({
        ...atual,
        larguras: { ...atual.larguras, [id]: nova },
      }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const restaurar = () => setPreferencias({ ordem: [], ocultas: [], larguras: {} });
  const larguraTotal = colunasVisiveis.reduce((total, coluna) => total + largura(coluna.id), 0);

  return {
    colunasOrdenadas,
    colunasVisiveis,
    ocultas,
    largura,
    larguraTotal,
    estiloColuna,
    definirVisibilidade,
    propsArrastar,
    iniciarRedimensionamento,
    restaurar,
  };
}

export type GradeColunasExcelApi = ReturnType<typeof useGradeColunasExcel>;

export function GradeColunasMenu({
  configuracao,
  aberto,
  onAlternar,
  onFechar,
}: {
  configuracao: GradeColunasExcelApi;
  aberto: boolean;
  onAlternar: () => void;
  onFechar: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (evento: globalThis.MouseEvent) => {
      if (!menuRef.current?.contains(evento.target as Node)) onFechar();
    };
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onFechar();
    };
    document.addEventListener('mousedown', fechar);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fechar);
      document.removeEventListener('keydown', tecla);
    };
  }, [aberto, onFechar]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={aberto}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
      >
        <Columns3 className="h-3.5 w-3.5" />
        Colunas
      </button>
      {aberto ? (
        <div className="absolute right-0 z-[60] mt-1 w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-600 dark:bg-slate-800">
          <p className="px-2 pb-2 text-[11px] text-slate-500 dark:text-slate-400">
            Marque para exibir. Arraste os cabeçalhos para reposicionar e use a borda direita para redimensionar.
          </p>
          <div className="max-h-72 overflow-auto">
            {configuracao.colunasOrdenadas.map((coluna) => (
              <label
                key={coluna.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <GripVertical className="h-3.5 w-3.5 text-slate-400" />
                <input
                  type="checkbox"
                  checked={!configuracao.ocultas.has(coluna.id)}
                  disabled={coluna.fixa}
                  onChange={(evento) => configuracao.definirVisibilidade(coluna.id, evento.target.checked)}
                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="min-w-0 flex-1 truncate">{coluna.label}</span>
                <span className="text-[10px] tabular-nums text-slate-400">{configuracao.largura(coluna.id)} px</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={configuracao.restaurar}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar padrão
          </button>
        </div>
      ) : null}
    </div>
  );
}
