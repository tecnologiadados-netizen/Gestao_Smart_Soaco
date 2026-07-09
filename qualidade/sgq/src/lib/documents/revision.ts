export const INITIAL_REVISION = "00";

export function formatRevision(value: string | number): string {
  const num = typeof value === "string" ? parseInt(value, 10) : value;
  if (Number.isNaN(num) || num < 0) return INITIAL_REVISION;
  return String(num).padStart(2, "0");
}

export function getNextRevision(existingRevisions: string[]): string {
  let maxNum = -1;

  for (const revision of existingRevisions) {
    const num = parseInt(revision, 10);
    if (!Number.isNaN(num) && num > maxNum) maxNum = num;
  }

  return formatRevision(maxNum + 1);
}

export function isInitialRevision(revision: string): boolean {
  return formatRevision(revision) === INITIAL_REVISION;
}
