/** Fila global — Word COM não suporta conversões paralelas entre módulos. */
let pdfQueue: Promise<unknown> = Promise.resolve();

export function enfileirarPdfWord<T>(fn: () => Promise<T>): Promise<T> {
  const task = pdfQueue.then(fn, fn);
  pdfQueue = task.catch(() => {});
  return task;
}
