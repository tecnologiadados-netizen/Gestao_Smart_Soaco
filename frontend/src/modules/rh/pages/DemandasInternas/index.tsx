import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Check, ImageIcon, ListChecks, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { resolveUploadUrl } from '@/api/client';
import AppLayout from '@rh/components/AppLayout';
import { canDemandaAba } from '@rh/lib/route-permissions';
import { rhPath } from '@rh/lib/rh-paths';
import {
  anexarPrint,
  atualizarCard,
  criarCard,
  criarLista,
  criarQuadro,
  excluirAnexo,
  excluirCard,
  excluirLista,
  excluirQuadro,
  corDoPostIt,
  getDemandas,
  inserirAntes,
  moverCard,
  moverLista,
  prazoAtrasado,
  progressoChecklist,
  renomearLista,
  renomearQuadro,
  rotuloPrazo,
  type DemandaCard,
  type DemandaLista,
  type DemandaQuadro,
  type DemandasArvore,
} from '@rh/lib/demandas-internas';
import CardModal from '@rh/pages/DemandasInternas/CardModal';
import ExcluirQuadroDialog from '@rh/pages/DemandasInternas/ExcluirQuadroDialog';
import SeletorCorCard from '@rh/pages/DemandasInternas/SeletorCorCard';

const CHAVE = ['rh-demandas-internas'] as const;

