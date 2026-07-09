import { useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { UI_TRANSITION_MS } from '@qualidade/lib/motion';

export function useTransitionRouter() {
  const navigate = useNavigate();
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const push = useCallback((href: string, options?: { delay?: number; animateExit?: boolean }) => {
    const delay = options?.delay ?? UI_TRANSITION_MS;
    const animateExit = options?.animateExit ?? true;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (animateExit) setExiting(true);
    timerRef.current = setTimeout(() => {
      navigate(href.startsWith('/qualidade') ? href : `/qualidade${href.startsWith('/') ? href : `/${href}`}`);
      setExiting(false);
      timerRef.current = null;
    }, delay);
  }, [navigate]);

  return { push, exiting, navigate };
}
