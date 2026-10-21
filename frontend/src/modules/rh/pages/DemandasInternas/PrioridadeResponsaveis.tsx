import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Flag, Users, X } from 'lucide-react';
import { criarMatcherTextoLivre } from '@/utils/textoLivreBusca';
import { getOrganicoFotosResumo, isApiConfigured } from '@rh/lib/api-client';
import { canViewOrganicoPhotos } from '@rh/lib/route-permissions';
import {
  matriculaTemFoto,
  registrarMatriculasComFoto,
  useOrganicoCardFoto,
} from '@rh/pages/Organico/useOrganicoCardFoto';
import {
  getColaboradoresResponsaveis,
  iniciaisDoNome,
  PRIORIDADES_CARD,
  type Prioridade,
  type Responsavel,
} from '@rh/lib/demandas-internas';

const rotuloSecao = 'mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground';

export function SeletorPrioridade({
  valor,
  podeEditar,
  onSalvar,
}: {
  valor: Prioridade | null;
  podeEditar: boolean;
  onSalvar: (prioridade: Prioridade | null) => void;
}) {
  const atual = PRIORIDADES_CARD.find((item) => item.id === valor) ?? null;
  return (
    <div className="mt-3">
      <p className={rotuloSecao}>
        <Flag className="h-3.5 w-3.5" /> Prioridade
      </p>
      {podeEditar ? (
        <div className="flex flex-wrap items-center gap-2">
          {PRIORIDADES_CARD.map((item) => {
            const ativo = item.id === valor;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={ativo}
                onClick={() => onSalvar(ativo ? null : item.id)}
                style={ativo ? { backgroundColor: item.fundo, color: item.texto, borderColor: item.fundo } : { borderColor: item.fundo }}
                className={`rounded-full border-2 px-3 py-1 text-xs font-semibold ${ativo ? '' : 'bg-white text-[#10233f] hover:bg-[#f7f9fc]'}`}
              >
                {item.rotulo}
              </button>
            );
          })}
          {valor ? (
            <button
              type="button"
              onClick={() => onSalvar(null)}
              className="rounded-md px-2 py-1 text-xs font-medium text-[#5c7084] hover:bg-[#e7eef8]"
            >
              Limpar
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm">{atual ? atual.rotulo : 'Sem prioridade'}</p>
      )}
    </div>
  );
}

function useMatriculasComFoto(podeVerFotos: boolean): Set<string> {
  const { data } = useQuery({
    queryKey: ['organico-fotos-resumo'],
    queryFn: getOrganicoFotosResumo,
    enabled: podeVerFotos,
    staleTime: 5 * 60 * 1000,
  });
  return useMemo(
    () => registrarMatriculasComFoto((data ?? []).map((foto) => String(foto.colaboradorMatricula ?? ''))),
    [data],
  );
}

/** Foto do orgânico (quem tem permissão de ver fotos); sem foto, as iniciais. */
export function AvatarResponsavel({
  matricula,
  nome,
  className = '',
  imediata = false,
}: {
  matricula: string;
  nome: string;
  className?: string;
  /** No quadro a foto espera o card aparecer; no modal, busca na hora. */
  imediata?: boolean;
}) {
  const podeVerFotos = isApiConfigured() && canViewOrganicoPhotos();
  const comFoto = useMatriculasComFoto(podeVerFotos);
  const { rootRef, fotoSrc } = useOrganicoCardFoto({
    matricula,
    nome,
    fotoDisponivel: matriculaTemFoto(comFoto, matricula),
    podeBuscar: podeVerFotos,
    imediata,
  });
  return (
    <div
      ref={rootRef}
      title={nome}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1a4a86] font-semibold text-white ${className}`}
    >
      {fotoSrc ? <img src={fotoSrc} alt="" draggable={false} className="h-full w-full object-cover" /> : iniciaisDoNome(nome)}
    </div>
  );
}

export function SeletorResponsaveis({
  valor,
  podeEditar,
  onSalvar,
}: {
  valor: Responsavel[];
  podeEditar: boolean;
  onSalvar: (responsaveis: Responsavel[]) => void;
}) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const [destaque, setDestaque] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const colaboradores = useQuery({
    queryKey: ['rh-demanda-colaboradores'],
    queryFn: getColaboradoresResponsaveis,
    enabled: podeEditar,
    staleTime: 5 * 60 * 1000,
  });

  const opcoes = useMemo(() => {
    const escolhidos = new Set(valor.map((item) => item.matricula));
    const match = criarMatcherTextoLivre(busca);
    return (colaboradores.data ?? [])
      .filter((c) => !escolhidos.has(c.matricula))
      .filter((c) => !busca.trim() || match(`${c.nome} ${c.setor} ${c.cargo} ${c.matricula}`))
      .slice(0, 8);
  }, [busca, colaboradores.data, valor]);

  function escolher(indice: number) {
    const item = opcoes[indice];
    if (!item) return;
    onSalvar([...valor, { matricula: item.matricula, nome: item.nome }]);
    setBusca('');
    setDestaque(0);
    inputRef.current?.focus();
  }

  return (
    <div className="mt-3">
      <p className={rotuloSecao}>
        <Users className="h-3.5 w-3.5" /> Responsáveis
      </p>
      {valor.length ? (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {valor.map((item) => (
            <li
              key={item.matricula}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#c5d4e6] bg-white py-0.5 pl-0.5 pr-1 text-xs font-medium text-[#10233f]"
            >
              <AvatarResponsavel matricula={item.matricula} nome={item.nome} imediata className="h-5 w-5 text-[9px]" />
              <span className="truncate">{item.nome}</span>
              {podeEditar ? (
                <button
                  type="button"
                  aria-label={`Retirar ${item.nome}`}
                  onClick={() => onSalvar(valor.filter((atual) => atual.matricula !== item.matricula))}
                  className="rounded-full p-0.5 text-[#5c7084] hover:bg-[#fde8e6] hover:text-[#b42318]"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : !podeEditar ? (
        <p className="text-sm text-muted-foreground">Nenhum responsável.</p>
      ) : null}
      {podeEditar ? (
        <div className="relative max-w-sm">
          <input
            ref={inputRef}
            type="text"
            value={busca}
            placeholder="Buscar no orgânico (nome, setor; % refina)"
            onChange={(evento) => {
              setBusca(evento.target.value);
              setDestaque(0);
              setAberto(true);
            }}
            onFocus={() => setAberto(true)}
            onBlur={() => window.setTimeout(() => setAberto(false), 150)}
            onKeyDown={(evento) => {
              if (evento.key === 'ArrowDown') {
                evento.preventDefault();
                setDestaque((atual) => Math.min(atual + 1, Math.max(opcoes.length - 1, 0)));
              } else if (evento.key === 'ArrowUp') {
                evento.preventDefault();
                setDestaque((atual) => Math.max(atual - 1, 0));
              } else if (evento.key === 'Enter') {
                evento.preventDefault();
                escolher(destaque);
              } else if (evento.key === 'Escape' && aberto) {
                evento.stopPropagation();
                setAberto(false);
              }
            }}
            className="w-full rounded-lg border border-[#c5d4e6] bg-white px-2 py-1.5 text-sm text-[#10233f] outline-none focus:border-[#FFAD00]"
          />
          {aberto ? (
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[#c5d4e6] bg-white py-1 shadow-lg">
              {colaboradores.isLoading ? (
                <li className="px-3 py-2 text-sm text-[#5c7084]">Carregando colaboradores…</li>
              ) : colaboradores.isError ? (
                <li className="px-3 py-2 text-sm text-[#b42318]">Não foi possível carregar o orgânico.</li>
              ) : !opcoes.length ? (
                <li className="px-3 py-2 text-sm text-[#5c7084]">Nenhum colaborador encontrado.</li>
              ) : (
                opcoes.map((item, indice) => (
                  <li key={item.matricula}>
                    <button
                      type="button"
                      onMouseDown={(evento) => evento.preventDefault()}
                      onMouseEnter={() => setDestaque(indice)}
                      onClick={() => escolher(indice)}
                      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${indice === destaque ? 'bg-[#e7eef8]' : ''}`}
                    >
                      <AvatarResponsavel matricula={item.matricula} nome={item.nome} imediata className="h-6 w-6 text-[10px]" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-[#10233f]">{item.nome}</span>
                        <span className="block truncate text-[11px] text-[#5c7084]">
                          {[item.setor, item.cargo].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