function semAcento(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function ehListaConcluida(nome: string) {
  return semAcento(nome).includes('conclu');
}

function aplicarConclusao(arvore: DemandasArvore, card: DemandaCard, marcar: boolean): DemandasArvore {
  const comFlag: DemandasArvore = {
    quadros: arvore.quadros.map((quadro) => ({
      ...quadro,
      listas: quadro.listas.map((lista) => ({
        ...lista,
        cards: lista.cards.map((item) => (item.id === card.id ? { ...item, concluido: marcar } : item)),
      })),
    })),
  };
  if (!marcar) return comFlag;
  const quadro = comFlag.quadros.find((item) => item.listas.some((lista) => lista.cards.some((itemCard) => itemCard.id === card.id)));
  const destino = quadro?.listas.find((lista) => ehListaConcluida(lista.nome));
  if (!destino || destino.cards.some((item) => item.id === card.id)) return comFlag;
  return aplicarMoverCard(comFlag, card.id, destino.id, null);
}

function faixaDaLista(nome: string, indice: number) {
  const chave = semAcento(nome);
  if (chave.includes('fazer') || chave.includes('pendente')) return '#FFAD00';
  if (chave.includes('andamento') || chave.includes('fazendo')) return '#38bdf8';
  if (chave.includes('conclu')) return '#34d399';
  return ['#FFAD00', '#38bdf8', '#34d399', '#c084fc'][indice % 4];
}

type Arraste = { tipo: 'card' | 'lista'; id: string } | null;
let arrasteAtual: Arraste = null;

function clonar(arvore: DemandasArvore): DemandasArvore {
  return {
    quadros: arvore.quadros.map((quadro) => ({
      ...quadro,
      listas: quadro.listas.map((lista) => ({
        ...lista,
        cards: lista.cards.map((card) => ({ ...card })),
      })),
    })),
  };
}

function aplicarMoverCard(arvore: DemandasArvore, cardId: string, listaId: string, antesDeId: string | null): DemandasArvore {
  const proxima = clonar(arvore);
  let card: DemandaCard | undefined;
  for (const quadro of proxima.quadros) {
    for (const lista of quadro.listas) {
      const indice = lista.cards.findIndex((item) => item.id === cardId);
      if (indice >= 0) {
        card = lista.cards[indice];
        lista.cards.splice(indice, 1);
      }
    }
  }
  if (!card) return arvore;
  const destino = proxima.quadros.flatMap((quadro) => quadro.listas).find((lista) => lista.id === listaId);
  if (!destino) return arvore;
  const movido = { ...card, listaId: destino.id, quadroId: destino.quadroId };
  const ids = inserirAntes(
    destino.cards.map((item) => item.id),
    movido.id,
    antesDeId,
  );
  const porId = new Map(destino.cards.map((item) => [item.id, item]));
  porId.set(movido.id, movido);
  destino.cards = ids.flatMap((id) => {
    const item = porId.get(id);
    return item ? [item] : [];
  });
  return proxima;
}

function mesmaOrdem(atual: string[], proxima: string[]): boolean {
  return atual.length === proxima.length && atual.every((id, indice) => id === proxima[indice]);
}

export default function DemandasInternas() {
  const { quadroId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const quadroCriar = canDemandaAba('quadros', 'create');
  const quadroEditar = canDemandaAba('quadros', 'edit');
  const quadroExcluir = canDemandaAba('quadros', 'delete');
  const listaCriar = canDemandaAba('listas', 'create');
  const listaEditar = canDemandaAba('listas', 'edit');
  const listaExcluir = canDemandaAba('listas', 'delete');
  const cardCriar = canDemandaAba('cards', 'create');
  const cardEditar = canDemandaAba('cards', 'edit');
  const cardExcluir = canDemandaAba('cards', 'delete');
  const filaRef = useRef(Promise.resolve());
  const [cardAbertoId, setCardAbertoId] = useState<string | null>(null);
  const [quadroParaExcluir, setQuadroParaExcluir] = useState<DemandaQuadro | null>(null);
  const [listaParaExcluir, setListaParaExcluir] = useState<DemandaLista | null>(null);
  const consulta = useQuery({ queryKey: CHAVE, queryFn: getDemandas });

  useEffect(() => {
    if (!listaParaExcluir) return;
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') setListaParaExcluir(null);
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [listaParaExcluir]);

  const gravar = useCallback(
    (tarefa: () => Promise<DemandasArvore>) => {
      const pedido = filaRef.current.then(tarefa, tarefa);
      filaRef.current = pedido.then(
        () => undefined,
        () => undefined,
      );
      return pedido
        .then((arvore) => {
          queryClient.setQueryData(CHAVE, arvore);
          return arvore;
        })
        .catch((err: unknown) => {
          toast.error(err instanceof Error ? err.message : 'Não foi possível salvar.');
          void queryClient.invalidateQueries({ queryKey: CHAVE });
          return null;
        });
    },
    [queryClient],
  );

  const quadros = consulta.data?.quadros ?? [];
  const quadro = quadros.find((item) => item.id === quadroId) ?? null;
  const cardAberto = quadros.flatMap((item) => item.listas.flatMap((lista) => lista.cards)).find((card) => card.id === cardAbertoId) ?? null;

  function soltarCard(cardId: string, listaId: string, antesDeId: string | null) {
    const atual = queryClient.getQueryData<DemandasArvore>(CHAVE);
    if (!atual) return;
    const lista = atual.quadros.flatMap((item) => item.listas).find((item) => item.id === listaId);
    if (lista && mesmaOrdem(lista.cards.map((card) => card.id), inserirAntes(lista.cards.map((card) => card.id), cardId, antesDeId))) {
      return;
    }
    if (atual) queryClient.setQueryData(CHAVE, aplicarMoverCard(atual, cardId, listaId, antesDeId));
    void gravar(() => moverCard(cardId, listaId, antesDeId));
  }

  function soltarLista(listaId: string, antesDeId: string | null, quadroAtual: DemandaQuadro) {
    const ids = quadroAtual.listas.map((lista) => lista.id);
    if (mesmaOrdem(ids, inserirAntes(ids, listaId, antesDeId))) return;
    void gravar(() => moverLista(listaId, antesDeId));
  }

  function alternarConclusao(card: DemandaCard) {
    const marcar = !card.concluido;
    const atual = queryClient.getQueryData<DemandasArvore>(CHAVE);
    if (atual) queryClient.setQueryData(CHAVE, aplicarConclusao(atual, card, marcar));
    const quadroDoCard = atual?.quadros.find((item) => item.listas.some((lista) => lista.cards.some((itemCard) => itemCard.id === card.id)));
    const destino = quadroDoCard?.listas.find((lista) => ehListaConcluida(lista.nome));
    const jaEstaLa = quadroDoCard?.listas.some((lista) => ehListaConcluida(lista.nome) && lista.cards.some((item) => item.id === card.id));
    if (marcar && destino && !jaEstaLa) {
      void gravar(async () => {
        await atualizarCard(card.id, { concluido: true });
        return moverCard(card.id, destino.id, null);
      });
      return;
    }
    void gravar(() => atualizarCard(card.id, { concluido: marcar }));
  }

  return (
    <AppLayout>
      {consulta.isLoading ? (
        <p className="p-6 text-sm text-muted-foreground">Carregando quadros…</p>
      ) : consulta.isError ? (
        <div className="p-6">
          <p className="text-sm text-destructive">Não foi possível carregar as demandas.</p>
          <button type="button" className="mt-3 text-sm underline" onClick={() => void consulta.refetch()}>
            Tentar de novo
          </button>
        </div>
      ) : quadroId && !quadro ? (
        <div className="p-6">
          <p className="text-sm text-muted-foreground">Quadro não encontrado.</p>
          <button type="button" className="mt-3 text-sm underline" onClick={() => navigate(rhPath('/demandas-internas'))}>
            Voltar aos quadros
          </button>
        </div>
      ) : quadro ? (
        <QuadroBoard
          quadro={quadro}
          quadroEditar={quadroEditar}
          quadroExcluir={quadroExcluir}
          listaCriar={listaCriar}
          listaEditar={listaEditar}
          listaExcluir={listaExcluir}
          cardCriar={cardCriar}
          cardEditar={cardEditar}
          onVoltar={() => navigate(rhPath('/demandas-internas'))}
          onRenomear={(nome) => void gravar(() => renomearQuadro(quadro.id, nome))}
          onExcluir={() => setQuadroParaExcluir(quadro)}
          onCriarLista={async (nome) => {
            const arvore = await gravar(() => criarLista(quadro.id, nome));
            if (!arvore) throw new Error('falha');
          }}
          onRenomearLista={(id, nome) => void gravar(() => renomearLista(id, nome))}
          onExcluirLista={setListaParaExcluir}
          onCriarCard={async (listaId, titulo, cor) => {
            const arvore = await gravar(() => criarCard(listaId, titulo, cor));
            if (!arvore) throw new Error('falha');
          }}
          onConcluir={alternarConclusao}
          onAbrirCard={setCardAbertoId}
          onSoltarCard={soltarCard}
          onSoltarLista={(listaId, antesDeId) => soltarLista(listaId, antesDeId, quadro)}
        />
      ) : (
        <GradeQuadros
          quadros={quadros}
          podeCriar={quadroCriar}
          onAbrir={(id) => navigate(rhPath(`/demandas-internas/${id}`))}
          onCriar={async (nome) => {
            const antes = new Set((queryClient.getQueryData<DemandasArvore>(CHAVE)?.quadros ?? []).map((item) => item.id));
            const arvore = await gravar(() => criarQuadro(nome));
            if (!arvore) throw new Error('falha');
            const novo = arvore.quadros.find((item) => !antes.has(item.id));
            if (novo) navigate(rhPath(`/demandas-internas/${novo.id}`));
          }}
        />
      )}

      {listaParaExcluir ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="presentation">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="excluir-lista-titulo"
            className="rh-demanda-modal w-full max-w-md rounded-xl border border-[#c5d4e6] p-5 shadow-2xl"
          >
            <h2 id="excluir-lista-titulo" className="text-lg font-semibold text-[#10233f]">
              Excluir lista
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#3d5168] [overflow-wrap:anywhere]">
              A lista <span className="font-semibold text-[#10233f]">“{listaParaExcluir.nome}”</span> será apagada, junto com os cards dela. Essa ação não pode ser desfeita.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setListaParaExcluir(null)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-[#10233f] hover:bg-[#e7eef8]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const lista = listaParaExcluir;
                  setListaParaExcluir(null);
                  void gravar(() => excluirLista(lista.id));
                }}
                className="rounded-lg bg-[#b42318] px-3 py-2 text-sm font-semibold text-white hover:bg-[#912018]"
              >
                Excluir lista
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {quadroParaExcluir ? (
        <ExcluirQuadroDialog
          nome={quadroParaExcluir.nome}
          onCancelar={() => setQuadroParaExcluir(null)}
          onConfirmar={async (senha) => {
            try {
              const arvore = await excluirQuadro(quadroParaExcluir.id, senha);
              queryClient.setQueryData(CHAVE, arvore);
              setQuadroParaExcluir(null);
              navigate(rhPath('/demandas-internas'));
              return null;
            } catch (err) {
              return err instanceof Error ? err.message : 'Não foi possível excluir o quadro.';
            }
          }}
        />
      ) : null}

      {cardAberto ? (
        <CardModal
          card={cardAberto}
          quadros={quadros}
          podeEditar={cardEditar}
          podeExcluir={cardExcluir}
          onClose={() => setCardAbertoId(null)}
          onSalvar={async (patch) => {
            await gravar(() => atualizarCard(cardAberto.id, patch));
          }}
          onConcluir={() => {
            if (cardAberto) alternarConclusao(cardAberto);
          }}
          onExcluir={async () => {
            setCardAbertoId(null);
            await gravar(() => excluirCard(cardAberto.id));
          }}
          onAnexar={(arquivo) => gravar(() => anexarPrint(cardAberto.id, arquivo)).then(() => undefined)}
          onRemoverAnexo={(id) => gravar(() => excluirAnexo(id)).then(() => undefined)}
        />
      ) : null}
    </AppLayout>
  );
}

function GradeQuadros({
  quadros,
  podeCriar,
  onAbrir,
  onCriar,
}: {
  quadros: DemandaQuadro[];
  podeCriar: boolean;
  onAbrir: (id: string) => void;
  onCriar: (nome: string) => Promise<void>;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <h1 className="text-2xl font-semibold text-foreground">Demandas Internas</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Acompanhamento das demandas entre o RH e a diretoria. Cada quadro organiza os cards por situação.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quadros.map((quadro) => {
          const total = quadro.listas.reduce((soma, lista) => soma + lista.cards.length, 0);
          return (
            <button
              key={quadro.id}
              type="button"
              onClick={() => onAbrir(quadro.id)}
              className="flex h-28 flex-col items-start justify-between rounded-lg border border-border border-l-4 border-l-[#FFAD00] bg-card p-3 text-left text-foreground shadow-sm hover:bg-muted"
            >
              <span className="text-base font-semibold leading-snug">{quadro.nome}</span>
              <span className="text-xs text-muted-foreground">
                {total} {total === 1 ? 'card' : 'cards'}
              </span>
            </button>
          );
        })}
        {podeCriar ? <Composer rotulo="Criar quadro" placeholder="Nome do quadro" destaque onCriar={onCriar} /> : null}
      </div>
      {!quadros.length && !podeCriar ? (
        <p className="mt-6 text-sm text-muted-foreground">Nenhum quadro cadastrado.</p>
      ) : null}
    </div>
  );
}

function QuadroBoard({
  quadro,
  quadroEditar,
  quadroExcluir,
  listaCriar,
  listaEditar,
  listaExcluir,
  cardCriar,
  cardEditar,
  onVoltar,
  onRenomear,
  onExcluir,
  onCriarLista,
  onRenomearLista,
  onExcluirLista,
  onCriarCard,
  onConcluir,
  onAbrirCard,
  onSoltarCard,
  onSoltarLista,
}: {
  quadro: DemandaQuadro;
  quadroEditar: boolean;
  quadroExcluir: boolean;
  listaCriar: boolean;
  listaEditar: boolean;
  listaExcluir: boolean;
  cardCriar: boolean;
  cardEditar: boolean;
  onVoltar: () => void;
  onRenomear: (nome: string) => void;
  onExcluir: () => void;
  onCriarLista: (nome: string) => Promise<unknown>;
  onRenomearLista: (id: string, nome: string) => void;
  onExcluirLista: (lista: DemandaLista) => void;
  onCriarCard: (listaId: string, titulo: string, cor: string) => Promise<unknown>;
  onConcluir: (card: DemandaCard) => void;
  onAbrirCard: (id: string) => void;
  onSoltarCard: (cardId: string, listaId: string, antesDeId: string | null) => void;
  onSoltarLista: (listaId: string, antesDeId: string | null) => void;
}) {
  const [sobre, setSobre] = useState<{ tipo: 'card' | 'lista'; id: string } | null>(null);

  function marcar(proximo: { tipo: 'card' | 'lista'; id: string }) {
    setSobre((atual) => (atual?.tipo === proximo.tipo && atual.id === proximo.id ? atual : proximo));
  }

  function limparArraste() {
    arrasteAtual = null;
    setSobre(null);
  }

  return (
    <div className="rh-demanda-quadro flex h-[calc(100dvh-7.5rem)] min-h-[32rem] flex-col overflow-hidden rounded-xl border border-[#082444] bg-[linear-gradient(165deg,#0a2f5c_0%,#1560a8_48%,#0d3a6e_100%)] text-white shadow-lg">
      <header className="flex items-center gap-2 border-b border-white/15 bg-[#08284f] px-3 py-2">
        <button type="button" onClick={onVoltar} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-white/80 hover:bg-white/10 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Quadros
        </button>
        <NomeEditavel
          valor={quadro.nome}
          podeEditar={quadroEditar}
          onSalvar={onRenomear}
          className="rh-demanda-campo w-auto min-w-[8rem] max-w-sm rounded-md px-2 py-1 text-lg font-semibold text-white outline-none"
        />
        {quadroExcluir ? (
          <button type="button" onClick={onExcluir} className="ml-auto rounded-md p-2 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Excluir quadro">
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </header>
      <div className="flex min-h-0 flex-1 items-start gap-3 overflow-x-auto px-3 py-3">
        {quadro.listas.map((lista, indice) => (
          <section
            key={lista.id}
            style={{ borderTopColor: faixaDaLista(lista.nome, indice) }}
            className={`flex max-h-full w-72 min-w-0 shrink-0 flex-col overflow-hidden rounded-xl border-t-4 bg-[#eef3f9] text-[#10233f] shadow-md ${
              sobre?.tipo === 'lista' && sobre.id === lista.id ? 'ring-2 ring-[#FFAD00]' : ''
            }`}
            onDragOver={(evento) => {
              if (!arrasteAtual) return;
              if (arrasteAtual.tipo === 'card' && !cardEditar) return;
              if (arrasteAtual.tipo === 'lista' && !listaEditar) return;
              evento.preventDefault();
              marcar({ tipo: 'lista', id: lista.id });
            }}
            onDrop={(evento) => {
              evento.preventDefault();
              const atual = arrasteAtual;
              limparArraste();
              if (!atual) return;
              if (atual.tipo === 'card') {
                if (cardEditar) onSoltarCard(atual.id, lista.id, null);
              } else if (listaEditar && atual.id !== lista.id) onSoltarLista(atual.id, lista.id);
            }}
          >
            <header
              draggable={listaEditar}
              onDragStart={(evento) => {
                if ((evento.target as HTMLElement).closest('[data-no-drag]')) {
                  evento.preventDefault();
                  return;
                }
                arrasteAtual = { tipo: 'lista', id: lista.id };
                evento.dataTransfer.effectAllowed = 'move';
                evento.dataTransfer.setData('text/plain', lista.id);
              }}
              onDragEnd={limparArraste}
              onDrop={(evento) => {
                evento.preventDefault();
                evento.stopPropagation();
                const atual = arrasteAtual;
                limparArraste();
                if (!atual) return;
                if (atual.tipo === 'card') {
                  if (cardEditar) onSoltarCard(atual.id, lista.id, lista.cards[0]?.id ?? null);
                } else if (listaEditar && atual.id !== lista.id) onSoltarLista(atual.id, lista.id);
              }}
              className="flex cursor-grab items-center gap-1 px-2 pt-2 active:cursor-grabbing"
            >
              <NomeEditavel
                valor={lista.nome}
                podeEditar={listaEditar}
                onSalvar={(nome) => onRenomearLista(lista.id, nome)}
                className="rh-demanda-campo min-w-0 flex-1 rounded-md px-2 py-1 text-sm font-semibold text-[#10233f] outline-none"
              />
              {listaExcluir ? (
                <button
                  type="button"
                  data-no-drag
                  aria-label="Excluir lista"
                  onClick={() => onExcluirLista(lista)}
                  className="rounded-md p-1 text-[#3d5168] hover:bg-[#d5e0ee] hover:text-[#10233f]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </header>
            <div className="min-h-2 flex-1 space-y-2 overflow-y-auto px-2 py-2">
              {lista.cards.map((card) => (
                <CardFace
                  key={card.id}
                  card={card}
                  podeEditar={cardEditar}
                  destacado={sobre?.tipo === 'card' && sobre.id === card.id}
                  onAbrir={() => onAbrirCard(card.id)}
                  onConcluir={() => onConcluir(card)}
                  onDragOver={(evento) => {
                    if (!arrasteAtual) return;
                    if (arrasteAtual.tipo === 'card' && !cardEditar) return;
                    if (arrasteAtual.tipo === 'lista' && !listaEditar) return;
                    evento.preventDefault();
                    evento.stopPropagation();
                    marcar({ tipo: arrasteAtual.tipo === 'lista' ? 'lista' : 'card', id: arrasteAtual.tipo === 'lista' ? lista.id : card.id });
                  }}
                  onDrop={(evento) => {
                    evento.preventDefault();
                    evento.stopPropagation();
                    const atual = arrasteAtual;
                    limparArraste();
                    if (!atual) return;
                    if (atual.tipo === 'card') {
                      if (cardEditar && atual.id !== card.id) onSoltarCard(atual.id, lista.id, card.id);
                      return;
                    }
                    if (listaEditar && atual.id !== lista.id) onSoltarLista(atual.id, lista.id);
                  }}
                  onArrasteFim={limparArraste}
                />
              ))}
            </div>
            {cardCriar ? (
              <div className="px-2 pb-2">
                <Composer tom="claro" escolherCor rotulo="Adicionar um card" placeholder="Título do card" onCriar={(titulo, cor) => onCriarCard(lista.id, titulo, cor ?? 'branco')} />
              </div>
            ) : null}
          </section>
        ))}
        {listaCriar || listaEditar ? (
          <div
            className="w-72 shrink-0"
            onDragOver={(evento) => {
              if (!listaEditar || arrasteAtual?.tipo !== 'lista') return;
              evento.preventDefault();
            }}
            onDrop={(evento) => {
              evento.preventDefault();
              const atual = arrasteAtual;
              limparArraste();
              if (listaEditar && atual?.tipo === 'lista') onSoltarLista(atual.id, null);
            }}
          >
            {listaCriar ? (
              <Composer tom="escuro" rotulo="Adicionar outra lista" placeholder="Nome da lista" destaque onCriar={onCriarLista} />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CardFace({
  card,
  podeEditar,
  destacado,
  onAbrir,
  onConcluir,
  onDragOver,
  onDrop,
  onArrasteFim,
}: {
  card: DemandaCard;
  podeEditar: boolean;
  destacado: boolean;
  onAbrir: () => void;
  onConcluir: () => void;
  onDragOver: (evento: DragEvent) => void;
  onDrop: (evento: DragEvent) => void;
  onArrasteFim: () => void;
}) {
  const arrastou = useRef(false);
  const progresso = progressoChecklist(card);
  const capa = card.anexos[0];
  const tom = corDoPostIt(card.cor);
  const claro = tom.texto.toLowerCase() !== '#ffffff';
  const atrasado = prazoAtrasado(card.prazo, card.concluido);
  return (
    <article
      draggable={podeEditar}
      style={{ backgroundColor: tom.fundo, color: tom.texto, boxShadow: '0 8px 14px rgba(4, 30, 66, 0.16)' }}
      onDragStart={(evento) => {
        if ((evento.target as HTMLElement).closest('[data-no-drag]')) {
          evento.preventDefault();
          return;
        }
        arrasteAtual = { tipo: 'card', id: card.id };
        arrastou.current = true;
        evento.dataTransfer.effectAllowed = 'move';
        evento.dataTransfer.setData('text/plain', card.id);
      }}
      onDragEnd={() => {
        onArrasteFim();
        window.setTimeout(() => {
          arrastou.current = false;
        }, 0);
      }}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={() => {
        if (arrastou.current) return;
        onAbrir();
      }}
      className={`relative w-full min-w-0 cursor-pointer overflow-hidden rounded-md border px-3 py-3 pr-5 transition hover:-translate-y-0.5 ${
        claro ? 'border-[#d5e0ee]' : 'border-transparent'
      } ${destacado ? 'ring-2 ring-[#FFAD00]' : ''} ${podeEditar ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 h-4 w-4"
        style={{ background: `linear-gradient(135deg, transparent 50%, ${tom.dobra} 50%)` }}
      />
      {capa ? (
        <img src={resolveUploadUrl(capa.storagePath)} alt="" draggable={false} className="mb-2 max-h-32 w-full rounded-md object-cover" />
      ) : null}
      <div className="flex w-full min-w-0 items-start gap-2">
        <button
          type="button"
          data-no-drag
          disabled={!podeEditar}
          aria-label={card.concluido ? 'Desmarcar card' : 'Concluir card'}
          onClick={(evento) => {
            evento.stopPropagation();
            onConcluir();
          }}
          className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 bg-white/80"
          style={
            card.concluido
              ? { borderColor: tom.texto, backgroundColor: tom.texto, color: tom.fundo }
              : { borderColor: tom.texto, color: tom.texto }
          }
        >
          {card.concluido ? <Check className="h-3 w-3" /> : null}
        </button>
        <button
          type="button"
          className={`min-w-0 flex-1 whitespace-normal bg-transparent text-left text-sm font-semibold leading-5 [overflow-wrap:anywhere] ${card.concluido ? 'line-through opacity-70' : ''}`}
          style={{ color: tom.texto }}
          onClick={(evento) => {
            evento.stopPropagation();
            onAbrir();
          }}
        >
          {card.titulo}
        </button>
      </div>
      {progresso || card.anexos.length || card.prazo ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 pl-6 text-xs">
          {card.prazo ? (
            <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-semibold ${atrasado ? 'bg-[#b42318] text-white' : 'bg-black/15'}`}>
              <Calendar className="h-3.5 w-3.5" /> {rotuloPrazo(card.prazo)}
            </span>
          ) : null}
          {progresso ? (
            <span
              className={`inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium ${
                progresso.feitos === progresso.total ? 'bg-black/20' : 'opacity-80'
              }`}
            >
              <ListChecks className="h-3.5 w-3.5" /> {progresso.feitos}/{progresso.total}
            </span>
          ) : null}
          {card.anexos.length ? (
            <span className="inline-flex items-center gap-1 opacity-80">
              <ImageIcon className="h-3.5 w-3.5" /> {card.anexos.length}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function NomeEditavel({
  valor,
  podeEditar,
  onSalvar,
  className,
}: {
  valor: string;
  podeEditar: boolean;
  onSalvar: (nome: string) => void;
  className: string;
}) {
  const [texto, setTexto] = useState(valor);
  useEffect(() => setTexto(valor), [valor]);
  return (
    <input
      data-no-drag
      value={texto}
      readOnly={!podeEditar}
      onChange={(evento) => setTexto(evento.target.value)}
      onBlur={() => {
        const nome = texto.trim();
        if (!nome || nome === valor) {
          setTexto(valor);
          return;
        }
        onSalvar(nome);
      }}
      onKeyDown={(evento) => {
        if (evento.key === 'Enter') evento.currentTarget.blur();
      }}
      className={className}
    />
  );
}

function Composer({
  rotulo,
  placeholder,
  destaque = false,
  tom = 'pagina',
  escolherCor = false,
  onCriar,
}: {
  rotulo: string;
  placeholder: string;
  destaque?: boolean;
  tom?: 'pagina' | 'claro' | 'escuro';
  escolherCor?: boolean;
  onCriar: (texto: string, cor?: string) => Promise<unknown>;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [cor, setCor] = useState('branco');
  const [enviando, setEnviando] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (aberto) ref.current?.focus();
  }, [aberto]);

  function fechar() {
    setAberto(false);
    setTexto('');
    setCor('branco');
  }

  async function enviar() {
    const titulo = texto.trim();
    if (!titulo || enviando) return;
    setEnviando(true);
    try {
      await onCriar(titulo, escolherCor ? cor : undefined);
      fechar();
    } finally {
      setEnviando(false);
    }
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={
          tom === 'escuro'
            ? 'flex h-28 w-full items-start gap-2 rounded-xl border border-dashed border-[#FFAD00] bg-white/10 p-3 text-left text-sm font-medium text-white hover:bg-white/20'
            : tom === 'claro'
              ? 'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium text-[#1a4a86] hover:bg-[#d9e4f2]'
              : destaque
                ? 'flex h-28 w-full items-start gap-2 rounded-lg border border-dashed border-[#FFAD00] bg-card p-3 text-left text-sm font-medium text-foreground hover:bg-muted'
                : 'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-muted-foreground hover:bg-muted'
        }
      >
        <Plus className="h-4 w-4 shrink-0" /> {rotulo}
      </button>
    );
  }

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        void enviar();
      }}
      className={tom === 'escuro' ? 'rounded-xl border border-white/20 bg-white/10 p-3' : tom === 'claro' ? '' : destaque ? 'rounded-lg border border-border bg-card p-3' : ''}
    >
      {escolherCor ? (
        <div className="mb-2">
          <SeletorCorCard valor={cor} onEscolher={setCor} />
        </div>
      ) : null}
      <textarea
        ref={ref}
        value={texto}
        rows={destaque ? 2 : 3}
        placeholder={placeholder}
        onChange={(evento) => setTexto(evento.target.value)}
        onKeyDown={(evento) => {
          if (evento.key === 'Enter' && !evento.shiftKey) {
            evento.preventDefault();
            void enviar();
          }
          if (evento.key === 'Escape') fechar();
        }}
        className={`w-full resize-none rounded-lg border px-2 py-2 text-sm outline-none ${
          tom === 'claro' || tom === 'escuro'
            ? 'border-[#c5d4e6] bg-white text-[#10233f]'
            : 'border-border bg-background text-foreground'
        }`}
      />
      <div className="mt-2 flex items-center gap-2">
        <button type="submit" disabled={enviando} className="rounded-md bg-[#FFAD00] px-3 py-1.5 text-sm font-semibold text-[#041E42] disabled:opacity-50">
          Adicionar
        </button>
        <button
          type="button"
          aria-label="Cancelar"
          onClick={fechar}
          className={`rounded p-1 ${tom === 'escuro' ? 'text-white hover:bg-white/10' : tom === 'claro' ? 'text-[#3d5168] hover:bg-[#d9e4f2]' : 'text-muted-foreground hover:bg-muted'}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
