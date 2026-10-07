import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { toast } from 'sonner';
import { resolveUploadUrl } from '@/api/client';
import AppLayout from '@rh/components/AppLayout';
import SeletorCorCard from '@rh/pages/DemandasInternas/SeletorCorCard';
import { corDoPostIt } from '@rh/lib/demandas-internas';
import { canEditRoute } from '@rh/lib/route-permissions';
import { rhPath } from '@rh/lib/rh-paths';
import { rhFieldInput, rhFieldLabel, rhFieldSelectNative, rhFieldTextarea } from '@rh/lib/form-field-styles';
import {
  anexarPdfVaga,
  atualizarVaga,
  criarVaga,
  excluirVaga,
  removerPdfVaga,
  fraseHistorico,
  getVagas,
  prazoVencido,
  proximosStatus,
  rotuloPrazo,
  rotuloStatus,
  type LinkDivulgacao,
  type StatusVaga,
  type Vaga,
} from '@rh/lib/vagas';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const CHAVE = ['rh-vagas'] as const;
const LIMITE_PDF = 15 * 1024 * 1024;

const CORES: Record<StatusVaga, string> = {
  aberta_sem_divulgacao: 'bg-[#fff4d6] text-[#8a5a00]',
  em_divulgacao: 'bg-[#e5f4ff] text-[#0b4f86]',
  triagem: 'bg-[#efe8ff] text-[#5b2d91]',
  entrevista: 'bg-[#e7f7ef] text-[#0f6b45]',
  fechada: 'bg-[#e8edf3] text-[#334155]',
};

type FiltroVaga = 'todas' | 'abertas' | StatusVaga;

type LinhaLink = { chave: string; descricao: string; url: string };

