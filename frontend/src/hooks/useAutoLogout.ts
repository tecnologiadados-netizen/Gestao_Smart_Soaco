import { useEffect, useRef } from 'react';
import {
  isSessaoInatividadeExpirada,
  msRestantesInatividade,
  touchLastActivity,
} from '../utils/sessaoInatividade';

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'mousemove'] as const;

/**
 * Desconecta o usuário após período de inatividade (minutos), se configurado no grupo.
 * Usa timestamp persistido para respeitar o limite mesmo após fechar o navegador ou reiniciar o PC.
 */
export function useAutoLogout(
  minutos: number | null | undefined,
  login: string | null | undefined,
  onLogout: () => void
): void {
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;
  const loggingOutRef = useRef(false);

  useEffect(() => {
    if (minutos == null || minutos < 1 || !login?.trim()) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    loggingOutRef.current = false;

    const logoutNow = () => {
      if (loggingOutRef.current) return;
      loggingOutRef.current = true;
      onLogoutRef.current();
    };

    const armTimer = (resetActivity: boolean) => {
      if (timer) clearTimeout(timer);
      if (resetActivity) touchLastActivity(login);
      if (isSessaoInatividadeExpirada(login, minutos)) {
        logoutNow();
        return;
      }
      timer = setTimeout(logoutNow, msRestantesInatividade(login, minutos));
    };

    const onActivity = () => {
      if (loggingOutRef.current) return;
      armTimer(true);
    };

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      armTimer(false);
    };

    if (isSessaoInatividadeExpirada(login, minutos)) {
      logoutNow();
      return;
    }

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true });
    }
    document.addEventListener('visibilitychange', onVisible);

    armTimer(false);

    return () => {
      if (timer) clearTimeout(timer);
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onActivity);
      }
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [minutos, login]);
}
