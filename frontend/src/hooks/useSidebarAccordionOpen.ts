import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'sidebar_accordion_open';

function readOpenKeys(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

export function useSidebarAccordionOpen() {
  const [accordionOpen, setAccordionOpen] = useState<Set<string>>(readOpenKeys);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...accordionOpen]));
    } catch {
      // ignore quota / private mode
    }
  }, [accordionOpen]);

  const toggleAccordion = useCallback((key: string) => {
    setAccordionOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return { accordionOpen, toggleAccordion };
}
