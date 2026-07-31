import { useCallback, useState } from 'react';

const STORAGE_KEY = 'sidebar_accordion_open';

/**
 * Accordion da sidebar: sempre começa recolhido ao abrir o sistema.
 * Expansões valem só na sessão atual (não persistem no localStorage).
 */
export function useSidebarAccordionOpen() {
  const [accordionOpen, setAccordionOpen] = useState<Set<string>>(() => {
    // Limpa estado antigo gravado em versões anteriores.
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    return new Set();
  });

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
