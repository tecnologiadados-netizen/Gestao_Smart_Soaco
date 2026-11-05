import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { NoFamiliaPortaPalete } from '../../api/portaPalletsComercial';
import { criarMatcherTextoLivre } from '../../utils/textoLivreBusca';

type No = NoFamiliaPortaPalete;

type Props = {
  nos: No[];
  /** Vazio = família 95 inteira. `nenhuma` = nenhum ramo. Demais: códigos separados por `|`. */
  value: string;
  onChange: (value: string) => void;
  labelClass: string;
  inputClass: string;
  carregando?: boolean;
};

function indexar(nos: No[]): Map<string, No> {
  const mapa = new Map<string, No>();
  const walk = (no: No) => {
    mapa.set(no.classificacao, no);
    no.filhos.forEach(walk);
  };
  nos.forEach(walk);
  return mapa;
}

function marcado(cod: string, raizes: string[]): boolean {
  return raizes.some((r) => cod === r || cod.startsWith(`${r}.`));
}

function parcial(no: No, raizes: string[]): boolean {
  if (marcado(no.classificacao, raizes) || no.filhos.length === 0) return false;
  return no.filhos.some((f) => marcado(f.classificacao, raizes) || parcial(f, raizes));
}

function raizesDe(value: string, raiz: string): string[] {
  const v = value.trim();
  if (!v) return [raiz];
  if (v === 'nenhuma') return [];
  return v.split('|').map((s) => s.trim()).filter(Boolean);
}

function colapsar(raizes: string[], porCodigo: Map<string, No>): string[] {
  let atual = [...new Set(raizes)];
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const no of porCodigo.values()) {
      if (no.filhos.length === 0 || atual.includes(no.classificacao)) continue;
      if (!no.filhos.every((f) => marcado(f.classificacao, atual))) continue;
      atual = atual.filter((r) => !no.filhos.some((f) => r === f.classificacao || r.startsWith(`${f.classificacao}.`)));
      atual.push(no.classificacao);
      mudou = true;
    }
  }
  return atual;
}

function ligar(cod: string, raizes: string[], porCodigo: Map<string, No>): string[] {
  const semDesc = raizes.filter((r) => r !== cod && !r.startsWith(`${cod}.`));
  return colapsar([...semDesc, cod], porCodigo);
}

function desligar(cod: string, raizes: string[], porCodigo: Map<string, No>): string[] {
  let atual = [...raizes];
  const partes = cod.split('.');
  for (let i = 1; i < partes.length; i++) {
    const ancestral = partes.slice(0, i).join('.');
    if (!atual.includes(ancestral)) continue;
    const no = porCodigo.get(ancestral);
    atual = atual.filter((r) => r !== ancestral);
    if (no) for (const filho of no.filhos) atual.push(filho.classificacao);
  }
  atual = atual.filter((r) => r !== cod && !r.startsWith(`${cod}.`));
  return colapsar(atual, porCodigo);
}

function serializar(raizes: string[], raiz: string): string {
  if (raizes.length === 0) return 'nenhuma';
  if (raizes.length === 1 && raizes[0] === raiz) return '';
  return raizes.join('|');
}

function tituloNome(nome: string): string {
  return nome
    .toLowerCase()
    .replace(/(^|\s)\S/g, (t) => t.toUpperCase());
}

