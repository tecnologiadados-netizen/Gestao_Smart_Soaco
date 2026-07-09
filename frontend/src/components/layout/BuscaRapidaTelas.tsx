import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useFavoritos } from '../../contexts/FavoritosContext';
import { useFavoritoVisaoAtual } from '../../contexts/FavoritoVisaoAtualContext';
import SalvarFavoritoModal from '../favoritos/SalvarFavoritoModal';
import { buildFavoritoUrl } from '../../config/telasFavoritaveis';
import { criarMatcherTextoLivre } from '../../utils/textoLivreBusca';
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

function BookmarkIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 text-accent-400" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  );
}

export default function BuscaRapidaTelas({ className = '' }: { className?: string }) {
  const navigate = useNavigate();
  const { hasPermission, isMaster, grupo } = useAuth();
  const { favoritos } = useFavoritos();
  const { visao } = useFavoritoVisaoAtual();

  const [termo, setTermo] = useState('');
  const [aberto, setAberto] = useState(false);
  const [modalSalvarAberto, setModalSalvarAberto] = useState(false);
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

  const favoritosFiltrados = useMemo(() => {
    const t = termo.trim();
    if (!t) return favoritos;
    const match = criarMatcherTextoLivre(t);
    return favoritos.filter(
      (f) =>
        match(f.nome) ||
        match(f.telaLabel) ||
        match(f.resumoFiltros) ||
        match(f.rota),
    );
  }, [favoritos, termo]);

  type ItemLista =
    | { kind: 'header'; label: string }
    | { kind: 'salvar-atual'; label: string; sub: string }
    | { kind: 'favorito'; id: number; label: string; sub: string; path: string }
    | { kind: 'tela'; tela: TelaBuscaRapida };

  const podeFavoritarAtual =
    !!visao && Object.values(visao.filtros).every((v) => v?.trim());

  const itensLista = useMemo((): ItemLista[] => {
    const termoVazio = termo.trim().length === 0;
    const favs = termoVazio ? favoritos : favoritosFiltrados;
    const out: ItemLista[] = [];

    if (termoVazio && podeFavoritarAtual && visao) {
      out.push({ kind: 'header', label: 'Esta tela' });
      out.push({
        kind: 'salvar-atual',
        label: 'Favoritar visão atual',
        sub: `${visao.telaLabel} › ${visao.resumoFiltros}`,
      });
    }

    if (favs.length > 0) {
      if (termoVazio) out.push({ kind: 'header', label: 'Favoritas' });
      for (const f of favs) {
        out.push({
          kind: 'favorito',
          id: f.id,
          label: f.nome,
          sub: `${f.telaLabel} › ${f.resumoFiltros}`,
          path: buildFavoritoUrl(f.rota, f.id),
        });
      }
    }

    if (!termoVazio) {
      if (sugestoes.length > 0) {
        if (favs.length > 0) out.push({ kind: 'header', label: 'Telas' });
        for (const tela of sugestoes) {
          out.push({ kind: 'tela', tela });
        }
      }
    }

    return out;
  }, [termo, favoritos, favoritosFiltrados, sugestoes, podeFavoritarAtual, visao]);

  const mostrarLista = aberto && (termo.trim().length > 0 || favoritos.length > 0 || podeFavoritarAtual);

  const itensInterativos = useMemo(
    () => itensLista.filter((i) => i.kind !== 'header'),
    [itensLista],
  );

  function abrirModalSalvar() {
    setAberto(false);
    setModalSalvarAberto(true);
    inputRef.current?.blur();
  }

  useEffect(() => {
    setDestaqueIdx(0);
  }, [termo, itensInterativos.length]);

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

  const irParaPath = useCallback(
    (path: string) => {
      navigate(path);
      setTermo('');
      setAberto(false);
      setInputEditavel(false);
      inputRef.current?.blur();
    },
    [navigate],
  );

  const irParaTela = useCallback(
    (tela: TelaBuscaRapida) => {
      irParaPath(tela.path);
    },
    [irParaPath],
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
      setDestaqueIdx((i) =>
        itensInterativos.length === 0 ? 0 : (i + 1) % itensInterativos.length,
      );
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setDestaqueIdx((i) =>
        itensInterativos.length === 0 ? 0 : (i - 1 + itensInterativos.length) % itensInterativos.length,
      );
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const alvo = itensInterativos[destaqueIdx];
      if (!alvo) return;
      if (alvo.kind === 'salvar-atual') {
        setModalSalvarAberto(true);
        return;
      }
      if (alvo.kind === 'favorito') irParaPath(alvo.path);
      else if (alvo.kind === 'tela') irParaTela(alvo.tela);
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
              maxHeight: Math.max(120, Math.min(320, window.innerHeight - listaRect.top - 8)),
            }}
            className="overflow-y-auto rounded-lg border border-white/15 bg-soaco-graphite py-1 shadow-2xl"
          >
            {itensLista.length === 0 ? (
              <li className="px-3 py-2 text-sm text-white/50">Nenhum resultado</li>
            ) : (
              itensLista.map((item, i) => {
                if (item.kind === 'header') {
                  return (
                    <li key={`hdr-${item.label}-${i}`} className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/40">
                      {item.label}
                    </li>
                  );
                }
                const idx = itensInterativos.indexOf(item);
                if (item.kind === 'salvar-atual') {
                  return (
                    <li key="salvar-atual" role="option" aria-selected={idx === destaqueIdx}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={abrirModalSalvar}
                        onMouseEnter={() => setDestaqueIdx(idx)}
                        className={`flex w-full items-start gap-2 border-b border-white/10 px-3 py-2 text-left transition ${
                          idx === destaqueIdx ? 'bg-accent-500/20 text-white' : 'text-white/85 hover:bg-white/10'
                        }`}
                      >
                        <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{item.label}</span>
                          <span className="block truncate text-xs text-white/45">{item.sub}</span>
                        </span>
                      </button>
                    </li>
                  );
                }
                if (item.kind === 'favorito') {
                  return (
                    <li key={`fav-${item.id}`} role="option" aria-selected={idx === destaqueIdx}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => irParaPath(item.path)}
                        onMouseEnter={() => setDestaqueIdx(idx)}
                        className={`flex w-full items-start gap-2 px-3 py-2 text-left transition ${
                          idx === destaqueIdx ? 'bg-accent-500/20 text-white' : 'text-white/85 hover:bg-white/10'
                        }`}
                      >
                        <BookmarkIcon />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{item.label}</span>
                          <span className="block truncate text-xs text-white/45">{item.sub}</span>
                        </span>
                      </button>
                    </li>
                  );
                }
                const tela = item.tela;
                return (
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
                );
              })
            )}
          </ul>,
          document.body,
        )}

      {visao && (
        <SalvarFavoritoModal
          open={modalSalvarAberto}
          onClose={() => setModalSalvarAberto(false)}
          rota={visao.rota}
          filtros={visao.filtros}
          resumoFiltros={`${visao.telaLabel} › ${visao.resumoFiltros}`}
        />
      )}
    </div>
  );
}
