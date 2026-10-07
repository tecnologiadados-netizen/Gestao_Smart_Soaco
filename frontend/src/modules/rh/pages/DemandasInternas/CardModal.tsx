import { useEffect, useRef, useState } from 'react';
import { AlignLeft, Calendar, Check, ImagePlus, ListChecks, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { resolveUploadUrl } from '@/api/client';
import { prazoAtrasado, rotuloPrazo, type DemandaCard, type DemandaChecklist, type DemandaQuadro } from '@rh/lib/demandas-internas';
import SeletorCorCard from '@rh/pages/DemandasInternas/SeletorCorCard';

type CardModalProps = {
  card: DemandaCard;
  quadros: DemandaQuadro[];
  podeEditar: boolean;
  podeExcluir: boolean;
  onClose: () => void;
  onConcluir: () => void;
  onSalvar: (patch: {
    titulo?: string;
    observacao?: string;
    concluido?: boolean;
    checklists?: DemandaChecklist[];
    cor?: string;
    prazo?: string | null;
  }) => Promise<void>;
  onExcluir: () => Promise<void>;
  onAnexar: (arquivo: File) => Promise<void>;
  onRemoverAnexo: (id: string) => Promise<void>;
};

export default function CardModal({
  card,
  quadros,
  podeEditar,
  podeExcluir,
  onClose,
  onConcluir,
  onSalvar,
  onExcluir,
  onAnexar,
  onRemoverAnexo,
}: CardModalProps) {
  const [titulo, setTitulo] = useState(card.titulo);
  const [observacao, setObservacao] = useState(card.observacao);
  const [printAberto, setPrintAberto] = useState<string | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [enviandoPrint, setEnviandoPrint] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const checklistsRef = useRef(card.checklists);

  useEffect(() => {
    setTitulo(card.titulo);
    setObservacao(card.observacao);
  }, [card.id, card.titulo, card.observacao]);

  useEffect(() => {
    checklistsRef.current = card.checklists;
  }, [card.checklists]);

  const fecharRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== 'Escape') return;
      if (printAberto) setPrintAberto(null);
      else if (confirmarExclusao) setConfirmarExclusao(false);
      else fecharRef.current();
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [printAberto, confirmarExclusao]);

  const quadro = quadros.find((item) => item.id === card.quadroId);
  const lista = quadro?.listas.find((item) => item.id === card.listaId);

  function fechar() {
    const patch: { titulo?: string; observacao?: string } = {};
    const tituloLimpo = titulo.trim();
    if (tituloLimpo && tituloLimpo !== card.titulo) patch.titulo = tituloLimpo;
    if (observacao !== card.observacao) patch.observacao = observacao;
    if (Object.keys(patch).length) void onSalvar(patch);
    onClose();
  }
  fecharRef.current = fechar;

  function salvarListas(checklists: DemandaChecklist[]) {
    checklistsRef.current = checklists;
    return onSalvar({ checklists });
  }

  async function receberArquivos(arquivos: File[]) {
    const validos = arquivos.filter((arquivo) => arquivo.type.startsWith('image/'));
    if (!validos.length) {
      toast.error('Envie um print em PNG, JPG, WEBP ou GIF.');
      return;
    }
    if (validos.some((arquivo) => arquivo.size > 15 * 1024 * 1024)) {
      toast.error('O print passa de 15 MB.');
      return;
    }
    setEnviandoPrint(true);
    try {
      for (const arquivo of validos) await onAnexar(arquivo);
    } finally {
      setEnviandoPrint(false);
      if (arquivoRef.current) arquivoRef.current.value = '';
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-8 sm:pt-14"
      onMouseDown={fechar}
      onPaste={(evento) => {
        if (!podeEditar) return;
        const arquivos = Array.from(evento.clipboardData.files);
        if (!arquivos.length) return;
        evento.preventDefault();
        void receberArquivos(arquivos);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={card.titulo}
        className="rh-demanda-modal mb-10 grid w-full max-w-3xl gap-4 rounded-xl border border-[#c5d4e6] p-4 shadow-2xl sm:grid-cols-[minmax(0,1fr)_220px] sm:p-6"
        onMouseDown={(evento) => evento.stopPropagation()}
      >
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <button
              type="button"
              aria-label={card.concluido ? 'Desmarcar card' : 'Concluir card'}
              disabled={!podeEditar}
              onClick={() => onConcluir()}
              className={`mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                card.concluido ? 'border-[#1f845a] bg-[#1f845a] text-white' : 'border-muted-foreground/50 bg-card'
              }`}
            >
              {card.concluido ? <Check className="h-3.5 w-3.5" /> : null}
            </button>
            <div className="min-w-0 flex-1">
              <textarea
                value={titulo}
                readOnly={!podeEditar}
                rows={2}
                onChange={(evento) => setTitulo(evento.target.value)}
                onBlur={() => {
                  const tituloLimpo = titulo.trim();
                  if (tituloLimpo && tituloLimpo !== card.titulo) void onSalvar({ titulo: tituloLimpo });
                  else setTitulo(card.titulo);
                }}
                className={`rh-demanda-campo w-full resize-none whitespace-pre-wrap bg-transparent text-xl font-semibold leading-snug text-foreground outline-none [overflow-wrap:anywhere] ${
                  card.concluido ? 'text-muted-foreground line-through' : ''
                }`}
              />
              <p className="text-sm text-muted-foreground">
                na lista {lista?.nome ?? '—'}
                {quadro ? ` · ${quadro.nome}` : ''}
              </p>
              {podeEditar ? (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cor do post-it</p>
                  <SeletorCorCard valor={card.cor || 'branco'} onEscolher={(cor) => void onSalvar({ cor })} />
                </div>
              ) : null}
              <div className="mt-3">
                <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" /> Prazo
                </p>
                {podeEditar ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      value={card.prazo ?? ''}
                      onChange={(evento) => void onSalvar({ prazo: evento.target.value || null })}
                      className="rounded-lg border border-[#c5d4e6] bg-white px-2 py-1.5 text-sm text-[#10233f] outline-none focus:border-[#FFAD00]"
                    />
                    {card.prazo ? (
                      <button
                        type="button"
                        onClick={() => void onSalvar({ prazo: null })}
                        className="rounded-md px-2 py-1 text-xs font-medium text-[#5c7084] hover:bg-[#e7eef8]"
                      >
                        Limpar
                      </button>
                    ) : null}
                    {card.prazo && prazoAtrasado(card.prazo, card.concluido) ? (
                      <span className="text-xs font-semibold text-[#b42318]">Prazo vencido</span>
                    ) : null}
                  </div>
                ) : (
                  <p className={`text-sm ${prazoAtrasado(card.prazo, card.concluido) ? 'font-semibold text-[#b42318]' : ''}`}>
                    {card.prazo ? rotuloPrazo(card.prazo) : 'Sem prazo'}
                  </p>
                )}
              </div>
            </div>
            <button type="button" aria-label="Fechar" onClick={fechar} className="rounded p-1 text-muted-foreground hover:bg-muted">
              <X className="h-5 w-5" />
            </button>
          </div>

          <section className="mt-6">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <AlignLeft className="h-4 w-4" /> Observação
            </h3>
            <textarea
              value={observacao}
              readOnly={!podeEditar}
              rows={4}
              placeholder="Este texto só aparece aqui dentro do card."
              onChange={(evento) => setObservacao(evento.target.value)}
              onBlur={() => {
                if (observacao !== card.observacao) void onSalvar({ observacao });
              }}
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-[#FFAD00]"
            />
          </section>

          {card.checklists.map((checklist) => {
            const feitos = checklist.itens.filter((item) => item.feito).length;
            const total = checklist.itens.length;
            const percentual = total ? Math.round((feitos / total) * 100) : 0;
            function alternarItem(itemId: string) {
              void salvarListas(
                checklistsRef.current.map((listaAtual) =>
                  listaAtual.id !== checklist.id
                    ? listaAtual
                    : {
                        ...listaAtual,
                        itens: listaAtual.itens.map((atual) =>
                          atual.id === itemId ? { ...atual, feito: !atual.feito } : atual,
                        ),
                      },
                ),
              );
            }
            return (
              <section key={checklist.id} className="mt-6 rounded-xl border border-[#d5e0ee] bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center gap-2">
                  <ListChecks className="h-4 w-4 shrink-0 text-[#1a4a86]" />
                  <TituloChecklist
                    titulo={checklist.titulo}
                    podeEditar={podeEditar}
                    onSalvar={(tituloLista) =>
                      void salvarListas(
                        checklistsRef.current.map((item) =>
                          item.id === checklist.id ? { ...item, titulo: tituloLista } : item,
                        ),
                      )
                    }
                  />
                  {total ? (
                    <span className="shrink-0 rounded-full bg-[#e7eef8] px-2 py-0.5 text-xs font-semibold text-[#1a4a86]">
                      {feitos}/{total}
                    </span>
                  ) : null}
                  {podeEditar ? (
                    <button
                      type="button"
                      aria-label="Excluir checklist"
                      onClick={() =>
                        void salvarListas(checklistsRef.current.filter((item) => item.id !== checklist.id))
                      }
                      className="rounded p-1 text-[#5c7084] hover:bg-[#fde8e6] hover:text-[#b42318]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                {total ? (
                  <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[#e7eef8]">
                    <div
                      className={`h-full rounded-full ${percentual === 100 ? 'bg-[#1f845a]' : 'bg-[#FFAD00]'}`}
                      style={{ width: `${percentual}%` }}
                    />
                  </div>
                ) : null}
                <ul className="space-y-2">
                  {checklist.itens.map((item) => (
                    <li
                      key={item.id}
                      className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
                        item.feito ? 'border-[#b7e4c7] bg-[#f3fbf6]' : 'border-[#d5e0ee] bg-[#f7f9fc] hover:border-[#FFAD00]'
                      }`}
                    >
                      <button
                        type="button"
                        disabled={!podeEditar}
                        aria-label={item.feito ? 'Desmarcar item' : 'Concluir item'}
                        onClick={() => alternarItem(item.id)}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                          item.feito ? 'border-[#1f845a] bg-[#1f845a] text-white' : 'border-[#1a4a86] bg-white hover:border-[#FFAD00]'
                        }`}
                      >
                        {item.feito ? <Check className="h-3.5 w-3.5" /> : null}
                      </button>
                      <button
                        type="button"
                        disabled={!podeEditar}
                        onClick={() => alternarItem(item.id)}
                        className={`min-w-0 flex-1 bg-transparent text-left text-sm font-medium ${
                          item.feito ? 'text-[#5c7084] line-through' : 'text-[#10233f]'
                        }`}
                      >
                        {item.texto}
                      </button>
                      {podeEditar ? (
                        <button
                          type="button"
                          aria-label="Remover item"
                          onClick={() =>
                            void salvarListas(
                              checklistsRef.current.map((listaAtual) =>
                                listaAtual.id !== checklist.id
                                  ? listaAtual
                                  : { ...listaAtual, itens: listaAtual.itens.filter((atual) => atual.id !== item.id) },
                              ),
                            )
                          }
                          className="rounded p-1 text-[#8aa0b8] hover:bg-[#fde8e6] hover:text-[#b42318]"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {podeEditar ? (
                  <NovoItem
                    onAdd={(texto) =>
                      void salvarListas(
                        checklistsRef.current.map((listaAtual) =>
                          listaAtual.id !== checklist.id
                            ? listaAtual
                            : {
                                ...listaAtual,
                                itens: [...listaAtual.itens, { id: crypto.randomUUID(), texto, feito: false }],
                              },
                        ),
                      )
                    }
                  />
                ) : null}
              </section>
            );
          })}

          <section className="mt-6">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <ImagePlus className="h-4 w-4" /> Prints
            </h3>
            {card.anexos.length ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {card.anexos.map((anexo) => (
                  <div key={anexo.id} className="group relative overflow-hidden rounded-lg border border-border bg-muted">
                    <button type="button" className="block w-full" onClick={() => setPrintAberto(anexo.storagePath)}>
                      <img
                        src={resolveUploadUrl(anexo.storagePath)}
                        alt={anexo.nome}
                        className="h-28 w-full object-cover"
                      />
                    </button>
                    {podeExcluir ? (
                      <button
                        type="button"
                        aria-label="Remover print"
                        onClick={() => void onRemoverAnexo(anexo.id)}
                        className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum print neste card.</p>
            )}
            {enviandoPrint ? <p className="mt-2 text-sm text-muted-foreground">Enviando print…</p> : null}
          </section>
        </div>

        <aside className="space-y-4">
          {podeEditar || podeExcluir ? (
            <>
              {podeEditar ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Adicionar</p>
                <button
                  type="button"
                  onClick={() =>
                    void salvarListas([
                      ...checklistsRef.current,
                      { id: crypto.randomUUID(), titulo: 'Checklist', itens: [] },
                    ])
                  }
                  className="flex w-full items-center gap-2 rounded-lg bg-muted px-3 py-2 text-left text-sm hover:bg-muted/70"
                >
                  <ListChecks className="h-4 w-4" /> Checklist
                </button>
                <button
                  type="button"
                  onClick={() => arquivoRef.current?.click()}
                  className="flex w-full items-center gap-2 rounded-lg bg-muted px-3 py-2 text-left text-sm hover:bg-muted/70"
                >
                  <ImagePlus className="h-4 w-4" /> Print
                </button>
                <input
                  ref={arquivoRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={(evento) => void receberArquivos(Array.from(evento.target.files ?? []))}
                />
              </div>
              ) : null}

              {podeExcluir ? (
              <button
                type="button"
                onClick={() => setConfirmarExclusao(true)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[#b42318] hover:bg-[#fde8e6]"
              >
                <Trash2 className="h-4 w-4" /> Excluir card
              </button>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Somente leitura.</p>
          )}
        </aside>
      </div>

      {printAberto ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
          onMouseDown={(evento) => {
            evento.stopPropagation();
            setPrintAberto(null);
          }}
        >
          <img src={resolveUploadUrl(printAberto)} alt="" className="max-h-full max-w-full object-contain" />
        </div>
      ) : null}

      {confirmarExclusao ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(evento) => evento.stopPropagation()}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="excluir-card-titulo"
            className="rh-demanda-modal w-full max-w-md rounded-xl border border-[#c5d4e6] p-5 shadow-2xl"
          >
            <h2 id="excluir-card-titulo" className="text-lg font-semibold text-[#10233f]">
              Excluir card
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#3d5168] [overflow-wrap:anywhere]">
              O card <span className="font-semibold text-[#10233f]">“{card.titulo}”</span> será apagado, junto com o checklist e os prints. Essa ação não pode ser desfeita.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmarExclusao(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-[#10233f] hover:bg-[#e7eef8]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void onExcluir()}
                className="rounded-lg bg-[#b42318] px-3 py-2 text-sm font-semibold text-white hover:bg-[#912018]"
              >
                Excluir card
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TituloChecklist({
  titulo,
  podeEditar,
  onSalvar,
}: {
  titulo: string;
  podeEditar: boolean;
  onSalvar: (titulo: string) => void;
}) {
  const [texto, setTexto] = useState(titulo);
  useEffect(() => setTexto(titulo), [titulo]);
  return (
    <input
      value={texto}
      readOnly={!podeEditar}
      onChange={(evento) => setTexto(evento.target.value)}
      onBlur={() => {
        const limpo = texto.trim() || 'Checklist';
        if (limpo !== titulo) onSalvar(limpo);
        else setTexto(titulo);
      }}
      className="rh-demanda-campo min-w-0 flex-1 bg-transparent text-sm font-semibold text-foreground outline-none"
    />
  );
}

function NovoItem({ onAdd }: { onAdd: (texto: string) => void }) {
  const [texto, setTexto] = useState('');
  const [aberto, setAberto] = useState(false);
  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-2 flex w-full items-center gap-2 rounded-lg border border-dashed border-[#c5d4e6] px-3 py-2 text-left text-sm font-medium text-[#1a4a86] hover:border-[#FFAD00] hover:bg-[#fff8e8]"
      >
        + Adicionar um item
      </button>
    );
  }
  return (
    <form
      className="mt-2"
      onSubmit={(evento) => {
        evento.preventDefault();
        const limpo = texto.trim();
        if (!limpo) return;
        onAdd(limpo);
        setTexto('');
      }}
    >
      <input
        autoFocus
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        onKeyDown={(evento) => {
          if (evento.key === 'Escape') {
            setAberto(false);
            setTexto('');
          }
        }}
        placeholder="Adicionar um item"
        className="w-full rounded-lg border border-[#c5d4e6] bg-white px-3 py-2 text-sm text-[#10233f] outline-none focus:border-[#FFAD00]"
      />
    </form>
  );
}
