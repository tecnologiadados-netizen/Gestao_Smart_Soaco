import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  isAuthenticated,
  isRhSessionInactive,
  logout,
  touchRhSessionActivity,
} from "@rh/lib/auth";
import { toast } from "sonner";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "click"] as const;
const CHECK_INTERVAL_MS = 60_000;

/**
 * Encerra a sessão após 1h sem interação e redireciona para o login.
 */
export function useRhSessionInactivity(): void {
  const enabled = isAuthenticated();
  const navigate = useNavigate();
  const lastTouchRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const bumpActivity = () => {
      const now = Date.now();
      if (now - lastTouchRef.current < 15_000) return;
      lastTouchRef.current = now;
      touchRhSessionActivity();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (isRhSessionInactive()) {
          logout();
          toast.info("Sessão encerrada por inatividade. Informe sua senha para continuar.");
          navigate("/", { replace: true });
          return;
        }
        bumpActivity();
      }
    };

    const checkIdle = () => {
      if (isRhSessionInactive()) {
        logout();
        toast.info("Sessão encerrada por inatividade. Informe sua senha para continuar.");
        navigate("/", { replace: true });
      }
    };

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, bumpActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    const intervalId = window.setInterval(checkIdle, CHECK_INTERVAL_MS);

    return () => {
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, bumpActivity);
      }
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(intervalId);
    };
  }, [enabled, navigate]);
}
