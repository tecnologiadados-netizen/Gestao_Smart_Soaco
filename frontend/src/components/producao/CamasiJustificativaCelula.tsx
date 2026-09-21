import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil } from 'lucide-react';
import {
  justificarParadaCamasi,
  type CamasiJustificativaOpcao,
} from '../../api/producaoCamasi';

type Props = {
  data: string;
  inicio: string | null;
  fim: string | null;
  observacao: string | null;
  justificativa: string;
  opcoes: CamasiJustificativaOpcao[];
  onSaved: () => void;
  onEditingChange?: (editando: boolean) => void;
};

export default function CamasiJustificativaCelula({
  data,
  inicio,
  fim,
  observacao,
  justificativa,
  opcoes,
  onSaved,
  onEditingChange,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [escolha, setEscolha] = useState('');
  const [nova, setNova] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    onEditingChange?.(aberto);
    return () => onEditingChange?.(false);
  }, [aberto, onEditingChange]);

  useLayoutEffect(() => {
    if (!aberto) return;
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = 288;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const top = r.bottom + 4;
    const flip = top + 220 > window.innerHeight;
    setPos({ top: flip ? Math.max(8, r.top - 224) : top, left });
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const onDoc = (ev: MouseEvent) => {
      const t = ev.target as Node;
      if (boxRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setAberto(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [aberto]);

  const abrir = () => {
    setErro(null);
    setNova('');
    setEscolha(opcoes.some((o) => o.nome === justificativa) ? justificativa : '');
    setAberto(true);
  };

  const salvar = async () => {
    const nome = nova.trim() || escolha.trim();
    if (!nome) {
      setErro('Selecione ou cadastre uma justificativa.');
      return;
    }
    if (!inicio || !fim) {
      setErro('Horário da parada incompleto.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await justificarParadaCamasi({
        data,
        inicioParado: inicio,
        fimParado: fim,
        observacao,
        nome,
      });
      setAberto(false);
      onSaved();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          abrir();
        }}
        className="inline-flex max-w-full items-center gap-1 rounded px-0.5 text-left font-medium text-amber-800 hover:underline dark:text-amber-200"
        title="Apontar justificativa"
      >
        <span className="truncate">{justificativa}</span>
        <Pencil className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
      </button>
      {aberto && pos
        ? createPortal(
        <div
          ref={boxRef}
          className="fixed z-[80] w-72 rounded-md border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-600 dark:bg-slate-900"
          style={{ top: pos.top, left: pos.left }}
        >
          <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
            Motivo cadastrado
          </label>
          <select
            className="mt-0.5 w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            value={escolha}
            onChange={(e) => {
              setEscolha(e.target.value);
              setNova('');
            }}
            disabled={salvando}
          >
            <option value="">Selecione…</option>
            {opcoes.map((o) => (
              <option key={`${o.origem}-${o.nome}`} value={o.nome}>
                {o.nome}
              </option>
            ))}
          </select>
          <label className="mt-2 block text-[11px] font-medium text-slate-600 dark:text-slate-300">
            Ou cadastrar nova
          </label>
          <input
            className="mt-0.5 w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            placeholder="Ex.: Falta de material"
            disabled={salvando}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void salvar();
              }
            }}
          />
          {erro ? <p className="mt-1 text-[11px] text-red-600 dark:text-red-400">{erro}</p> : null}
          <div className="mt-2 flex justify-end gap-1">
            <button
              type="button"
              className="rounded px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={() => setAberto(false)}
              disabled={salvando}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="rounded bg-primary-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-primary-700 disabled:opacity-60"
              onClick={() => void salvar()}
              disabled={salvando}
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>,
            document.body
          )
        : null}
    </div>
  );
}