function quando(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function linhaVazia(): LinhaLink {
  return { chave: crypto.randomUUID(), descricao: '', url: '' };
}

function linhasDe(links: LinkDivulgacao[] | undefined): LinhaLink[] {
  const lista = links ?? [];
  if (lista.length === 0) return [linhaVazia()];
  return lista.map((link) => ({ chave: link.id, descricao: link.descricao, url: link.url }));
}

function linksParaEnvio(linhas: LinhaLink[]): LinkDivulgacao[] {
  return linhas
    .map((linha) => ({ id: linha.chave, descricao: linha.descricao.trim(), url: linha.url.trim() }))
    .filter((linha) => linha.url || linha.descricao);
}

function assinaturaLinks(links: Array<{ id: string; descricao: string; url: string }>): string {
  return JSON.stringify(links.map((link) => [link.id, link.descricao.trim(), link.url.trim()]));
}

function resumir(texto: string, limite = 90): string {
  const limpo = texto.replace(/\s+/g, ' ').trim();
  if (limpo.length <= limite) return limpo;
  return `${limpo.slice(0, limite - 1).trimEnd()}…`;
}

function nomeLocal(link: LinkDivulgacao): string {
  const onde = link.descricao.trim();
  if (onde) return onde;
  try {
    return new URL(link.url).hostname.replace(/^www\./, '');
  } catch {
    return link.url.trim();
  }
}

function locaisDivulgacao(vaga: Vaga): string {
  return resumir([...new Set((vaga.links ?? []).map(nomeLocal).filter(Boolean))].join(', '), 160);
}

function resumoVaga(vaga: Vaga): string {
  if (vaga.status === 'em_divulgacao') return locaisDivulgacao(vaga) || 'Sem locais de divulgação';
  const obs = resumir(vaga.observacao, 180);
  if (vaga.status === 'aberta_sem_divulgacao') return obs;
  return obs || locaisDivulgacao(vaga);
}

function arquivoPdfValido(arquivo: File): boolean {
  const pdf = arquivo.type === 'application/pdf' || arquivo.name.toLowerCase().endsWith('.pdf');
  if (!pdf) {
    toast.error('Envie o post da vaga em PDF.');
    return false;
  }
  if (arquivo.size > LIMITE_PDF) {
    toast.error('O PDF passa de 15 MB.');
    return false;
  }
  return true;
}

function CapaPdf({ src }: { src: string }) {
  const [imagem, setImagem] = useState('');
  useEffect(() => {
    let ativo = true;
    let documento: { destroy: () => Promise<void> } | null = null;
    (async () => {
      const resposta = await fetch(src);
      if (!resposta.ok) throw new Error('pdf');
      const dados = new Uint8Array(await resposta.arrayBuffer());
      const pdf = await getDocument({ data: dados }).promise;
      documento = pdf;
      const pagina = await pdf.getPage(1);
      const viewport = pagina.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      const contexto = canvas.getContext('2d');
      if (!contexto) return;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await pagina.render({ canvasContext: contexto, viewport, canvas }).promise;
      if (!ativo) return;
      setImagem(canvas.toDataURL('image/jpeg', 0.86));
    })().catch(() => {
      if (ativo) setImagem('');
    });
    return () => {
      ativo = false;
      void documento?.destroy();
    };
  }, [src]);
  if (!imagem) return <span className="mb-2 block h-32 w-full animate-pulse rounded-md bg-black/10" aria-hidden />;
  return <img src={imagem} alt="" draggable={false} className="mb-2 max-h-32 w-full rounded-md object-cover" />;
}

function CampoPdf({
  src,
  nome,
  podeEditar,
  onEscolher,
  onRemover,
}: {
  src: string;
  nome: string;
  podeEditar: boolean;
  onEscolher: (arquivo: File) => void;
  onRemover: () => void;
}) {
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Post da vaga</p>
      {src ? (
        <div className="mt-2">
          <CapaPdf src={src} />
          {nome ? <p className="text-xs text-muted-foreground">{nome}</p> : null}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Nenhum PDF anexado.</p>
      )}
      {podeEditar ? (
        <div className="mt-2 flex gap-3">
          <label className="cursor-pointer text-sm font-semibold text-[#FFAD00]">
            {src ? 'Trocar PDF' : 'Anexar PDF'}
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(evento) => {
                const arquivo = evento.target.files?.[0];
                evento.target.value = '';
                if (arquivo && arquivoPdfValido(arquivo)) onEscolher(arquivo);
              }}
            />
          </label>
          {src ? (
            <button type="button" onClick={onRemover} className="text-sm font-medium text-[#b42318]">
              Remover
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PostItVaga({ vaga, onAbrir }: { vaga: Vaga; onAbrir: () => void }) {
  const tom = corDoPostIt(vaga.cor);
  const claro = tom.texto.toLowerCase() !== '#ffffff';
  const resumo = resumoVaga(vaga);
  const vencido = prazoVencido(vaga);
  return (
    <button
      type="button"
      onClick={onAbrir}
      style={{ backgroundColor: tom.fundo, color: tom.texto, boxShadow: '0 6px 14px rgba(16, 35, 63, 0.08)' }}
      className={`relative flex min-h-[13rem] flex-col overflow-hidden rounded-md border px-4 py-3.5 pr-6 text-left transition hover:-translate-y-0.5 ${claro ? 'border-[#d5deea]' : 'border-transparent'}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 h-5 w-5"
        style={{ background: `linear-gradient(135deg, transparent 50%, ${tom.dobra} 50%)` }}
      />
      {vaga.anexo ? <CapaPdf src={resolveUploadUrl(vaga.anexo.storagePath)} /> : null}
      <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CORES[vaga.status]}`}>
        {rotuloStatus(vaga.status)}
      </span>
      <span className="mt-2 text-base font-semibold leading-5 [overflow-wrap:anywhere]">{vaga.titulo}</span>
      {resumo ? <span className="mt-2 line-clamp-5 flex-1 text-sm leading-5 opacity-90">{resumo}</span> : <span className="flex-1" />}
      {vaga.prazo ? (
        <span className={`mt-3 inline-flex w-fit rounded px-1.5 py-0.5 text-xs font-semibold ${vencido ? 'bg-[#b42318] text-white' : 'bg-black/10'}`}>
          Fecha até {rotuloPrazo(vaga.prazo)}
          {vencido ? ' · vencido' : ''}
        </span>
      ) : (
        <span className="mt-3 text-xs opacity-70">Sem data limite</span>
      )}
    </button>
  );
}

function CascaModal({
  tituloId,
  onFechar,
  children,
}: {
  tituloId: string;
  onFechar: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function tecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') onFechar();
    }
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onFechar]);

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/60" role="presentation" onClick={onFechar}>
      <div className="flex min-h-full justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={tituloId}
          className="m-auto w-full max-w-2xl rounded-xl border border-border bg-card p-5 shadow-2xl"
          onClick={(evento) => evento.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function TabelaLinks({
  linhas,
  onChange,
  podeEditar,
}: {
  linhas: LinhaLink[];
  onChange: (linhas: LinhaLink[]) => void;
  podeEditar: boolean;
}) {
  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Links de divulgação</p>
      <div className="mt-2 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-[34%] px-3 py-2 font-medium">Onde</th>
              <th className="px-3 py-2 font-medium">Link</th>
              <th className="w-24 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha, indice) => (
              <tr key={linha.chave} className="border-t border-border">
                <td className="p-2 align-top">
                  <input
                    value={linha.descricao}
                    disabled={!podeEditar}
                    placeholder="LinkedIn, site…"
                    onChange={(evento) => {
                      const copia = [...linhas];
                      copia[indice] = { ...linha, descricao: evento.target.value };
                      onChange(copia);
                    }}
                    className={rhFieldInput}
                  />
                </td>
                <td className="p-2 align-top">
                  <input
                    value={linha.url}
                    disabled={!podeEditar}
                    placeholder="https://"
                    onChange={(evento) => {
                      const copia = [...linhas];
                      copia[indice] = { ...linha, url: evento.target.value };
                      onChange(copia);
                    }}
                    className={rhFieldInput}
                  />
                </td>
                <td className="p-2 text-right align-middle">
                  {linha.url.trim() ? (
                    <a href={linha.url.trim().startsWith('http') ? linha.url.trim() : `https://${linha.url.trim()}`} target="_blank" rel="noreferrer" className="mr-2 text-xs font-semibold text-[#FFAD00]">
                      Abrir
                    </a>
                  ) : null}
                  {podeEditar ? (
                    <button
                      type="button"
                      onClick={() => onChange(linhas.filter((item) => item.chave !== linha.chave))}
                      className="text-xs font-medium text-[#b42318]"
                    >
                      Remover
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {podeEditar ? (
        <button type="button" onClick={() => onChange([...linhas, linhaVazia()])} className="mt-2 text-sm font-semibold text-[#FFAD00]">
          Adicionar linha
        </button>
      ) : null}
    </div>
  );
}

export default function Vagas() {
  const podeEditar = canEditRoute(rhPath('/vagas'));
  const queryClient = useQueryClient();
  const consulta = useQuery({ queryKey: CHAVE, queryFn: getVagas });
  const [filtro, setFiltro] = useState<FiltroVaga>('todas');
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const vagas = consulta.data?.vagas ?? [];
  const visiveis = useMemo(() => {
    if (filtro === 'todas') return vagas;
    if (filtro === 'abertas') return vagas.filter((vaga) => vaga.status !== 'fechada');
    return vagas.filter((vaga) => vaga.status === filtro);
  }, [filtro, vagas]);
  const contagem = useMemo(() => {
    const porStatus = (status: StatusVaga) => vagas.filter((vaga) => vaga.status === status).length;
    return {
      todas: vagas.length,
      abertas: vagas.filter((vaga) => vaga.status !== 'fechada').length,
      aberta_sem_divulgacao: porStatus('aberta_sem_divulgacao'),
      em_divulgacao: porStatus('em_divulgacao'),
      triagem: porStatus('triagem'),
      entrevista: porStatus('entrevista'),
      fechada: porStatus('fechada'),
    } satisfies Record<FiltroVaga, number>;
  }, [vagas]);
  const selecionada = vagas.find((vaga) => vaga.id === selecionadaId) ?? null;

  function aplicar(vaga: Vaga) {
    queryClient.setQueryData<{ vagas: Vaga[] }>(CHAVE, (atual) => {
      const lista = atual?.vagas ?? [];
      const sem = lista.filter((item) => item.id !== vaga.id);
      return { vagas: [vaga, ...sem].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) };
    });
    setSelecionadaId(vaga.id);
  }

  return (
    <AppLayout>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d5deea] bg-white px-5 py-4 shadow-[0_10px_24px_-16px_rgba(4,30,66,0.45)] dark:border-[#2c3848] dark:bg-[#171d27]">
          <div>
            <h1 className="text-2xl font-semibold text-[#10233f] dark:text-white">Vagas</h1>
            <p className="mt-1 text-sm text-[#3d5168] dark:text-[#b7c3d4]">
              Cadastre a posição em aberto e acompanhe divulgação, triagem, entrevista e o fechamento.
            </p>
          </div>
          {podeEditar ? (
            <button
              type="button"
              onClick={() => {
                setSelecionadaId(null);
                setCriando(true);
              }}
              className="rounded-lg bg-[#FFAD00] px-4 py-2 text-sm font-semibold text-[#041E42] shadow-sm"
            >
              Cadastrar vaga
            </button>
          ) : null}
        </header>

        <section className="rounded-2xl border border-[#d5deea] bg-white p-4 shadow-[0_10px_24px_-16px_rgba(4,30,66,0.45)] dark:border-[#2c3848] dark:bg-[#171d27]">
          <div className="flex flex-wrap gap-2 border-b border-[#e4ebf3] pb-4 dark:border-[#2c3848]">
            {(
              [
                ['todas', 'Todas'],
                ['abertas', 'Abertas'],
                ['aberta_sem_divulgacao', 'Sem divulgação'],
                ['em_divulgacao', 'Em divulgação'],
                ['triagem', 'Triagem'],
                ['entrevista', 'Entrevista'],
                ['fechada', 'Fechadas'],
              ] as const
            ).map(([id, rotulo]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFiltro(id)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  filtro === id
                    ? 'border-[#041E42] bg-[#041E42] text-white shadow-sm'
                    : 'border-[#c5d0e2] bg-[#f4f7fb] text-[#243044] hover:border-[#041E42] dark:border-[#3a4658] dark:bg-[#121820] dark:text-[#d5deea]'
                }`}
              >
                {rotulo}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${filtro === id ? 'bg-white/20' : 'bg-white text-[#041E42] dark:bg-[#243044] dark:text-white'}`}>
                  {contagem[id]}
                </span>
              </button>
            ))}
          </div>

          {consulta.isLoading ? <p className="px-1 py-6 text-sm text-[#3d5168] dark:text-[#b7c3d4]">Carregando vagas…</p> : null}
          {consulta.isError ? <p className="px-1 py-6 text-sm text-destructive">Não foi possível carregar as vagas.</p> : null}

          <div className="mt-4 rounded-xl bg-[#f4f7fb] p-4 dark:bg-[#121820]">
            {!consulta.isLoading && visiveis.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[#c5d0e2] px-4 py-8 text-center text-sm text-[#3d5168] dark:border-[#3a4658] dark:text-[#b7c3d4]">
                Nenhuma vaga neste filtro.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visiveis.map((vaga) => (
                  <PostItVaga
                    key={vaga.id}
                    vaga={vaga}
                    onAbrir={() => {
                      setCriando(false);
                      setSelecionadaId(vaga.id);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {criando && podeEditar ? (
        <FormularioCadastro
          onCancelar={() => setCriando(false)}
          onCriada={(vaga) => {
            aplicar(vaga);
            setCriando(false);
            setFiltro('abertas');
          }}
        />
      ) : null}

      {selecionada ? (
        <DetalheVaga
          key={selecionada.id}
          vaga={selecionada}
          podeEditar={podeEditar}
          onAtualizada={aplicar}
          onFechar={() => setSelecionadaId(null)}
          onExcluida={() => setSelecionadaId(null)}
        />
      ) : null}
    </AppLayout>
  );
}

function FormularioCadastro({ onCancelar, onCriada }: { onCancelar: () => void; onCriada: (vaga: Vaga) => void }) {
  const [titulo, setTitulo] = useState('');
  const [status, setStatus] = useState<'aberta_sem_divulgacao' | 'em_divulgacao'>('aberta_sem_divulgacao');
  const [prazo, setPrazo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [cor, setCor] = useState('branco');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [linhas, setLinhas] = useState<LinhaLink[]>([linhaVazia()]);
  const previa = useMemo(() => (arquivo ? URL.createObjectURL(arquivo) : ''), [arquivo]);
  useEffect(() => {
    if (!previa) return;
    return () => URL.revokeObjectURL(previa);
  }, [previa]);
  const [enviando, setEnviando] = useState(false);

  async function salvar() {
    if (!titulo.trim()) {
      toast.error('Informe o nome da vaga.');
      return;
    }
    setEnviando(true);
    try {
      const resposta = await criarVaga({
        titulo: titulo.trim(),
        status,
        prazo: prazo || null,
        observacao: observacao.trim(),
        links: status === 'em_divulgacao' ? linksParaEnvio(linhas) : [],
        cor,
      });
      const gravada = arquivo ? (await anexarPdfVaga(resposta.vaga.id, arquivo)).vaga : resposta.vaga;
      onCriada(gravada);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível cadastrar a vaga.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <CascaModal tituloId="nova-vaga-titulo" onFechar={onCancelar}>
      <form
        className="grid gap-3"
        onSubmit={(evento) => {
          evento.preventDefault();
          void salvar();
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="nova-vaga-titulo" className="text-lg font-semibold text-foreground">
            Nova vaga
          </h2>
          <button type="button" onClick={onCancelar} className="rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-muted" aria-label="Fechar">
            Fechar
          </button>
        </div>
        <label className={rhFieldLabel}>
          Nome da vaga
          <input value={titulo} onChange={(evento) => setTitulo(evento.target.value)} className={`mt-1 ${rhFieldInput}`} />
        </label>
        <div>
          <p className={rhFieldLabel}>Cor do post-it</p>
          <div className="mt-2">
            <SeletorCorCard valor={cor} onEscolher={setCor} />
          </div>
        </div>
        <label className={rhFieldLabel}>
          Status de abertura
          <select
            value={status}
            onChange={(evento) => setStatus(evento.target.value as 'aberta_sem_divulgacao' | 'em_divulgacao')}
            className={`mt-1 ${rhFieldSelectNative}`}
          >
            <option value="aberta_sem_divulgacao">Aberta sem divulgação (standby)</option>
            <option value="em_divulgacao">Em divulgação</option>
          </select>
        </label>
        {status === 'em_divulgacao' ? <TabelaLinks linhas={linhas} onChange={setLinhas} podeEditar /> : null}
        <label className={rhFieldLabel}>
          Data limite de fechamento
          <input type="date" value={prazo} onChange={(evento) => setPrazo(evento.target.value)} className={`mt-1 ${rhFieldInput}`} />
        </label>
        <label className={rhFieldLabel}>
          Observação
          <textarea value={observacao} onChange={(evento) => setObservacao(evento.target.value)} className={`mt-1 ${rhFieldTextarea}`} />
        </label>
        <CampoPdf src={previa} nome={arquivo?.name ?? ''} podeEditar onEscolher={setArquivo} onRemover={() => setArquivo(null)} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancelar} className="rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted">
            Cancelar
          </button>
          <button type="submit" disabled={enviando} className="rounded-lg bg-[#041E42] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {enviando ? 'Salvando…' : 'Cadastrar'}
          </button>
        </div>
      </form>
    </CascaModal>
  );
}

function DetalheVaga({
  vaga,
  podeEditar,
  onAtualizada,
  onFechar,
  onExcluida,
}: {
  vaga: Vaga;
  podeEditar: boolean;
  onAtualizada: (vaga: Vaga) => void;
  onFechar: () => void;
  onExcluida: () => void;
}) {
  const queryClient = useQueryClient();
  const [titulo, setTitulo] = useState(vaga.titulo);
  const [prazo, setPrazo] = useState(vaga.prazo ?? '');
  const [observacao, setObservacao] = useState(vaga.observacao);
  const [cor, setCor] = useState(vaga.cor || 'branco');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [removerPdf, setRemoverPdf] = useState(false);
  const [proximo, setProximo] = useState('');
  const [detalhe, setDetalhe] = useState('');
  const [linhas, setLinhas] = useState<LinhaLink[]>(() => linhasDe(vaga.links));
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const previa = useMemo(() => (arquivo ? URL.createObjectURL(arquivo) : ''), [arquivo]);
  useEffect(() => {
    if (!previa) return;
    return () => URL.revokeObjectURL(previa);
  }, [previa]);
  const mutacao = useMutation({
    mutationFn: async (entrada: { patch: Parameters<typeof atualizarVaga>[1]; arquivo: File | null; removerPdf: boolean }) => {
      let atual = vaga;
      if (Object.keys(entrada.patch).length > 0) atual = (await atualizarVaga(vaga.id, entrada.patch)).vaga;
      if (entrada.arquivo) atual = (await anexarPdfVaga(vaga.id, entrada.arquivo)).vaga;
      else if (entrada.removerPdf && vaga.anexo) atual = (await removerPdfVaga(vaga.id)).vaga;
      return { vaga: atual };
    },
    onSuccess: (resposta) => {
      onAtualizada(resposta.vaga);
      setTitulo(resposta.vaga.titulo);
      setPrazo(resposta.vaga.prazo ?? '');
      setObservacao(resposta.vaga.observacao);
      setCor(resposta.vaga.cor || 'branco');
      setArquivo(null);
      setRemoverPdf(false);
      setLinhas(linhasDe(resposta.vaga.links));
      setProximo('');
      setDetalhe('');
      toast.success('Vaga salva.');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Não foi possível atualizar a vaga.'),
  });

  const historico = [...vaga.historico].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const linha = new Map(historico.map((evento, indice) => [evento.id, historico[indice - 1]]));
  const exibirLinks = vaga.status !== 'aberta_sem_divulgacao' || proximo === 'em_divulgacao';
  const linksAlterados = assinaturaLinks(linksParaEnvio(linhas)) !== assinaturaLinks(vaga.links ?? []);
  const alterado =
    titulo.trim() !== vaga.titulo ||
    (prazo || null) !== (vaga.prazo ?? null) ||
    observacao !== vaga.observacao ||
    cor !== (vaga.cor || 'branco') ||
    arquivo !== null ||
    removerPdf ||
    proximo !== '' ||
    (exibirLinks && linksAlterados);

  function salvar() {
    const limpo = titulo.trim();
    if (!limpo) {
      toast.error('Informe o nome da vaga.');
      return;
    }
    const patch: Parameters<typeof atualizarVaga>[1] = {};
    if (limpo !== vaga.titulo) patch.titulo = limpo;
    if ((prazo || null) !== (vaga.prazo ?? null)) patch.prazo = prazo || null;
    if (observacao !== vaga.observacao) patch.observacao = observacao;
    if (cor !== (vaga.cor || 'branco')) patch.cor = cor;
    if (proximo) {
      patch.status = proximo as StatusVaga;
      patch.detalhe = detalhe;
    }
    if (exibirLinks && linksAlterados) patch.links = linksParaEnvio(linhas);
    if (Object.keys(patch).length === 0 && !arquivo && !removerPdf) return;
    mutacao.mutate({ patch, arquivo, removerPdf });
  }

  function fechar() {
    if (confirmarExclusao) {
      setConfirmarExclusao(false);
      return;
    }
    onFechar();
  }

  return (
    <CascaModal tituloId="vaga-detalhe-titulo" onFechar={fechar}>
      <div className="flex items-start justify-between gap-3">
        {podeEditar ? (
          <input
            id="vaga-detalhe-titulo"
            value={titulo}
            onChange={(evento) => setTitulo(evento.target.value)}
            className={`${rhFieldInput} text-lg font-semibold`}
          />
        ) : (
          <h2 id="vaga-detalhe-titulo" className="text-lg font-semibold text-foreground">
            {vaga.titulo}
          </h2>
        )}
        <div className="flex shrink-0 gap-2">
          {podeEditar ? (
            <button
              type="button"
              onClick={salvar}
              disabled={!alterado || mutacao.isPending}
              className="rounded-lg bg-[#FFAD00] px-3 py-1.5 text-sm font-semibold text-[#041E42] disabled:opacity-40"
            >
              {mutacao.isPending ? 'Salvando…' : 'Salvar'}
            </button>
          ) : null}
          <button type="button" onClick={fechar} className="rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-muted">
            Fechar
          </button>
        </div>
      </div>
      <p className={`mt-3 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${CORES[vaga.status]}`}>
        {rotuloStatus(vaga.status)}
      </p>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cor do post-it</p>
        <div className="mt-2">
          {podeEditar ? (
            <SeletorCorCard valor={cor} onEscolher={setCor} />
          ) : (
            <span className="inline-block h-6 w-6 rounded-md border border-black/15" style={{ backgroundColor: corDoPostIt(vaga.cor).fundo }} />
          )}
        </div>
      </div>

      <label className={`${rhFieldLabel} mt-4`}>
        Data limite de fechamento
        <input
          type="date"
          value={prazo}
          disabled={!podeEditar || mutacao.isPending}
          onChange={(evento) => setPrazo(evento.target.value)}
          className={`mt-1 ${rhFieldInput}`}
        />
      </label>
      {prazoVencido({ prazo: prazo || null, status: vaga.status }) ? (
        <p className="mt-1 text-xs font-semibold text-[#b42318]">Prazo vencido</p>
      ) : null}

      <CampoPdf
        src={previa || (!removerPdf && vaga.anexo ? resolveUploadUrl(vaga.anexo.storagePath) : '')}
        nome={arquivo?.name || (!removerPdf ? vaga.anexo?.nome : '') || ''}
        podeEditar={podeEditar && !mutacao.isPending}
        onEscolher={(escolhido) => {
          setArquivo(escolhido);
          setRemoverPdf(false);
        }}
        onRemover={() => {
          setArquivo(null);
          setRemoverPdf(true);
        }}
      />

      <label className={`${rhFieldLabel} mt-4`}>
        Observação
        <textarea
          value={observacao}
          readOnly={!podeEditar}
          onChange={(evento) => setObservacao(evento.target.value)}
          className={`mt-1 ${rhFieldTextarea}`}
        />
      </label>

      {exibirLinks ? <TabelaLinks linhas={linhas} onChange={setLinhas} podeEditar={podeEditar} /> : null}

      {podeEditar ? (
        <div className="mt-4 grid gap-2 rounded-lg bg-muted/50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Andamento</p>
          <select value={proximo} onChange={(evento) => setProximo(evento.target.value)} className={rhFieldSelectNative} disabled={mutacao.isPending}>
            <option value="">Escolha o próximo status</option>
            {proximosStatus(vaga.status).map((status) => (
              <option key={status} value={status}>
                {vaga.status === 'fechada' ? `Reabrir: ${rotuloStatus(status)}` : rotuloStatus(status)}
              </option>
            ))}
          </select>
          <input
            value={detalhe}
            onChange={(evento) => setDetalhe(evento.target.value)}
            placeholder="Nota deste movimento (opcional)"
            className={rhFieldInput}
            disabled={mutacao.isPending}
          />
        </div>
      ) : null}

      <h3 className="mt-5 text-sm font-semibold text-foreground">Histórico</h3>
      <ol className="mt-2 space-y-3">
        {[...vaga.historico]
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((evento) => (
            <li key={evento.id} className="border-l-2 border-[#FFAD00] pl-3">
              <p className="text-sm font-medium text-foreground">{fraseHistorico(evento, linha.get(evento.id))}</p>
              <p className="text-xs text-muted-foreground">
                {quando(evento.createdAt)}
                {evento.createdBy ? ` · ${evento.createdBy}` : ''}
              </p>
              {evento.detalhe && evento.tipo === 'status' ? (
                <p className="mt-1 text-sm text-muted-foreground">{evento.detalhe}</p>
              ) : null}
            </li>
          ))}
      </ol>

      {podeEditar ? (
        <button type="button" onClick={() => setConfirmarExclusao(true)} className="mt-5 text-sm font-medium text-[#b42318]">
          Excluir vaga
        </button>
      ) : null}

      {confirmarExclusao ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" role="presentation">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5" role="alertdialog" aria-modal="true">
            <h2 className="text-lg font-semibold text-foreground">Excluir vaga</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A vaga “{vaga.titulo}” e o histórico dela serão apagados. Essa ação não pode ser desfeita.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmarExclusao(false)} className="rounded-lg px-3 py-2 text-sm">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  void excluirVaga(vaga.id)
                    .then((resposta) => {
                      queryClient.setQueryData(CHAVE, resposta);
                      setConfirmarExclusao(false);
                      onExcluida();
                    })
                    .catch((err: unknown) => toast.error(err instanceof Error ? err.message : 'Não foi possível excluir a vaga.'));
                }}
                className="rounded-lg bg-[#b42318] px-3 py-2 text-sm font-semibold text-white"
              >
                Excluir vaga
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </CascaModal>
  );
}
