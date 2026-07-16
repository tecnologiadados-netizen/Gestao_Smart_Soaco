import { useNavigate } from "react-router-dom";
import { ShieldOff } from "lucide-react";
import { Button } from "@rh/components/ui/button";
import { logout } from "@rh/lib/auth";

/**
 * Evita loop de navegação quando o usuário está logado mas não tem permissão
 * (ou a sessão não bate mais com `rh_system_users`).
 */
const SemAcesso = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background px-6">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <ShieldOff className="h-7 w-7 text-destructive" />
      </div>
      <div className="max-w-md text-center space-y-2">
        <h1 className="text-xl font-semibold text-foreground">Acesso não autorizado</h1>
        <p className="text-sm text-muted-foreground">
          Sua sessão pode estar desatualizada ou seu usuário não tem permissão para esta área. Saia e entre
          novamente, ou peça ao administrador para revisar suas permissões.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        <Button
          type="button"
          variant="default"
          onClick={() => {
            logout();
            navigate("/", { replace: true });
          }}
        >
          Sair e voltar ao login
        </Button>
      </div>
    </div>
  );
};

export default SemAcesso;
