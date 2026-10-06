import { useEffect, useState, type FormEvent } from 'react';
import { login, pingServer } from '@/api/auth';
import { useAuth } from '@/contexts/AuthContext';
import LogoSoAco from '@/components/LogoSoAco';

const BRAND = {
  bg: '#000000',
  card: 'rgba(46, 45, 44, 0.85)',
  border: 'rgba(255, 173, 0, 0.25)',
  text: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.75)',
  inputBg: 'rgba(255, 255, 255, 0.08)',
  inputBorder: 'rgba(128, 128, 128, 0.4)',
  focusRing: 'rgba(255, 173, 0, 0.5)',
  primary: '#1E22AA',
  primaryHover: '#161A88',
};

export default function PdvLoginPage({ onEntrou }: { onEntrou: () => void }) {
  const { refreshUser } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [servidor, setServidor] = useState<boolean | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      pingServer().then(setServidor);
    }, 800);
    return () => window.clearTimeout(t);
  }, []);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    if (!usuario.trim() || !senha) {
      setErro('Informe usuário e senha.');
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      const data = await login(usuario.trim(), senha);
      if (!data.token) {
        setErro('Login ok, mas a sessão não foi aberta. Tente novamente.');
        return;
      }
      await refreshUser();
      onEntrou();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha no login.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: BRAND.bg }}>
      <form
        onSubmit={(e) => void entrar(e)}
        className="w-full max-w-sm rounded-2xl p-8 shadow-2xl"
        style={{ backgroundColor: BRAND.card, border: `1px solid ${BRAND.border}` }}
      >
        <div className="mb-6 flex flex-col items-center">
          <LogoSoAco className="mb-5 h-auto w-full max-w-[300px]" />
          <h1 className="text-2xl font-bold" style={{ color: BRAND.text }}>PDV</h1>
          <p className="mt-1 text-center text-sm" style={{ color: BRAND.textMuted }}>
            Entre com o usuário vinculado na configuração.
          </p>
        </div>
        <label className="mb-4 block text-sm" style={{ color: BRAND.textMuted }}>
          Usuário
          <input
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username"
            autoFocus
            className="mt-1 w-full rounded-lg px-3 py-2.5 outline-none"
            style={{ background: BRAND.inputBg, border: `1px solid ${BRAND.inputBorder}`, color: BRAND.text }}
          />
        </label>
        <label className="mb-6 block text-sm" style={{ color: BRAND.textMuted }}>
          Senha
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg px-3 py-2.5 outline-none"
            style={{ background: BRAND.inputBg, border: `1px solid ${BRAND.inputBorder}`, color: BRAND.text }}
          />
        </label>
        {servidor === false ? (
          <p className="mb-4 text-center text-sm text-amber-300">Servidor indisponível. Tente de novo em instantes.</p>
        ) : null}
        {erro ? <p className="mb-4 text-center text-sm text-amber-300">{erro}</p> : null}
        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-lg py-2.5 font-medium text-white disabled:opacity-50"
          style={{ background: BRAND.primary }}
        >
          {enviando ? 'Entrando…' : 'Entrar no PDV'}
        </button>
      </form>
    </div>
  );
}
