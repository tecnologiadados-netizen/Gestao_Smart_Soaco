import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchPainelProducaoColaboradoresOrganico,
  urlFotoColaboradorOrganico,
  type PainelProducaoColaboradorOrganico,
  type PainelProducaoResponsavel,
} from '../../api/painelProducao';
import { criarMatcherTextoLivre } from '../../utils/textoLivreBusca';
import { formatMesShort } from '../../utils/painelProducaoFormat';

function portalTarget(): HTMLElement {
  return (
    document.querySelector<HTMLElement>('.painel-producao-module .dashboard') ?? document.body
  );
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primeira = partes[0]![0] ?? '';
  const ultima = partes.length > 1 ? (partes[partes.length - 1]![0] ?? '') : '';
  return `${primeira}${ultima}`.toUpperCase();
}

/** Foto do orgânico; sem foto (ou falha ao carregar) mostra as iniciais. */
export function ColaboradorAvatar({
  organicoId,
  nome,
  temFoto = true,
  tamanho = 'md',
}: {
  organicoId: string;
  nome: string;
  /** false = já se sabe que não há foto (evita requisição). */
  temFoto?: boolean;
  tamanho?: 'sm' | 'md';
}) {
  const [falhou, setFalhou] = useState(false);
  useEffect(() => setFalhou(false), [organicoId]);
  const classe = `resp-avatar is-${tamanho}`;
  if (!temFoto || falhou || !organicoId) {
    return (
      <span className={`${classe} is-iniciais`} aria-hidden="true">
        {iniciais(nome)}
      </span>
    );
  }
  return (
    <img
      className={classe}
      src={urlFotoColaboradorOrganico(organicoId)}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFalhou(true)}
    />
  );
}

export function ResponsaveisLista({
  responsaveis,
  definidoEm,
  mes,
  vazio = 'Sem responsável',
}: {
  responsaveis: PainelProducaoResponsavel[];
  definidoEm?: string | null;
  mes: string;
  vazio?: string;
}) {
  if (responsaveis.length === 0) {
    return <span className="resp-vazio">{vazio}</span>;
  }
  const herdado = definidoEm && definidoEm !== mes;
  return (
    <div className="resp-lista">
      {responsaveis.map((r) => (
        <div key={r.organico_id} className="resp-item">
          <ColaboradorAvatar organicoId={r.organico_id} nome={r.nome} tamanho="sm" />
          <span className="resp-item-texto">
            <span className="resp-nome">{r.nome}</span>
            {r.cargo && <span className="resp-cargo">{r.cargo}</span>}
          </span>
        </div>
      ))}
      {herdado && (
        <span className="resp-herdado" title="Vínculo mantido automaticamente do mês em que foi gravado">
          desde {formatMesShort(definidoEm)}
        </span>
      )}
    </div>
  );
}