export default function FiltroArvoreFamilia({
  nos,
  value,
  onChange,
  labelClass,
  inputClass,
  carregando = false,
}: Props) {
  const raiz = nos[0]?.classificacao ?? '95';
  const porCodigo = useMemo(() => indexar(nos), [nos]);
  const raizes = raizesDe(value, raiz);
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set(['95']));
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fecha = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (ref.current?.contains(alvo) || painelRef.current?.contains(alvo)) return;
      setAberto(false);
    };
    document.addEventListener('mousedown', fecha);
    return () => document.removeEventListener('mousedown', fecha);
  }, [aberto]);

  useEffect(() => {
    if (!aberto) {
      setPos(null);
      return;
    }
    const atualizar = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const margem = 8;
      const largura = Math.min(544, Math.max(rect.width, window.innerWidth - margem * 2));
      const left = Math.max(margem, Math.min(rect.left, window.innerWidth - largura - margem));
      const espacoAbaixo = window.innerHeight - rect.bottom - margem;
      setPos({
        top: rect.bottom + 4,
        left,
        width: largura,
        maxHeight: Math.max(220, Math.min(420, espacoAbaixo)),
      });
    };
    atualizar();
    window.addEventListener('resize', atualizar);
    window.addEventListener('scroll', atualizar, true);
    return () => {
      window.removeEventListener('resize', atualizar);
      window.removeEventListener('scroll', atualizar, true);
    };
  }, [aberto]);

  const match = useMemo(() => criarMatcherTextoLivre(busca), [busca]);
  const buscando = busca.trim().length > 0;

  const rotulo = (() => {
    if (carregando && nos.length === 0) return 'Carregando…';
    if (!value.trim()) return 'Família 95';
    if (value.trim() === 'nenhuma') return 'Nenhuma';
    const codigos = value.split('|').filter(Boolean);
    if (codigos.length === 1) {
      const no = porCodigo.get(codigos[0] ?? '');
      return no ? `${no.classificacao} — ${tituloNome(no.nome)}` : codigos[0];
    }
    return `${codigos.length} famílias`;
  })();

  const alternar = (cod: string) => {
    const atual = raizesDe(value, raiz);
    const proximo = marcado(cod, atual) ? desligar(cod, atual, porCodigo) : ligar(cod, atual, porCodigo);
    onChange(serializar(proximo, raiz));
  };

  const visivel = (no: No): boolean => {
    if (!buscando) return true;
    if (match(`${no.classificacao} ${no.nome}`)) return true;
    return no.filhos.some(visivel);
  };

  const renderNo = (no: No, profundidade: number) => {
    if (!visivel(no)) return null;
    const abertoNo = buscando || expandidos.has(no.classificacao);
    const temFilhos = no.filhos.length > 0;
    const checado = marcado(no.classificacao, raizes);
    const meio = parcial(no, raizes);
    return (
      <div key={no.classificacao}>
        <div className="flex items-center gap-1 py-0.5" style={{ paddingLeft: profundidade * 14 }}>
          {temFilhos ? (
            <button
              type="button"
              aria-label={abertoNo ? `Recolher ${no.classificacao}` : `Expandir ${no.classificacao}`}
              className="grid h-6 w-6 shrink-0 place-items-center rounded border border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              onClick={() =>
                setExpandidos((atual) => {
                  const next = new Set(atual);
                  if (next.has(no.classificacao)) next.delete(no.classificacao);
                  else next.add(no.classificacao);
                  return next;
                })
              }
            >
              {abertoNo ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : (
            <span className="h-6 w-6 shrink-0" />
          )}
          <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 rounded px-1 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-600">
            <input
              type="checkbox"
              checked={checado}
              ref={(el) => {
                if (el) el.indeterminate = meio;
              }}
              onChange={() => alternar(no.classificacao)}
              className="mt-0.5 shrink-0 rounded border-slate-400 text-primary-600 focus:ring-primary-500"
            />
            <span className="min-w-0 text-sm leading-snug text-slate-800 dark:text-slate-100">
              <span className="font-medium">{no.classificacao}</span>
              <span> — {no.nome}</span>
            </span>
          </label>
        </div>
        {temFilhos && abertoNo ? no.filhos.map((filho) => renderNo(filho, profundidade + 1)) : null}
      </div>
    );
  };

  return (
    <div className="relative w-full min-w-0" ref={ref}>
      <label className={labelClass}>Família</label>
      <div className={`${inputClass} flex w-full items-center gap-1`}>
        <button type="button" className="min-w-0 flex-1 truncate bg-transparent py-0 text-left" onClick={() => setAberto((v) => !v)}>
          {rotulo}
        </button>
        {value.trim() ? (
          <button
            type="button"
            aria-label="Limpar filtro Família"
            title="Família 95 inteira"
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-600 dark:hover:text-slate-100"
            onClick={() => onChange('')}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path d="M3 3l6 6M9 3L3 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
        <button type="button" aria-label={aberto ? 'Fechar Família' : 'Abrir Família'} className="shrink-0 bg-transparent py-0 text-slate-400" onClick={() => setAberto((v) => !v)}>
          {aberto ? '▲' : '▼'}
        </button>
      </div>
      {aberto &&
        pos &&
        createPortal(
          <div
            ref={painelRef}
            className="flex flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-700"
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight, zIndex: 220 }}
          >
            <div className="border-b border-slate-200 p-2 dark:border-slate-600">
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Pesquisar… use % para refinar"
                className="w-full rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1.5 text-sm text-slate-800 focus:border-transparent focus:ring-2 focus:ring-primary-500 dark:border-slate-500 dark:bg-slate-600 dark:text-slate-100"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
              {nos.length === 0 ? (
                <p className="px-3 py-2 text-sm text-slate-500">Carregando a árvore…</p>
              ) : (
                nos.map((no) => renderNo(no, 0))
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
