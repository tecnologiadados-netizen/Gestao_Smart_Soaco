/** Ajusta altura do textarea conforme o conteúdo, até um teto (com scroll depois). */
export function fitTextareaHeight(ta: HTMLTextAreaElement, maxHeight: number): void {
  ta.style.height = '0';
  const h = Math.min(Math.max(ta.scrollHeight, 1), maxHeight);
  ta.style.height = `${h}px`;
  ta.style.overflowY = ta.scrollHeight > maxHeight ? 'auto' : 'hidden';
}
