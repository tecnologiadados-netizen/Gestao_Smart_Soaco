import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import {
  hasStoredRhSession,
  isRhSessionInactive,
  logout,
  MASTER_USER,
  setSessionFromApiLogin,
  setSessionFromMockLogin,
} from "@rh/lib/auth";
import { getGroupPermissionsByGroupId, validateUser } from "@rh/lib/config";
import { getDefaultPostLoginPath } from "@rh/lib/route-permissions";
import { useLogo } from "@rh/hooks/useLogo";
import { APP_DISPLAY_NAME } from "@rh/lib/app-brand";
import logoOrganico from "@rh/assets/logo-organico.svg";
import { isApiConfigured, rhLogin } from "@rh/lib/api-client";

const Login = () => {
  const navigate = useNavigate();
  const { logo: customLogo } = useLogo();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  /** Remove tokens antigos sem atividade (evita conflito com o watcher de inatividade). */
  useEffect(() => {
    if (hasStoredRhSession() && isRhSessionInactive()) {
      logout();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const u = username.trim();
      if (isApiConfigured()) {
        const result = await rhLogin(u, password);
        setSessionFromApiLogin(result);
      } else {
        if (u === MASTER_USER) {
          setError("Login master exige API configurada (RH_MASTER_PASSWORD no Supabase Secrets).");
          return;
        }
        const systemUser = validateUser(u, password);
        if (!systemUser) {
          setError("Usuário ou senha incorretos. Tente novamente.");
          return;
        }
        setSessionFromMockLogin(systemUser.username, getGroupPermissionsByGroupId(systemUser.groupId));
      }
      navigate(getDefaultPostLoginPath(), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Usuário ou senha incorretos. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-primary relative overflow-hidden">
      {/* Geometric background pattern */}
      <div className="absolute inset-0 opacity-10">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Accent geometric shapes */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-accent/10 rotate-45 translate-x-48 -translate-y-48" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary-vibrant/20 rotate-12 -translate-x-32 translate-y-32" />

      {/* Left branding panel */}
      <div className="hidden lg:flex flex-1 flex-col justify-center px-20 relative z-10">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.19, 1, 0.22, 1] }}
        >
          <div className="flex items-center gap-5 mb-10 p-5 rounded-xl bg-primary-foreground/5 border border-primary-foreground/10">
            <div className={`w-16 h-16 flex items-center justify-center overflow-hidden rounded-lg shrink-0 ${customLogo ? "bg-transparent p-1" : "bg-accent"}`}>
              {customLogo ? (
                <img src={customLogo} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <img src={logoOrganico} alt="Logo Orgânico" className="w-full h-full object-contain p-0.5" />
              )}
            </div>
            <div>
              <h2 className="text-primary-foreground text-lg font-bold tracking-tight">{APP_DISPLAY_NAME}</h2>
              <span className="text-primary-foreground/40 text-[10px] uppercase tracking-[0.2em] font-bold">Plataforma Estratégica</span>
            </div>
          </div>

          <h1 className="text-primary-foreground text-4xl font-bold tracking-tight leading-tight max-w-lg">
            Gestão inteligente de pessoas começa aqui
          </h1>
          <p className="text-primary-foreground/50 mt-4 text-lg max-w-md">
            Plataforma estratégica de gestão de capital humano para tomada de decisões em tempo real.
          </p>
        </motion.div>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.19, 1, 0.22, 1] }}
          className="w-full max-w-md bg-card border-t-4 border-accent shadow-level-3 p-10"
        >
          <header className="mb-8">
            <div className="lg:hidden flex items-center gap-4 mb-6 p-4 rounded-lg bg-muted/30">
              <div className={`w-12 h-12 flex items-center justify-center overflow-hidden rounded-lg shrink-0 ${customLogo ? "bg-transparent p-1" : "bg-accent"}`}>
                {customLogo ? (
                  <img src={customLogo} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <img src={logoOrganico} alt="Logo Orgânico" className="w-full h-full object-contain p-0.5" />
                )}
              </div>
              <span className="text-foreground font-bold tracking-tight">{APP_DISPLAY_NAME}</span>
            </div>
            <h1 className="text-foreground text-2xl font-bold tracking-tight">Acesso ao Sistema</h1>
          </header>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 py-2 px-3">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label className="label-industrial">Usuário</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border-b-2 border-border focus:border-primary-vibrant py-3 outline-none transition-colors duration-200 bg-transparent text-foreground placeholder:text-muted-foreground/50"
                placeholder="Digite seu usuário"
                required
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <label className="label-industrial">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border-b-2 border-border focus:border-primary-vibrant py-3 pr-10 outline-none transition-colors duration-200 bg-transparent text-foreground placeholder:text-muted-foreground/50"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary-vibrant text-primary-foreground font-bold py-4 transition-all duration-200 active:scale-[0.98] disabled:opacity-70 text-sm uppercase tracking-wider"
            >
              {isLoading ? "AUTENTICANDO..." : "AUTENTICAR"}
            </button>

            <div className="text-center">
              <button
                type="button"
                className="text-muted-foreground hover:text-primary-vibrant text-xs transition-colors"
              >
                Esqueci minha senha
              </button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider text-center">
              Sistema protegido • Acesso autorizado apenas
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
