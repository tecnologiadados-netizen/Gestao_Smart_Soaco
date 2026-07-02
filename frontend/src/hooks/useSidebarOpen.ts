import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'sidebar_pinned';

function readPinned(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function useSidebarOpen() {
  const [pinned, setPinned] = useState(readPinned);
  const [open, setOpen] = useState(() => readPinned());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(pinned));
    } catch {
      // ignore quota / private mode
    }
  }, [pinned]);

  const expand = useCallback(() => setOpen(true), []);

  const collapse = useCallback(() => {
    setOpen((current) => (pinned ? current : false));
  }, [pinned]);

  const toggle = useCallback(() => {
    setPinned((prev) => {
      const next = !prev;
      setOpen(next);
      return next;
    });
  }, []);

  return { open, pinned, setOpen, expand, collapse, toggle };
}