export function ResponsaveisPickerModal({
  titulo,
  subtitulo,
  multiplo,
  inicial,
  onCancelar,
  onSalvar,
}: {
  titulo: string;
  subtitulo?: string;
  multiplo: boolean;
  inicial: PainelProducaoResponsavel[];
  onCancelar: () => void;
  onSalvar: (organicoIds: string[]) => Promise<void>;
}) {
  const [selecionados, setSelecionados] = useState<PainelProducaoResponsavel[]>(inicial);
  const [colaboradores, setColaboradores] = useState<PainelProducaoColaboradorOrganico[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [termo, setTermo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    fetchPainelProducaoColaboradoresOrganico()
      .then((lista) => {
        if (ativo) setColaboradores(lista);
      })
      .catch((err: unknown) => {
        if (ativo) setErro(err instanceof Error ? err.message : 'Falha ao carregar o orgânico.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !salvando) onCancelar();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancelar, salvando]);

  const idsSelecionados = useMemo(
    () => new Set(selecionados.map((s) => s.organico_id)),
    [selecionados],
  );

  const filtrados = useMemo(() => {
    const match = criarMatcherTextoLivre(termo);
    return colaboradores.filter(
      (p) =>
        !idsSelecionados.has(p.id) &&
        (match(p.nome) || match(p.cargo) || match(p.setor) || match(p.matricula)),
    );
  }, [colaboradores, termo, idsSelecionados]);

  function adicionar(p: PainelProducaoColaboradorOrganico) {
    const novo = { organico_id: p.id, nome: p.nome, cargo: p.cargo };
    setSelecionados((prev) => (multiplo ? [...prev, novo] : [novo]));
    setTermo('');
    setErro(null);
  }

  function remover(id: string) {
    setSelecionados((prev) => prev.filter((s) => s.organico_id !== id));
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar(selecionados.map((s) => s.organico_id));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao salvar.');
      setSalvando(false);
    }
  }

  return createPortal(
    <div
      className="apuracao-tooltip-overlay"
      onClick={() => {
        if (!salvando) onCancelar();
      }}
    >
      <div
        className="apuracao-tooltip resp-modal"
        role="dialog"
        aria-label={titulo}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="apuracao-tooltip-close"
          aria-label="Fechar"
          onClick={onCancelar}
          disabled={salvando}
        >
          ×
        </button>
        <div className="apuracao-tooltip-header">
          <strong>{titulo}</strong>
          {subtitulo && <span>{subtitulo}</span>}
        </div>

        <div className="resp-modal-body">
          <div className="resp-modal-secao">
            <span className="resp-modal-rotulo">
              {multiplo ? 'Responsáveis vinculados' : 'Responsável'}
            </span>
            {selecionados.length === 0 ? (
              <span className="resp-vazio">Nenhum vinculado.</span>
            ) : (
              <ul className="resp-chips">
                {selecionados.map((s) => (
                  <li key={s.organico_id} className="resp-chip">
                    <ColaboradorAvatar organicoId={s.organico_id} nome={s.nome} />
                    <span className="resp-chip-texto">
                      <strong>{s.nome}</strong>
                      {s.cargo && <small>{s.cargo}</small>}
                    </span>
                    <button
                      type="button"
                      onClick={() => remover(s.organico_id)}
                      disabled={salvando}
                      aria-label={`Remover ${s.nome}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="resp-modal-secao">
            <span className="resp-modal-rotulo">
              {multiplo || selecionados.length === 0 ? 'Adicionar do orgânico' : 'Trocar por'}
            </span>
            <input
              type="text"
              className="targets-input resp-busca"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Nome, cargo ou setor… (% refina, ex.: Sold%)"
              disabled={carregando || salvando}
              autoFocus
            />
            <ul className="resp-opcoes" role="listbox">
              {carregando ? (
                <li className="resp-opcoes-estado">Carregando orgânico…</li>
              ) : filtrados.length === 0 ? (
                <li className="resp-opcoes-estado">Nenhum colaborador ativo encontrado.</li>
              ) : (
                filtrados.map((p) => (
                  <li key={p.id} role="option" aria-selected={false}>
                    <button type="button" onClick={() => adicionar(p)} disabled={salvando}>
                      <ColaboradorAvatar organicoId={p.id} nome={p.nome} temFoto={p.tem_foto} />
                      <span className="resp-opcao-texto">
                        <strong>{p.nome}</strong>
                        <small>{[p.cargo, p.setor].filter(Boolean).join(' · ')}</small>
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
            <span className="resp-modal-nota">
              Colaboradores ativos do orgânico. O vínculo vale para este mês e os seguintes, até
              ser alterado.
            </span>
          </div>

          {erro && <p className="apuracao-tooltip-state is-error">{erro}</p>}
        </div>

        <div className="resp-modal-acoes">
          <button
            type="button"
            className="targets-cancel-btn"
            onClick={onCancelar}
            disabled={salvando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="targets-save-btn"
            onClick={() => void salvar()}
            disabled={salvando}
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>,
    portalTarget(),
  );
}

/** Célula com responsáveis + botão para vincular (abre o modal do orgânico). */
export function ResponsaveisCelula({
  responsaveis,
  definidoEm,
  mes,
  podeEditar,
  multiplo,
  titulo,
  subtitulo,
  onSalvar,
}: {
  responsaveis: PainelProducaoResponsavel[];
  definidoEm?: string | null;
  mes: string;
  podeEditar: boolean;
  multiplo: boolean;
  titulo: string;
  subtitulo?: string;
  onSalvar: (organicoIds: string[]) => Promise<void>;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="resp-celula">
      <ResponsaveisLista
        responsaveis={responsaveis}
        definidoEm={definidoEm}
        mes={mes}
        vazio={multiplo ? 'Sem responsáveis' : 'Sem responsável'}
      />
      {podeEditar && (
        <button type="button" className="resp-editar-btn" onClick={() => setAberto(true)}>
          {responsaveis.length === 0 ? 'Vincular' : 'Alterar'}
        </button>
      )}
      {aberto && (
        <ResponsaveisPickerModal
          titulo={titulo}
          subtitulo={subtitulo}
          multiplo={multiplo}
          inicial={responsaveis}
          onCancelar={() => setAberto(false)}
          onSalvar={async (ids) => {
            await onSalvar(ids);
            setAberto(false);
          }}
        />
      )}
    </div>
  );
}
