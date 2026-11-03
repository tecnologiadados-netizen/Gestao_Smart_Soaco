import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatData } from './portaPalletsComercialFormat';

const NOMES_MES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];
const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

type Props = {
  /** AAAA-MM-DD */
  desde: string;
  /** AAAA-MM-DD */
  ate: string;
  min: string;
  max: string;
  onChange: (desde: string, ate: string) => void;
  label?: string;
};

function iso(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function paraTexto(data: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(data) ? formatData(data) : '';
}

/** Aceita dd/mm/aaaa (com ou sem barras). */
function deTexto(texto: string): string | null {
  const m = /^(\d{2})\/?(\d{2})\/?(\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const dia = Number(m[1]);
  const mes = Number(m[2]);
  const ano = Number(m[3]);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return iso(ano, mes, dia);
}

function mascara(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 8);
  if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}

/** Intervalo de datas: digita De/Até (dd/mm/aaaa) ou clica no dia inicial e depois no final. */
export default function SeletorPeriodoDias({ desde, ate, min, max, onChange, label = 'Período' }: Props) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [vista, setVista] = useState(() => ({ ano: Number(ate.slice(0, 4)), mes: Number(ate.slice(5, 7)) }));
  const [inicioPendente, setInicioPendente] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [textoDe, setTextoDe] = useState('');
  const [textoAte, setTextoAte] = useState('');
  const [erroTexto, setErroTexto] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const aberto = pos != null;

  const abrir = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setVista({ ano: Number(ate.slice(0, 4)), mes: Number(ate.slice(5, 7)) });
    setInicioPendente(null);
    setTextoDe(paraTexto(desde));
    setTextoAte(paraTexto(ate));
    setErroTexto(null);
    setPos({ top: r.bottom + 6, left: r.left });
  };
  const fechar = () => {
    setPos(null);
    setInicioPendente(null);
    setHover(null);
  };

  useEffect(() => {
    if (!aberto) return;
    const clique = (e: MouseEvent) => {
      const alvo = e.target as Node;
      if (btnRef.current?.contains(alvo) || popRef.current?.contains(alvo)) return;
      fechar();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar();
    };
    document.addEventListener('mousedown', clique);
    window.addEventListener('keydown', tecla);
    window.addEventListener('resize', fechar);
    return () => {
      document.removeEventListener('mousedown', clique);
      window.removeEventListener('keydown', tecla);
      window.removeEventListener('resize', fechar);
    };
  }, [aberto]);

  const confirmar = (a: string, b: string) => {
    const [ini, fim] = b < a ? [b, a] : [a, b];
    if (ini < min || fim > max) {
      setErroTexto(`Período entre ${formatData(min)} e ${formatData(max)}.`);
      return;
    }
    onChange(ini, fim);
    fechar();
  };

  const aplicarTexto = () => {
    const a = deTexto(textoDe);
    const b = deTexto(textoAte);
    if (!a || !b) {
      setErroTexto('Use o formato dd/mm/aaaa.');
      return;
    }
    confirmar(a, b);
  };

  const escolher = (dia: string) => {
    if (!inicioPendente) {
      setInicioPendente(dia);
      setTextoDe(formatData(dia));
      setTextoAte('');
      return;
    }
    confirmar(inicioPendente, dia);
  };

  const faixa = (dia: string): 'ponta' | 'meio' | null => {
    const ini = inicioPendente ?? desde;
    const fim = inicioPendente ? (hover ?? inicioPendente) : ate;
    const [a, b] = fim < ini ? [fim, ini] : [ini, fim];
    if (dia === a || dia === b) return 'ponta';
    if (dia > a && dia < b) return 'meio';
    return null;
  };

  const mover = (delta: number) => {
    setVista((v) => {
      const d = new Date(v.ano, v.mes - 1 + delta, 1);
      return { ano: d.getFullYear(), mes: d.getMonth() + 1 };
    });
  };
  const primeiroDaVista = iso(vista.ano, vista.mes, 1);
  const podeVoltar = primeiroDaVista > min.slice(0, 7) + '-01';
  const podeAvancar = primeiroDaVista < max.slice(0, 7) + '-01';

  const diasNoMes = new Date(vista.ano, vista.mes, 0).getDate();
  const offset = new Date(vista.ano, vista.mes - 1, 1).getDay();
  const celulas: Array<string | null> = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: diasNoMes }, (_, i) => iso(vista.ano, vista.mes, i + 1)),
  ];

  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (aberto ? fechar() : abrir())}
        className="inline-flex min-w-[230px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        aria-expanded={aberto}
      >
        <CalendarRange className="h-4 w-4 text-slate-400" />
        <span className="tabular-nums">
          {formatData(desde)} <span className="text-slate-400">→</span> {formatData(ate)}
        </span>
      </button>
      {pos && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={popRef}
              style={{ top: pos.top, left: pos.left }}
              className="fixed z-[10030] w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-white/10 dark:bg-[#12141c]"
            >
              <form
                className="mb-3 flex items-end gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  aplicarTexto();
                }}
              >
                {(
                  [
                    ['De', textoDe, setTextoDe],
                    ['Até', textoAte, setTextoAte],
                  ] as const
                ).map(([rotulo, valor, set]) => (
                  <label key={rotulo} className="flex-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {rotulo}
                    <input
                      value={valor}
                      inputMode="numeric"
                      placeholder="dd/mm/aaaa"
                      onChange={(e) => {
                        set(mascara(e.target.value));
                        setErroTexto(null);
                      }}
                      className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs tabular-nums text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </label>
                ))}
                <button
                  type="submit"
                  className="rounded-md bg-primary-600 px-2 py-1 text-xs font-semibold text-white hover:bg-primary-700"
                >
                  OK
                </button>
              </form>
              {erroTexto ? <p className="-mt-2 mb-2 text-[11px] text-rose-600 dark:text-rose-300">{erroTexto}</p> : null}

              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  disabled={!podeVoltar}
                  onClick={() => mover(-1)}
                  className="rounded-md p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-white/10"
                  aria-label="Mês anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold capitalize text-slate-800 dark:text-slate-100">
                  {NOMES_MES[vista.mes - 1]} {vista.ano}
                </span>
                <button
                  type="button"
                  disabled={!podeAvancar}
                  onClick={() => mover(1)}
                  className="rounded-md p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-white/10"
                  aria-label="Próximo mês"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-slate-400">
                {SEMANA.map((s, i) => (
                  <span key={i}>{s}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5" onMouseLeave={() => setHover(null)}>
                {celulas.map((dia, i) => {
                  if (!dia) return <span key={`v${i}`} />;
                  const fora = dia < min || dia > max;
                  const marca = fora ? null : faixa(dia);
                  return (
                    <button
                      key={dia}
                      type="button"
                      disabled={fora}
                      onClick={() => escolher(dia)}
                      onMouseEnter={() => setHover(dia)}
                      className={`rounded-md py-1 text-xs tabular-nums transition disabled:cursor-not-allowed disabled:opacity-30 ${
                        marca === 'ponta'
                          ? 'bg-primary-600 font-semibold text-white'
                          : marca === 'meio'
                            ? 'bg-primary-600/20 text-slate-800 dark:text-slate-100'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10'
                      }`}
                    >
                      {Number(dia.slice(8))}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                {inicioPendente
                  ? `Início ${formatData(inicioPendente)} — escolha o dia final.`
                  : 'Digite acima ou clique no dia inicial e depois no final.'}
              </p>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
