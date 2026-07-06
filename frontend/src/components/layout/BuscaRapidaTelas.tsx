import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { criarPropsInputBuscaDropdown } from '../../utils/inputBuscaDropdown';
import {
  buildTelasBuscaRapidaForUser,
  filtrarTelasBuscaRapida,
  type TelaBuscaRapida,
} from '../../utils/telasBuscaRapida';

function SearchIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-white/45" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

export default function BuscaRapidaTelas({ className = '' }: { className?: string }) {
  const navigate = useNavigate();
  const { hasPermission, isMaster, grupo } = useAuth();

  const [termo, setTermo] = useState('');
  const [aberto, setAberto] = useState(false);
  const [destaqueIdx, setDestaqueIdx] = useState(0);
  const [inputEditavel, setInputEditavel] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLUListElement>(null);

  const [listaRect, setListaRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const atualizarPosLista = useCallback(() => {
    if (!containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    setListaRect({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  const telas = useMemo(
    () => buildTelasBuscaRapidaForUser({ hasPermission, isMaster, grupo }),
    [hasPermission, isMaster, grupo],
  );

  const sugestoes = useMemo(() => filtrarTelasBuscaRapida(telas, termo), [telas, termo]);

  const mostrarLista = aberto && termo.trim().length > 0;

  useEffect(() => {
    setDestaqueIdx(0);
  }, [termo, sugestoes.length]);

  useEffect(() => {
    if (!mostrarLista) return;
    const el = listaRef.current?.children[destaqueIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [destaqueIdx, mostrarLista]);

  useEffect(() => {
    if (!mostrarLista) {
      setListaRect(null);
      return;
    }
    atualizarPosLista();
    window.addEventListener('resize', atualizarPosLista);
    window.addEventListener('scroll', atualizarPosLista, true);
    return () => {
      window.removeEventListener('resize', atualizarPosLista);
      window.removeEventListener('scroll', atualizarPosLista, true);
    };
  }, [mostrarLista, atualizarPosLista, termo]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (containerRef.current?.contains(alvo) || listaRef.current?.contains(alvo)) return;
      setAberto(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const irParaTela = useCallback(
    (tela: TelaBuscaRapida) => {
      navigate(tela.path);
      setTermo('');
      setAberto(false);
      setInputEditavel(false);
      inputRef.current?.blur();
    },
    [navigate],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!mostrarLista) {
      if (e.key === 'Escape') {
        setTermo('');
        setAberto(false);
        inputRef.current?.blur();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDestaqueIdx((i) => (sugestoes.length === 0 ? 0 : (i + 1) % sugestoes.length));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setDestaqueIdx((i) => (sugestoes.length === 0 ? 0 : (i - 1 + sugestoes.length) % sugestoes.length));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const alvo = sugestoes[destaqueIdx];
      if (alvo) irParaTela(alvo);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setTermo('');
      setAberto(false);
      inputRef.current?.blur();
    }
  };

  const inputProps = criarPropsInputBuscaDropdown(() => setInputEditavel(true), {
    readOnly: !inputEditavel,
  });

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 transition focus-within:border-accent-500/60 focus-within:bg-white/8">
        <SearchIcon />
        <input
          {...inputProps}
          ref={inputRef}
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          onKeyDown={onKeyDown}
          placeholder="Pesquisar telas…"
          aria-label="Pesquisa rápida de telas"
          aria-autocomplete="list"
          aria-expanded={mostrarLista}
          aria-controls="busca-rapida-lista"
          role="combobox"
          className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
        />
      </div>

      {mostrarLista &&
        listaRect &&
        createPortal(
          <ul
            id="busca-rapida-lista"
            ref={listaRef}
            role="listbox"
            style={{
              position: 'fixed',
              top: listaRect.top,
              left: listaRect.left,
              width: listaRect.width,
              zIndex: 200,
              maxHeight: Math.max(120, Math.min(288, window.innerHeight - listaRect.top - 8)),
            }}
            className="overflow-y-auto rounded-lg border border-white/15 bg-soaco-graphite py-1 shadow-2xl"
          >
            {sugestoes.length === 0 ? (
              <li className="px-3 py-2 text-sm text-white/50">Nenhuma tela encontrada</li>
            ) : (
              sugestoes.map((tela, idx) => (
                <li key={tela.path} role="option" aria-selected={idx === destaqueIdx}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => irParaTela(tela)}
                    onMouseEnter={() => setDestaqueIdx(idx)}
                    className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left transition ${
                      idx === destaqueIdx ? 'bg-accent-500/20 text-white' : 'text-white/85 hover:bg-white/10'
                    }`}
                  >
                    <span className="truncate text-sm font-medium">{tela.label}</span>
                    {tela.contexto && (
                      <span className="truncate text-xs text-white/45">{tela.contexto}</span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>,
          document.body,
        )}
    </div>
  );
}
