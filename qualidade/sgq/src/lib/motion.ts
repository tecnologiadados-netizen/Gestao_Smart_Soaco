/** Duração padrão das transições visuais do SGQ (ms). */
export const UI_TRANSITION_MS = 220

export const UI_TRANSITION_EXIT_MS = 180

export function afterUiTransition(
  callback: () => void,
  delay = UI_TRANSITION_MS
) {
  window.setTimeout(callback, delay)
}
