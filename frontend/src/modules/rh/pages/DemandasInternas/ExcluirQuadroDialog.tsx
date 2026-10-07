import { useEffect, useRef, useState } from 'react';

type ExcluirQuadroDialogProps = {
  nome: string;
  onCancelar: () => void;
  onConfirmar: (senha: string) => Promise<string | null>;
};

export default function ExcluirQuadroDialog({ nome, onCancelar, onConfirmar }: ExcluirQuadroDialogProps) {
  const [etapa, setEtapa] = useState<'confirmar' | 'senha'>('confirmar');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const senhaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (etapa === 'senha') senhaRef.current?.focus();
  }, [etapa]);

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== 'Escape' || enviando) return;
      if (etapa === 'senha') {
        setEtapa('confirmar');
        setSenha('');
        setErro(null);
        return;
      }
      onCancelar();
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [enviando, etapa, onCancelar]);

  async function confirmarSenha() {
    const digitada = senha.trim();
    if (!digitada) {
      setErro('Digite sua senha.');
      senhaRef.current?.focus();
      return;
    }
    setEnviando(true);
    setErro(null);
    const mensagem = await onConfirmar(digitada);
    if (mensagem) {
      setErro(mensagem);
      setEnviando(false);
      senhaRef.current?.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="excluir-quadro-titulo"
        className="rh-demanda-modal w-full max-w-md rounded-xl border border-[#c5d4e6] p-5 shadow-2xl"
      >
        {etapa === 'confirmar' ? (
          <>
            <h2 id="excluir-quadro-titulo" className="text-lg font-semibold text-[#10233f]">
              Excluir quadro
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#3d5168]">
              O quadro <span className="font-semibold text-[#10233f]">“{nome}”</span> será apagado, junto com as listas e os cards. Essa ação não pode ser desfeita.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancelar}
                className="rounded-lg px-3 py-2 text-sm font-medium text-[#10233f] hover:bg-[#e7eef8]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setEtapa('senha')}
                className="rounded-lg bg-[#b42318] px-3 py-2 text-sm font-semibold text-white hover:bg-[#912018]"
              >
                Continuar
              </button>
            </div>
          </>
        ) : (
          <form
            onSubmit={(evento) => {
              evento.preventDefault();
              void confirmarSenha();
            }}
          >
            <h2 id="excluir-quadro-titulo" className="text-lg font-semibold text-[#10233f]">
              Confirme com a sua senha
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#3d5168]">
              Digite a senha da sua conta para excluir o quadro <span className="font-semibold text-[#10233f]">“{nome}”</span>.
            </p>
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-[#3d5168]">
              Senha
              <input
                ref={senhaRef}
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(evento) => {
                  setSenha(evento.target.value);
                  setErro(null);
                }}
                className="mt-1 w-full rounded-lg border border-[#c5d4e6] px-3 py-2 text-sm font-normal normal-case tracking-normal text-[#10233f]"
              />
            </label>
            {erro ? <p className="mt-2 text-sm text-[#b42318]">{erro}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={enviando}
                onClick={() => {
                  setEtapa('confirmar');
                  setSenha('');
                  setErro(null);
                }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-[#10233f] hover:bg-[#e7eef8] disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={enviando || !senha.trim()}
                className="rounded-lg bg-[#b42318] px-3 py-2 text-sm font-semibold text-white hover:bg-[#912018] disabled:opacity-50"
              >
                {enviando ? 'Excluindo…' : 'Excluir quadro'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
